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
  throw Error(`Peforma 3D cannot write ${MESH_TARGETS[target] || target} yet.`);
}

// Replaced in Task 2.
function parseObj() {
  throw Error('Wavefront OBJ arrives in task 2.');
}

// Replaced in Task 3.
function parsePly() {
  throw Error('PLY arrives in task 3.');
}

// Replaced in Task 4.
function parseTsurf() {
  throw Error('GOCAD TSurf arrives in task 4.');
}
