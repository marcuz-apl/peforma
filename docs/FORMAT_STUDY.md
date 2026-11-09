# Format study: the bundled example set

## Purpose

The files under `examples/` are the same reference grid saved in five formats: CPS-3 ASCII, ZMAP+ ASCII, IRAP Classic ASCII, EarthVision ASCII and Shapefile. Comparing them node by node established the real header meaning, storage order and null convention for each format. This note records those findings, the defects they exposed and the checks used to confirm the fixes.

## Reference geometry

| Property | Value |
| --- | --- |
| Columns (`nx`) | 152 |
| Rows (`ny`) | 252 |
| X bounds | 358413 to 365963 |
| Y bounds | 3142534 to 3155084 |
| Increments | 50 by 50 |
| Nodes | 38,304 |
| Null nodes | 156 |
| Value range | 5899.32959 to 7601.849609 |
| CRS | ED50 / UTM zone 34N |

CPS-3 and ZMAP+ contain identical values and identical null positions. IRAP and EarthVision contain identical values and identical null positions. All four agree once the storage order is accounted for; the only numeric difference is the ZMAP+ file's float32 precision, at most 5e-5.

## Storage order

CPS-3 and ZMAP+ write nodes column by column, starting at the north-west corner (`xmin`, `ymax`) and running south. For a logical row `r` counted from `ymin` and a column `c` counted from `xmin`, the file position is:

```
fileIndex = c * ny + (ny - 1 - r)
```

IRAP Classic writes rows from `ymin` upward, so its file position is row-major:

```
fileIndex = r * nx + c
```

EarthVision scatters the same nodes but carries explicit 1-based column and row indices, so no order needs to be inferred.

Peforma Horizon/Grid stores grids internally in the IRAP/EarthVision order: row-major from `ymin`. CPS-3 and ZMAP+ are reordered on import and reordered again on export.

## Format details

### CPS-3 ASCII

- `FSNROW <rows> <columns>` gives rows then columns; the example is `FSNROW 252 152`.
- `FSXINC <dx> <dy>` gives the increments; the example is `FSXINC 50.000000 50.000000`.
- `FSLIMI <xmin> <xmax> <ymin> <ymax> <zmin> <zmax>` gives bounds and the value range.
- `FSASCI` declares the null marker as `0.1E+31`, which is 1e30.
- Node values follow the `->MSMODL:` record in column-major north-west to south order.
- Null nodes are written with the literal `0.1E+31`.

### ZMAP+ ASCII

- The dimensions record in a ZIMS/Kingdom export is `<rows>, <columns>, <xmin>, <xmax>, <ymin>, <ymax>`. The example is `252, 152, 358413, 365963, 3142534, 3155084`.
- The next record is `<rotation>, <dx>, <dy>`. The example is `0.0000, 50.0000, 50.0000`.
- The null control record is `<width>, <null>, <blank>, <decimals>, <flag>`. The example is `15, 0.1000000E+31, , 7, 1`.
- The null marker in the control record and in the data is `0.1000000E+31`, which is 1e30.
- Node values follow the closing `@` in the same column-major north-west to south order as CPS-3.
- Some writers declare columns first. Peforma Horizon/Grid resolves the orientation by matching the coordinate spans to the declared increments, and falls back to the declared order only when the increments are missing or zero. This keeps both header conventions readable without guessing from file names.

### IRAP Classic ASCII

- Record 1 is `-996 <rows> <dx> <dy>`. The example is `-996 252 50.000000 50.000000`.
- Record 2 is `<xmin> <xmax> <ymin> <ymax>`.
- Record 3 is `<columns> 0 <xmin> <ymin>`. The example is `152 0.000000 358413.000000 3142534.000000`.
- Record 4 is the seven-value control record.
- Null nodes use `9999900`.
- Node values are row-major from `ymin`, matching the explicit row indices in EarthVision.

### EarthVision ASCII

- The example is version 6 scattered data.
- `Grid_size: <columns> x <rows>` gives columns then rows; the example is `152 x 252`.
- Each node record is `x y z column row` with 1-based column and row indices.
- Null nodes are omitted rather than written with a sentinel.
- Peforma Horizon/Grid restores the regular grid from the explicit indices and fills missing nodes with an internal null value.

### Shapefile

- The example is a `.shp`, `.shx`, `.dbf` and `.prj` bundle in ED50 / UTM zone 34N.
- It contains boundary geometry, not grid node values.
- Turning the boundary into a regular grid would require an interpolation method and cell size, so Peforma Horizon/Grid does not convert it. Shapefile feature exchange is handled by the sibling [Peforma Shapefile](../PRD.md#shapefile) tool.

## Defects this study exposed

| Symptom | Cause | Correction |
| --- | --- | --- |
| `FSNROW 152 252` and `FSXINC 30.08 83.11` instead of `252 152` and `50 50` | ZMAP dimensions were read as columns then rows | Orientation is resolved from bounds and declared increments |
| Surface appeared sheared or transposed | CPS-3 and ZMAP values were read as row-major | Values are converted column-major to row-major on import and back on export |
| Null nodes were treated as real values | CPS-3 sentinel was assumed to be 1e31 | CPS-3 uses `0.1E+31` (1e30) in both the header and the data |
| ZMAP increments were lost | Exporter wrote `0.0, 0.0, 0.0` | Exporter writes the real `dx` and `dy` |
| ZMAP header order did not match the source software | Exporter wrote columns first | Exporter writes rows first, matching the ZIMS/Kingdom layout |

Values themselves were never rescaled or altered. The apparent data difference came from wrong dimensions, wrong ordering and wrong null handling.

## Verification

The conversion matrix below was run after the fixes. Each source example was uploaded, exported to CPS-3, and compared with the bundled CPS-3 reference. The CPS-3 reference was then exported to the other formats and compared node by node.

| Source | Result |
| --- | --- |
| CPS-3 to CPS-3 | 0 value differences, 0 null mismatches |
| ZMAP+ to CPS-3 | 0 value differences, 0 null mismatches, maximum numeric difference 5e-5 from float32 source precision |
| IRAP to CPS-3 | 0 value differences, 0 null mismatches |
| EarthVision to CPS-3 | 0 value differences, 0 null mismatches |
| CPS-3 to ZMAP+ | 0 value differences, 0 null mismatches, header `252, 152` with `0.0, 50, 50` |
| CPS-3 to IRAP | 0 value differences, 0 null mismatches, header `-996 252 50 50` |
| CPS-3 to EarthVision | All 38,148 non-null nodes match by column and row; all 156 null nodes are omitted |

The production build also completes successfully after the changes.

## Independent synthetic check

A second, deliberately different dataset lives in `examples/Synthetic/`. It is a 37 by 23 grid with 25 by 40 increments, bounds 100000 to 100900 and 2000000 to 2000880, 851 nodes, seven known null nodes, and values that encode their own row and column. It is non-square, uses different increments in X and Y, and is small enough to inspect by hand.

The CPS-3 version was converted to CPS-3, ZMAP+, IRAP Classic and EarthVision, then each output was re-imported and converted back to CPS-3. A second ZMAP+ file with the columns-first header was also tested.

| Path | Result |
| --- | --- |
| CPS-3 to CPS-3 | 0 value differences, 0 null mismatches |
| CPS-3 to ZMAP+ to CPS-3 | 0 value differences, 0 null mismatches |
| CPS-3 to IRAP to CPS-3 | 0 value differences, 0 null mismatches |
| CPS-3 to EarthVision to CPS-3 | 0 value differences, 0 null mismatches |
| Columns-first ZMAP+ to CPS-3 | 0 value differences, 0 null mismatches |

The generated headers were `FSNROW 23 37` with `FSXINC 25 40` in CPS-3, `23, 37` with `0.0, 25, 40` in ZMAP+, and `-996 23 25 40` with 37 columns in IRAP. EarthVision reported `Grid_size: 37 x 23` and omitted exactly the seven null nodes, leaving 844 records.

## Re-running the study

1. Start the app with `npm run dev`.
2. Upload a file from `examples/` and check that the summary reports 152 by 252, 38,304 nodes, 50 by 50 increments and 156 null nodes.
3. Export to CPS-3 and confirm `FSNROW 252 152`, `FSXINC 50 50` and the `0.1E+31` null marker.
4. Repeat for the ZMAP+, IRAP and EarthVision examples; all four should produce the same node values.

## Interoperability caution

Dialects vary by application and version. The rules above describe the bundled ZIMS/Kingdom exports and the formats they produce, not every possible writer. No reprojection or vertical unit conversion is performed, and null sentinels are mapped to the target format rather than recalculated. Confirm orientation, units, nulls and CRS in the target software before operational use.
