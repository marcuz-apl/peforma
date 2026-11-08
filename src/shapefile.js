// Peforma Shapefile — Esri Shapefile bundle parsing and writing.
//
// A shapefile is a bundle: .shp holds geometry, .shx is the record index,
// .dbf holds attributes, and .prj optionally names the coordinate reference
// system. The reader never reprojects, never reorders records, and never
// rewrites attribute values. The writer states every convention it applies —
// ring closure, ring orientation, field-name truncation, and any dropped Z.

const SHP_MAGIC = 9994;
const SHP_VERSION = 1000;
const ZIP_FLAG_UTF8 = 0x0800;

export const SHAPEFILE_TARGETS = {
  geojson: 'GeoJSON',
  shapefile: 'Esri Shapefile bundle (.zip)',
};

// Shape type codes that carry a Z value, and their 2D counterparts.
const SHAPE_KIND = {
  0: 'null', 1: 'point', 3: 'polyline', 5: 'polygon', 8: 'multipoint',
  11: 'point', 13: 'polyline', 15: 'polygon', 18: 'multipoint',
  21: 'point', 23: 'polyline', 25: 'polygon', 28: 'multipoint',
};
const HAS_Z = new Set([11, 13, 15, 18]);
const HAS_M = new Set([21, 23, 25, 28]);

// ---------------------------------------------------------------------------
// Reading

// Read a shapefile bundle. `files` maps lower-case extension to content:
// { shp: ArrayBuffer, shx?: ArrayBuffer, dbf?: ArrayBuffer, prj?: string }.
export function parseShapefileBundle({ shp, shx, dbf, prj, fileName }) {
  if (!shp) throw Error('This bundle has no .shp geometry file. Add the .shp file and try again.');
  if (!dbf) throw Error('This bundle has no .dbf attribute file. Esri Shapefile needs .shp and .dbf together.');

  const warnings = [];
  const geometry = readShp(shp, warnings);
  const shxCount = shx ? readShx(shx) : null;
  const table = readDbf(dbf, warnings);

  if (shxCount != null && shxCount !== geometry.records.length) {
    throw Error(`The .shx index lists ${shxCount.toLocaleString()} records, but the .shp file contains ${geometry.records.length.toLocaleString()}. The bundle is inconsistent, so nothing was converted.`);
  }
  if (shx == null) warnings.push('No .shx index was included. The geometry was read directly from the .shp file.');
  if (table.records.length !== geometry.records.length) {
    throw Error(`The .dbf attribute table has ${table.records.length.toLocaleString()} rows, but the .shp file contains ${geometry.records.length.toLocaleString()} records. The bundle is inconsistent, so nothing was converted.`);
  }

  const features = [];
  let nullRecords = 0;
  geometry.records.forEach((record, i) => {
    if (!record) { nullRecords++; return; }
    const attributes = table.records[i] || {};
    features.push(toFeature(record, attributes));
  });
  if (nullRecords > 0) warnings.push(`${nullRecords.toLocaleString()} null shapefile record${nullRecords === 1 ? ' was' : 's were'} skipped.`);
  if (table.deleted > 0) warnings.push(`${table.deleted.toLocaleString()} record${table.deleted === 1 ? ' is' : 's are'} flagged deleted in the .dbf table; their geometry is still listed with empty attributes.`);
  if (table.fallbackEncoding) warnings.push('Attribute text was not valid UTF-8, so it was read with the Windows-1252 fallback.');

  return {
    fileName,
    format: 'shapefile',
    crs: prj && prj.trim() ? prj.trim() : null,
    features,
    warnings,
  };
}

// Read a GeoJSON file as the other side of the exchange. Polygons are handled
// here because a shapefile bundle can carry them.
export function parseGeoJsonFile(text, fileName) {
  let json;
  try { json = JSON.parse(text); } catch (e) { throw Error(`This file is not valid JSON: ${e.message}`); }

  const warnings = [];
  let crs = json.peforma_crs_wkt || json.crs?.properties?.name || null;
  const list = json.type === 'FeatureCollection' ? json.features
    : json.type === 'Feature' ? [json]
      : json.type ? [json] : null;
  if (!list) throw Error('This JSON is not GeoJSON: expected a FeatureCollection, a Feature, or a geometry object.');

  const features = [];
  const walk = (geometry, properties) => {
    if (!geometry) { warnings.push('A feature had no geometry and was skipped.'); return; }
    const props = properties || {};
    const c = geometry.coordinates;
    switch (geometry.type) {
      case 'Point':
        features.push({ kind: 'point', points: [readPosition(c, warnings)], attributes: props });
        break;
      case 'MultiPoint':
        features.push({ kind: 'multipoint', points: readPositions(c, warnings), attributes: props });
        break;
      case 'LineString':
        features.push({ kind: 'polyline', parts: [readPositions(c, warnings)], attributes: props });
        break;
      case 'MultiLineString':
        features.push({ kind: 'polyline', parts: c.map(part => readPositions(part, warnings)), attributes: props });
        break;
      case 'Polygon':
        features.push({ kind: 'polygon', rings: c.map(ring => readPositions(ring, warnings)), attributes: props });
        break;
      case 'MultiPolygon':
        features.push({ kind: 'multipolygon', polygons: c.map(poly => poly.map(ring => readPositions(ring, warnings))), attributes: props });
        break;
      case 'GeometryCollection':
        warnings.push('A GeometryCollection was split into one feature per member, keeping the same properties.');
        for (const member of geometry.geometries || []) walk(member, props);
        break;
      default:
        warnings.push(`Unsupported GeoJSON geometry "${geometry.type}" was skipped.`);
    }
  };

  for (const feature of list) {
    if (feature.type === 'Feature') walk(feature.geometry, feature.properties);
    else if (feature.type === 'GeometryCollection' || feature.coordinates) walk(feature, {});
    else warnings.push(`Unknown GeoJSON object "${feature.type}" was skipped.`);
  }

  if (features.length === 0) throw Error('No supported geometry was found in this GeoJSON.');
  features.forEach((f, i) => validateFeature(f, i + 1, warnings));

  return { fileName, format: 'geojson', crs, features, warnings };
}

function readPosition(c, warnings) {
  if (!Array.isArray(c) || c.length < 2) { warnings.push('A coordinate pair was missing and was read as invalid.'); return { x: NaN, y: NaN }; }
  const out = { x: Number(c[0]), y: Number(c[1]) };
  if (c.length > 2 && c[2] != null) out.z = Number(c[2]);
  if (!Number.isFinite(out.x) || !Number.isFinite(out.y)) warnings.push('A coordinate was not a finite number.');
  return out;
}

function readPositions(c, warnings) {
  return Array.isArray(c) ? c.map(p => readPosition(p, warnings)) : [];
}

function validateFeature(feature, index, warnings) {
  const count = featureVertexCount(feature);
  if (feature.kind === 'point' && (!Number.isFinite(feature.points[0]?.x) || !Number.isFinite(feature.points[0]?.y))) {
    throw Error(`Feature ${index} is a point without finite X and Y coordinates.`);
  }
  if (feature.kind === 'multipoint' && count === 0) throw Error(`Feature ${index} is a multipoint with no vertices.`);
  if (feature.kind === 'polyline') {
    const short = feature.parts.findIndex(part => part.length < 2);
    if (short >= 0) throw Error(`Feature ${index}, part ${short + 1} is a polyline with fewer than two vertices.`);
  }
  if (feature.kind === 'polygon' || feature.kind === 'multipolygon') {
    const rings = feature.kind === 'polygon' ? feature.rings : feature.polygons.flat();
    const short = rings.findIndex(ring => ring.length < 3);
    if (short >= 0) throw Error(`Feature ${index} has a ring with fewer than three vertices.`);
  }
}

function featureVertexCount(feature) {
  if (feature.kind === 'point') return 1;
  if (feature.kind === 'multipoint') return feature.points.length;
  if (feature.kind === 'polyline') return feature.parts.reduce((n, p) => n + p.length, 0);
  if (feature.kind === 'polygon') return feature.rings.reduce((n, r) => n + r.length, 0);
  return feature.polygons.flat().reduce((n, r) => n + r.length, 0);
}

// Shapefile geometry becomes a feature with the same shape kinds GeoJSON uses.
// A polygon record's parts are split into polygons by ring orientation: an
// exterior ring is clockwise, and the counter-clockwise rings that follow are
// its holes.
function toFeature(record, attributes) {
  if (record.kind === 'point') return { kind: 'point', points: [record.points[0]], attributes };
  if (record.kind === 'multipoint') return { kind: 'multipoint', points: record.points, attributes };
  if (record.kind === 'polyline') return { kind: 'polyline', parts: record.parts, attributes };

  const polygons = [];
  let current = null;
  for (const ring of record.parts) {
    const exterior = signedArea(ring) < 0;
    if (exterior || !current) { current = [ring]; polygons.push(current); }
    else current.push(ring);
  }
  if (polygons.length === 1) return { kind: 'polygon', rings: polygons[0], attributes };
  return { kind: 'multipolygon', polygons, attributes };
}

function readShp(buffer, warnings) {
  const dv = new DataView(buffer);
  if (buffer.byteLength < 100) throw Error('The .shp file is shorter than its 100-byte header.');
  if (dv.getInt32(0, false) !== SHP_MAGIC) throw Error('This is not an Esri Shapefile: the .shp header code is not 9994.');
  const declared = dv.getInt32(24, false) * 2;
  if (declared > buffer.byteLength) throw Error(`The .shp file is truncated: its header declares ${declared.toLocaleString()} bytes but only ${buffer.byteLength.toLocaleString()} are present.`);
  if (dv.getInt32(28, true) !== SHP_VERSION) throw Error(`Unsupported shapefile version ${dv.getInt32(28, true)}; expected 1000.`);

  const fileType = dv.getInt32(32, true);
  if (!SHAPE_KIND[fileType]) throw Error(`Unsupported shapefile geometry type ${fileType}.`);

  const end = Math.min(declared, buffer.byteLength);
  const records = [];
  let at = 100;
  while (at + 8 <= end) {
    const contentBytes = dv.getInt32(at + 4, false) * 2;
    at += 8;
    if (contentBytes < 4 || at + contentBytes > end) throw Error(`The .shp file is truncated in record ${records.length + 1}.`);
    records.push(readShape(dv, at, contentBytes, warnings));
    at += contentBytes;
  }
  if (at !== end) throw Error('The .shp file has trailing bytes that do not form a complete record.');
  return { fileType, records };
}

function readShape(dv, at, length, warnings) {
  const type = dv.getInt32(at, true);
  const kind = SHAPE_KIND[type];
  if (kind == null) throw Error(`Unsupported shape type ${type} inside a record.`);
  if (kind === 'null') return null;
  const z = HAS_Z.has(type);
  const m = HAS_M.has(type);
  let p = at + 4;

  if (kind === 'point') {
    const point = { x: dv.getFloat64(p, true), y: dv.getFloat64(p + 8, true) };
    p += 16;
    if (z) { point.z = dv.getFloat64(p, true); p += 8; }
    if (m) warnings.push('Measure (M) values were ignored.');
    return { kind, points: [point] };
  }

  p += 32; // bounding box
  if (kind === 'multipoint') {
    const n = dv.getInt32(p, true); p += 4;
    const points = [];
    for (let i = 0; i < n; i++, p += 16) points.push({ x: dv.getFloat64(p, true), y: dv.getFloat64(p + 8, true) });
    if (z) { p += 16; for (let i = 0; i < n; i++, p += 8) points[i].z = dv.getFloat64(p, true); }
    if (m) warnings.push('Measure (M) values were ignored.');
    return { kind, points };
  }

  const numParts = dv.getInt32(p, true);
  const numPoints = dv.getInt32(p + 4, true);
  p += 8;
  const starts = [];
  for (let i = 0; i < numParts; i++, p += 4) starts.push(dv.getInt32(p, true));
  const points = [];
  for (let i = 0; i < numPoints; i++, p += 16) points.push({ x: dv.getFloat64(p, true), y: dv.getFloat64(p + 8, true) });
  if (z) {
    p += 16;
    for (let i = 0; i < numPoints; i++, p += 8) points[i].z = dv.getFloat64(p, true);
  }
  if (m) warnings.push('Measure (M) values were ignored.');

  const parts = [];
  for (let i = 0; i < numParts; i++) {
    const from = starts[i];
    const to = i + 1 < numParts ? starts[i + 1] : numPoints;
    if (!(from >= 0 && to <= numPoints && to >= from)) throw Error(`Record geometry has an invalid part index (${from}–${to}).`);
    parts.push(points.slice(from, to));
  }
  return { kind, parts };
}

function readShx(buffer) {
  const dv = new DataView(buffer);
  if (buffer.byteLength < 100 || dv.getInt32(0, false) !== SHP_MAGIC) throw Error('The .shx index is not a valid shapefile index.');
  return Math.floor((buffer.byteLength - 100) / 8);
}

function readDbf(buffer, warnings) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 32) throw Error('The .dbf file is shorter than its header.');
  const dv = new DataView(buffer);
  const recordCount = dv.getInt32(4, true);
  const headerLength = dv.getUint16(8, true);
  const recordLength = dv.getUint16(10, true);
  if (recordLength < 1 || headerLength < 33 || headerLength > bytes.length) throw Error('The .dbf header is malformed (impossible record or header length).');

  const fields = [];
  let at = 32;
  while (at + 32 <= headerLength && bytes[at] !== 0x0d) {
    const name = ascii(bytes, at, 11).replace(/\0.*$/, '').trim();
    const type = String.fromCharCode(bytes[at + 11]);
    const length = bytes[at + 16];
    const decimals = bytes[at + 17];
    if (length === 0) throw Error(`The .dbf field "${name}" has a zero length.`);
    fields.push({ name, type, length, decimals });
    at += 32;
  }
  if (at >= headerLength || bytes[at] !== 0x0d) throw Error('The .dbf field descriptor block is not terminated.');

  const decoder = makeDecoder(warnings);
  const records = [];
  let deleted = 0;
  let at2 = headerLength;
  for (let i = 0; i < recordCount; i++) {
    if (at2 + recordLength > bytes.length) throw Error(`The .dbf file is truncated at record ${i + 1} of ${recordCount}.`);
    const flag = bytes[at2];
    let p = at2 + 1;
    const row = {};
    for (const f of fields) {
      row[f.name] = readDbfValue(bytes.subarray(p, p + f.length), f, decoder);
      p += f.length;
    }
    if (flag === 0x2a) { deleted++; records.push({}); } else records.push(row);
    at2 += recordLength;
  }
  return { records, deleted, fallbackEncoding: decoder.fallback };
}

function makeDecoder(warnings) {
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  const fallback = new TextDecoder('windows-1252');
  const state = { fallback: false };
  state.decode = bytes => {
    try { return utf8.decode(bytes); } catch { state.fallback = true; return fallback.decode(bytes); }
  };
  return state;
}

function readDbfValue(bytes, field, decoder) {
  const raw = decoder.decode(bytes).replace(/\0/g, '');
  switch (field.type) {
    case 'C': return raw.replace(/\s+$/, '');
    case 'N':
    case 'F': {
      const t = raw.trim();
      if (!t || t === '*') return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : t;
    }
    case 'L': {
      const t = raw.trim().toUpperCase();
      return t === 'T' || t === 'Y' ? true : t === 'F' || t === 'N' ? false : null;
    }
    case 'D': {
      const t = raw.trim();
      return /^\d{8}$/.test(t) ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : t || null;
    }
    default: return raw.replace(/\s+$/, '');
  }
}

function ascii(bytes, start, length) {
  let out = '';
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[start + i]);
  return out;
}

// ---------------------------------------------------------------------------
// Summaries

export function summarizeFeatures(features) {
  let vertexCount = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let zMin = Infinity, zMax = -Infinity, hasZ = false;
  let missingZ = 0;
  let ringCount = 0;
  const attrNames = [];
  const seen = new Set();

  for (const f of features) {
    if (f.kind === 'polygon') ringCount += f.rings.length;
    if (f.kind === 'multipolygon') ringCount += f.polygons.flat().length;
    for (const name of Object.keys(f.attributes || {})) {
      if (!seen.has(name)) { seen.add(name); attrNames.push(name); }
    }
    for (const v of featureVertices(f)) {
      if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) continue;
      vertexCount++;
      minX = Math.min(minX, v.x); minY = Math.min(minY, v.y);
      maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y);
      if (Number.isFinite(v.z)) {
        hasZ = true;
        zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z);
      } else if (v.z === undefined) missingZ++;
    }
  }

  return {
    featureCount: features.length,
    vertexCount,
    ringCount,
    hasZ: hasZ && missingZ === 0,
    partialZ: hasZ && missingZ > 0,
    bounds: vertexCount ? [minX, minY, maxX, maxY] : null,
    zBounds: hasZ ? [zMin, zMax] : null,
    attrNames,
    kinds: [...new Set(features.map(kindLabel))],
  };
}

function featureVertices(feature) {
  if (feature.kind === 'point') return feature.points;
  if (feature.kind === 'multipoint') return feature.points;
  if (feature.kind === 'polyline') return feature.parts.flat();
  if (feature.kind === 'polygon') return feature.rings.flat();
  return feature.polygons.flat(2);
}

function kindLabel(feature) {
  return feature.kind === 'multipoint' ? 'multipoint'
    : feature.kind === 'multipolygon' ? 'multipolygon'
      : feature.kind;
}

// ---------------------------------------------------------------------------
// Writing GeoJSON

export function buildGeoJson(model) {
  const warnings = [];
  const features = model.features.map(f => {
    const properties = { ...(f.attributes || {}) };
    if (f.kind === 'point') {
      return { type: 'Feature', geometry: { type: 'Point', coordinates: position(f.points[0]) }, properties };
    }
    if (f.kind === 'multipoint') {
      return { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: f.points.map(position) }, properties };
    }
    if (f.kind === 'polyline') {
      const parts = f.parts.map(part => part.map(position));
      return {
        type: 'Feature',
        geometry: parts.length === 1 ? { type: 'LineString', coordinates: parts[0] }
          : { type: 'MultiLineString', coordinates: parts },
        properties,
      };
    }
    const ringsList = f.kind === 'polygon' ? [f.rings] : f.polygons;
    const outPolys = ringsList.map(rings => rings.map((ring, i) => geojsonRing(ring, i === 0, warnings).map(position)));
    return {
      type: 'Feature',
      geometry: outPolys.length === 1 ? { type: 'Polygon', coordinates: outPolys[0] }
        : { type: 'MultiPolygon', coordinates: outPolys },
      properties,
    };
  });

  // RFC 7946 no longer defines a crs member. A short label is kept in the
  // legacy member; a WKT definition is kept verbatim in a foreign member so
  // converting back to a shapefile still has a .prj to write.
  const out = { type: 'FeatureCollection', features };
  if (model.crs) {
    if (looksLikeWkt(model.crs)) out.peforma_crs_wkt = model.crs;
    else out.crs = { type: 'name', properties: { name: model.crs } };
  }
  return { text: JSON.stringify(out, null, 2) + '\n', warnings: unique(warnings) };
}

function looksLikeWkt(text) {
  return /[\[\]]|PROJCS|GEOGCS|PROJCRS|GEOGCRS/i.test(text);
}

function position(p) {
  return Number.isFinite(p.z) ? [p.x, p.y, p.z] : [p.x, p.y];
}

function geojsonRing(ring, exterior, warnings) {
  const closed = closeRing(ring, warnings);
  const ccw = signedArea(closed) > 0;
  if (closed.length >= 4 && (exterior ? !ccw : ccw)) return [...closed].reverse();
  return closed;
}

// ---------------------------------------------------------------------------
// Writing a shapefile bundle

// Returns { bytes, fileName, warnings } where bytes is a store-only ZIP that
// holds one shapefile set per geometry kind present in the model.
export function buildShapefileZip(model) {
  const warnings = [];
  const groups = groupFeatures(model.features, warnings);
  const base = (model.fileName || 'peforma').replace(/\.[^.]+$/, '') || 'peforma';
  const entries = [];

  for (const group of groups) {
    const { shapeType, features } = group;
    const packed = packGroup(features, shapeType, warnings);
    const suffix = groups.length > 1 ? `_${group.key}` : '';
    const name = `${base}${suffix}`;
    entries.push({ name: `${name}.shp`, data: packed.shp });
    entries.push({ name: `${name}.shx`, data: packed.shx });
    entries.push({ name: `${name}.dbf`, data: packed.dbf });
    if (hasNonAsciiText(features)) entries.push({ name: `${name}.cpg`, data: new TextEncoder().encode('UTF-8') });
    if (model.crs) entries.push({ name: `${name}.prj`, data: new TextEncoder().encode(model.crs + '\n') });
  }

  return {
    bytes: writeZip(entries),
    fileName: `${base}_shapefile.zip`,
    warnings: unique(warnings),
  };
}

function hasNonAsciiText(features) {
  for (const f of features) {
    for (const v of Object.values(f.attributes || {})) {
      if (typeof v === 'string' && /[^\x00-\x7F]/.test(v)) return true;
    }
  }
  return false;
}

function groupFeatures(features, warnings) {
  const layout = {
    point: { key: 'points', shapeType: 1 },
    multipoint: { key: 'multipoints', shapeType: 8 },
    polyline: { key: 'lines', shapeType: 3 },
    polygon: { key: 'polygons', shapeType: 5 },
  };
  const groups = new Map();
  for (const f of features) {
    const key = layout[f.kind] ? f.kind : 'polygon';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  if (groups.size > 1) {
    warnings.push('The source mixes geometry types. Each type is written as its own shapefile set inside the ZIP, because one shapefile can carry only one geometry type.');
  }
  return Object.keys(layout).filter(key => groups.has(key)).map(key => ({
    key: layout[key].key,
    shapeType: layout[key].shapeType,
    features: groups.get(key),
  }));
}

function packGroup(features, shapeType, warnings) {
  const useZ = features.every(f => featureVertices(f).every(v => Number.isFinite(v.z)));
  const withZ = useZ && featureVertices(features[0]).length > 0;
  if (!useZ && features.some(f => featureVertices(f).some(v => v.z !== undefined))) {
    warnings.push('Z values were dropped because at least one vertex has no Z; a shapefile record cannot mix missing and present Z.');
  }

  const records = features.map(f => encodeShape(f, shapeType, withZ, warnings));
  const bounds = recordBounds(features, withZ);
  const type = withZ ? { 1: 11, 3: 13, 5: 15, 8: 18 }[shapeType] : shapeType;
  const shp = buildShp(type, records, bounds);
  const shx = buildShx(type, records);
  const dbf = buildDbf(features, warnings);
  return { shp, shx, dbf };
}

function encodeShape(feature, shapeType, withZ, warnings) {
  if (shapeType === 1) {
    const p = feature.points[0];
    return encodePoint(p, withZ);
  }
  if (shapeType === 8) {
    return encodePoints(feature.points, withZ);
  }
  const parts = feature.kind === 'polyline' ? feature.parts
    : feature.kind === 'polygon' ? cleanRings([feature.rings], warnings)[0]
      : cleanRings(feature.polygons, warnings).flat();
  return encodeParts(parts, shapeType, withZ);
}

function encodePoint(p, withZ) {
  const size = withZ ? 28 : 20;
  const buf = new ArrayBuffer(size);
  const dv = new DataView(buf);
  dv.setInt32(0, withZ ? 11 : 1, true);
  dv.setFloat64(4, p.x, true);
  dv.setFloat64(12, p.y, true);
  if (withZ) dv.setFloat64(20, p.z, true);
  return new Uint8Array(buf);
}

function encodePoints(points, withZ) {
  const count = points.length;
  const total = 40 + count * 16 + (withZ ? 16 + count * 8 : 0);
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  dv.setInt32(0, withZ ? 18 : 8, true);
  writeBox(dv, 4, points);
  dv.setInt32(36, count, true);
  let at = 40;
  for (const p of points) { dv.setFloat64(at, p.x, true); dv.setFloat64(at + 8, p.y, true); at += 16; }
  if (withZ) {
    writeZRange(dv, at, points);
    at += 16;
    for (const p of points) { dv.setFloat64(at, p.z, true); at += 8; }
  }
  return new Uint8Array(buf);
}

// Rings are normalised to Esri's convention only here, in the writer: exterior
// rings clockwise, holes counter-clockwise. The applied convention is reported.
function cleanRings(polygons, warnings) {
  let closedCount = 0;
  let reversedCount = 0;
  const out = polygons.map((rings, pi) => rings.map((ring, ri) => {
    const before = ring.length;
    const closed = closeRing(ring, { push() {} });
    if (closed.length !== before) closedCount++;
    const exterior = ri === 0;
    const ccw = signedArea(closed) > 0;
    if (closed.length >= 4 && (exterior ? ccw : !ccw)) { reversedCount++; return [...closed].reverse(); }
    return closed;
  }));
  if (closedCount > 0) warnings.push(`${closedCount} open ring${closedCount === 1 ? ' was' : 's were'} closed because a shapefile ring is a closed loop.`);
  if (reversedCount > 0) warnings.push(`${reversedCount} ring${reversedCount === 1 ? ' was' : 's were'} reversed to Esri's orientation convention: exterior clockwise, holes counter-clockwise.`);
  return out;
}

function encodeParts(parts, shapeType, withZ) {
  const numParts = parts.length;
  const points = parts.flat();
  const numPoints = points.length;
  const total = 44 + numParts * 4 + numPoints * 16 + (withZ ? 16 + numPoints * 8 : 0);
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const type = shapeType === 5 ? (withZ ? 15 : 5) : (withZ ? 13 : 3);
  dv.setInt32(0, type, true);
  writeBox(dv, 4, points);
  dv.setInt32(36, numParts, true);
  dv.setInt32(40, numPoints, true);
  let at = 44;
  let start = 0;
  for (const part of parts) { dv.setInt32(at, start, true); at += 4; start += part.length; }
  for (const p of points) { dv.setFloat64(at, p.x, true); dv.setFloat64(at + 8, p.y, true); at += 16; }
  if (withZ) {
    writeZRange(dv, at, points);
    at += 16;
    for (const p of points) { dv.setFloat64(at, p.z, true); at += 8; }
  }
  return new Uint8Array(buf);
}

// The shape's 32-byte XY box. Z bounds sit after the point array, not here.
function writeBox(dv, at, points) {
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for (const p of points) {
    xmin = Math.min(xmin, p.x); ymin = Math.min(ymin, p.y);
    xmax = Math.max(xmax, p.x); ymax = Math.max(ymax, p.y);
  }
  dv.setFloat64(at, xmin, true); dv.setFloat64(at + 8, ymin, true);
  dv.setFloat64(at + 16, xmax, true); dv.setFloat64(at + 24, ymax, true);
}

// The 16-byte Z range that follows the point array in a Z shape.
function writeZRange(dv, at, points) {
  let zmin = Infinity, zmax = -Infinity;
  for (const p of points) { zmin = Math.min(zmin, p.z); zmax = Math.max(zmax, p.z); }
  dv.setFloat64(at, zmin, true);
  dv.setFloat64(at + 8, zmax, true);
}

function buildShp(type, records, bounds) {
  const total = 100 + records.reduce((n, r) => n + 8 + r.length, 0);
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  dv.setInt32(0, SHP_MAGIC, false);
  dv.setInt32(24, total / 2, false);
  dv.setInt32(28, SHP_VERSION, true);
  dv.setInt32(32, type, true);
  dv.setFloat64(36, bounds[0], true);
  dv.setFloat64(44, bounds[1], true);
  dv.setFloat64(52, bounds[2], true);
  dv.setFloat64(60, bounds[3], true);
  if (HAS_Z.has(type)) {
    dv.setFloat64(68, bounds[4], true);
    dv.setFloat64(76, bounds[5], true);
  }
  let at = 100;
  records.forEach((content, i) => {
    dv.setInt32(at, i + 1, false);
    dv.setInt32(at + 4, content.length / 2, false);
    new Uint8Array(buf, at + 8, content.length).set(content);
    at += 8 + content.length;
  });
  return new Uint8Array(buf);
}

function buildShx(type, records) {
  const buf = new ArrayBuffer(100 + records.length * 8);
  const dv = new DataView(buf);
  dv.setInt32(0, SHP_MAGIC, false);
  dv.setInt32(24, (buf.byteLength) / 2, false);
  dv.setInt32(28, SHP_VERSION, true);
  dv.setInt32(32, type, true);
  let offset = 100;
  records.forEach((content, i) => {
    dv.setInt32(100 + i * 8, offset / 2, false);
    dv.setInt32(104 + i * 8, content.length / 2, false);
    offset += 8 + content.length;
  });
  return new Uint8Array(buf);
}

function recordBounds(features, withZ) {
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  let zmin = 0, zmax = 0;
  let first = true;
  for (const f of features) {
    for (const p of featureVertices(f)) {
      xmin = Math.min(xmin, p.x); ymin = Math.min(ymin, p.y);
      xmax = Math.max(xmax, p.x); ymax = Math.max(ymax, p.y);
      if (withZ) {
        if (first) { zmin = p.z; zmax = p.z; }
        else { zmin = Math.min(zmin, p.z); zmax = Math.max(zmax, p.z); }
      }
      first = false;
    }
  }
  return [xmin, ymin, xmax, ymax, zmin, zmax];
}

// DBF holds one flat table, so attribute fields come from the union of keys.
function buildDbf(features, warnings) {
  const keys = [];
  const seen = new Set();
  for (const f of features) for (const key of Object.keys(f.attributes || {})) {
    if (!seen.has(key)) { seen.add(key); keys.push(key); }
  }

  const fields = [];
  const used = new Set();
  for (const key of keys) {
    const name = dbfName(key, used);
    if (name !== key) warnings.push(`Attribute "${key}" was written as "${name}" because a DBF field name is limited to 10 ASCII characters and must be unique.`);
    const values = features.map(f => f.attributes?.[key]);
    fields.push({ ...describeField(name, values, warnings), key });
  }

  const headerLength = 32 + fields.length * 32 + 1;
  const recordLength = 1 + fields.reduce((n, f) => n + f.length, 0);
  const total = headerLength + recordLength * features.length + 1;
  const bytes = new Uint8Array(total);
  const dv = new DataView(bytes.buffer);
  const now = new Date();
  bytes[0] = 0x03;
  bytes[1] = now.getUTCFullYear() % 100;
  bytes[2] = now.getUTCMonth() + 1;
  bytes[3] = now.getUTCDate();
  dv.setInt32(4, features.length, true);
  dv.setUint16(8, headerLength, true);
  dv.setUint16(10, recordLength, true);

  fields.forEach((f, i) => {
    const at = 32 + i * 32;
    for (let c = 0; c < 11; c++) bytes[at + c] = c < f.name.length ? f.name.charCodeAt(c) : 0;
    bytes[at + 11] = f.type.charCodeAt(0);
    bytes[at + 16] = f.length;
    bytes[at + 17] = f.decimals;
  });
  bytes[headerLength - 1] = 0x0d;

  let blanks = 0;
  const encoder = new TextEncoder();
  let at = headerLength;
  for (const f of features) {
    bytes[at] = 0x20;
    let p = at + 1;
    for (const field of fields) {
      const value = f.attributes?.[field.key];
      if ((value === null || value === undefined) && field.type !== 'L') blanks++;
      const data = encoder.encode(formatDbfValue(value, field));
      for (let c = 0; c < field.length; c++) bytes[p + c] = 0x20;
      if (field.type === 'N' || field.type === 'F') bytes.set(data, p + field.length - data.length);
      else bytes.set(data.subarray(0, field.length), p);
      p += field.length;
    }
    at += recordLength;
  }
  if (blanks > 0) warnings.push(`${blanks.toLocaleString()} empty attribute value${blanks === 1 ? ' was' : 's were'} written as blanks because a DBF field has no null marker.`);
  bytes[total - 1] = 0x1a;
  return bytes;
}

function dbfName(key, used) {
  let base = String(key).normalize('NFKD').replace(/[^\x00-\x7F]/g, '').replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+/, '');
  if (!/^[A-Za-z]/.test(base)) base = `F${base}`;
  base = base.slice(0, 10) || 'FIELD';
  let name = base;
  let n = 1;
  while (used.has(name.toLowerCase())) {
    const suffix = String(n++);
    name = base.slice(0, 10 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

function describeField(name, values, warnings) {
  const present = values.filter(v => v !== null && v !== undefined && v !== '');
  const allNumeric = present.length > 0 && present.every(v => typeof v === 'number' && Number.isFinite(v));
  if (allNumeric) {
    const decimals = Math.max(...present.map(decimalsOf));
    const texts = present.map(v => v.toFixed(decimals));
    const width = Math.max(1, ...texts.map(t => t.length));
    if (width <= 18) return { name, type: 'N', length: width, decimals };
    warnings.push(`Attribute "${name}" needs ${width} characters as a DBF number, beyond the 18-character limit, so it was written as text.`);
  }
  const isBool = present.length > 0 && present.every(v => typeof v === 'boolean');
  if (isBool) return { name, type: 'L', length: 1, decimals: 0 };
  const encoder = new TextEncoder();
  const max = present.length ? Math.max(...present.map(v => encoder.encode(String(v)).length)) : 1;
  if (max > 254) warnings.push(`Attribute "${name}" holds text longer than 254 bytes; values were truncated to fit the DBF field.`);
  return { name, type: 'C', length: Math.min(254, Math.max(1, max)), decimals: 0 };
}

function decimalsOf(v) {
  const s = String(v);
  const at = s.indexOf('.');
  return at < 0 ? 0 : Math.min(6, s.length - at - 1);
}

function formatDbfValue(value, field) {
  if (value === null || value === undefined) return field.type === 'L' ? '?' : '';
  if (field.type === 'L') return value ? 'T' : 'F';
  if (field.type === 'N') {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return '';
    return n.toFixed(field.decimals);
  }
  const text = String(value);
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= field.length) return text;
  let cut = '';
  for (const ch of text) {
    if (new TextEncoder().encode(cut + ch).length > field.length) break;
    cut += ch;
  }
  return cut;
}

// ---------------------------------------------------------------------------
// Helpers

function closeRing(ring, warnings) {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first.x === last.x && first.y === last.y && (first.z ?? null) === (last.z ?? null)) return ring;
  warnings.push?.('An open ring was closed because the target requires a closed linear ring.');
  return [...ring, { ...first }];
}

function signedArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function unique(list) {
  return [...new Set(list)];
}

// ---------------------------------------------------------------------------
// Store-only ZIP (no compression), so the bundle downloads as one file.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function writeZip(entries) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, ZIP_FLAG_UTF8, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, ZIP_FLAG_UTF8, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const total = offset + centralSize + 22;
  const out = new Uint8Array(total);
  let at = 0;
  for (const local of locals) { out.set(local, at); at += local.length; }
  for (const central of centrals) { out.set(central, at); at += central.length; }
  const ev = new DataView(out.buffer);
  ev.setUint32(at, 0x06054b50, true);
  ev.setUint16(at + 8, entries.length, true);
  ev.setUint16(at + 10, entries.length, true);
  ev.setUint32(at + 12, centralSize, true);
  ev.setUint32(at + 16, offset, true);
  return out;
}
