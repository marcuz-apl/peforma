// Peforma Culture Lines/Points — tier-1 open-format parsing and writing.
//
// Every format is identified from its contents or the file extension; nothing is
// ever sent to a server. The internal model keeps two geometry kinds (point set,
// polyline) and preserves vertex order, attribute values, missing-Z
// distinctions, and CRS/units metadata exactly as read. No reprojection, no unit
// conversion, no silent guessing: a delimited file without a header requires an
// explicit column mapping before it is treated as geometry.

// Source labels are keyed by detected format.
export const LINE_SOURCE_LABELS = {
  csv: 'Delimited text',
  geojson: 'GeoJSON',
  gocad: 'GOCAD ASCII',
};

// Writable target formats. Shapefile writing is deferred to the polygon tool so
// point, line, and polygon exports share one implementation; it is therefore
// not offered as a Culture Lines/Points output here.
export const LINE_TARGETS = {
  csv: 'Delimited text (CSV)',
  geojson: 'GeoJSON',
  gocad: 'GOCAD ASCII',
};

// Summarise a list of geometry objects for the UI: counts, coordinate bounds,
// Z presence, and the union of attribute names. Pure and read-only.
export function summarize(objects, crs, units) {
  let vertexCount = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let zMin = Infinity, zMax = -Infinity, hasZ = false;
  for (const o of objects) {
    const verts = o.multiPoints || (o.multiLines ? o.vertices.flat() : o.vertices || (o.vertex ? [o.vertex] : []));
    for (const v of verts || []) {
      if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y)) continue;
      vertexCount++;
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      maxX = Math.max(maxX, v.x);
      maxY = Math.max(maxY, v.y);
      if (v.z !== undefined && v.z !== null && Number.isFinite(v.z)) {
        hasZ = true;
        zMin = Math.min(zMin, v.z);
        zMax = Math.max(zMax, v.z);
      }
    }
  }
  const attrNames = [...new Set(objects.flatMap(o => Object.keys(o.attributes || {}).filter(k => k !== 'name')))];
  return {
    objectCount: objects.length,
    vertexCount,
    hasZ,
    bounds: vertexCount ? [minX, minY, maxX, maxY] : null,
    zBounds: hasZ ? [zMin, zMax] : null,
    attrNames,
    crs,
    units,
  };
}

// Detect the source format from the extension, then fall back to contents. The
// extension is authoritative when it names a known format, so a .csv renamed to
// .txt is still read as delimited text; a .geojson/.json is parsed as JSON.
export function detectLineFormat(fileName, text) {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'geojson' || ext === 'json') return 'geojson';
  if (['pl', 'vs', 'ts', 'dat', 'txt', 'csv', 'tsv', 'xyz'].includes(ext)) {
    // GOCAD declares itself with UP TO / PLINE / VSET near the top.
    if (/\b(UP\s+TO|PLINE|VSET)\b/.test(text.slice(0, 4000))) return 'gocad';
    return 'csv';
  }
  // No recognised extension: sniff the contents.
  try { JSON.parse(text); return 'geojson'; } catch { /* not JSON */ }
  if (/\b(UP\s+TO|PLINE|VSET)\b/.test(text.slice(0, 4000))) return 'gocad';
  if (/\S/.test(text)) return 'csv';
  throw Error('This file is empty.');
}

// Parse a delimited text file into a mapping-pending structure. The caller must
// assign X/Y (and optionally Z, Name, and attribute columns) before the rows
// are treated as geometry. When a header row is present, columns are named and
// the mapping is pre-seeded from likely header text; when it is absent, every
// column is anonymous and no mapping is suggested — the user must confirm one.
export function parseDelimited(text, fileName, crs, units) {
  const rawLines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const nonEmpty = rawLines.filter(l => l.trim() !== '');
  if (nonEmpty.length === 0) throw Error('This file has no data rows.');

  const delim = detectDelim(rawLines[0]);
  const firstTokens = delim === 'whitespace'
    ? nonEmpty[0].trim().split(/\s+/)
    : nonEmpty[0].split(delim).map(s => s.trim());

  const colCount = firstTokens.length;
  if (colCount < 2) throw Error('This delimited file has fewer than 2 columns; at least X and Y are required.');

  const firstAllNumeric = firstTokens.every(c => c !== '' && Number.isFinite(Number(c)));
  // A header names its columns, so it is non-numeric; an all-numeric first row is the
  // first data row. A headerless file that ends in a label column (X, Y, Z, name) is
  // therefore still read as data, because its first row is all numbers.
  const hasHeader = !firstAllNumeric;
  const headers = hasHeader
    ? firstTokens.map((c, i) => c || `Column ${i + 1}`)
    : firstTokens.map((_, i) => `Column ${i + 1}`);

  const dataLines = hasHeader ? nonEmpty.slice(1) : nonEmpty;
  const rows = dataLines.map(l => delim === 'whitespace' ? l.trim().split(/\s+/) : l.split(delim).map(s => s.trim()));
  if (rows.length === 0) throw Error('This file has no data rows after the header.');

  return {
    kind: 'unmapped',
    format: 'csv',
    headers,
    rows,
    crs: crs || null,
    units: units || null,
    fileName,
    suggested: hasHeader ? suggestMapping(headers) : null,
    delimiter: delim,
  };
}

// Suggest X/Y (and optional Z/Name) columns purely from header labels. A column
// is only matched when its label clearly names that axis; anything else stays
// unmatched so the user has to decide.
function suggestMapping(headers) {
  const map = { x: null, y: null, z: null, name: null, attrs: [] };
  const used = new Set();
  const pick = (re, key) => {
    const idx = headers.findIndex((h, i) => !used.has(i) && re.test(h));
    if (idx >= 0) { map[key] = idx; used.add(idx); }
  };
  pick(/^(x|lon(itude)?|east(eing)?)$/i, 'x');
  pick(/^(y|lat(itude)?|north(ing)?)$/i, 'y');
  pick(/^(z|elev(ation)?|depth|tvd(?:ss)?|md(?:d)?\b|depth_?(?:true|measured))$/i, 'z');
  pick(/^(name|id|line|line_?name|well|well_?name|fault|fault_?name|label|feature)$/i, 'name');
  return map;
}

// Turn a mapping-pending delimited result into a geometry model once the user
// has confirmed (or corrected) the column mapping. `mapping` is { x, y, z?,
// name?, attrs? } of column indices. X and Y are required. When `isLine` is
// true, rows are grouped into polylines; otherwise each row is a point.
export function resolveDelimited(pending, mapping, { isLine = false } = {}) {
  const { headers, rows, crs, units, fileName } = pending;
  if (mapping.x == null || mapping.y == null) throw Error('Choose the X and Y columns before converting.');
  if (mapping.x === mapping.y) throw Error('X and Y must be two different columns.');

  const value = (row, i) => (i == null ? undefined : row[i]);
  const objects = [];
  let skipped = 0;

  if (!isLine) {
    for (const row of rows) {
      const x = num(value(row, mapping.x));
      const y = num(value(row, mapping.y));
      if (x === null || y === null) { skipped++; continue; }
      const vertex = { x, y };
      const z = num(value(row, mapping.z));
      if (z !== null) vertex.z = z;
      objects.push({ kind: 'point', vertex, attributes: pickAttrs(row, mapping, headers) });
    }
  } else {
    // Group consecutive rows into one polyline. When a Name column is mapped, a
    // new object starts whenever the name changes; otherwise all rows form a
    // single path. This preserves the "line, then its vertices" layout.
    const nameIdx = mapping.name != null ? mapping.name : null;
    let current = null;
    for (const row of rows) {
      const x = num(value(row, mapping.x));
      const y = num(value(row, mapping.y));
      if (x === null || y === null) { skipped++; continue; }
      const label = nameIdx != null ? String(value(row, nameIdx) ?? '') : '__single__';
      if (!current || current._key !== label) {
        current = { kind: 'polyline', _key: label, vertices: [], attributes: nameIdx != null ? { name: label } : {} };
        objects.push(current);
      }
      const vertex = { x, y };
      const z = num(value(row, mapping.z));
      if (z !== null) vertex.z = z;
      current.vertices.push(vertex);
    }
    for (const o of objects) delete o._key;
  }

  if (objects.length === 0) throw Error(`No usable ${isLine ? 'line' : 'point'} records after mapping (${skipped} skipped).`);
  // Polylines need at least two vertices to be a line; drop empty ones.
  const pruned = isLine ? objects.filter(o => o.vertices.length >= 2) : objects;
  if (pruned.length === 0) throw Error('No line has more than one vertex after mapping.');

  return {
    kind: isLine ? 'polyline' : 'point',
    format: 'csv',
    objects: pruned,
    crs: crs || null,
    units: units || null,
    fileName,
    skipped,
    note: skipped ? `${skipped} record${skipped === 1 ? '' : 's'} skipped (non-numeric coordinates).` : undefined,
  };
}

// Pick the attribute values for a point row. `mapping.attrs` is an array of
// column indices the user flagged as extra attributes (anything not X/Y/Z/Name).
function pickAttrs(row, mapping, headers) {
  const attrs = {};
  if (mapping.name != null) attrs.name = row[mapping.name] ?? '';
  if (mapping.attrs) for (const ai of mapping.attrs) attrs[headers[ai] || `Column ${ai + 1}`] = row[ai];
  return attrs;
}

// Parse a GeoJSON document into the internal model. Point, MultiPoint,
// LineString, and MultiLineString are supported; Polygon, MultiPolygon, and
// GeometryCollection members are skipped with a count, since closed polygon
// topology belongs to the Culture Polygon converter.
export function parseGeoJson(text, fileName) {
  let doc;
  try { doc = JSON.parse(text); } catch (e) { throw Error('This is not valid GeoJSON: ' + e.message); }

  const features =
    doc.type === 'FeatureCollection' ? (doc.features || [])
    : doc.type === 'Feature' ? [doc]
    : doc.type && doc.coordinates !== undefined ? [{ type: 'Feature', properties: {}, geometry: doc }]
    : null;
  if (!features) throw Error('This GeoJSON has no Feature, FeatureCollection, or geometry object.');

  const crs = doc.crs?.name || doc.crs?.properties?.name || null;
  const objects = [];
  let skipped = 0;

  for (const feature of features) {
    const geom = feature.geometry;
    if (!geom || !Array.isArray(geom.coordinates)) { skipped++; continue; }
    const built = fromGeoJsonGeometry(geom.type, geom.coordinates, feature.properties || {});
    if (!built) { skipped++; continue; }
    objects.push(built);
  }
  if (objects.length === 0) throw Error('No supported point or line geometry in this GeoJSON (polygon geometry belongs to the Culture Polygon converter).');

  return {
    kind: objects.every(o => o.kind === 'point') ? 'point' : 'mixed',
    format: 'geojson',
    objects,
    crs,
    units: null,
    fileName,
    skipped,
    note: skipped ? `${skipped} object${skipped === 1 ? '' : 's'} with unsupported or missing geometry skipped.` : undefined,
  };
}

function fromGeoJsonGeometry(type, coords, props) {
  const attrs = { ...props };
  switch (type) {
    case 'Point':
      return { kind: 'point', vertex: toVertex(coords), attributes: attrs };
    case 'MultiPoint':
      return { kind: 'point', multiPoints: coords.map(toVertex), attributes: attrs };
    case 'LineString':
      return { kind: 'polyline', vertices: coords.map(toVertex), attributes: attrs, closed: false };
    case 'MultiLineString':
      return { kind: 'polyline', multiLines: true, vertices: coords.map(ring => ring.map(toVertex)), attributes: attrs };
    default:
      return null; // Polygon, MultiPolygon, etc. are out of scope for this tool.
  }
}

function toVertex(c) {
  const vertex = { x: c[0], y: c[1] };
  if (c.length > 2 && c[2] !== undefined && c[2] !== null) vertex.z = c[2];
  return vertex;
}

// Parse a GOCAD ASCII file (UP TO header + PLINE / VSET objects). Only PLINE and
// VSET are supported here; TSURF belongs to the surface tool. The header's CRS
// and UNITS fields are preserved as text and never reinterpreted.
export function parseGocad(text, fileName) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const crs = gocadField(lines, 'CRS');
  const units = gocadField(lines, 'UNITS');

  const objects = [];
  let i = 0;
  while (i < lines.length) {
    const head = lines[i].trim();
    if (/^PLINE\b/.test(head)) {
      const m = head.match(/^PLINE\s+(\d+)(?:\s+\d+)?(?:\s+(.*))?$/);
      const nv = Number(m[1]);
      const objName = (m[2] || '').trim() || undefined;
      const verts = readGocadVertices(lines, i + 1, nv, 'PLINE', objName, objects.length + 1);
      objects.push({ kind: 'polyline', vertices: verts, attributes: objName ? { name: objName } : {}, closed: false });
      i += nv + 1;
      continue;
    }
    if (/^VSET\b/.test(head)) {
      const m = head.match(/^VSET\s+(\d+)(?:\s+(.*))?$/);
      const nv = Number(m[1]);
      const objName = (m[2] || '').trim() || undefined;
      const pts = readGocadVertices(lines, i + 1, nv, 'VSET', objName, objects.length + 1);
      objects.push(pts.length === 1
        ? { kind: 'point', vertex: pts[0], attributes: objName ? { name: objName } : {} }
        : { kind: 'point', multiPoints: pts, attributes: objName ? { name: objName } : {} });
      i += nv + 1;
      continue;
    }
    i++;
  }

  if (objects.length === 0) throw Error('No GOCAD PLINE or VSET objects found in this file.');
  return {
    kind: objects.every(o => o.kind === 'point') ? 'point' : 'mixed',
    format: 'gocad',
    objects,
    crs: crs || null,
    units: units || null,
    fileName,
    skipped: 0,
  };
}

function readGocadVertices(lines, start, count, objType, objName, ordinal) {
  const verts = [];
  for (let k = 0; k < count; k++) {
    const t = (lines[start + k] || '').trim().split(/\s+/).filter(Boolean);
    if (t.length < 2 || !Number.isFinite(Number(t[0])) || !Number.isFinite(Number(t[1]))) {
      throw Error(`GOCAD ${objType} ${objName || '#' + ordinal}: record ${k + 1} is not a numeric X Y (Z) vertex.`);
    }
    const vertex = { x: Number(t[0]), y: Number(t[1]) };
    if (t.length > 2 && Number.isFinite(Number(t[2]))) vertex.z = Number(t[2]);
    verts.push(vertex);
  }
  return verts;
}

// Read a `FIELD: value` line from the GOCAD header block.
function gocadField(lines, field) {
  for (const l of lines) {
    const m = l.trim().match(new RegExp(`^${field}\\s*[:=]\\s*(.+)$`, 'i'));
    if (m) return m[1].trim();
  }
  return null;
}

// Detect the delimiter of a delimited text sample. Whitespace is returned only
// when there are no tab/semicolon/comma characters, so "X,Y,Z" is not treated
// as whitespace columns.
function detectDelim(line) {
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  if (line.includes(',')) return ',';
  return 'whitespace';
}

// Parse a selected source into either a resolved model or a mapping-pending
// delimited structure. Top-level dispatcher used by the view.
export function parseLinePoints(text, fileName, { crs, units } = {}) {
  const fmt = detectLineFormat(fileName, text);
  if (fmt === 'geojson') return parseGeoJson(text, fileName);
  if (fmt === 'gocad') return parseGocad(text, fileName);
  return parseDelimited(text, fileName, crs, units);
}

// ---------------------------------------------------------------------------
// Writing

// Serialise a resolved model to a target format. `model` is the return of
// resolveDelimited / parseGeoJson / parseGocad. Coordinate order, precision,
// and CRS label are written exactly as read.
export function writeLinePoints(model, target) {
  switch (target) {
    case 'csv': return writeCsv(model);
    case 'geojson': return writeGeoJson(model);
    case 'gocad': return writeGocad(model);
    default: throw Error(`No writer for target format: ${target}`);
  }
}

// Flatten every object into a X,Y,Z,Name,<attrs...> CSV. Polyline vertices share
// the object's attributes and repeat on each row.
function writeCsv(model) {
  const attrNames = summarize(model.objects, model.crs, model.units).attrNames;
  const out = [['X', 'Y', 'Z', 'Name', ...attrNames]];
  for (const o of model.objects) {
    const name = o.attributes?.name ?? '';
    const emit = (v) => out.push([
      v.x ?? '',
      v.y ?? '',
      v.z !== undefined && v.z !== null ? v.z : '',
      name,
      ...attrNames.map(a => o.attributes?.[a] ?? ''),
    ]);
    if (o.multiPoints) o.multiPoints.forEach(emit);
    else if (o.multiLines) for (const ring of o.vertices) ring.forEach(emit);
    else if (o.vertices) o.vertices.forEach(emit);
    else if (o.vertex) emit(o.vertex);
  }
  return out.map(row => row.map(csvEscape).join(',')).join('\n') + '\n';
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function writeGeoJson(model) {
  const features = model.objects.map(o => {
    let geometry;
    if (o.multiPoints) geometry = { type: 'MultiPoint', coordinates: o.multiPoints.map(toCoord) };
    else if (o.vertex) geometry = { type: 'Point', coordinates: toCoord(o.vertex) };
    else if (o.multiLines) geometry = { type: 'MultiLineString', coordinates: o.vertices.map(ring => ring.map(toCoord)) };
    else if (o.vertices) geometry = { type: 'LineString', coordinates: o.vertices.map(toCoord) };
    if (!geometry) return null;
    const props = { ...o.attributes };
    return { type: 'Feature', properties: props, geometry };
  }).filter(Boolean);

  const fc = { type: 'FeatureCollection', features };
  if (model.crs) fc.crs = { type: 'name', name: model.crs };
  return JSON.stringify(fc, null, 2) + '\n';
}

function toCoord(v) {
  const c = [v.x, v.y];
  if (v.z !== undefined && v.z !== null) c.push(v.z);
  return c;
}

function writeGocad(model) {
  const out = ['UP TO'];
  if (model.crs) out.push(`CRS: ${model.crs}`);
  if (model.units) out.push(`UNITS: ${model.units}`);
  out.push('');
  for (const o of model.objects) {
    const id = o.attributes?.name || '';
    if (o.multiPoints) {
      out.push(`VSET ${o.multiPoints.length} ${id}`.trimEnd());
      o.multiPoints.forEach(v => out.push(vLine(v)));
      out.push('');
    } else if (o.vertex) {
      out.push(`VSET 1 ${id}`.trimEnd());
      out.push(vLine(o.vertex));
      out.push('');
    } else if (o.multiLines) {
      o.vertices.forEach((ring, i) => {
        const rid = id ? `${id}_${i + 1}` : '';
        out.push(`PLINE ${ring.length} 4 ${rid}`.trimEnd());
        ring.forEach(v => out.push(vLine(v)));
        out.push('');
      });
    } else if (o.vertices) {
      out.push(`PLINE ${o.vertices.length} 4 ${id}`.trimEnd());
      o.vertices.forEach(v => out.push(vLine(v)));
      out.push('');
    }
  }
  return out.join('\n') + '\n';
}

function vLine(v) {
  const s = [v.x, v.y];
  if (v.z !== undefined && v.z !== null) s.push(v.z);
  return s.join(' ');
}

// ---------------------------------------------------------------------------
// Small helpers

// Coerce a cell to a finite number, or null when it is empty or non-numeric.
// This is the only place text becomes a number; a missing value stays missing.
function num(cell) {
  if (cell === undefined || cell === null) return null;
  const s = String(cell).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
