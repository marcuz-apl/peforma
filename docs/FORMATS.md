# Supported format variants

All file parsing and writing runs locally in the browser.

## Format detection

ASCII grids are identified from their contents, never from the file extension. A CPS-3, EarthVision, IRAP Classic or ZMAP+ grid is accepted whatever it is named (`.grid`, `.txt`, `.dat`, no extension at all). When several files are selected, each is tried in turn and the first one whose contents match a supported format is loaded.

The files under `examples/` are the same 152 by 252 reference grid saved in each format. They are the reference set for parser and exporter checks: CPS-3 and ZMAP+ must produce the same node values as IRAP Classic and EarthVision. The measured ordering, null conventions and verification results are recorded in [the format study](FORMAT_STUDY.md).

EarthVision `Field:` records may carry a unit suffix (for example `# Field: 3 z feet`); the field number and name are matched, and the suffix is ignored.

## EarthVision ASCII

The provided Petrel-style export is version 6 scattered data. Its header includes `Grid_size: 152 x 252`, `Grid_space` bounds, and X/Y/Z/column/row fields. The node records carry 1-based column and row indices. Peforma Grid uses those indices to restore the regular grid without interpolating. `Z_units` is preserved as descriptive metadata; values are not rescaled.

## CPS-3 ASCII

The example uses `FSASCI`, `FSLIMI`, `FSNROW`, `FSXINC`, a `->MSMODL:` marker, then node values. `FSNROW` gives rows then columns. Nodes are stored column by column, starting at the north-west corner (`xmin`, `ymax`) and running south, so Peforma reorders them into its internal row-major grid. `0.1E+31` (1e30) is the null marker both in the header and in the values.

## IRAP Classic ASCII

The example uses the `-996` classic header: row count and increments on record one, bounds on record two, column count and origin on record three, a control record, then node values. Values are row-major from the southern row (`ymin`), matching EarthVision’s explicit row indices. Null nodes use `9999900`.

## ZMAP+ ASCII

The replacement example is a real ZMAP+ grid: an `@Grid HEADER, GRID, 5` record, value-width/null control record, grid dimensions and coordinate bounds, an origin/increment record, a closing `@`, and then values. Its dimensions are `252, 152` and increments are 50 by 50. This exporter declares rows then columns, while other writers declare columns then rows; Peforma resolves the orientation from the coordinate spans and the declared increments. Nodes are stored column by column from the north-west corner, as in CPS-3.

## Interoperability caution

File dialects and node traversal conventions vary by application. Compare converted grids in the target software, including orientation, null nodes, coordinates, units, and CRS, before operational use. No reprojection or vertical unit conversion is performed.

## Culture Lines/Points (Peforma Culture)

Peforma Culture is the vector tool; its Lines/Points converter handles open line and point formats. Delimited text (CSV, TSV, XYZ), Petrel-style ASCII points and lines, GeoJSON, and GOCAD ASCII `PLINE`/`VSET` are recognised from their contents or the selected file extension; a `.geojson`/`.json` file is parsed as GeoJSON, and a `UP TO`/`PLINE`/`VSET` marker near the top selects GOCAD.

Vertex order, attribute values, the distinction between a missing and a zero Z coordinate, and CRS/units labels are preserved exactly as read. No reprojection or unit conversion is performed.

A delimited file with a header has its column mapping pre-seeded from labels that clearly name each axis; a file without a header has anonymous columns, so the user must assign the X and Y columns explicitly before the rows are treated as geometry. In line mode, consecutive rows are grouped into one polyline, split whenever the mapped Name column changes. Fault sticks are ordinary polylines: a fault name or ID column groups the vertices of one stick and is carried as an attribute. Fault planes are triangulated surfaces handled by Peforma 3D.

Closed polygon geometry (GeoJSON Polygon/MultiPolygon and closed GOCAD curves) belongs to the Culture Polygon converter and is not offered as a Lines/Points case. The vendor fault-polygon dialects remain planned.

## Culture Polygon (Peforma Culture)

The Polygon converter reads GeoJSON `Polygon` and `MultiPolygon` geometry and GOCAD ASCII closed PLINE curves, and writes GeoJSON or GOCAD. Detection is by extension first (`.geojson`/`.json` is GeoJSON) and then by contents: a `UP TO` header or a leading `PLINE` selects GOCAD, and any other file must parse as JSON to be accepted as GeoJSON.

A polygon is stored as an ordered list of rings. The first ring is the exterior and every later ring is a hole. Polygon order, ring order, hole order, and vertex order are preserved exactly; rings are never joined, split, reordered, or deduplicated. Missing Z is distinct from Z = 0, and a partially Z-valued model is reported as partial.

Ring closure is read, not invented. A GeoJSON ring is treated as stored-closed when its last position repeats its first X/Y position. A GOCAD PLINE is treated as closed when the last vertex repeats the first or when a `SEG` record joins the last vertex to the first; one-based and zero-based segment indices are both accepted. An open GOCAD curve is skipped with a warning because open curves belong to Lines/Points. Closure is reported in the summary and is applied only when writing.

Ring orientation (clockwise or counter-clockwise) is computed from the signed area and reported as stored, separately for exterior rings and holes. A zero-area ring is reported as having no reportable orientation. Self-intersecting rings are detected for rings up to 1,200 vertices within a 6,000-vertex check budget and are reported, never repaired.

GeoJSON output closes every ring and applies RFC 7946 orientation: exterior rings counter-clockwise and holes clockwise. Every ring that had to be closed or reversed is counted in a warning. GOCAD output writes each ring as its own closed `PLINE` by repeating the first vertex; it warns that holes and multipart areas become separate curves and that attributes other than the object name cannot be carried. GOCAD headers may declare `CRS` and `UNITS` as free text; both are preserved verbatim and never interpreted as EPSG codes. GeoJSON CRS metadata is read from `peforma_crs_wkt` first and then the legacy `crs` member, and is written back in the same form. No reprojection or unit conversion is performed.

## Esri Shapefile (Peforma Shapefile)

Peforma Shapefile reads a bundle of `.shp`, `.shx`, `.dbf`, and optional `.prj` files, or a GeoJSON file, and writes either a GeoJSON FeatureCollection or a ZIP of shapefile sets.

A `.shp` and a `.dbf` are required together; `.shx` is optional but, when present, its record count must match `.shp`. Record counts in `.dbf` are also checked against `.shp`, and null shape records are skipped with a warning. Shape types 1 (point), 3 (polyline), 5 (polygon), 8 (multipoint) and their Z variants 11, 13, 15, 18 are read; M-only variants are not treated as a separate geometry kind.

Polygon parts are grouped by ring orientation: clockwise rings start an exterior and counter-clockwise rings become holes, keeping source part order. Ring closure and orientation are preserved from the source and applied on write — Esri exterior rings clockwise, GeoJSON exterior rings counter-clockwise per RFC 7946, with holes reversed accordingly.

DBF attributes are carried by field name and value. Text is read as UTF-8 when it validates and otherwise falls back to Windows-1252 with a warning. On write, field names are limited to 10 ASCII characters with case-insensitive uniqueness, numeric widths are kept within 18 characters, and values a DBF field cannot hold, such as nulls outside logical fields, are written as blanks with a warning.

A `.prj` file is treated as WKT and stored as text without interpretation; GeoJSON round-trips through the legacy `crs` member or the `peforma_crs_wkt` member. No reprojection, datum transformation, or unit conversion is performed. When a model mixes geometry kinds, one shapefile set is written per kind inside the ZIP.

