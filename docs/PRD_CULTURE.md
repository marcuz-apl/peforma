# Peforma Culture — Vector Data Exchange

Status: both Culture converters are implemented. **Lines/Points** reads and writes delimited text with an explicit column mapping, Petrel-style ASCII points and lines where the columns are unambiguous, GOCAD ASCII `.pl` and `.vs`, and GeoJSON `Point`, `MultiPoint`, `LineString`, and `MultiLineString`. **Polygon** reads and writes GeoJSON `Polygon` and `MultiPolygon` and closed GOCAD PLINE curves. Esri Shapefile is implemented as its own Peforma Shapefile tool, specified in [PRD_SHAPEFILE.md](PRD_SHAPEFILE.md). UKOOA P1/90, OGP P1/11, and OGP P6/11 navigation are implemented in Peforma Seismic, specified in [PRD_SEISMIC.md](PRD_SEISMIC.md). RESQML, DXF, KML, WITSML, and the vendor polygon dialects (IESX, CPS-3 Lines, Kingdom `.plg`, ZMAP `@FALT`) remain planned, and no line below should be read as a claim of support for them.

Peforma Culture is the suite member for vector geometry: ordered coordinates, closed rings, and the attributes that travel with them. Peforma Horizon/Grid handles regularly sampled surfaces; Culture handles everything that is not a grid or a seismic volume — fault sticks, contour lines, culture lines, well trajectories, well picks, fault polygons, horizon boundaries, prospect outlines, and other point, line, and polygon sets. Seismic navigation is a separate Peforma Seismic concern.

Culture is one product with two live geometry converters. **Lines/Points** handles open geometry. **Polygon** handles closed area geometry. Esri Shapefile is a container that can hold any of the three geometry kinds, so it is not a geometry converter; the live **Peforma Shapefile** tool owns the shapefile bundle itself, including its DBF attributes and `.prj` sidecar.

## Problem

Vector geometry is exchanged constantly between interpretation systems, but the exchange is fragile. The geometry itself is simple — coordinates in order — while the files that carry it differ in delimiter, column order, header conventions, coordinate reference system, vertical reference, units, attribute names, and whether a line is one object or a collection of segments.

Polygon exchange adds its own disagreements. The geometry is closed and ordered, which makes it look simple, but the rules for what makes a polygon valid — ring orientation, a repeated first vertex, holes, self-intersection, attribute inheritance, and the Z convention for planar versus closed-solid geometry — vary by producer. Two files that draw the same shape can fail to import because one repeats the first vertex at the end and the other does not, or because one ring runs clockwise and the other counter-clockwise.

Most large applications store vectors inside a project database. When a geoscientist needs to move that geometry to another application, they export a text, GIS, or shapefile interchange file, hand-map columns, and often resample or reorder vertices to satisfy the receiver. Each manual step can silently change vertex count, order, closure, ring orientation, Z values, or the meaning of an attribute column.

The same geometry also arrives from outside interpretation software: navigation from a seismic contractor, well trajectories from a drilling database, picks from a colleague, or culture data from a GIS team. These sources use different standards and different vendor dialects, and the receiving application may accept only one of them.

## Goal

Provide small browser tools that read supported vector exchange files, show exactly what geometry, rings, and attributes were found, let the user resolve ambiguous column mappings explicitly, and write a supported interchange file without changing coordinates, vertex order, ring order, ring orientation, or attributes.

The tool must be honest about ambiguity. A file with no header and three numeric columns could be X Y Z, Y X Z, X Z Y, or a measured-depth curve. Culture must ask rather than guess, and must reject a dialect it does not fully understand.

## Users

Oil and gas geoscientists, data managers, and interpreters who need to move points, polylines, and polygons between interpretation applications, GIS, and well-data systems. They are comfortable with coordinate systems and file formats but do not want to write conversion scripts for every exchange.

## Geometry model

Culture keeps one model with three geometry kinds, so parsing, writing, and the honesty rules stay consistent across converters.

| Concept | Converter | Meaning | Rules |
| --- | --- | --- | --- |
| Point set | Lines/Points | An unordered collection of points | Point order is preserved as read; no spatial sorting |
| Polyline | Lines/Points | One ordered path of vertices | Vertex order and duplicates are preserved; no simplification |
| Multipart line | Lines/Points | Several polylines sharing attributes | Parts keep their source order and a part index; parts are never joined |
| Polygon | Polygon | One outer ring plus zero or more inner rings | Rings keep source order; holes are never dropped or merged |
| Multipolygon | Polygon | A collection of polygons | Polygons keep their source order |
| Vertex | All | X, Y, optional Z, and optional per-vertex attributes | Missing Z is distinct from Z = 0 |
| Object attributes | All | Name, type, and other per-object, per-ring, or per-set fields | Preserved as typed strings or numbers, never merged by name guesswork |
| Closure | All | A polyline may repeat its first vertex; a ring may be stored open or closed | Preserved as stored; never normalized silently |
| Ring orientation | Polygon | Clockwise or counter-clockwise | Reported; RFC 7946 expects exterior CCW and interior CW in a geographic coordinate system |
| Self-intersection | Polygon | A ring that crosses itself | Reported as a warning; never repaired |
| CRS | All | Horizontal and vertical reference | Carried as metadata; never reprojected or silently assumed |
| Units | All | Horizontal and vertical units | Carried as metadata; never converted |

A line object is a single path. A polyline that happens to repeat its first vertex stays a polyline in Lines/Points; closure is preserved as stored and is not reinterpreted as a polygon. Geometry becomes a polygon only when the source declares polygon geometry or a closed ring structure — GeoJSON `Polygon`/`MultiPolygon`, a shapefile Polygon record, or a GOCAD curve declared as a boundary. That declaration is what routes a record to the Polygon converter instead of Lines/Points.

Coordinate order is a property of the file, not an assumption. Every reader states which axis it read first and records that decision in the result metadata so the export and the UI can report it.

A polygon that arrives closed in one format may arrive open in another because the exporter dropped the duplicated endpoint. The tool must not add or remove that endpoint silently. The reader records the closure state it found, and the writer applies the closure convention the target requires, stating that decision in the summary.

## Scope

### Lines/Points — implemented

- Read and write delimited text point and polyline files with an explicit column mapping chosen by the user.
- Read and write Petrel-style ASCII point and line layouts as delimited text where the columns are unambiguous.
- Read and write GOCAD ASCII polylines (`.pl`) and point sets (`.vs`).
- Read and write GeoJSON `Point`, `MultiPoint`, `LineString`, and `MultiLineString` geometry with property preservation.
- Read and write fault sticks as ordinary polylines: each stick is one ordered vertex path, and a fault name or ID is carried as an object attribute.
- Show geometry counts, coordinate bounds, vertex totals, Z range, attribute names, CRS source, and a lightweight preview.
- Preserve coordinate reference system metadata when present and label it as unknown when absent.
- Process files locally in the browser, with no upload and no telemetry.
- Produce actionable errors for unsupported dialects and malformed records.

### Polygon — implemented

- Read and write GeoJSON `Polygon` and `MultiPolygon` with property preservation. On write, rings are closed and oriented to RFC 7946: exterior counter-clockwise, holes clockwise.
- Read and write GOCAD ASCII closed curves as polygon boundaries. Closure is recognised from a repeated first/last vertex or a `SEG` record joining the last vertex to the first.
- Preserve polygon count, ring order, hole order, vertex order, stored closure, and attribute values exactly.
- Report polygon counts, ring counts, vertex totals, which rings are stored closed or open, the direction each ring runs, hole structure, zero-area rings, attribute names, CRS, and units.
- Report ring closure and orientation decisions the writer makes; never normalize them on read.
- Report self-intersecting rings and consecutive duplicate vertices without repairing them.
- Report what GOCAD cannot carry: hole linkage, multipart structure, and attributes other than the object name.
- Process files locally in the browser, with no upload and no telemetry.

### Polygon vendor dialects — planned

- Read the documented Petrel IESX fault-polygon ASCII export (`.dat` or `.iesx`) and the CPS-3 Lines ASCII polygon export.
- Read the Kingdom planimeter polygon format (`.plg`) and the ZMAP fault-polygon records marked with `@FALT`.

### Peforma Shapefile — implemented, separate product

- Read and write Esri Shapefile point, multipoint, polyline, polygon, and multipolygon features as a bundle: required `.shp` and `.dbf`, optional `.shx`, `.prj`, and `.cpg`.
- Preserve record order, geometry order, part order, and attribute values; report attribute names that cannot be written back exactly.
- Detect truncated bundles, missing `.dbf` files, mismatched `.shx` or `.dbf` counts, and unreadable geometry records.
- Exchange the same geometry with GeoJSON, including polygon and multipolygon geometry.
- Full scope lives in [PRD_SHAPEFILE.md](PRD_SHAPEFILE.md).

### Out of scope for Culture

- Vendor project databases and binary project files, including Petrel, OpenWorks, DecisionSpace, Kingdom, Petra, Roxar RMS, JewelSuite, GeoGraphix, and PaleoScan project stores.
- Fault planes and other triangulated surfaces, which belong to Peforma 3D, and structural-framework fault pillars, which are reservoir-grid objects rather than exchange polylines.
- Reading or writing seismic trace data, trace headers, or acquisition navigation. Those belong to Peforma Seismic, including UKOOA P1/90, OGP P1/11, and OGP P6/11.
- Well log curves (LAS, DLIS, LIS) and petrophysical interpretation objects.
- Topological operations: union, intersection, difference, buffer, dissolve, validity repair, self-intersection fixing, and area computation.
- Interpolation, smoothing, densification, simplification, snapping, node adjustment, and Z recalculation.
- Coordinate reprojection, datum transformation, geoid conversion, and unit conversion.
- Point-cloud formats such as LAS/LAZ, which are lidar products rather than geoscience vector data.
- Rasterized polygon fills and polygonization of line work. A polygon is exchanged as ring geometry, not as a mask.
- Z-aware solid polygons (closed 3D volumes). A Z value per vertex is preserved, but the tool does not build or validate a closed solid.
- Batch conversion and server-side storage.

## Format landscape

Vector data travels through three families of formats: open exchange standards, vendor ASCII exports, and vendor project databases. Only the first two are candidates for a browser converter.

### Open standards and documented formats

| Format | Steward or origin | Carries | Reading | Writing | Notes |
| --- | --- | --- | --- | --- | --- |
| CSV, TSV, XYZ, ASCII | No single owner | Arbitrary point and vertex tables | Yes, with explicit mapping | Yes, with chosen columns | Delimiter, decimal mark, header row, and column meaning must be declared by the user |
| GeoJSON | IETF RFC 7946 | Points, multipoints, lines, multilines, polygons, multipolygons, properties | Yes, all supported geometry kinds | Yes, all supported geometry kinds | WGS 84 longitude/latitude by specification; projected coordinates are outside the RFC and must be flagged; polygons use RFC 7946 closure and orientation |
| GOCAD ASCII `.pl` | Paradigm/Emerson GOCAD, publicly documented | Polyline and closed-curve vertices and segments with properties | Yes | Yes | `PLINE` objects use vertices and segments; closed curves are read as polygons, open curves belong to Lines/Points |
| GOCAD ASCII `.vs` | Paradigm/Emerson GOCAD | Point or voxel sets | Yes | Yes | JewelSuite documents `.vs` as a point-set exchange option |
| Esri Shapefile | Esri technical description | Point, multipoint, polyline, and polygon features with DBF attributes and `.prj` | Implemented by Peforma Shapefile | Implemented by Peforma Shapefile | Requires `.shp` and `.dbf`; `.shx`, `.prj`, and `.cpg` are optional; geometry order and record order are preserved |
| DXF | Autodesk, documented | 2D and 3D polylines, points, closed entities, blocks | Later | Later | Version drift and block references make full support unrealistic; only simple entities are candidates |
| KML | OGC | Points, line strings, and polygon placemarks for display | Later | Later | WGS 84 longitude/latitude; styling and folders are not preserved as data |
| UKOOA P1/90 | Legacy UKOOA/IOGP | Marine navigation lines, shot points, source and receiver positions | Peforma Seismic | Peforma Seismic | Navigation is implemented in the Peforma Seismic Navigation tab |
| IOGP P1/11 | IOGP Geomatics Committee, v2.0 user guide | Geophysical position data with richer metadata | Peforma Seismic | Peforma Seismic | Text form; implemented in the Peforma Seismic Navigation tab |
| P2/11 | IOGP Geomatics Committee | Positioning data for non-seismic operations | Later | Later | Adjacent standard; evaluate only if users ask for it |
| P6/11 | IOGP Geomatics Committee | Seismic bin-grid geometry | Peforma Seismic | CSV only | A bin grid is not a vector list, so Peforma Seismic writes it as a table |
| SEG-UKOOA ADS | SEG and UKOOA | Acquisition data storage metafile | No | No | Defines field-tape metadata rather than an interpretation exchange file |
| SEG-Y rev 2.1 | SEG | Seismic traces with a 240-byte trace header | Peforma Seismic | Peforma Seismic | Trace data and trace-header navigation are handled by the Peforma Seismic tabs; amplitudes are never altered |
| SEG-D rev 3.x | SEG | Field seismic records | No | No | Acquisition format; out of scope |
| RESQML 2.2 | Energistics | Earth-model objects, including polyline, point-set, and fault-set representations | Later | Later | Packaged as an EPC container with XML parts; a subset reader is feasible, a full implementation is not |
| WITSML 2.x | Energistics | Well, wellbore, and trajectory objects | Later | Later | XML objects; useful for well trajectories but not a general vector format |
| LAS 2.0 | CWLS | Well log curves referenced to depth | No | No | A depth-referenced curve, not vector geometry; relevant only as a caution when users confuse it with trajectory data |

### Polygon and boundary dialects

These are real, commonly produced exports. Several are not fully specified in public documents, so they are treated as observed dialects that must be confirmed against representative files before they are promoted to tier 1.

| Format | Producer | Carries | Reading | Writing | Notes |
| --- | --- | --- | --- | --- | --- |
| IESX fault polygon ASCII | Petrel / GeoQuest lineage | Closed fault polygon rings with per-polygon attributes | Later | Later | Petrel's documented polygon export; extensions `.dat` or `.iesx` |
| CPS-3 Lines ASCII | Petrel | Polygon or contour vertices in CPS-3 line style | Later | Later | The polygon variant of a CPS-3 line export |
| Kingdom planimeter polygon | S&P Global Kingdom | Closed planimeter boundary with attributes | Later | Later | Extension `.plg`; used to import Kingdom polygons into other tools |
| ZMAP fault polygon | ZMAP / Kingdom lineage | Fault polygon records introduced by `@FALT` | Later | Later | Identified by the `@FALT` marker in record one |
| EarthVision fault polygon | Dynamic Graphics | Fault polygon records introduced by `FFASCI` | Later | Later | Vendor dialect; confirm against a representative file |
| DUG `.dupoly` | DUG Insight | Picked polygon vertices | Later | Later | Vendor dialect; not publicly specified, so out of scope until representative files exist |

### Vendor ecosystems

The table records how each vendor's tools exchange vector geometry in public documentation. It does not imply that Peforma will read the vendor's project store.

| Vendor | Applications | Public vector exchange | Consequence for Peforma |
| --- | --- | --- | --- |
| SLB | Petrel, GeoFrame, Charisma, Techlog, Data Integrator | Petrel imports and exports ASCII points and lines, well paths, deviation surveys, shapefiles, and fault polygons; Data Integrator and OpenSpirit move objects between stores | Target the documented ASCII and GIS exports, not the Petrel project |
| Halliburton / Landmark | OpenWorks, DecisionSpace, SeisWorks | Geometry lives in the OpenWorks database; ASCII export utilities and OpenSpirit connectors extract wells, paths, and interpretation objects; SEG-Y carries seismic navigation | Provide well-path and generic ASCII readers; do not read OpenWorks tables directly |
| Baker Hughes | JewelSuite, JewelSuite Geomechanics | JewelSuite documents GOCAD `.vs`, JOA ASCII point sets, and JOA XML point sets; WITSML and SEG-Y cover well and seismic exchange | GOCAD point sets are a realistic shared format; JOA formats are candidates |
| S&P Global | Kingdom, Petra | Kingdom exports culture and interpretation data to text and shapefile; Petra exports well and interpretation data to ASCII; Kingdom uses a planimeter polygon text format | Support shapefile and plain text; treat undocumented Kingdom and Petra text dialects as later work |
| Emerson | GOCAD, Roxar RMS, SKUA | GOCAD ASCII `.pl`, `.vs`, and `.ts` are documented and read by third-party tools; RMS and SKUA project stores are proprietary | GOCAD ASCII is a strong interchange target |
| Dynamic Graphics | EarthVision | EarthVision grids and its own project data; interchange often goes through ASCII and GIS | Grids are covered by Peforma Horizon/Grid; lines are not a documented public strength |
| LMKR | GeoGraphix | Project database with ASCII and shapefile exchange for well and culture data | Generic ASCII and shapefile coverage is sufficient initially |
| DUG | DUG Insight | Imports and exports columnar text, UKOOA navigation, Kingdom polygon files, shapefiles, and SEG-Y; well paths use a simple ASCII layout | Confirms that columnar text, P1/90, and shapefile are the practical lingua franca |
| OpenSpirit / TIBCO | Multi-vendor connector | Extracts well paths, position logs, and point sets from Petrel, OpenWorks, and other stores into other applications | A model for what users expect, not a file format Peforma can consume |

Two conclusions follow from the landscape. First, there is no single vendor-neutral vector format comparable to CPS-3 for grids; the practical exchange set is columnar text, shapefile, GeoJSON, GOCAD ASCII, and navigation standards. Second, the vendor project database is where most geometry lives, and it is precisely the part a local browser tool should not pretend to read.

## Support tiers

The tiers separate what can be built with confidence from what needs a published specification or representative files before it can be promised.

| Tier | Geometry | Formats | Direction | Rationale |
| --- | --- | --- | --- | --- |
| 1 — implemented | Lines/Points | Delimited text with explicit mapping | Import and export | Covers the most common hand exchange and makes ambiguity visible |
| 1 — implemented | Lines/Points | Petrel-style ASCII points and polylines | Import and export | Simple, widely produced, and verifiable against real exports |
| 1 — implemented | Lines/Points | GOCAD ASCII `.pl` and `.vs` | Import and export | Publicly documented, used across Paradigm/Emerson and JewelSuite |
| 1 — implemented | Lines/Points | GeoJSON points and lines | Import and export | Precise specification and straightforward geometry mapping |
| 1 — implemented | Polygon | GeoJSON `Polygon` and `MultiPolygon` | Import and export | Precise specification and unambiguous ring rules |
| 1 — implemented | Polygon | GOCAD closed curves | Import and export | Documented closed-curve structure |
| 1 — implemented | Shapefile | Point, multipoint, polyline, and polygon bundles | Import and export | Standard GIS delivery, delivered by Peforma Shapefile |
| 1 — implemented | Seismic | UKOOA P1/90, OGP P1/11, and OGP P6/11 navigation | Import; P1/90 and P1/11 export | Delivered by Peforma Seismic, not by the Culture converters |
| 2 — after validation | Polygon | Petrel IESX, CPS-3 Lines, Kingdom `.plg`, ZMAP `@FALT` | Import, then export | Real dialects, partially documented; need representative files |
| 2 — after validation | All | RESQML 2.2 vector subsets | Import, then export | Standards-based but requires EPC package handling and careful subsetting |
| 2 — after validation | All | DXF and KML simple geometry | Import, then export | Useful for GIS and CAD users, with a deliberately small entity set |
| 2 — after validation | Lines/Points | WITSML 2.x trajectory objects | Import | Well trajectories only, not a general geometry exchange |
| 3 — out of scope | All | Vendor project stores and binary project files | None | No public, stable, safe contract |
| 3 — out of scope | All | Seismic amplitudes, well logs, point clouds | None | Different problem domains |

A format moves from tier 2 to tier 1 only after the parser has been checked against representative files from more than one producer and the assumptions are written down.

## Design principles

- Preserve vertex count, vertex order, object order, part order, ring order, hole order, and attribute values exactly. Do not deduplicate, sort, simplify, join parts, or close geometry on read; a writer may apply the target's closure convention and must report it.
- Make column meaning explicit. Delimited files require a user-confirmed mapping before a preview is treated as geometry.
- Distinguish missing Z from zero Z, missing attributes from empty strings, and a stored closed ring from a stored open ring.
- Carry CRS and units as metadata. Never reproject, never rescale, never substitute a default datum.
- Treat closure as stored data. A repeated first vertex is not silently removed, and an open line or ring is not silently closed.
- Report ring orientation. Do not reverse a ring to "fix" it; the target format decides the convention and the tool names that decision.
- Treat self-intersection as a warning, not an error to repair.
- Reject unknown dialects with a specific reason. Never fall back to a positional guess when a header is missing or contradictory.
- Keep the vector core independent of the grid code. Vectors must not inherit grid assumptions about rows, columns, or null sentinels.
- Report what was read: geometry kind, object count, ring count, vertex count, bounds, Z range, attribute names, CRS source, and any records skipped.

## User experience outline

### Lines/Points — implemented

1. Drop or choose one or more files. Identify candidate formats from content and extension, and show the detected format with a confidence note.
2. If the format is delimited text, show the first records and ask the user to assign X, Y, optional Z, object name, and optional measure or attribute columns. Do not preselect a mapping when the header is absent.
3. Show a summary: geometry kind, object and vertex counts, coordinate bounds, Z range, CRS, units, and attribute list.
4. Show a lightweight preview as a list and a small map when coordinates are plausible. The preview must be optional for large files.
5. Let the user choose an output format and confirm the assumptions that will be written: coordinate order, delimiter, precision, Z handling, CRS label, and attribute columns.
6. Download the result with a clear file name and extension, and report any information the target format cannot carry.

### Polygon — implemented

1. Drop or choose one file and show the detected format.
2. Show the ring summary: polygon count, ring count, vertex totals, which rings are stored closed or open, which direction each ring runs, which holes exist, and any zero-area rings.
3. Show attribute names, the CRS source, and units. If the CRS is absent, say so rather than assuming WGS 84.
4. Let the user choose GeoJSON or GOCAD output. The target conventions are stated before download: GeoJSON closes and orients rings to RFC 7946; GOCAD writes each ring as its own closed curve.
5. Download the result and report every closure, reversal, and information loss the target format requires.

Warnings must be specific and actionable in both converters: which record or ring failed, which column was ambiguous, which attribute was dropped, which convention the writer applied, and what the user can do about it. A partial conversion is not offered silently; either the user accepts a listed loss of metadata or the conversion stops.

## Validation and errors

- Validate numeric fields before building geometry, and report the line and column of the first failure.
- Reject files with inconsistent vertex counts in fixed-width or declared-length records.
- Reject a polyline with fewer than two vertices and a point with fewer than two coordinates.
- Require at least three positions and three distinct vertices in a ring. A GeoJSON ring that stores its closure repeats the first position and therefore has at least four positions; a stored-open ring is reported and closed only when the target requires it.
- Reject coordinates that are not finite numbers; do not coerce text to zero. GeoJSON coordinates must be JSON numbers, not numeric strings.
- Treat a declared CRS that contradicts the coordinate range as a warning, not a silent correction.
- Detect truncated shapefile bundles, missing `.dbf` files, and unreadable `.prj` files.
- Detect self-intersecting rings and duplicate first/last vertices, and report them; never repair them automatically.
- Bound memory use for large files and report when a file is too large for an in-browser preview.
- Never crash the page on malformed input; surface a readable error and keep the previous result intact.

## Interoperability cautions

- Column order is not standardized across vendors even when the values look familiar. An unlabeled `X Y Z` file may be easting, northing, elevation, or a local grid in a different order.
- Horizontal and vertical units are often omitted. A metric grid with feet in Z is a common and expensive mistake.
- Elevation sign conventions differ: elevation positive up, depth positive down, and subsea depth negative are all in use.
- CRS definitions may be absent, approximate, or stored only in a companion file. A shapefile without `.prj` is not self-describing.
- GeoJSON is WGS 84 longitude/latitude by specification. Projected coordinates in a `.geojson` file are a common informal extension and must be labeled as such.
- Ring closure and orientation conventions differ. Some writers repeat the first vertex, some do not; RFC 7946 expects exterior rings counter-clockwise and holes clockwise in a geographic coordinate system. Reversing or closing a ring without recording the decision changes the data.
- Shapefile attribute names are limited to ten characters and may be truncated. Preserve the stored names and warn when a name cannot be written back exactly.
- GOCAD headers may declare a coordinate reference system in a free-text field. Preserve the text and do not interpret it as an EPSG code.
- GOCAD PLINE has no hole or multipart structure. A closed curve is one polygon, holes are separate closed curves, and per-vertex properties and per-object attributes other than the name cannot be carried; the writer reports each loss.
- Vendor IESX and `.plg` dialects carry attributes that are named differently by different producers. A field that means "fault type" in one export may be unnamed in another; the mapping is explicit, never by position alone.
- A "polygon" in a fault-polygon export is a closed interpretation ring, not a validated topological surface. Do not treat it as a watertight solid.
- RESQML and WITSML objects carry explicit units and CRS; a partial reader must either honor them or refuse the object.
- Output compatibility should be confirmed in the target application, including geometry kind, orientation, closure, CRS, units, Z sign, null handling, and attribute mapping.

## Acceptance criteria

- A user can load a supported point, polyline, or polygon file, see the detected format, confirm or assign geometry columns where required, inspect counts, bounds, CRS, attributes, and ring structure, and download a supported output.
- A delimited file without a header is never interpreted without an explicit user mapping.
- The exported geometry has the same vertex count, vertex order, object order, part order, and coordinate values as the imported geometry, apart from documented precision rounding.
- Missing Z, missing attributes, and empty strings remain distinguishable in the result.
- A closed polyline stays a polyline unless the source declares polygon geometry.
- The exported polygon geometry keeps polygon count, ring count, ring order, hole order, and vertex order, apart from the target's closure and orientation conventions, and every applied convention and loss is reported.
- A GOCAD export reports that holes and multipart areas become separate curves and that attributes other than the name are omitted.
- CRS and units are either preserved or explicitly reported as unknown; no reprojection or unit conversion occurs.
- Invalid or unsupported files produce a readable error without crashing the page, and the previous result remains available.
- The interface works on desktop and narrow screens and is keyboard accessible, with labelled controls, visible focus, and announced results.
- All parsing, preview, and export run in the browser, with no network request carrying source geometry.
- The format assumptions and limitations are documented before a format is marked as supported.

## Open questions

- Which vendor dialect should anchor the next Polygon step: Petrel IESX, Kingdom `.plg`, or ZMAP `@FALT`? IESX has the strongest public documentation trail.
- GOCAD has no hole linkage. Should closed curves sharing a name be treated as one polygon with holes, or stay separate polygons unless the user says otherwise?
- Should GeoJSON export offer a choice to keep stored ring orientation for projected coordinates, or always apply the RFC 7946 convention?
- Should Culture Polygon accept shapefile Polygon records from Peforma Shapefile, or keep the two tools fully independent?
- Is a map preview required, or is a numeric summary and a ring table enough?
- How should very large navigation files be handled in a browser: a hard size limit, a streaming summary, or a worker with progress?

## Sources

- [SEG-Y revision 2.1 clarification](https://seg.org/wp-content/uploads/2025/11/seg-y_rev2-1_clarification_2025-05-01.pdf) and [SEG-Y rev 1 specification](https://www.moveoutdata.net/wp-content/uploads/2022/06/SEG-Y-Format-rev-1.pdf) — trace header layout, revisions, and navigation fields.
- [SEG Technical Standards](https://seg.org/publications/seg-technical-standards/) and [SEG-D rev 3.0](https://www.scribd.com/document/556462067/SEG-D-rev3-0-Format-jun2012) — field tape standards.
- [IOGP P1/11 user guide](https://www.iogp.org/bookstore/product/iogp-p1-11-geophysical-position-data-exchange-format-user-guide/), [IOGP release announcement](https://www.iogp.org/blog/announcements/geomatics-announcements/iogp-releases-version-2-0-of-geophysical-position-data-exchange-formats/), [OGP P2/11](https://www.moveoutdata.net/wp-content/uploads/2022/06/OGP-P2-11.pdf), and [SEG-UKOOA ADS metafile format](https://seg.org/wp-content/uploads/2025/11/seg_ukooa_ads_meta_format_ver1.pdf) — marine positioning and acquisition metadata.
- [RESQML standards](https://energistics.org/resqml-data-standards), [RESQML v2.2 release note](https://energistics.org/resqml-developers-users), and [OSDU RESQML parser](https://community.opengroup.org/osdu/platform/data-flow/ingestion/energistics/resqml-parser) — polyline, point-set, and fault-set representations.
- [WITSML schema overview](https://energistics.org/sites/default/files/witsml_schema_overview.html) and [WITSML 2.0 overview](https://energistics.org/sites/default/files/2023-03/witsml-v2-webinar-v2.pdf) — well and trajectory objects.
- [LAS 2.0 documentation](https://kcpetrophysics.mynucleus.ca/LAS_2_Documentation_Feb2017.pdf) and [USGS LAS description](https://www.usgs.gov/programs/national-geological-and-geophysical-data-preservation-program/las-format) — log curves, included to separate them from trajectory geometry.
- [GOCAD ASCII format description](https://paulbourke.net/dataformats/gocad/gocad.pdf), [OpenGeoSys GOCAD reader](https://www.opengeosys.org/stable/docs/tools/fileio/gocadtsurfacereader/), and [LaGriT GOCAD reader](https://lanl.github.io/LaGriT/pages/docs/read_gocad.html) — `PLINE`, `VSET`, and `TSURF` structure.
- [JewelSuite point sets](https://documentation.jewelsuite.com/geomechanics/Content/Main/External-formats-Point-sets.htm) — GOCAD `.vs`, JOA ASCII, and JOA XML point-set exchange.
- [ASCII data transfer to Petrel](https://www.scribd.com/document/407812520/GF-to-Petrel), [Petrel data import notes](https://www.scribd.com/doc/290493967/Petrel-2011-Data-Import), and [OpenDTect ASCII well track](https://doc.opendtect.org/7.0.0/doc/od_userdoc/content/survey/import/import_wells/from_ascii_files/track.htm) — Petrel-style deviation and path columns.
- [OpenWorks data management](https://www.academia.edu/10235441/OpenWorks_Software_Data_Management), [Halliburton OpenWorks](https://www.halliburton.com/en/software/decisionspace-365-enterprise/ds365-ai/openworks-software), and [OpenSpirit well paths and position logs](https://support.tibco.com/external/article/KB0071288/creating-wellpaths-and-position-logs.html) — Landmark store and extraction behavior.
- [Petra export tools](https://onlinehelp.ihsmarkit.com/Energy/Petra/2024/Content/1-Overview/ovr_exportingdata.htm), [Petra log export](https://onlinehelp.ihs.com/Energy/Petra/2020/Content/1-Overview/ovr_export_logs.htm), and [Kingdom vendor formats](https://www.scribd.com/document/753195959/VendorFormats) — Kingdom and Petra text exchange.
- [DUG Insight navigation loader](https://help.dugeo.com/m/Insight/l/438585-loading-navigation-data-files) and [DUG Insight well paths](https://help.dugeo.com/m/Insight/l/438717-defining-well-path) — columnar text and UKOOA use in practice.
- [DUG Insight: export polygons from Petrel](https://help.dugeo.com/online-manual/faq/articles/petrel/77999-how-do-i-export-polygons-from-petrel-to-import-into-insight.html), [DUG Insight: import a Kingdom polygon](https://help.dugeo.com/online-manual/faq/articles/kingdom/222070-how-do-i-import-a-kingdom-polygon-to-use-in-insight.html), and [using fault polygons](https://help.dugeo.com/online-manual/user-manual/articles/polygons/438752-using-fault-polygons.html) — IESX, Kingdom `.plg`, and DUG polygon exchange.
- [Recognized polygon files and markers](https://migris.no/migrix-userguide/input-subfixes_print.html) — `@FALT`, `@FAULT`, and `FFASCI` record markers.
- [Exporting contour, fault polygon, and grid data from Petrel](https://www.coursehero.com/file/29778492/petrel-to-ofmpdf/) — CPS-3 Lines polygon export.
- [Esri Shapefile technical description](https://www.esri.com/content/dam/esrisites/sitecore-archive/Files/Pdfs/library/whitepapers/pdfs/shapefile.pdf) and [GeoJSON RFC 7946](https://www.rfc-editor.org/rfc/rfc7946) — GIS geometry, ring orientation, and bundle rules.
- [DXF LWPOLYLINE entity](https://ezdxf.readthedocs.io/en/stable/dxfentities/lwpolyline.html) — closed 2D and 3D polyline entities.
- [ResInsight well paths](https://resinsight.org/wells-and-completions/wellpaths/index.html) — simple ASCII path conventions.
- [JewelSuite subsurface modeling brochure](https://dam.bakerhughes.com/m/6f9eb486a4cfac0a/original/JewelSuite-Subsurface-Modeling-Brochure.pdf) and [JewelSuite ecosystem](https://www.bakerhughes.com/oilfield-services-and-equipment-digital/well-planning/jewelsuite-ecosystem) — Baker Hughes tool scope.
