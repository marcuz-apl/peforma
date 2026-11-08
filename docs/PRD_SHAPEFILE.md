# Peforma Shapefile — Esri Shapefile Bundle Exchange

Status: implemented at `#shapefile`. The tool reads Esri Shapefile sets (`.shp`, `.shx`, `.dbf`, `.prj`, `.cpg`) and GeoJSON, then writes either a GeoJSON FeatureCollection or a shapefile ZIP. Multi-file bundle download, per-record geometry, DBF attributes, Z values, CRS text, and ring conventions are handled; no reprojection, unit conversion, topology repair, or shapefile compression is performed.

Peforma Shapefile is the suite member for the Esri Shapefile container. It is separate from Peforma Culture: Culture converts vector geometry between open formats, while Shapefile owns the bundle itself — the `.shp` records, the `.shx` index, the `.dbf` attribute table, and the `.prj` definition. Culture Polygon remains planned and does not read or write shapefiles.

## Problem

Shapefiles are the practical delivery format for GIS and interpretation data, but they are not a single file. A set that appears complete in a folder may be missing its `.dbf`, have an `.shx` from a different export, or carry a `.prj` that contradicts the coordinates. Attribute names are capped, nulls are not representable, text encoding is often undeclared, and polygon ring orientation follows a different convention from GeoJSON. A converter that quietly repairs these differences can change field names, drop Z values, or reverse rings without the user noticing.

## Goal

Read a supported shapefile set or GeoJSON, show exactly which records, geometry kinds, attributes, and CRS were found, and write a supported target without changing record order, vertex order, attribute values, or present Z values. Report every convention the writer applies and reject an inconsistent bundle instead of producing a plausible partial result.

## Users

Oil and gas geoscientists, GIS analysts, and data managers who need to move culture data, well locations, fault traces, and polygons between interpretation software, GIS, and data rooms. They need a repeatable exchange that states its assumptions rather than a lossy "open and save".

## Scope

### Implemented

- Read `.shp` geometry records for null, point, multipoint, polyline, polygon, and their Z and M variants.
- Read `.shx` when present and require its record count to match the `.shp` file.
- Read `.dbf` attributes, including character, numeric, float, logical, and date fields; decode UTF-8 with a Windows-1252 fallback.
- Read `.prj` as a CRS definition and carry it as text.
- Read GeoJSON `Point`, `MultiPoint`, `LineString`, `MultiLineString`, `Polygon`, `MultiPolygon`, and `GeometryCollection`.
- Show feature and vertex counts, coordinate bounds, Z range, geometry kinds, ring count, CRS, and attribute names.
- Show the first features, every warning, and every writer convention applied.
- Write GeoJSON with RFC 7946 ring closure and orientation rules, and preserve a WKT CRS in a foreign member.
- Write a shapefile ZIP with one set per geometry kind, Z type codes when every vertex has Z, and a `.cpg` when attribute text is non-ASCII.
- Preserve record order, geometry order, part order, ring order, attribute values, and finite Z values.

### Out of scope

- Reading or writing `.zip` archives, `.sbn`, `.sbx`, `.qix`, `.xml` metadata, or Esri geodatabase containers.
- Reprojection, datum or geoid transformation, unit conversion, and vertical reference conversion.
- Topology repair, self-intersection fixing, simplification, densification, buffering, dissolve, or area computation.
- Writing field names longer than ten ASCII characters, multiple DBF tables, memo fields, or binary fields.
- Attribute type inference across mixed values beyond number, boolean, and text.
- Shapefile compression, multi-patch geometry, or true 3D surface primitives.
- Server-side processing or telemetry.

## Bundle rules

| File | Required | Reading | Writing |
| --- | --- | --- | --- |
| `.shp` | Yes | 100-byte header, then big-endian record headers with little-endian content | Header plus one record per feature |
| `.shx` | No | Record count must match `.shp` | Written for every set |
| `.dbf` | Yes | Row count must match `.shp` records; deleted rows flagged | Written with the union of attribute field names |
| `.prj` | No | Carried as CRS text | Written when a CRS label or WKT is present |
| `.cpg` | No | Accepted but not required | Written as `UTF-8` when non-ASCII text is present |

A bundle with no `.shp` or no `.dbf` is rejected. A `.shx` or `.dbf` whose count differs from the geometry record count is rejected, because a partial conversion would silently misalign records and attributes.

## Geometry model

| Concept | Shape type | Z variant | Rules |
| --- | --- | --- | --- |
| Null record | 0 | None | Skipped and counted |
| Point | 1 | 11 | One coordinate |
| PolyLine | 3 | 13 | One or more parts, each with two or more vertices |
| Polygon | 5 | 15 | Closed rings; exterior clockwise, holes counter-clockwise |
| MultiPoint | 8 | 18 | Ordered point collection |

Measure (M) variants 21, 23, 25, and 28 are read for geometry but M values are ignored and reported. A polygon record's parts are grouped into polygons by ring orientation when read, so a record with several exteriors becomes a MultiPolygon rather than one polygon with unrelated rings.

## Reading GeoJSON

GeoJSON input follows RFC 7946 geometry types. A `GeometryCollection` is split into one feature per member with the same properties. A polyline needs at least two vertices and a ring needs at least three; shorter geometry is rejected with the feature number. Coordinates must be finite numbers.

## Writing conventions

- GeoJSON output closes linear rings, writes exterior rings counter-clockwise and holes clockwise, and reports how many rings were closed or reversed.
- A short CRS label is written in the legacy `crs` member; a WKT definition is written verbatim as `peforma_crs_wkt` so shapefile output can restore the `.prj`.
- Shapefile output is a ZIP with one set per geometry kind, because one shapefile can carry only one geometry type.
- Z values are written only when every vertex in the set has a finite Z; otherwise the set is written without Z and the drop is reported.
- DBF field names are limited to ten ASCII characters and must be unique; a renamed or truncated name is reported.
- A missing attribute value becomes a blank because a DBF field has no null marker, and the count is reported.
- Attributes are written as text, number, or logical fields from their values; non-ASCII text is written as UTF-8 with a `.cpg` file.

## User experience

1. Drop or choose one GeoJSON file or one complete shapefile set. More than one set in a single drop is rejected.
2. Show the loaded set name, record count, vertex count, bounds, Z range or CRS, geometry kinds, ring count, and attribute names.
3. Show the first features and every warning: a missing `.shx`, skipped null records, deleted rows, or a fallback text encoding.
4. Choose GeoJSON or the shapefile bundle and show the conventions the writer will apply.
5. Download either a `.geojson` file or a `.zip` containing `.shp`, `.shx`, `.dbf`, `.prj`, and `.cpg` as applicable.

## Validation and errors

- Reject a missing `.shp` or `.dbf` and name the missing part.
- Reject a `.shx` or `.dbf` whose record count differs from the `.shp` file.
- Reject a `.shp` with the wrong header code, an unsupported version, a declared length beyond the file, or a truncated record.
- Reject files that are not part of one set and files with duplicate extensions.
- Reject GeoJSON that is not valid JSON, has no supported geometry, or contains a point without finite X and Y or too-short line and ring geometry.
- Never crash the page on malformed input; keep the previous result available.

## Interoperability cautions

- Some readers expect ANSI text and ignore `.cpg`; a UTF-8 attribute value may still display incorrectly outside modern GIS software.
- Deleted `.dbf` rows and null geometry records are preserved as listed warnings rather than removed silently.
- Z support varies by reader; a Z shapefile may import as 2D.
- A `.prj` may be absent or may describe a CRS that is not EPSG-coded; the text is carried, not interpreted.
- DBF field widths and decimal places are inferred from the values and may differ from the source table.
- Confirm record order, geometry, attributes, ring orientation, CRS, and Z values in the receiving application before operational use.

## Acceptance criteria

- A user can load a shapefile set or GeoJSON, inspect record and geometry counts, bounds, Z or CRS, attributes, and warnings, and download a supported output.
- A set with a missing `.shp` or `.dbf`, or with mismatched record counts, is rejected with a readable reason.
- Exported geometry keeps record order, vertex order, part order, ring order, attribute values, and finite Z values, apart from the documented DBF name, blank-null, and Z-drop conventions.
- Ring closure and orientation applied by the writer are reported.
- The interface works on desktop and narrow screens and is keyboard accessible.
- All parsing and writing run in the browser.
