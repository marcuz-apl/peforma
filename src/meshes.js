// Peforma 3D — triangulated surface and geobody exchange for the tier-1 open
// formats. Vertex order, face order, connectivity, groups, and normals are
// preserved. Closure and normal consistency are reported, never repaired.

export const MESH_SOURCE_LABELS = {
  'stl-ascii': 'STL (ASCII)',
  'stl-binary': 'STL (binary)',
  obj: 'Wavefront OBJ',
  'ply-ascii': 'PLY (ASCII)',
  'ply-binary': 'PLY (binary little-endian)',
  tsurf: 'GOCAD TSurf',
};

export const MESH_TARGETS = {
  'stl-ascii': 'STL (ASCII)',
  'stl-binary': 'STL (binary)',
  obj: 'Wavefront OBJ',
  'ply-ascii': 'PLY (ASCII)',
  'ply-binary': 'PLY (binary little-endian)',
  tsurf: 'GOCAD TSurf',
};

export const MESH_EXTENSIONS = {
  'stl-ascii': 'stl',
  'stl-binary': 'stl',
  obj: 'obj',
  'ply-ascii': 'ply',
  'ply-binary': 'ply',
  tsurf: 'ts',
};

export const MAX_MESH_BYTES = 64 * 1024 * 1024;
export const PREVIEW_FACE_LIMIT = 20000;

const HEAD_SCAN = 262144;
const FLOAT32 = new Float32Array(1);

function decodeText(bytes, length = bytes.byteLength) {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, Math.min(length, bytes.byteLength)));
}

function headText(bytes) {
  return decodeText(bytes, HEAD_SCAN).replace(/^\uFEFF/, '');
}

function firstRecord(text) {
  return text.split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('#')) || '';
}

export function detectMeshFormat(bytes) {
  const head = headText(bytes);
  const firstLine = (head.split(/\r?\n/, 1)[0] || '').trim();

  if (firstLine === 'ply') {
    const format = /^format\s+(\S+)\s+(\S+)\s*$/m.exec(head);
    if (!format) throw Error('This PLY header has no format line.');
    if (format[1] === 'ascii') return 'ply-ascii';
    if (format[1] === 'binary_little_endian') return 'ply-binary';
    if (format[1] === 'binary_big_endian') {
      throw Error(`This PLY declares binary_big_endian ${format[2]}; Peforma 3D reads little-endian binary PLY only.`);
    }
    throw Error(`This PLY declares an unknown format, "${format[1]} ${format[2]}".`);
  }

  const first = firstRecord(head);
  if (/^GOCAD\s+/i.test(first)) {
    const type = first.split(/\s+/)[1] || '';
    if (/^TSurf$/i.test(type)) return 'tsurf';
    if (/^TSolid$/i.test(type)) {
      throw Error('This is a GOCAD TSolid. Tetrahedral solids arrive in tier 2; Peforma 3D reads GOCAD TSurf today.');
    }
    if (/^(PLINE|VSet)$/i.test(type)) {
      throw Error(`This is GOCAD ${type}; open lines and points belong to Peforma Culture Lines/Points.`);
    }
    throw Error(`GOCAD ${type || 'file'} is not a supported mesh type. Peforma 3D reads GOCAD TSurf.`);
  }

  if (bytes.byteLength >= 84) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint32(80, true);
    const expected = 84 + 50 * count;
    if (bytes.byteLength === expected) return 'stl-binary';
    // A length within one record of the declaration is a truncated or padded
    // binary STL, not an unknown file; report the mismatch rather than hide it.
    if (count > 0 && Math.abs(expected - bytes.byteLength) < 50) {
      throw Error(`Binary STL declares ${count} triangles, which needs ${expected} bytes, but the file is ${bytes.byteLength} bytes.`);
    }
  }

  if (/^\s*solid\b/i.test(head) && /facet\s+normal/i.test(head) && /endfacet/i.test(head)) return 'stl-ascii';
  if (/^\s*v\s+\S+\s+\S+\s+\S+/m.test(head) && /^\s*f\s+\S+/m.test(head)) return 'obj';

  throw Error('Unrecognised mesh file. Peforma 3D reads STL, OBJ, PLY, and GOCAD TSurf.');
}

export function loadMeshFile(bytes, fileName) {
  if (!bytes || bytes.byteLength === 0) throw Error('This file is empty.');
  if (bytes.byteLength > MAX_MESH_BYTES) {
    throw Error(`${fileName} is ${(bytes.byteLength / 1048576).toFixed(1)} MB; Peforma 3D reads mesh files up to 64 MB.`);
  }
  const format = detectMeshFormat(bytes);
  if (format === 'stl-ascii') return parseStlAscii(bytes, fileName);
  if (format === 'stl-binary') return parseStlBinary(bytes, fileName);
  if (format === 'obj') return parseObj(bytes, fileName);
  if (format === 'ply-ascii' || format === 'ply-binary') return parsePly(bytes, fileName, format);
  return parseTsurf(bytes, fileName);
}

function makeModel(fileName, format) {
  return {
    fileName,
    format,
    name: null,
    positions: new Float64Array(0),
    faces: new Uint32Array(0),
    faceNormals: null,
    vertexNormals: null,
    faceGroups: null,
    groups: [],
    crs: null,
    units: null,
    warnings: [],
  };
}

function num(value) {
  return value === 0 ? '0' : String(value);
}

function outputFileName(model, target) {
  const base = model.fileName.replace(/\.[^.]+$/, '') || 'peforma';
  return `${base}.${MESH_EXTENSIONS[target]}`;
}

// ---------------------------------------------------------------------------
// STL

function parseStlAscii(bytes, fileName) {
  const lines = decodeText(bytes).replace(/^\uFEFF/, '').split(/\r?\n/);
  const positions = [];
  const faces = [];
  const normals = [];
  const model = makeModel(fileName, 'stl-ascii');
  let facetIndex = 0;
  let facetNormal = null;
  let facetVertices = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const solid = /^solid\b(.*)$/i.exec(line);
    if (solid) {
      if (!model.name) model.name = solid[1].trim() || null;
      continue;
    }

    const facet = /^facet\s+normal\s+(\S+)\s+(\S+)\s+(\S+)$/i.exec(line);
    if (facet) {
      facetIndex++;
      facetNormal = facet.slice(1).map(Number);
      if (!facetNormal.every(Number.isFinite)) throw Error(`STL facet ${facetIndex} has a non-numeric normal.`);
      facetVertices = 0;
      continue;
    }

    const vertex = /^vertex\s+(\S+)\s+(\S+)\s+(\S+)$/i.exec(line);
    if (vertex) {
      if (!facetNormal) throw Error(`STL vertex on line ${i + 1} appears before any facet.`);
      const xyz = vertex.slice(1).map(Number);
      if (!xyz.every(Number.isFinite)) throw Error(`STL facet ${facetIndex} has a non-numeric vertex.`);
      positions.push(...xyz);
      facetVertices++;
      continue;
    }

    if (/^endfacet\b/i.test(line)) {
      if (!facetNormal) throw Error(`STL endfacet on line ${i + 1} has no matching facet.`);
      if (facetVertices !== 3) throw Error(`STL facet ${facetIndex} has ${facetVertices} vertices; a facet needs 3.`);
      const base = faces.length;
      faces.push(base, base + 1, base + 2);
      normals.push(...facetNormal);
      facetNormal = null;
      continue;
    }
  }

  if (facetNormal) throw Error(`STL facet ${facetIndex} has ${facetVertices} vertices; a facet needs 3.`);
  if (facetIndex === 0 || faces.length === 0) throw Error('No STL facets were found.');

  model.positions = new Float64Array(positions);
  model.faces = new Uint32Array(faces);
  model.faceNormals = new Float64Array(normals);
  return model;
}

function binaryStlName(bytes) {
  let end = 0;
  while (end < 80 && bytes[end] !== 0) end++;
  const text = decodeText(bytes.subarray(0, end), end).trim();
  if (!text || /[^\x20-\x7e\t]/.test(text)) return null;
  return text;
}

function parseStlBinary(bytes, fileName) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  const expected = 84 + 50 * count;
  if (bytes.byteLength !== expected) {
    throw Error(`Binary STL declares ${count} triangles, which needs ${expected} bytes, but the file is ${bytes.byteLength} bytes.`);
  }
  if (count === 0) throw Error('This binary STL has no triangles.');

  const model = makeModel(fileName, 'stl-binary');
  model.name = binaryStlName(bytes);
  model.positions = new Float64Array(count * 9);
  model.faces = new Uint32Array(count * 3);
  model.faceNormals = new Float64Array(count * 3);
  let attributeRecords = 0;

  for (let t = 0; t < count; t++) {
    const record = 84 + t * 50;
    model.faceNormals[t * 3] = view.getFloat32(record, true);
    model.faceNormals[t * 3 + 1] = view.getFloat32(record + 4, true);
    model.faceNormals[t * 3 + 2] = view.getFloat32(record + 8, true);
    for (let v = 0; v < 3; v++) {
      const at = record + 12 + v * 12;
      const out = (t * 3 + v) * 3;
      model.positions[out] = view.getFloat32(at, true);
      model.positions[out + 1] = view.getFloat32(at + 4, true);
      model.positions[out + 2] = view.getFloat32(at + 8, true);
      model.faces[t * 3 + v] = t * 3 + v;
    }
    if (view.getUint16(record + 48, true) !== 0) attributeRecords++;
  }

  if (attributeRecords) {
    model.warnings.push(`The binary STL attribute byte count is non-zero on ${attributeRecords} facet${attributeRecords === 1 ? '' : 's'}; those values are not carried.`);
  }
  return model;
}

function stlWarnings(model) {
  const warnings = [];
  if (model.groups.length) {
    warnings.push(`STL does not carry groups; ${model.groups.length} group name${model.groups.length === 1 ? '' : 's'} were not written.`);
  }
  if (model.vertexNormals) warnings.push('STL does not carry vertex normals; the stored vertex normals were not written.');
  if (model.crs) warnings.push('STL does not carry a CRS; the declared CRS text was not written.');
  if (model.units) warnings.push('STL does not carry units; the declared units text was not written.');
  return warnings;
}

function stlSolidName(model) {
  return model.name || 'Peforma 3D mesh';
}

function writeStlAscii(model) {
  const name = stlSolidName(model);
  const out = [`solid ${name}`];
  for (let f = 0; f < model.faces.length; f += 3) {
    const normal = model.faceNormals
      ? [model.faceNormals[f], model.faceNormals[f + 1], model.faceNormals[f + 2]]
      : [0, 0, 0];
    out.push(`  facet normal ${normal.map(num).join(' ')}`);
    out.push('    outer loop');
    for (let k = 0; k < 3; k++) {
      const at = model.faces[f + k] * 3;
      out.push(`      vertex ${num(model.positions[at])} ${num(model.positions[at + 1])} ${num(model.positions[at + 2])}`);
    }
    out.push('    endloop');
    out.push('  endfacet');
  }
  out.push(`endsolid ${name}`);
  return {
    text: out.join('\n') + '\n',
    warnings: stlWarnings(model),
    fileName: outputFileName(model, 'stl-ascii'),
    mime: 'model/stl',
  };
}

function roundFloat32(value) {
  FLOAT32[0] = value;
  return FLOAT32[0];
}

function writeStlBinary(model) {
  const faceCount = model.faces.length / 3;
  const bytes = new ArrayBuffer(84 + 50 * faceCount);
  new Uint8Array(bytes, 0, 80).fill(0x20);
  const header = new TextEncoder().encode(stlSolidName(model)).subarray(0, 80);
  new Uint8Array(bytes, 0, header.length).set(header);
  const view = new DataView(bytes);
  view.setUint32(80, faceCount, true);

  let rounded = 0;
  const put = (offset, value) => {
    if (roundFloat32(value) !== value) rounded++;
    view.setFloat32(offset, value, true);
  };

  for (let f = 0; f < faceCount; f++) {
    const base = f * 3;
    const record = 84 + f * 50;
    for (let c = 0; c < 3; c++) {
      put(record + c * 4, model.faceNormals ? model.faceNormals[base + c] : 0);
    }
    for (let k = 0; k < 3; k++) {
      const at = model.faces[base + k] * 3;
      for (let c = 0; c < 3; c++) put(record + 12 + k * 12 + c * 4, model.positions[at + c]);
    }
    view.setUint16(record + 48, 0, true);
  }

  const warnings = stlWarnings(model);
  if (rounded) {
    warnings.push(`Binary STL stores 32-bit floats; ${rounded.toLocaleString()} coordinate or normal value${rounded === 1 ? '' : 's'} not exactly representable were rounded.`);
  }
  return {
    bytes,
    warnings,
    fileName: outputFileName(model, 'stl-binary'),
    mime: 'model/stl',
  };
}

// ---------------------------------------------------------------------------
// Summary

export function summarizeMesh(model) {
  const vertexCount = model.positions.length / 3;
  const faceCount = model.faces.length / 3;
  const usePositions = model.format === 'stl-ascii' || model.format === 'stl-binary';

  const bounds = vertexCount
    ? { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
    : null;
  if (bounds) {
    for (let i = 0; i < model.positions.length; i += 3) {
      for (let c = 0; c < 3; c++) {
        const value = model.positions[i + c];
        if (value < bounds.min[c]) bounds.min[c] = value;
        if (value > bounds.max[c]) bounds.max[c] = value;
      }
    }
  }

  const tokens = new Map();
  const positionToken = index => {
    if (!tokens.has(index)) {
      const at = index * 3;
      tokens.set(index, `${num(model.positions[at])},${num(model.positions[at + 1])},${num(model.positions[at + 2])}`);
    }
    return tokens.get(index);
  };
  const endpoint = index => (usePositions ? positionToken(index) : `#${index}`);

  const edges = new Map();
  let degenerateFaces = 0;

  for (let f = 0; f < model.faces.length; f += 3) {
    const a = model.faces[f];
    const b = model.faces[f + 1];
    const c = model.faces[f + 2];
    if (a === b || b === c || a === c
      || positionToken(a) === positionToken(b)
      || positionToken(b) === positionToken(c)
      || positionToken(a) === positionToken(c)) {
      degenerateFaces++;
      continue;
    }
    const corners = [endpoint(a), endpoint(b), endpoint(c)];
    for (let k = 0; k < 3; k++) {
      const from = corners[k];
      const to = corners[(k + 1) % 3];
      const key = from < to ? `${from}|${to}` : `${to}|${from}`;
      let edge = edges.get(key);
      if (!edge) {
        edge = { count: 0, forward: 0, backward: 0 };
        edges.set(key, edge);
      }
      edge.count++;
      if (from < to) edge.forward++;
      else edge.backward++;
    }
  }

  let openEdges = 0;
  let nonManifoldEdges = 0;
  let inconsistentEdges = 0;
  let sharedEdges = 0;
  for (const edge of edges.values()) {
    if (edge.count === 1) openEdges++;
    else if (edge.count > 2) nonManifoldEdges++;
    else {
      sharedEdges++;
      if (edge.forward === 2 || edge.backward === 2) inconsistentEdges++;
    }
  }

  const hasNormals = !!(model.faceNormals || model.vertexNormals);
  const normalState = !hasNormals
    ? 'none'
    : sharedEdges === 0
      ? 'undetermined'
      : inconsistentEdges === 0 ? 'consistent' : 'inconsistent';

  return {
    vertexCount,
    faceCount,
    groupCount: model.groups.length,
    groupNames: model.groups.map(group => group.name),
    bounds,
    closed: faceCount > 0 && openEdges === 0 && nonManifoldEdges === 0 && degenerateFaces === 0,
    openEdges,
    nonManifoldEdges,
    closureMethod: usePositions ? 'exact positions' : 'indices',
    normalState,
    inconsistentEdges,
    degenerateFaces,
    hasFaceNormals: !!model.faceNormals,
    hasVertexNormals: !!model.vertexNormals,
    crs: model.crs,
    units: model.units,
  };
}

// ---------------------------------------------------------------------------
// Writers

export function writeMesh(model, target) {
  if (target === 'stl-ascii') return writeStlAscii(model);
  if (target === 'stl-binary') return writeStlBinary(model);
  if (target === 'obj') return writeObj(model);
  if (target === 'ply-ascii' || target === 'ply-binary') return writePly(model, target);
  throw Error(`Peforma 3D cannot write ${MESH_TARGETS[target] || target} yet.`);
}

// ---------------------------------------------------------------------------
// Wavefront OBJ

function resolveObjIndex(raw, count, faceNumber, kind) {
  const index = Number(raw);
  if (!Number.isInteger(index) || index === 0) {
    throw Error(`Face ${faceNumber} has an invalid ${kind} index "${raw}".`);
  }
  const resolved = index > 0 ? index - 1 : count + index;
  if (resolved < 0 || resolved >= count) {
    throw Error(`Face ${faceNumber} references ${kind} ${index}, but ${count} are defined.`);
  }
  return resolved;
}

function parseObj(bytes, fileName) {
  const lines = decodeText(bytes).replace(/^\uFEFF/, '').split(/\r?\n/);
  const positions = [];
  const normals = [];
  const vertexNormal = [];
  const faces = [];
  const faceGroups = [];
  const groups = [];
  const groupIds = new Map();
  const ignored = new Map();
  let currentGroup = -1;
  let name = null;
  let extraComponents = 0;
  let anyNormalFace = false;
  let anyPlainFace = false;

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber].trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const tag = parts[0];

    if (tag === 'v') {
      if (parts.length < 4) throw Error(`OBJ vertex on line ${lineNumber + 1} has ${parts.length - 1} coordinates; three are required.`);
      const xyz = parts.slice(1, 4).map(Number);
      if (!xyz.every(Number.isFinite)) throw Error(`OBJ vertex on line ${lineNumber + 1} is not numeric.`);
      positions.push(...xyz);
      if (parts.length > 4) extraComponents++;
      continue;
    }

    if (tag === 'vn') {
      if (parts.length < 4) throw Error(`OBJ normal on line ${lineNumber + 1} has ${parts.length - 1} components; three are required.`);
      const xyz = parts.slice(1, 4).map(Number);
      if (!xyz.every(Number.isFinite)) throw Error(`OBJ normal on line ${lineNumber + 1} is not numeric.`);
      normals.push(...xyz);
      continue;
    }

    if (tag === 'o') {
      const label = parts.slice(1).join(' ').trim();
      if (!name && label) name = label;
      continue;
    }

    if (tag === 'g') {
      const label = parts.slice(1).join(' ').trim();
      if (!label) {
        currentGroup = -1;
      } else if (!groupIds.has(label)) {
        const id = groups.length;
        groupIds.set(label, id);
        groups.push({ id, name: label, faceCount: 0 });
        currentGroup = id;
      } else {
        currentGroup = groupIds.get(label);
      }
      continue;
    }

    if (tag === 'f') {
      const faceNumber = faces.length / 3 + 1;
      const tokens = parts.slice(1);
      if (tokens.length !== 3) {
        throw Error(`Face ${faceNumber} has ${tokens.length} vertices; Peforma 3D reads triangular meshes only.`);
      }
      const references = tokens.map(token => {
        const fields = token.split('/');
        if (!fields[0]) throw Error(`Face ${faceNumber} has no vertex index in "${token}".`);
        return {
          vertex: resolveObjIndex(fields[0], positions.length / 3, faceNumber, 'vertex'),
          normal: fields[2] ? resolveObjIndex(fields[2], normals.length / 3, faceNumber, 'normal') : null,
        };
      });
      const withNormal = references.filter(reference => reference.normal !== null).length;
      if (withNormal !== 0 && withNormal !== 3) {
        throw Error(`Face ${faceNumber} mixes vertex-normal references with tokens that have no normal; all three must agree.`);
      }
      if (withNormal) anyNormalFace = true;
      else anyPlainFace = true;

      references.forEach(reference => {
        faces.push(reference.vertex);
        if (reference.normal === null) return;
        const at = reference.normal * 3;
        const out = reference.vertex * 3;
        if (Number.isFinite(vertexNormal[out])
          && (vertexNormal[out] !== normals[at]
            || vertexNormal[out + 1] !== normals[at + 1]
            || vertexNormal[out + 2] !== normals[at + 2])) {
          throw Error(`Face ${faceNumber} assigns vertex ${reference.vertex + 1} a different normal from the one used earlier.`);
        }
        vertexNormal[out] = normals[at];
        vertexNormal[out + 1] = normals[at + 1];
        vertexNormal[out + 2] = normals[at + 2];
      });
      faceGroups.push(currentGroup);
      if (currentGroup >= 0) groups[currentGroup].faceCount++;
      continue;
    }

    ignored.set(tag, (ignored.get(tag) || 0) + 1);
  }

  if (faces.length === 0) throw Error('This OBJ has no triangular faces.');

  const model = makeModel(fileName, 'obj');
  model.name = name;
  model.positions = new Float64Array(positions);
  model.faces = new Uint32Array(faces);
  model.faceGroups = new Int32Array(faceGroups);
  model.groups = groups;

  if (anyNormalFace) {
    const complete = new Float64Array((positions.length / 3) * 3).fill(NaN);
    complete.set(vertexNormal);
    model.vertexNormals = complete;
  }

  if (extraComponents) {
    model.warnings.push(`${extraComponents} OBJ vertex${extraComponents === 1 ? '' : 's'} carry more than three coordinates; values beyond Z are not carried.`);
  }
  if (anyNormalFace && anyPlainFace) {
    model.warnings.push('Some OBJ faces carry vertex normals and others do not; the writer keeps that distinction per face.');
  }
  if (ignored.size) {
    const summary = [...ignored.entries()].map(([tag, count]) => `${tag} × ${count}`).join(', ');
    model.warnings.push(`OBJ records not carried: ${summary}.`);
  }
  return model;
}

function objWarnings(model) {
  const warnings = [];
  if (model.faceNormals) warnings.push('OBJ does not carry face normals; the stored facet normals were not written.');
  if (model.crs) warnings.push('OBJ does not carry a CRS; the declared CRS text was not written.');
  if (model.units) warnings.push('OBJ does not carry units; the declared units text was not written.');
  return warnings;
}

function writeObj(model) {
  const out = ['# Created by Peforma 3D'];
  const vertexCount = model.positions.length / 3;

  for (let v = 0; v < vertexCount; v++) {
    const at = v * 3;
    out.push(`v ${num(model.positions[at])} ${num(model.positions[at + 1])} ${num(model.positions[at + 2])}`);
  }

  const normalIndex = new Map();
  if (model.vertexNormals) {
    for (let v = 0; v < vertexCount; v++) {
      const at = v * 3;
      if (!Number.isFinite(model.vertexNormals[at])) continue;
      normalIndex.set(v, normalIndex.size + 1);
      out.push(`vn ${num(model.vertexNormals[at])} ${num(model.vertexNormals[at + 1])} ${num(model.vertexNormals[at + 2])}`);
    }
  }

  let currentGroup = null;
  for (let f = 0; f < model.faces.length; f += 3) {
    if (model.faceGroups) {
      const group = model.faceGroups[f / 3];
      if (group !== currentGroup) {
        currentGroup = group;
        out.push(group >= 0 ? `g ${model.groups[group].name}` : 'g');
      }
    }
    const tokens = [0, 1, 2].map(k => {
      const vertex = model.faces[f + k];
      const normal = normalIndex.get(vertex);
      return normal ? `${vertex + 1}//${normal}` : String(vertex + 1);
    });
    out.push(`f ${tokens.join(' ')}`);
  }

  return {
    text: out.join('\n') + '\n',
    warnings: objWarnings(model),
    fileName: outputFileName(model, 'obj'),
    mime: 'text/plain',
  };
}

// ---------------------------------------------------------------------------
// PLY

const PLY_TYPES = {
  char: { size: 1, get: 'getInt8' },
  uchar: { size: 1, get: 'getUint8' },
  short: { size: 2, get: 'getInt16' },
  ushort: { size: 2, get: 'getUint16' },
  int: { size: 4, get: 'getInt32' },
  uint: { size: 4, get: 'getUint32' },
  float: { size: 4, get: 'getFloat32' },
  double: { size: 8, get: 'getFloat64' },
};
const PLY_INTEGERS = new Set(['char', 'uchar', 'short', 'ushort', 'int', 'uint']);
const PLY_KNOWN_VERTEX = new Set(['x', 'y', 'z', 'nx', 'ny', 'nz']);
const PLY_TEXTURE = new Set(['u', 'v', 's', 't']);

function plyHeader(bytes) {
  const scan = decodeText(bytes, Math.min(bytes.byteLength, HEAD_SCAN));
  const marker = scan.indexOf('end_header');
  if (marker < 0) throw Error('This PLY header has no end_header line.');
  const newline = scan.indexOf('\n', marker);
  const dataOffset = newline < 0 ? bytes.byteLength : new TextEncoder().encode(scan.slice(0, newline + 1)).byteLength;

  const elements = [];
  let current = null;
  for (const raw of scan.slice(0, marker).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === 'ply' || parts[0] === 'comment' || parts[0] === 'obj_info') continue;
    if (parts[0] === 'format') continue;
    if (parts[0] === 'element') {
      const count = Number(parts[2]);
      if (!Number.isInteger(count) || count < 0) throw Error(`PLY element "${parts[1]}" has an invalid count.`);
      current = { name: parts[1], count, properties: [] };
      elements.push(current);
      continue;
    }
    if (parts[0] === 'property') {
      if (!current) throw Error('PLY property appears before any element.');
      if (parts[1] === 'list') {
        if (parts.length < 5) throw Error(`PLY list property on line "${line}" is incomplete.`);
        current.properties.push({ name: parts[4], type: 'list', countType: parts[2], itemType: parts[3] });
      } else {
        if (parts.length < 3) throw Error(`PLY property on line "${line}" is incomplete.`);
        current.properties.push({ name: parts[2], type: parts[1] });
      }
      continue;
    }
    throw Error(`PLY header record "${line}" is not supported.`);
  }
  return { elements, dataOffset };
}

function parsePly(bytes, fileName, format) {
  const { elements, dataOffset } = plyHeader(bytes);
  const ascii = format === 'ply-ascii';
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tokens = ascii ? decodeText(bytes.subarray(dataOffset), bytes.byteLength - dataOffset).split(/\s+/).filter(Boolean) : null;
  let tokenIndex = 0;
  let offset = dataOffset;

  const readValue = type => {
    const info = PLY_TYPES[type];
    if (!info) throw Error(`PLY property type "${type}" is not supported.`);
    if (ascii) {
      if (tokenIndex >= tokens.length) throw Error('PLY data ended before every declared element was read.');
      const token = tokens[tokenIndex++];
      const value = Number(token);
      if (!Number.isFinite(value)) throw Error(`PLY value "${token}" is not numeric.`);
      return value;
    }
    if (offset + info.size > bytes.byteLength) throw Error('PLY data ended before every declared element was read.');
    const value = view[info.get](offset, true);
    offset += info.size;
    return value;
  };

  const readRecord = properties => {
    const record = {};
    for (const property of properties) {
      if (property.type === 'list') {
        const count = readValue(property.countType);
        if (!Number.isInteger(count) || count < 0) throw Error(`PLY list "${property.name}" has an invalid length.`);
        const values = [];
        for (let i = 0; i < count; i++) values.push(readValue(property.itemType));
        record[property.name] = values;
      } else {
        record[property.name] = readValue(property.type);
      }
    }
    return record;
  };

  const vertexElement = elements.find(element => element.name === 'vertex');
  if (!vertexElement) throw Error('This PLY has no vertex element.');
  for (const axis of ['x', 'y', 'z']) {
    const property = vertexElement.properties.find(candidate => candidate.name === axis);
    if (!property || property.type === 'list') throw Error(`PLY vertex element has no single-valued ${axis} property.`);
  }
  const normalProperties = ['nx', 'ny', 'nz'].map(axis => vertexElement.properties.find(property => property.name === axis));
  const hasNormals = normalProperties.every(Boolean);
  if (!hasNormals && normalProperties.some(Boolean)) throw Error('PLY vertex properties include only some of nx, ny, nz.');

  const faceElement = elements.find(element => element.name === 'face');
  if (!faceElement) throw Error('This PLY has no face element.');
  const indexProperty = faceElement.properties.find(property => property.type === 'list'
    && (property.name === 'vertex_indices' || property.name === 'vertex_index'));
  if (!indexProperty) throw Error('PLY face element has no vertex_indices list property.');
  if (!PLY_INTEGERS.has(indexProperty.countType) || !PLY_INTEGERS.has(indexProperty.itemType)) {
    throw Error(`PLY face list type ${indexProperty.countType}/${indexProperty.itemType} is not an integer type.`);
  }

  const positions = new Float64Array(vertexElement.count * 3);
  const normals = hasNormals ? new Float64Array(vertexElement.count * 3) : null;
  const faces = [];
  const dropped = new Set();
  const texture = new Set();
  let skippedElements = 0;
  let vertexIndex = 0;
  let faceIndex = 0;

  for (const element of elements) {
    if (element === vertexElement) {
      for (let i = 0; i < element.count; i++) {
        const record = readRecord(element.properties);
        const at = vertexIndex * 3;
        positions[at] = record.x;
        positions[at + 1] = record.y;
        positions[at + 2] = record.z;
        if (hasNormals) {
          normals[at] = record.nx;
          normals[at + 1] = record.ny;
          normals[at + 2] = record.nz;
        }
        for (const property of element.properties) {
          if (PLY_KNOWN_VERTEX.has(property.name)) continue;
          if (PLY_TEXTURE.has(property.name)) texture.add(property.name);
          else dropped.add(property.name);
        }
        vertexIndex++;
      }
      continue;
    }

    if (element === faceElement) {
      for (let i = 0; i < element.count; i++) {
        const record = readRecord(element.properties);
        const list = record[indexProperty.name];
        const faceNumber = faceIndex + 1;
        if (list.length !== 3) {
          throw Error(`Face ${faceNumber} has ${list.length} vertices; Peforma 3D reads triangular meshes only.`);
        }
        for (const index of list) {
          if (!Number.isInteger(index) || index < 0 || index >= vertexElement.count) {
            throw Error(`Face ${faceNumber} references vertex ${index}, but ${vertexElement.count} vertices are defined.`);
          }
          faces.push(index);
        }
        for (const property of element.properties) {
          if (property !== indexProperty) dropped.add(property.name);
        }
        faceIndex++;
      }
      continue;
    }

    if (element.properties.some(property => property.type === 'list')) {
      throw Error(`PLY element "${element.name}" uses a list property, so its byte length cannot be computed safely.`);
    }
    for (let i = 0; i < element.count; i++) readRecord(element.properties);
    skippedElements++;
  }

  if (faces.length === 0) throw Error('This PLY has no triangular faces.');

  const model = makeModel(fileName, format);
  model.positions = positions;
  model.faces = new Uint32Array(faces);
  model.vertexNormals = normals;
  if (dropped.size) {
    model.warnings.push(`PLY properties not carried: ${[...dropped].join(', ')}.`);
  }
  if (texture.size) {
    model.warnings.push(`PLY texture coordinates (${[...texture].join(', ')}) are not carried.`);
  }
  if (skippedElements) {
    model.warnings.push(`${skippedElements} PLY element${skippedElements === 1 ? '' : 's'} other than vertex and face were skipped.`);
  }
  return model;
}

function plyWarnings(model) {
  const warnings = [];
  if (model.groups.length) {
    warnings.push(`PLY does not carry groups; ${model.groups.length} group name${model.groups.length === 1 ? '' : 's'} were not written.`);
  }
  if (model.faceNormals) warnings.push('PLY does not carry face normals; the stored facet normals were not written.');
  if (model.crs) warnings.push('PLY does not carry a CRS; the declared CRS text was not written.');
  if (model.units) warnings.push('PLY does not carry units; the declared units text was not written.');
  return warnings;
}

function writePly(model, target) {
  const ascii = target === 'ply-ascii';
  const hasNormals = !!model.vertexNormals;
  const vertexCount = model.positions.length / 3;
  const faceCount = model.faces.length / 3;
  const header = [
    'ply',
    ascii ? 'format ascii 1.0' : 'format binary_little_endian 1.0',
    'comment Created by Peforma 3D',
    `element vertex ${vertexCount}`,
    'property double x',
    'property double y',
    'property double z',
    ...(hasNormals ? ['property double nx', 'property double ny', 'property double nz'] : []),
    `element face ${faceCount}`,
    'property list uchar uint vertex_indices',
    'end_header',
  ];
  const warnings = plyWarnings(model);
  const fileName = outputFileName(model, target);

  if (ascii) {
    const out = header.slice();
    for (let v = 0; v < vertexCount; v++) {
      const at = v * 3;
      const values = [model.positions[at], model.positions[at + 1], model.positions[at + 2]];
      if (hasNormals) values.push(model.vertexNormals[at], model.vertexNormals[at + 1], model.vertexNormals[at + 2]);
      out.push(values.map(num).join(' '));
    }
    for (let f = 0; f < model.faces.length; f += 3) {
      out.push(`3 ${model.faces[f]} ${model.faces[f + 1]} ${model.faces[f + 2]}`);
    }
    return { text: out.join('\n') + '\n', warnings, fileName, mime: 'text/plain' };
  }

  const headerBytes = new TextEncoder().encode(header.join('\n') + '\n');
  const vertexSize = (hasNormals ? 6 : 3) * 8;
  const bytes = new ArrayBuffer(headerBytes.byteLength + vertexCount * vertexSize + faceCount * 13);
  new Uint8Array(bytes).set(headerBytes);
  const view = new DataView(bytes);
  let offset = headerBytes.byteLength;

  for (let v = 0; v < vertexCount; v++) {
    const at = v * 3;
    for (let c = 0; c < 3; c++) {
      view.setFloat64(offset, model.positions[at + c], true);
      offset += 8;
    }
    if (hasNormals) {
      for (let c = 0; c < 3; c++) {
        view.setFloat64(offset, model.vertexNormals[at + c], true);
        offset += 8;
      }
    }
  }
  for (let f = 0; f < model.faces.length; f += 3) {
    view.setUint8(offset, 3);
    offset += 1;
    for (let k = 0; k < 3; k++) {
      view.setUint32(offset, model.faces[f + k], true);
      offset += 4;
    }
  }

  return { bytes, warnings, fileName, mime: 'application/octet-stream' };
}

// Replaced in Task 4.
function parseTsurf() {
  throw Error('GOCAD TSurf arrives in task 4.');
}
