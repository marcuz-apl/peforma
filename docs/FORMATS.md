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

A delimited file with a header has its column mapping pre-seeded from labels that clearly name each axis; a file without a header has anonymous columns, so the user must assign the X and Y columns explicitly before the rows are treated as geometry. In line mode, consecutive rows are grouped into one polyline, split whenever the mapped Name column changes.

Closed polygon geometry (GeoJSON Polygon/MultiPolygon, closed GOCAD curves, fault-polygon dialects) belongs to the planned Culture Polygon converter. Esri Shapefile bundles belong to the planned Peforma Shapefile tool. Neither is offered as a Lines/Points case.
