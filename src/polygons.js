// Peforma Culture Polygon — closed-ring exchange for the tier-1 open formats.
//
// A polygon is an ordered list of rings: the first ring is the exterior and each
// later ring is a hole. Source ring order, vertex order, stored orientation,
// duplicate vertices, and attributes are preserved. Closure is reported, never
// invented on read; the writer applies the target convention (GeoJSON closes and
// orients rings to RFC 7946) and reports every decision it made. No topology is
// repaired and no coordinate is reprojected.

export const POLYGON_SOURCE_LABELS = {
  geojson: 'GeoJSON',
  gocad: 'GOCAD ASCII',
};

export const POLYGON_TARGETS = {
  geojson: 'GeoJSON',
  gocad: 'GOCAD ASCII (closed curves)',
};

// GeoJSON rings must close; GOCAD curves close by repeating the first vertex or
// by a SEG record joining the last vertex to the first. Self-intersection checks
// are quadratic, so very large rings are reported as unchecked rather than
// freezing the page.
const SELF_INTERSECTION_RING_LIMIT = 1200;
const SELF_INTERSECTION_VERTEX_BUDGET = 6000;

export function detectPolygonFormat(fileName, text) {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'geojson' || ext === 'json') return 'geojson';
  const head = text.slice(0, 4000);
  if (/\bUP\s+TO\b/i.test(head) || /^\s*PLINE\b/im.test(head)) return 'gocad';
  try { JSON.parse(text); return 'geojson'; } catch { /* not JSON */ }
  throw Error('This file is neither GeoJSON polygon geometry nor a GOCAD ASCII closed-curve file.');
}

export function parsePolygonFile(text, fileName) {
  if (!text.trim()) throw Error('This file is empty.');
  return detectPolygonFormat(fileName, text) === 'geojson'
    ? parseGeoJsonPolygons(text, fileName)
    : parseGocadPolygons(text, fileName);
}

// ---------------------------------------------------------------------------
// GeoJSON

export function parseGeoJsonPolygons(text, fileName) {
  let doc;
  try { doc = JSON.parse(text); } catch (e) { throw Error('This is not valid GeoJSON: ' + e.message); }

  const features =
    doc.type === 'FeatureCollection' ? doc.features
    : doc.type === 'Feature' ? [doc]
    : doc.type && doc.coordinates !== undefined ? [{ type: 'Feature', properties: {}, geometry: doc }]
    : null;
  if (!Array.isArray(features)) throw Error('This GeoJSON has no Feature, FeatureCollection, or geometry object.');

  const crs = doc.peforma_crs_wkt || doc.crs?.properties?.name || doc.crs?.name || null;
  const objects = [];
  const counts = { duplicates: 0, zMismatch: 0, extraComponents: 0 };
  let skipped = 0;

  features.forEach((feature, fi) => {
    const geom = feature?.geometry;
    if (!geom || !Array.isArray(geom.coordinates)) { skipped++; return; }
    const props = feature.properties && typeof feature.properties === 'object' ? { ...feature.properties } : {};
    if (geom.type === 'Polygon') {
      objects.push({ kind: 'polygon', rings: buildRings(geom.coordinates, `Feature ${fi + 1}`, counts), attributes: props });
    } else if (geom.type === 'MultiPolygon') {
      if (geom.coordinates.length === 0) { skipped++; return; }
      const polygons = geom.coordinates.map((rings, pi) => buildRings(rings, `Feature ${fi + 1} polygon ${pi + 1}`, counts));
      objects.push({ kind: 'multipolygon', polygons, attributes: props });
    } else {
      skipped++;
    }
  });

  if (objects.length === 0) throw Error('No Polygon or MultiPolygon geometry in this GeoJSON. Point and line geometry belongs to Culture Lines/Points.');

  const summary = summarizePolygons(objects);
  const warnings = [];
  if (skipped) warnings.push(`${skipped} feature${skipped === 1 ? '' : 's'} without polygon geometry skipped; points and lines belong to Culture Lines/Points.`);
  if (counts.duplicates) warnings.push(`${counts.duplicates} consecutive duplicate vertex pair${counts.duplicates === 1 ? '' : 's'} preserved as stored.`);
  if (counts.zMismatch) warnings.push(`${counts.zMismatch} closed ring${counts.zMismatch === 1 ? '' : 's'} repeat the first X/Y position with a different Z; both stored values are kept.`);
  if (counts.extraComponents) warnings.push(`${counts.extraComponents} position${counts.extraComponents === 1 ? '' : 's'} carry more than three numbers; values beyond Z are not carried by the polygon model.`);
  if (summary.zeroAreaRings) warnings.push(`${summary.zeroAreaRings} ring${summary.zeroAreaRings === 1 ? '' : 's'} have zero area, so no orientation can be reported.`);
  warnings.push(...selfIntersectionWarnings(objects));

  return {
    kind: 'polygon',
    format: 'geojson',
    objects,
    crs,
    units: null,
    fileName,
    skipped,
    warnings,
  };
}

function buildRings(rings, label, counts) {
  if (!Array.isArray(rings) || rings.length === 0) throw Error(`${label} has no rings.`);
  return rings.map((ring, ri) => buildRing(ring, `${label} ring ${ri + 1}`, counts));
}

function buildRing(coords, label, counts) {
  if (!Array.isArray(coords) || coords.length < 3) {
    throw Error(`${label} has ${Array.isArray(coords) ? coords.length : 0} positions; a ring needs at least 3 vertices.`);
  }
  const vertices = coords.map((c, i) => toVertex(c, `${label} position ${i + 1}`, counts));
  const storedClosed = sameXY(vertices[0], vertices[vertices.length - 1]);
  if (distinctXY(vertices, storedClosed) < 3) throw Error(`${label} has fewer than 3 distinct vertices.`);
  if (storedClosed && vertices.length < 4) throw Error(`${label} repeats its first vertex but has fewer than 4 positions.`);

  for (let i = 1; i < vertices.length; i++) {
    if (sameXY(vertices[i - 1], vertices[i])) counts.duplicates++;
  }
  if (storedClosed && !sameZ(vertices[0], vertices[vertices.length - 1])) counts.zMismatch++;

  return { vertices, closed: storedClosed, storedClosed };
}

function toVertex(c, label, counts) {
  if (!Array.isArray(c) || c.length < 2) throw Error(`${label} is not an [X, Y] position.`);
  if (typeof c[0] !== 'number' || !Number.isFinite(c[0]) || typeof c[1] !== 'number' || !Number.isFinite(c[1])) {
    throw Error(`${label} has a non-numeric X or Y; numbers are required and text is never coerced.`);
  }
  const vertex = { x: c[0], y: c[1] };
  if (c.length > 2 && c[2] !== undefined && c[2] !== null) {
    if (typeof c[2] !== 'number' || !Number.isFinite(c[2])) throw Error(`${label} has a non-numeric Z.`);
    vertex.z = c[2];
  }
  if (c.length > 3) counts.extraComponents++;
  return vertex;
}

// ---------------------------------------------------------------------------
// GOCAD ASCII

export function parseGocadPolygons(text, fileName) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const crs = gocadField(lines, 'CRS');
  const units = gocadField(lines, 'UNITS');

  const objects = [];
  const counts = { duplicates: 0, zMismatch: 0 };
  let skippedOpen = 0;
  let extraProperties = 0;
  let i = 0;

  while (i < lines.length) {
    const head = lines[i].trim();
    if (!/^PLINE\b/i.test(head)) { i++; continue; }

    const m = head.match(/^PLINE\s+(\d+)(?:\s+\d+)?(?:\s+(.*))?$/i);
    if (!m) throw Error(`GOCAD PLINE on line ${i + 1} has no readable vertex count.`);
    const nv = Number(m[1]);
    if (!Number.isInteger(nv) || nv < 3) { skippedOpen++; i++; continue; }
    const name = (m[2] || '').trim();
    const { vertices, extra } = readGocadVertices(lines, i + 1, nv, name, i + 1);
    extraProperties += extra;

    const storedClosed = sameXY(vertices[0], vertices[nv - 1]);
    const segClosed = !storedClosed && gocadClosingSegment(lines, i + 1 + nv, nv);
    if (!storedClosed && !segClosed) { skippedOpen++; i += nv + 1; continue; }

    for (let k = 1; k < vertices.length; k++) if (sameXY(vertices[k - 1], vertices[k])) counts.duplicates++;
    if (storedClosed && !sameZ(vertices[0], vertices[vertices.length - 1])) counts.zMismatch++;

    objects.push({
      kind: 'polygon',
      rings: [{ vertices, closed: true, storedClosed }],
      attributes: name ? { name } : {},
    });
    i += nv + 1;
  }

  if (objects.length === 0) {
    throw Error('No closed GOCAD PLINE curves found. Open PLINE curves belong to Culture Lines/Points.');
  }

  const summary = summarizePolygons(objects);
  const warnings = [];
  if (skippedOpen) warnings.push(`${skippedOpen} open GOCAD PLINE curve${skippedOpen === 1 ? '' : 's'} skipped; open curves belong to Culture Lines/Points.`);
  if (extraProperties) warnings.push(`Per-vertex property values on ${extraProperties} GOCAD vertex line${extraProperties === 1 ? '' : 's'} are not carried by the polygon model.`);
  if (counts.duplicates) warnings.push(`${counts.duplicates} consecutive duplicate vertex pair${counts.duplicates === 1 ? '' : 's'} preserved as stored.`);
  if (counts.zMismatch) warnings.push(`${counts.zMismatch} closed ring${counts.zMismatch === 1 ? '' : 's'} repeat the first X/Y position with a different Z; both stored values are kept.`);
  if (summary.zeroAreaRings) warnings.push(`${summary.zeroAreaRings} ring${summary.zeroAreaRings === 1 ? '' : 's'} have zero area, so no orientation can be reported.`);
  warnings.push(...selfIntersectionWarnings(objects));

  return {
    kind: 'polygon',
    format: 'gocad',
    objects,
    crs: crs || null,
    units: units || null,
    fileName,
    skipped: skippedOpen,
    warnings,
  };
}

function readGocadVertices(lines, start, count, name, headLine) {
  const vertices = [];
  let extra = 0;
  for (let k = 0; k < count; k++) {
    const line = lines[start + k];
    if (line === undefined) throw Error(`GOCAD PLINE ${name || '#' + headLine} ends after ${k} of ${count} vertices.`);
    const t = line.trim().split(/\s+/).filter(Boolean);
    if (t.length < 2 || !Number.isFinite(Number(t[0])) || !Number.isFinite(Number(t[1]))) {
      throw Error(`GOCAD PLINE ${name || '#' + headLine}: vertex ${k + 1} is not a numeric X Y (Z) record.`);
    }
    const vertex = { x: Number(t[0]), y: Number(t[1]) };
    if (t.length > 2) {
      if (!Number.isFinite(Number(t[2]))) throw Error(`GOCAD PLINE ${name || '#' + headLine}: vertex ${k + 1} has a non-numeric Z.`);
      vertex.z = Number(t[2]);
    }
    if (t.length > 3) extra++;
    vertices.push(vertex);
  }
  return { vertices, extra };
}

// A GOCAD PLINE can declare closure with a SEG record joining the last vertex
// to the first instead of repeating the vertex. Accept one-based and zero-based
// segment indices, because both appear in files written by different tools.
function gocadClosingSegment(lines, start, nv) {
  const end = Math.min(lines.length, start + 4000);
  for (let i = start; i < end; i++) {
    const t = lines[i].trim();
    if (/^(PLINE|VSET|TSURF|TSOLID|VOXET|WELL|ARC|LINE)\b/i.test(t)) return false;
    if (!/^SEG\b/i.test(t)) continue;
    for (let j = i + 1; j < end; j++) {
      const s = lines[j].trim();
      if (/^END\b/i.test(s) || /^(PLINE|VSET|TSURF|TSOLID|VOXET|WELL|ARC|LINE)\b/i.test(s)) break;
      const m = s.match(/^(\d+)\s+(\d+)\s*$/);
      if (!m) continue;
      const a = Number(m[1]);
      const b = Number(m[2]);
      if ((a === 1 && b === nv) || (a === nv && b === 1)) return true;
      if ((a === 0 && b === nv - 1) || (a === nv - 1 && b === 0)) return true;
    }
    return false;
  }
  return false;
}

function gocadField(lines, field) {
  for (const l of lines) {
    const m = l.trim().match(new RegExp(`^${field}\\s*[:=]\\s*(.+)$`, 'i'));
    if (m) return m[1].trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Summary

export function summarizePolygons(objects) {
  let polygonCount = 0;
  let ringCount = 0;
  let vertexCount = 0;
  let holeCount = 0;
  let closedRings = 0;
  let openRings = 0;
  let repeatedRings = 0;
  let exteriorCW = 0;
  let exteriorCCW = 0;
  let holeCW = 0;
  let holeCCW = 0;
  let zeroAreaRings = 0;
  let zVertexCount = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let zMin = Infinity, zMax = -Infinity;
  const attrNames = new Set();

  for (const o of objects) {
    for (const key of Object.keys(o.attributes || {})) attrNames.add(key);
    const polygons = o.kind === 'polygon' ? [o.rings] : o.polygons;
    polygonCount += polygons.length;
    for (const rings of polygons) {
      rings.forEach((ring, ri) => {
        ringCount++;
        if (ri > 0) holeCount++;
        if (ring.closed) closedRings++; else openRings++;
        if (ring.storedClosed) repeatedRings++;
        vertexCount += ring.vertices.length;

        const direction = ringDirection(ring);
        if (direction === 'degenerate') zeroAreaRings++;
        else if (ri === 0) { if (direction === 'ccw') exteriorCCW++; else exteriorCW++; }
        else if (direction === 'cw') holeCW++;
        else holeCCW++;

        for (const v of ring.vertices) {
          minX = Math.min(minX, v.x);
          minY = Math.min(minY, v.y);
          maxX = Math.max(maxX, v.x);
          maxY = Math.max(maxY, v.y);
          if (Number.isFinite(v.z)) {
            zVertexCount++;
            zMin = Math.min(zMin, v.z);
            zMax = Math.max(zMax, v.z);
          }
        }
      });
    }
  }

  const hasZ = zVertexCount > 0;
  return {
    objectCount: objects.length,
    polygonCount,
    ringCount,
    holeCount,
    vertexCount,
    closedRings,
    openRings,
    repeatedRings,
    exteriorCW,
    exteriorCCW,
    holeCW,
    holeCCW,
    zeroAreaRings,
    hollow: holeCount > 0,
    hasZ,
    partialZ: hasZ && zVertexCount < vertexCount,
    bounds: vertexCount ? [minX, minY, maxX, maxY] : null,
    zBounds: hasZ ? [zMin, zMax] : null,
    attrNames: [...attrNames],
  };
}

export function ringDirection(ring) {
  const area = signedArea(ring.vertices, ring.storedClosed);
  if (area > 0) return 'ccw';
  if (area < 0) return 'cw';
  return 'degenerate';
}

function signedArea(vertices, dropClosingVertex) {
  const pts = dropClosingVertex && vertices.length > 1 ? vertices.slice(0, -1) : vertices;
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

// ---------------------------------------------------------------------------
// Writers

export function writePolygons(model, target) {
  if (target === 'geojson') return writeGeoJson(model);
  if (target === 'gocad') return writeGocad(model);
  throw Error(`No writer for target format: ${target}`);
}

function writeGeoJson(model) {
  let closedCount = 0;
  let reversedCount = 0;
  let degenerateCount = 0;
  let zMismatchCount = 0;

  const features = model.objects.map(o => {
    const polygons = o.kind === 'polygon' ? [o.rings] : o.polygons;
    const coordinates = polygons.map(rings => rings.map((ring, ri) => {
      const prepared = prepareGeoJsonRing(ring, ri === 0);
      if (prepared.closed) closedCount++;
      if (prepared.reversed) reversedCount++;
      if (prepared.degenerate) degenerateCount++;
      if (prepared.zMismatch) zMismatchCount++;
      return prepared.vertices.map(toCoordinate);
    }));
    const geometry = o.kind === 'polygon'
      ? { type: 'Polygon', coordinates: coordinates[0] }
      : { type: 'MultiPolygon', coordinates };
    return { type: 'Feature', properties: { ...o.attributes }, geometry };
  });

  const collection = { type: 'FeatureCollection', features };
  if (model.crs) {
    if (looksLikeWkt(model.crs)) collection.peforma_crs_wkt = model.crs;
    else collection.crs = { type: 'name', properties: { name: model.crs } };
  }

  const warnings = [];
  if (closedCount) warnings.push(`${closedCount} ring${closedCount === 1 ? '' : 's'} were stored open and were closed for GeoJSON by repeating the first vertex.`);
  if (reversedCount) warnings.push(`${reversedCount} ring${reversedCount === 1 ? '' : 's'} were reversed to RFC 7946 orientation: exterior counter-clockwise, holes clockwise.`);
  if (degenerateCount) warnings.push(`${degenerateCount} ring${degenerateCount === 1 ? '' : 's'} have zero area, so orientation could not be determined and was left as stored.`);
  if (zMismatchCount) warnings.push(`${zMismatchCount} ring${zMismatchCount === 1 ? '' : 's'} repeat their first X/Y position with a different Z; stored Z values were kept where the ring order allowed.`);

  return { text: JSON.stringify(collection, null, 2) + '\n', warnings };
}

function prepareGeoJsonRing(ring, exterior) {
  const work = (ring.storedClosed ? ring.vertices.slice(0, -1) : ring.vertices.slice()).map(v => ({ ...v }));
  const area = signedArea(work, false);
  const degenerate = area === 0;
  let reversed = false;
  if (!degenerate && (area > 0) !== exterior) {
    work.reverse();
    reversed = true;
  }

  if (!ring.storedClosed) {
    return { vertices: [...work, { ...work[0] }], closed: true, reversed, degenerate, zMismatch: false };
  }

  const storedLast = ring.vertices[ring.vertices.length - 1];
  const zMismatch = !sameZ(ring.vertices[0], storedLast);
  return {
    vertices: [...work, reversed ? { ...work[0] } : { ...storedLast }],
    closed: false,
    reversed,
    degenerate,
    zMismatch,
  };
}

function writeGocad(model) {
  let closedCount = 0;
  let holeCount = 0;
  let droppedValues = 0;
  const lines = ['UP TO'];
  if (model.crs) lines.push(`CRS: ${model.crs}`);
  if (model.units) lines.push(`UNITS: ${model.units}`);
  lines.push('');

  for (const o of model.objects) {
    const name = o.attributes?.name ?? '';
    const polygons = o.kind === 'polygon' ? [o.rings] : o.polygons;
    for (const rings of polygons) {
      holeCount += Math.max(0, rings.length - 1);
      for (const ring of rings) {
        const vertices = ring.storedClosed ? ring.vertices : [...ring.vertices, { ...ring.vertices[0] }];
        if (!ring.storedClosed) closedCount++;
        lines.push(`PLINE ${vertices.length} 4 ${name}`.trimEnd());
        vertices.forEach(v => lines.push(gocadVertex(v)));
        lines.push('');
      }
    }
    droppedValues += Object.keys(o.attributes || {}).filter(key => key !== 'name').length;
  }

  const warnings = [];
  if (closedCount) warnings.push(`${closedCount} ring${closedCount === 1 ? '' : 's'} were stored open and were closed by repeating the first vertex in GOCAD.`);
  if (holeCount) warnings.push(`${holeCount} hole ring${holeCount === 1 ? '' : 's'} were written as separate closed curves because GOCAD PLINE has no hole structure.`);
  if (model.objects.some(o => o.kind === 'multipolygon')) warnings.push('Each polygon in a MultiPolygon was written as its own closed curve; GOCAD has no multipart container.');
  if (droppedValues) warnings.push(`${droppedValues} attribute value${droppedValues === 1 ? '' : 's'} other than the name are not carried by GOCAD PLINE and were omitted.`);

  return { text: lines.join('\n') + '\n', warnings };
}

function toCoordinate(v) {
  const c = [v.x, v.y];
  if (Number.isFinite(v.z)) c.push(v.z);
  return c;
}

function gocadVertex(v) {
  const s = [v.x, v.y];
  if (Number.isFinite(v.z)) s.push(v.z);
  return s.join(' ');
}

// ---------------------------------------------------------------------------
// Geometry helpers

function sameXY(a, b) {
  return a.x === b.x && a.y === b.y;
}

function sameZ(a, b) {
  if (!Number.isFinite(a.z) && !Number.isFinite(b.z)) return true;
  return a.z === b.z;
}

function distinctXY(vertices, dropClosingVertex) {
  const pts = dropClosingVertex && vertices.length > 1 ? vertices.slice(0, -1) : vertices;
  const seen = new Set();
  for (const v of pts) seen.add(`${v.x},${v.y}`);
  return seen.size;
}

function selfIntersectionWarnings(objects) {
  let intersecting = 0;
  let unchecked = 0;
  let budget = SELF_INTERSECTION_VERTEX_BUDGET;

  for (const o of objects) {
    const polygons = o.kind === 'polygon' ? [o.rings] : o.polygons;
    for (const rings of polygons) {
      for (const ring of rings) {
        const work = ring.storedClosed ? ring.vertices.slice(0, -1) : ring.vertices;
        if (work.length > SELF_INTERSECTION_RING_LIMIT || budget <= 0) { unchecked++; continue; }
        budget -= work.length;
        if (ringSelfIntersects(work)) intersecting++;
      }
    }
  }

  const warnings = [];
  if (intersecting) warnings.push(`${intersecting} ring${intersecting === 1 ? '' : 's'} self-intersect; reported, not repaired.`);
  if (unchecked) warnings.push(`Self-intersection was not checked for ${unchecked} ring${unchecked === 1 ? '' : 's'} above ${SELF_INTERSECTION_RING_LIMIT.toLocaleString()} vertices.`);
  return warnings;
}

function ringSelfIntersects(vertices) {
  const n = vertices.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    if (sameXY(a, b)) continue;
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1) continue;
      if (i === 0 && j === n - 1) continue;
      const c = vertices[j];
      const d = vertices[(j + 1) % n];
      if (sameXY(c, d)) continue;
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

function segmentsIntersect(a, b, c, d) {
  const o1 = cross(a, b, c);
  const o2 = cross(a, b, d);
  const o3 = cross(c, d, a);
  const o4 = cross(c, d, b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  if (o1 === 0 && onSegment(a, b, c)) return true;
  if (o2 === 0 && onSegment(a, b, d)) return true;
  if (o3 === 0 && onSegment(c, d, a)) return true;
  if (o4 === 0 && onSegment(c, d, b)) return true;
  return false;
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a, b, p) {
  return p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x)
    && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
}

function looksLikeWkt(text) {
  return /[\[\]]|PROJCS|GEOGCS|PROJCRS|GEOGCRS/i.test(text);
}
