# Peforma — Product Requirements

Peforma is a product family for oil-sector subsurface data exchange. Every tool runs entirely in the browser: source files are parsed, inspected, and written locally, with no upload and no telemetry. Geometry, values, ordering, and metadata are preserved as stored; a convention the writer must apply is reported, never silent; an unsupported or ambiguous input is rejected with a specific reason rather than guessed.

This document is the single product requirements reference for the family. Each chapter below is the PRD for one tool and states its own shipped scope, format landscape, validation rules, and acceptance criteria.

| Chapter | Tool | Live routes |
| --- | --- | --- |
| [Horizon/Grid](#grid) | Regularly sampled depth-or-time surfaces | `#grid` |
| [Culture](#culture) | Vector lines, points, and closed polygon rings | `#culture`, `#culture-polygon` |
| [Shapefile](#shapefile) | Esri Shapefile bundles and GeoJSON features | `#shapefile` |
| [3D](#3d) | Triangular surface meshes and closed geobodies | `#3d-surfaces`, `#3d-solids` |
| [Seismic](#seismic) | Navigation, 2D seismic lines, and 3D cubes | `#seismic-navigation`, `#seismic-2d`, `#seismic-3d` |
| [Coordinates](#coordinates) | Latitude/longitude notation conversion | `#coordinates` |

Peforma Units (`#units`) is a reference converter whose exact factors are recorded in [docs/UNITS.md](docs/UNITS.md); it has no separate chapter. Format and parser assumptions are recorded in [docs/FORMATS.md](docs/FORMATS.md), and the historical grid format study in [docs/FORMAT_STUDY.md](docs/FORMAT_STUDY.md).

The app ships an in-app Docs page (`#docs`, linked from the header beside the theme toggle) that documents every live tool in detail: grid header records, node storage order, null conventions, line and polygon geometry rules, shapefile bundle rules, mesh closure and normal reporting, SEG-Y and navigation record layouts, coordinate notation forms, and exact unit factors. It is written and updated alongside each feature so the format knowledge gathered during implementation stays available to users, and it replaces the former per-tool header help link. The privacy and data-integrity guarantees are presented in a Privacy & integrity dialog opened from the footer's Privacy link, to the right of Disclaimer.

The bare root (`/`, also `#home`) presents a Peforma family landing page — Hero, Services, and Contact — that links into the live tools at `#grid` (grid), `#culture` (vector lines and points), `#culture-polygon` (closed polygon rings), `#shapefile` (Esri Shapefile and GeoJSON features), `#3d-surfaces` and `#3d-solids` (meshes and geobodies), `#seismic-navigation`, `#seismic-2d` and `#seismic-3d` (navigation and SEG-Y), `#coordinates` (coordinate notation), `#units`, and `#docs`; the converters themselves are unchanged and still process files locally in the browser. Contact pairs a validated message form, which hands a prefilled message to the visitor's mail client and never posts to a server, with an interactive map locked to Calgary whose zoom always re-centres on the city; the form and map share equal width. The landing header mirrors the toolbox chrome: section links and a Docs chip sit right-aligned beside the theme toggle, and the toolbox entry point lives in the hero, the closing call-to-action, and the mobile menu rather than the desktop header.

---

<a id="grid"></a>

## Peforma Horizon/Grid — Depth and Time Grid Exchange

### Problem
Geoscientists exchange depth and time grids — 2D map surfaces such as horizons — between interpretation applications. Petrel can export EarthVision ASCII grids, while receiving tools such as Kingdom may not import that format directly. Manual reformatting is error-prone and risks changing geometry or values.

### Goal
Provide a small, easy-to-use browser application that converts supported EarthVision ASCII depth or time grids into interoperable ASCII grid formats.

### Users
Oil and gas geoscientists who need to move regularly sampled surfaces — horizons in depth or time — between interpretation applications.

### MVP
- Accept an EarthVision ASCII grid selected by file picker or drag and drop.
- Parse and validate grid dimensions, coordinate bounds, increments, values, and nulls.
- Show a concise grid summary and a lightweight value preview.
- Export ZMAP+ ASCII and IRAP Classic ASCII.
- Download the converted grid with an appropriate extension.
- Process files locally in the browser, without upload or telemetry.
- Show actionable errors for unsupported or malformed input.

### Requirements
- Preserve node count, bounds, axis orientation, row/column ordering, and values.
- Require explicit handling of missing values; do not silently convert a real value to null.
- Reject unsupported EarthVision variants rather than producing a plausible but incorrect grid.
- Explain that output compatibility should be confirmed in the target application, especially for coordinate units, datum, null conventions, and axis direction.

### Out of scope for MVP
- Petrel binary input, irregular grids, reprojection, interpolation, datum conversion, batch conversion, server-side storage, and direct Kingdom integration.

### Acceptance criteria
- A user can choose a supported input and output format, inspect grid metadata, and download an ASCII output.
- Invalid files receive a readable error without crashing the page.
- The interface works on desktop and narrow screens and is keyboard accessible.
- Conversion is performed entirely in the browser.

---

<a id="culture"></a>

## Peforma Culture — Vector Data Exchange

Status: both Culture converters are implemented. **Lines/Points** reads and writes delimited text with an explicit column mapping, Petrel-style ASCII points and lines where the columns are unambiguous, GOCAD ASCII `.pl` and `.vs`, and GeoJSON `Point`, `MultiPoint`, `LineString`, and `MultiLineString`. **Polygon** reads and writes GeoJSON `Polygon` and `MultiPolygon` and closed GOCAD PLINE curves. Esri Shapefile is implemented as its own Peforma Shapefile tool, specified in [the Shapefile chapter](#shapefile). UKOOA P1/90, OGP P1/11, and OGP P6/11 navigation are implemented in Peforma Seismic, specified in [the Seismic chapter](#seismic). RESQML, DXF, KML, WITSML, and the vendor polygon dialects (IESX, CPS-3 Lines, Kingdom `.plg`, ZMAP `@FALT`) remain planned, and no line below should be read as a claim of support for them.

Peforma Culture is the suite member for vector geometry: ordered coordinates, closed rings, and the attributes that travel with them. Peforma Horizon/Grid handles regularly sampled surfaces; Culture handles everything that is not a grid or a seismic volume — fault sticks, contour lines, culture lines, well trajectories, well picks, fault polygons, horizon boundaries, prospect outlines, and other point, line, and polygon sets. Seismic navigation is a separate Peforma Seismic concern.

Culture is one product with two live geometry converters. **Lines/Points** handles open geometry. **Polygon** handles closed area geometry. Esri Shapefile is a container that can hold any of the three geometry kinds, so it is not a geometry converter; the live **Peforma Shapefile** tool owns the shapefile bundle itself, including its DBF attributes and `.prj` sidecar.

### Problem

Vector geometry is exchanged constantly between interpretation systems, but the exchange is fragile. The geometry itself is simple — coordinates in order — while the files that carry it differ in delimiter, column order, header conventions, coordinate reference system, vertical reference, units, attribute names, and whether a line is one object or a collection of segments.

Polygon exchange adds its own disagreements. The geometry is closed and ordered, which makes it look simple, but the rules for what makes a polygon valid — ring orientation, a repeated first vertex, holes, self-intersection, attribute inheritance, and the Z convention for planar versus closed-solid geometry — vary by producer. Two files that draw the same shape can fail to import because one repeats the first vertex at the end and the other does not, or because one ring runs clockwise and the other counter-clockwise.

Most large applications store vectors inside a project database. When a geoscientist needs to move that geometry to another application, they export a text, GIS, or shapefile interchange file, hand-map columns, and often resample or reorder vertices to satisfy the receiver. Each manual step can silently change vertex count, order, closure, ring orientation, Z values, or the meaning of an attribute column.

The same geometry also arrives from outside interpretation software: navigation from a seismic contractor, well trajectories from a drilling database, picks from a colleague, or culture data from a GIS team. These sources use different standards and different vendor dialects, and the receiving application may accept only one of them.

### Goal

Provide small browser tools that read supported vector exchange files, show exactly what geometry, rings, and attributes were found, let the user resolve ambiguous column mappings explicitly, and write a supported interchange file without changing coordinates, vertex order, ring order, ring orientation, or attributes.

The tool must be honest about ambiguity. A file with no header and three numeric columns could be X Y Z, Y X Z, X Z Y, or a measured-depth curve. Culture must ask rather than guess, and must reject a dialect it does not fully understand.

### Users

Oil and gas geoscientists, data managers, and interpreters who need to move points, polylines, and polygons between interpretation applications, GIS, and well-data systems. They are comfortable with coordinate systems and file formats but do not want to write conversion scripts for every exchange.

### Geometry model

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

### Scope

#### Lines/Points — implemented

- Read and write delimited text point and polyline files with an explicit column mapping chosen by the user.
- Read and write Petrel-style ASCII point and line layouts as delimited text where the columns are unambiguous.
- Read and write GOCAD ASCII polylines (`.pl`) and point sets (`.vs`).
- Read and write GeoJSON `Point`, `MultiPoint`, `LineString`, and `MultiLineString` geometry with property preservation.
- Read and write fault sticks as ordinary polylines: each stick is one ordered vertex path, and a fault name or ID is carried as an object attribute.
- Show geometry counts, coordinate bounds, vertex totals, Z range, attribute names, CRS source, and a lightweight preview.
- Preserve coordinate reference system metadata when present and label it as unknown when absent.
- Process files locally in the browser, with no upload and no telemetry.
- Produce actionable errors for unsupported dialects and malformed records.

#### Polygon — implemented

- Read and write GeoJSON `Polygon` and `MultiPolygon` with property preservation. On write, rings are closed and oriented to RFC 7946: exterior counter-clockwise, holes clockwise.
- Read and write GOCAD ASCII closed curves as polygon boundaries. Closure is recognised from a repeated first/last vertex or a `SEG` record joining the last vertex to the first.
- Preserve polygon count, ring order, hole order, vertex order, stored closure, and attribute values exactly.
- Report polygon counts, ring counts, vertex totals, which rings are stored closed or open, the direction each ring runs, hole structure, zero-area rings, attribute names, CRS, and units.
- Report ring closure and orientation decisions the writer makes; never normalize them on read.
- Report self-intersecting rings and consecutive duplicate vertices without repairing them.
- Report what GOCAD cannot carry: hole linkage, multipart structure, and attributes other than the object name.
- Process files locally in the browser, with no upload and no telemetry.

#### Polygon vendor dialects — planned

- Read the documented Petrel IESX fault-polygon ASCII export (`.dat` or `.iesx`) and the CPS-3 Lines ASCII polygon export.
- Read the Kingdom planimeter polygon format (`.plg`) and the ZMAP fault-polygon records marked with `@FALT`.

#### Peforma Shapefile — implemented, separate product

- Read and write Esri Shapefile point, multipoint, polyline, polygon, and multipolygon features as a bundle: required `.shp` and `.dbf`, optional `.shx`, `.prj`, and `.cpg`.
- Preserve record order, geometry order, part order, and attribute values; report attribute names that cannot be written back exactly.
- Detect truncated bundles, missing `.dbf` files, mismatched `.shx` or `.dbf` counts, and unreadable geometry records.
- Exchange the same geometry with GeoJSON, including polygon and multipolygon geometry.
- Full scope lives in [the Shapefile chapter](#shapefile).

#### Out of scope for Culture

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

### Format landscape

Vector data travels through three families of formats: open exchange standards, vendor ASCII exports, and vendor project databases. Only the first two are candidates for a browser converter.

#### Open standards and documented formats

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

#### Polygon and boundary dialects

These are real, commonly produced exports. Several are not fully specified in public documents, so they are treated as observed dialects that must be confirmed against representative files before they are promoted to tier 1.

| Format | Producer | Carries | Reading | Writing | Notes |
| --- | --- | --- | --- | --- | --- |
| IESX fault polygon ASCII | Petrel / GeoQuest lineage | Closed fault polygon rings with per-polygon attributes | Later | Later | Petrel's documented polygon export; extensions `.dat` or `.iesx` |
| CPS-3 Lines ASCII | Petrel | Polygon or contour vertices in CPS-3 line style | Later | Later | The polygon variant of a CPS-3 line export |
| Kingdom planimeter polygon | S&P Global Kingdom | Closed planimeter boundary with attributes | Later | Later | Extension `.plg`; used to import Kingdom polygons into other tools |
| ZMAP fault polygon | ZMAP / Kingdom lineage | Fault polygon records introduced by `@FALT` | Later | Later | Identified by the `@FALT` marker in record one |
| EarthVision fault polygon | Dynamic Graphics | Fault polygon records introduced by `FFASCI` | Later | Later | Vendor dialect; confirm against a representative file |
| DUG `.dupoly` | DUG Insight | Picked polygon vertices | Later | Later | Vendor dialect; not publicly specified, so out of scope until representative files exist |

#### Vendor ecosystems

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

### Support tiers

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

### Design principles

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

### User experience outline

#### Lines/Points — implemented

1. Drop or choose one or more files. Identify candidate formats from content and extension, and show the detected format with a confidence note.
2. If the format is delimited text, show the first records and ask the user to assign X, Y, optional Z, object name, and optional measure or attribute columns. Do not preselect a mapping when the header is absent.
3. Show a summary: geometry kind, object and vertex counts, coordinate bounds, Z range, CRS, units, and attribute list.
4. Show a lightweight preview as a list and a small map when coordinates are plausible. The preview must be optional for large files.
5. Let the user choose an output format and confirm the assumptions that will be written: coordinate order, delimiter, precision, Z handling, CRS label, and attribute columns.
6. Download the result with a clear file name and extension, and report any information the target format cannot carry.

#### Polygon — implemented

1. Drop or choose one file and show the detected format.
2. Show the ring summary: polygon count, ring count, vertex totals, which rings are stored closed or open, which direction each ring runs, which holes exist, and any zero-area rings.
3. Show attribute names, the CRS source, and units. If the CRS is absent, say so rather than assuming WGS 84.
4. Let the user choose GeoJSON or GOCAD output. The target conventions are stated before download: GeoJSON closes and orients rings to RFC 7946; GOCAD writes each ring as its own closed curve.
5. Download the result and report every closure, reversal, and information loss the target format requires.

Warnings must be specific and actionable in both converters: which record or ring failed, which column was ambiguous, which attribute was dropped, which convention the writer applied, and what the user can do about it. A partial conversion is not offered silently; either the user accepts a listed loss of metadata or the conversion stops.

### Validation and errors

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

### Interoperability cautions

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

### Acceptance criteria

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

### Open questions

- Which vendor dialect should anchor the next Polygon step: Petrel IESX, Kingdom `.plg`, or ZMAP `@FALT`? IESX has the strongest public documentation trail.
- GOCAD has no hole linkage. Should closed curves sharing a name be treated as one polygon with holes, or stay separate polygons unless the user says otherwise?
- Should GeoJSON export offer a choice to keep stored ring orientation for projected coordinates, or always apply the RFC 7946 convention?
- Should Culture Polygon accept shapefile Polygon records from Peforma Shapefile, or keep the two tools fully independent?
- Is a map preview required, or is a numeric summary and a ring table enough?
- How should very large navigation files be handled in a browser: a hard size limit, a streaming summary, or a worker with progress?

### Sources

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

---

<a id="shapefile"></a>

## Peforma Shapefile — Esri Shapefile Bundle Exchange

Status: implemented at `#shapefile`. The tool reads Esri Shapefile sets (`.shp`, `.shx`, `.dbf`, `.prj`, `.cpg`) and GeoJSON, then writes either a GeoJSON FeatureCollection or a shapefile ZIP. Multi-file bundle download, per-record geometry, DBF attributes, Z values, CRS text, and ring conventions are handled; no reprojection, unit conversion, topology repair, or shapefile compression is performed.

Peforma Shapefile is the suite member for the Esri Shapefile container. It is separate from Peforma Culture: Culture converts vector geometry between open formats, while Shapefile owns the bundle itself — the `.shp` records, the `.shx` index, the `.dbf` attribute table, and the `.prj` definition. The Culture Polygon converter is implemented and does not read or write shapefiles.

### Problem

Shapefiles are the practical delivery format for GIS and interpretation data, but they are not a single file. A set that appears complete in a folder may be missing its `.dbf`, have an `.shx` from a different export, or carry a `.prj` that contradicts the coordinates. Attribute names are capped, nulls are not representable, text encoding is often undeclared, and polygon ring orientation follows a different convention from GeoJSON. A converter that quietly repairs these differences can change field names, drop Z values, or reverse rings without the user noticing.

### Goal

Read a supported shapefile set or GeoJSON, show exactly which records, geometry kinds, attributes, and CRS were found, and write a supported target without changing record order, vertex order, attribute values, or present Z values. Report every convention the writer applies and reject an inconsistent bundle instead of producing a plausible partial result.

### Users

Oil and gas geoscientists, GIS analysts, and data managers who need to move culture data, well locations, fault traces, and polygons between interpretation software, GIS, and data rooms. They need a repeatable exchange that states its assumptions rather than a lossy "open and save".

### Scope

#### Implemented

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

#### Out of scope

- Reading or writing `.zip` archives, `.sbn`, `.sbx`, `.qix`, `.xml` metadata, or Esri geodatabase containers.
- Reprojection, datum or geoid transformation, unit conversion, and vertical reference conversion.
- Topology repair, self-intersection fixing, simplification, densification, buffering, dissolve, or area computation.
- Writing field names longer than ten ASCII characters, multiple DBF tables, memo fields, or binary fields.
- Attribute type inference across mixed values beyond number, boolean, and text.
- Shapefile compression, multi-patch geometry, or true 3D surface primitives.
- Server-side processing or telemetry.

### Bundle rules

| File | Required | Reading | Writing |
| --- | --- | --- | --- |
| `.shp` | Yes | 100-byte header, then big-endian record headers with little-endian content | Header plus one record per feature |
| `.shx` | No | Record count must match `.shp` | Written for every set |
| `.dbf` | Yes | Row count must match `.shp` records; deleted rows flagged | Written with the union of attribute field names |
| `.prj` | No | Carried as CRS text | Written when a CRS label or WKT is present |
| `.cpg` | No | Accepted but not required | Written as `UTF-8` when non-ASCII text is present |

A bundle with no `.shp` or no `.dbf` is rejected. A `.shx` or `.dbf` whose count differs from the geometry record count is rejected, because a partial conversion would silently misalign records and attributes.

### Geometry model

| Concept | Shape type | Z variant | Rules |
| --- | --- | --- | --- |
| Null record | 0 | None | Skipped and counted |
| Point | 1 | 11 | One coordinate |
| PolyLine | 3 | 13 | One or more parts, each with two or more vertices |
| Polygon | 5 | 15 | Closed rings; exterior clockwise, holes counter-clockwise |
| MultiPoint | 8 | 18 | Ordered point collection |

Measure (M) variants 21, 23, 25, and 28 are read for geometry but M values are ignored and reported. A polygon record's parts are grouped into polygons by ring orientation when read, so a record with several exteriors becomes a MultiPolygon rather than one polygon with unrelated rings.

### Reading GeoJSON

GeoJSON input follows RFC 7946 geometry types. A `GeometryCollection` is split into one feature per member with the same properties. A polyline needs at least two vertices and a ring needs at least three; shorter geometry is rejected with the feature number. Coordinates must be finite numbers.

### Writing conventions

- GeoJSON output closes linear rings, writes exterior rings counter-clockwise and holes clockwise, and reports how many rings were closed or reversed.
- A short CRS label is written in the legacy `crs` member; a WKT definition is written verbatim as `peforma_crs_wkt` so shapefile output can restore the `.prj`.
- Shapefile output is a ZIP with one set per geometry kind, because one shapefile can carry only one geometry type.
- Z values are written only when every vertex in the set has a finite Z; otherwise the set is written without Z and the drop is reported.
- DBF field names are limited to ten ASCII characters and must be unique; a renamed or truncated name is reported.
- A missing attribute value becomes a blank because a DBF field has no null marker, and the count is reported.
- Attributes are written as text, number, or logical fields from their values; non-ASCII text is written as UTF-8 with a `.cpg` file.

### User experience

1. Drop or choose one GeoJSON file or one complete shapefile set. More than one set in a single drop is rejected.
2. Show the loaded set name, record count, vertex count, bounds, Z range or CRS, geometry kinds, ring count, and attribute names.
3. Show the first features and every warning: a missing `.shx`, skipped null records, deleted rows, or a fallback text encoding.
4. Choose GeoJSON or the shapefile bundle and show the conventions the writer will apply.
5. Download either a `.geojson` file or a `.zip` containing `.shp`, `.shx`, `.dbf`, `.prj`, and `.cpg` as applicable.

### Validation and errors

- Reject a missing `.shp` or `.dbf` and name the missing part.
- Reject a `.shx` or `.dbf` whose record count differs from the `.shp` file.
- Reject a `.shp` with the wrong header code, an unsupported version, a declared length beyond the file, or a truncated record.
- Reject files that are not part of one set and files with duplicate extensions.
- Reject GeoJSON that is not valid JSON, has no supported geometry, or contains a point without finite X and Y or too-short line and ring geometry.
- Never crash the page on malformed input; keep the previous result available.

### Interoperability cautions

- Some readers expect ANSI text and ignore `.cpg`; a UTF-8 attribute value may still display incorrectly outside modern GIS software.
- Deleted `.dbf` rows and null geometry records are preserved as listed warnings rather than removed silently.
- Z support varies by reader; a Z shapefile may import as 2D.
- A `.prj` may be absent or may describe a CRS that is not EPSG-coded; the text is carried, not interpreted.
- DBF field widths and decimal places are inferred from the values and may differ from the source table.
- Confirm record order, geometry, attributes, ring orientation, CRS, and Z values in the receiving application before operational use.

### Acceptance criteria

- A user can load a shapefile set or GeoJSON, inspect record and geometry counts, bounds, Z or CRS, attributes, and warnings, and download a supported output.
- A set with a missing `.shp` or `.dbf`, or with mismatched record counts, is rejected with a readable reason.
- Exported geometry keeps record order, vertex order, part order, ring order, attribute values, and finite Z values, apart from the documented DBF name, blank-null, and Z-drop conventions.
- Ring closure and orientation applied by the writer are reported.
- The interface works on desktop and narrow screens and is keyboard accessible.
- All parsing and writing run in the browser.

---

<a id="3d"></a>

## Peforma 3D — Mesh and Geobody Data Exchange

Status: tier 1 implemented; tier 2 planned. ASCII and binary STL, Wavefront OBJ, PLY (ASCII and binary little-endian), and GOCAD TSurf are live at `#3d-surfaces` and `#3d-solids`. GOCAD TSolid and COLLADA are detected and rejected with a tier-2 message. The rest of this chapter records the product and format scope.

Peforma 3D is the suite member for triangular surface meshes and closed solid "geobodies". Peforma Horizon/Grid handles regularly sampled surfaces; Peforma Culture handles points, open polylines, and closed planar rings — fault sticks, well trajectories, fault polygons, and prospect outlines; Peforma Seismic handles 2D seismic lines and 3D cubes; Peforma 3D handles the tessellated objects that come from 3D geological modeling workflows: horizon and fault surfaces, faceted geobody boundaries, salt bodies, and the STL/OBJ/PLY/COLLADA/GOCAD files that interpretation and 3D-print tools exchange. Seismic volumes are trace data, not mesh objects, and are never read here. Geobody- and fault-specific semantics (stratigraphic ordering, facies, fault separation) are carried as attributes, not as a separate data model.

### Problem

A 3D geobody is a set of triangles with an implicit meaning: which side is "inside" the reservoir, which face separates two stratigraphic units, which edge is shared with the adjacent block. The mesh file itself rarely carries that meaning. Exporters strip it. An STL is just triangles; an OBJ may have group headers but no topology; a COLLADA file carries material names but not reservoir semantics. When a geobody moves between applications, the receiving tool has to re-derive unit identities, or the user has to remap them by hand, or the data is simply lost.

Most 3D geological modeling systems keep the meaningful model in a project database. The public exchange surface is a handful of tessellation formats: GOCAD `TSurf` and `TSolid`, STL, OBJ, PLY, and COLLADA. Each makes different decisions about which vertices are shared, which faces are present, and whether a "solid" is actually watertight. A converter that silently rewelds vertices, flips face normals, or fills boundary gaps has changed the geometry, even if the surface looks the same.

### Goal

Provide a small browser tool that reads supported mesh and geobody tessellation files, shows exactly what the geometry contains, and writes a target format without altering vertex position, face connectivity, normals, or attribute values.

The tool must be honest about what a mesh is. A surface mesh with open boundaries is not the same object as a watertight solid, and the tool must say which one it found rather than guess.

### Users

Oil and gas geoscientists, reservoir modelers, and 3D-print or visualization specialists who need to move triangulated surfaces or faceted geobodies between interpretation tools, modeling tools, and external 3D software. They need to know whether a mesh is open or closed, whether the normals are consistent, and which attributes carried over.

### Scope

#### In scope for the first release

- Read and write ASCII STL (solid and non-solid) with vertex and face preservation.
- Read and write binary STL; the file length must match `84 + 50 × record count`, and the record count is reported.
- Read and write Wavefront OBJ with `v`, `vn`, `f`, and `o`/`g` group records; preserve face indices, vertex normals, and group names.
- Read and write PLY (ASCII and binary little-endian) with vertex position, optional vertex normal, and face connectivity.
- Read and write GOCAD `TSurf` (`.ts`) triangle surfaces, including the declared name, CRS, and units.
- Read triangular fault and horizon surfaces as meshes; fault identity is carried only by the group or object name and by attributes, not by a separate fault object.
- Detect GOCAD `TSolid` (`.so`) and COLLADA (`.dae`) and reject them with a tier-2 message rather than misreading them.
- Show mesh-level facts: vertex count, face count, whether the mesh is closed or open (detected by open edges), normal consistency, bounding box, group names, CRS, and units.
- Preserve vertex positions, face connectivity, group or object names, and the normals a file carries.
- Report, not repair, open boundaries, inconsistent normals, and shared-vertex gaps.
- Count and report records a target format cannot carry, such as UV coordinates, material names, face normals, and CRS text.
- Process one file at a time locally in the browser, with no telemetry.
- Read files up to 64 MB into memory and reject a larger file with its size stated; never truncate a file.

#### Out of scope

- Vendor project databases and binary project stores for Petrel, OpenWorks, Kingdom, Petra, Roxar RMS, JewelSuite, and GeoGraphix.
- Seismic data: 2D lines, 3D cubes, SEG-Y, ZGY, trace headers, and survey geometry belong to Peforma Seismic. A seismic volume is not a mesh and is never read here.
- Fault sticks, well trajectories, and other open polylines: Peforma Culture Lines/Points reads and writes these.
- Fault pillars, structural frameworks, corner-point grids, and reservoir property arrays: grid-topology objects that no tessellation format carries.
- Mesh repair: welding vertices, filling holes, decimating, smoothing, re-tessellating, or computing new normals.
- Stratigraphic and facies re-assignment. Unit and facies labels that are present are carried through; labels that are not present are not inferred.
- Solid modeling: no B-rep, no watertightness repair, no boolean operations.
- Reprojection, datum transformation, geoid conversion, and unit conversion.
- 3D printing preparation: no slicer-specific adjustments, no wall thickness, no supports.
- Batch conversion and server-side storage.

### 3D data model

Peforma 3D uses one internal model built from triangles and their groups.

| Concept | Meaning | Rules |
| --- | --- | --- |
| Mesh | A set of vertices and triangular faces | Vertex order and face order preserved |
| Vertex | X, Y, Z and optional normal and UV | Position preserved exactly; missing normal is distinct from zero normal |
| Face | Three vertex indices, optionally a face normal | Connectivity preserved; no reordering or flipping |
| Group | A named subset of faces (`o` or `g` in OBJ, `<node>` in COLLADA) | Names preserved; face-to-group assignment not re-mapped |
| Closed | No open edges: every face edge is shared by exactly two faces | Detected and reported; not repaired |
| Open | At least one edge is shared by one face only | Detected and reported; not filled |
| Normal consistency | All face normals point the same general way | Detected and reported; not flipped |
| CRS | Horizontal and vertical reference | Carried as metadata when present; never transformed |
| Units | Model units | Carried as metadata; never converted |

A mesh that arrives open in one format may arrive closed in another if the exporter added the boundary faces. The tool must not add or remove faces silently. The reader records the closure state it found, and the writer applies whatever the target format requires, stating that decision.

### Object classification

A fault appears as three different objects, and they are not interchangeable. A **fault stick** is a picked polyline — one open path of X, Y, Z vertices. A **fault plane** is the interpreted surface built through one or more sticks: a triangulated, usually open surface. A **fault pillar** is the grid skeleton a corner-point model is built on — paired pillars with split nodes that encode throw across the fault. Only the surface is a Peforma 3D object. The stick is a Culture Lines/Points polyline, and the pillar belongs to reservoir-grid modelling. Peforma 3D never infers one from another.

| Object | Geometry | Typical exchange | Suite owner |
| --- | --- | --- | --- |
| Horizon or attribute surface, regular | Gridded surface | CPS-3, EarthVision, IRAP Classic, ZMAP+ | **Grid** |
| Horizon or fault surface, irregular | Triangulated surface | GOCAD `TSurf`, OBJ, STL | **3D** |
| Salt top or other interpreted surface | Triangulated surface | GOCAD `TSurf`, STL | **3D** |
| Geobody or salt body | Closed mesh or tetrahedral solid | STL, OBJ, PLY, GOCAD `TSolid` | **3D** |
| Fault stick or well trajectory | Open polyline in 3D | Delimited text, GeoJSON, GOCAD `PLINE` | **Culture Lines/Points** |
| Fault polygon, prospect outline, lease boundary | Closed planar ring | GeoJSON, GOCAD, shapefile, IESX (planned) | **Culture Polygon** / **Shapefile** |
| Well pick or 3D point | Point or point set | Delimited text, GeoJSON | **Culture Lines/Points** |
| Fault pillar, structural framework | Paired pillars with split nodes and grid topology | No mesh format; RESQML or a vendor project | **Future reservoir-grid tool** |
| Corner-point grid and properties | Cell topology plus arrays | RESQML or a vendor project | **Future reservoir-grid tool** |
| 2D seismic line or 3D cube | Volume raster of traces | SEG-Y, ZGY | **Seismic** |

Two lines follow from the table. First, dimensionality is not ownership: a fault stick has X, Y, Z but is 1D geometry, so it belongs with vectors; a horizon is a surface sampled either on a regular grid or as a triangle mesh, so it belongs with Grid or 3D depending on how it was sampled. Second, the object that carries the *interpretation* — the stick, plane, or pillar — is not always the object that carries the *grid topology*, and no tessellation format carries the latter.

### Format landscape

3D tessellation exchange travels through a small set of documented formats plus a group of vendor dialects.

#### Open standards and documented formats

| Format | Steward or origin | Carries | Reading | Writing | Notes |
| --- | --- | --- | --- | --- | --- |
| ASCII STL | De facto standard | Triangular facets with or without a solid name | Yes | Yes | Simplest tessellation format; no group, no normal, no UV |
| Binary STL | De facto standard | Same facets, packed in 50-byte records | Yes | Yes | No header metadata beyond the record count |
| Wavefront OBJ | Wavefront, documented | Vertices, normals, UVs, faces, groups, objects | Yes | Yes | Rich but free-form; the group and object records carry the only semantics |
| PLY | Stanford, documented | Vertices with properties, faces, and an optional texture | Yes | Yes | ASCII or binary; property list is explicit |
| GOCAD TSurf `.ts` | Paradigm/Emerson GOCAD, publicly documented | Triangulated surface with vertices, triangles, and properties | Yes | Yes | A surface mesh; CRS may be declared in the header |
| GOCAD TSolid `.so` | Paradigm/Emerson GOCAD | Tetrahedral cells with faces | Detected, tier 2 | No | A solid mesh; needs a representative file set before it can be read |
| COLLADA `dae` | Khronos, documented | Multiple meshes in a scene, each with primitives | Detected, tier 2 | No | Materials and transforms are out of scope; a tier-2 producer file set is required |
| KML ground overlay | OGC | Raster overlays, not mesh | No | No | Not a 3D mesh format |

#### Vendor exchange surface

| Vendor | Application | Public 3D exchange | Consequence for Peforma |
| --- | --- | --- | --- |
| SLB | Petrel, GeoFrame, Ocean | Petrel exports geological and reservoir models to COLLADA (`.dae`) and VRML (`.wrl`); GOCAD `TSurf` surfaces can be exported for simulation coupling | Provide COLLADA and GOCAD TSurf coverage; do not read the Petrel project |
| Halliburton / Landmark | OpenWorks, DecisionSpace, SeisWorks | Geometry lives in the OpenWorks database; external exchange goes through SEG-Y for seismic and ASCII/standard formats for interpretation objects; 3D geobody is not a documented public export | Generic mesh and surface formats are sufficient; OpenWorks tables stay out of scope |
| S&P Global | Kingdom, Petra | Kingdom exports 2D/3D seismic, wells, and interpretation objects; geobody surfaces are not a documented public export; Petra supports 3D view but not a documented mesh exchange format | Standard mesh formats cover what a user needs; vendor-specific files are out of scope |
| Emerson | GOCAD, Roxar RMS, SKUA, Leapfrog Geo | GOCAD `TSurf` and `TSolid` are the documented exchange formats; RMS reads and writes GOCAD surfaces; Leapfrog Geo exports per-unit OBJ and STL geobodies | GOCAD surfaces are a strong target; Leapfrog per-unit OBJ/STL is the practical geobody export |
| Baker Hughes | JewelSuite, JewelSuite Geomechanics | JewelSuite documents point sets, well paths, and model inputs in CSV; 3D geobody is not a documented public export format | Generic mesh and CSV are sufficient; no geobody format to support |
| DUG | DUG Insight | 2D/3D SEG-Y and columnar text; 3D geobody is not a documented public export | No direct geobody format; covered by generic mesh formats |

Two conclusions follow. First, the public 3D exchange surface is STL, OBJ, PLY, GOCAD TSurf, and COLLADA, with GOCAD TSolid as the solid-mesh format. Second, the meaningful "geobody" object — a faceted solid with stratigraphic identity — is most commonly exported by interpretation tools as a set of per-unit OBJ or STL files, one file per unit, with the unit identity carried only by the file name or a group record.

### Proposed support tiers

The tiers separate what can be built with confidence from what needs a representative file set before it can be promised.

| Tier | Formats | Direction | Rationale |
| --- | --- | --- | --- |
| 1 — first release | ASCII and binary STL | Import and export | Simplest, most widely produced, no ambiguity |
| 1 — first release | Wavefront OBJ | Import and export | Rich and documented; carries the group and object names that matter |
| 1 — first release | PLY (ASCII and binary) | Import and export | Explicit property list; straightforward to read and write |
| 1 — first release | GOCAD `TSurf` | Import and export | Publicly documented surface mesh, used across GOCAD-based tools |
| 2 — after validation | GOCAD `TSolid` | Import, then export | Solid-mesh representation; needs a representative file set |
| 2 — after validation | COLLADA `dae` | Import, then export | Khronos standard; limited to triangles and triods; needs a producer file set |
| 3 — out of scope | Vendor project stores and binary project files | None | No public, stable, safe contract |
| 3 — out of scope | Mesh repair, boolean, decimation, slicer prep | None | Different problem domain |

A format moves from tier 2 to tier 1 only after the parser has been checked against representative files from more than one producer and the assumptions are written down.

Tier 1 is implemented. A tier-2 format is detected and rejected with a message naming the tier, never parsed as a different format.

### Size and preview model

A geobody mesh can be large. Peforma 3D sets one hard limit and states it before conversion.

- Files up to 64 MB are read fully into memory; the summary is computed over the whole mesh, not a sample.
- A file larger than 64 MB is rejected with its size and the read cap stated. It is never truncated or partially read.
- The 3D preview draws at most 20,000 faces, sampled evenly, and labels the face count when it is a sample. The numeric summary is never sampled.
- Export writes the whole mesh with a fixed layout. The download button reports a busy state while the file is produced.
- The UI shows the file size, an estimate of the in-memory data model, and the 64 MB read cap before conversion begins.

### User experience outline

1. Drop or choose one mesh file. Identify the format from content and magic bytes, not only from the extension.
2. Show the mesh summary: vertex count, face count, whether the mesh is closed or open, whether normals are consistent, bounding box, group names, CRS, and units. A sampled 3D preview shows the triangles, with the sample size stated when the mesh exceeds 20,000 faces.
3. For GOCAD `TSurf`, show the declared CRS and units. A `TSolid` is rejected with a tier-2 message.
4. Let the user choose an output format and confirm the target conventions: face encoding, whether to preserve group names, and whether to keep vertex normals.
5. Download the result with a clear file name and extension, and report any information the target format cannot carry, such as UV coordinates, a face normal, or a group name.

Warnings must be specific: which face has no normal, which boundary edge is open, which group name is longer than the target allows, and what the user can do about it.

### Validation and errors

- Reject a face with a vertex index outside the vertex list.
- Reject a PLY property list that has a type the binary reader cannot decode.
- Reject a binary STL whose byte size does not match the declared record count.
- Report open edges and inconsistent normals; never repair them silently.
- Reject a COLLADA file with a tier-2 message rather than parsing its primitives.
- Report a GOCAD `TSurf` that has triangles referencing vertex indices beyond the declared count.
- Detect a declared CRS that contradicts the coordinate range and surface it as a warning.
- Never crash the page on malformed input; keep the previous result intact.

### Interoperability cautions

- "Closed" and "open" are properties of the mesh, not of the file extension. An STL file can be an open surface or a closed solid, and the tool must say which.
- A fault plane is an open surface even when a viewer makes it look closed. Report its closure state; never cap, thicken, or merge it into a solid.
- A fault stick, a fault plane, and a fault pillar are different objects. Never infer a surface from sticks or a pillar from a surface; each has its own owner in the suite.
- Face normal direction is a property of the file, not of the software that reads it. Flipping normals to "face outward" is a geometric decision the user must make, and the tool must state it.
- Group and object names in OBJ carry the stratigraphic or facies identity in many geobody workflows. A target format that cannot carry group names must have that limitation reported, not silently dropped.
- GOCAD `TSurf` may declare a coordinate reference system in a free-text field. Preserve the text and do not interpret it as an EPSG code.
- Per-unit geobody exports (one OBJ per stratigraphic unit) carry unit identity in the file name. The tool should let the user confirm the unit-to-file mapping before writing a single combined file.
- The summary is computed over the whole mesh, never a sample; only the preview is sampled, and the sample size is stated, not hidden.
- Output compatibility should be confirmed in the target application, including CRS, units, face orientation, and attribute mapping.

### Acceptance criteria

- A user can load a supported mesh or geobody file, see the detected format, mesh closure state, normal consistency, vertex and face counts, group names, and CRS, and download a supported output.
- A mesh with open boundaries or inconsistent normals is never silently repaired; the state is reported and the user confirms the export.
- The exported mesh has the same vertex count, face count, vertex order, face connectivity, and group names as the imported mesh, apart from documented precision rounding.
- CRS and units are preserved or explicitly reported as unknown; no reprojection or unit conversion occurs.
- Invalid or unsupported files produce a readable error without crashing the page; a failed load replaces the panel result with the error, while a failed export keeps the current mesh.
- The interface works on desktop and narrow screens and is keyboard accessible, with labelled controls, visible focus, and announced results.
- All parsing, preview, and export run in the browser, with no network request carrying source geometry.
- The format assumptions and limitations are documented before a format is marked as supported.

### Recorded decisions

- **OBJ anchoring.** A generic triangular OBJ is the read anchor, so a Leapfrog Geo per-unit export and a generic triangulation tool are both accepted as ordinary `v`/`vn`/`f`/`g` records. Per-unit files are converted one at a time; Peforma 3D does not combine them into one mesh, because combining changes the object count and can merge unrelated units.
- **GOCAD TSolid is tier 2.** It is the only public format that carries a true solid, but no representative file set has been validated. It is detected and rejected with a message naming tier 2.
- **The preview is numeric plus a sampled canvas.** A map view is not meaningful for an arbitrary 3D mesh, so the release shows the full numeric summary and a rotating orthographic preview sampled to 20,000 faces.
- **UV coordinates, materials, and face normals are dropped with a count.** A target format that cannot carry them reports how many records were not written rather than refusing the export. The source file remains unchanged.
- **One file at a time.** The converter reads one mesh file per conversion; a multi-file drop is rejected with a clear message instead of silently converting the first file.

### Sources

- [Petrel model export to COLLADA and VRML](http://www.terra3e.com/Software/3D_Printing.html) — the documented Petrel 3D export surface.
- [OpenGeoSys GOCAD TSurf and TSolid reader](https://lanl.github.io/LaGriT/pages/docs/read_gocad.html) and [GOCAD format description](https://paulbourke.net/dataformats/gocad/gocad.pdf) — triangle and tetrahedral cell structure.
- [ResInsight GOCAD surface documentation](https://resinsight.org/reference-manual/surfaces/gocadsurface/index.html) — `TSurf` support in a major interpretation tool.
- [Wavefront OBJ format](https://en.wikipedia.org/wiki/Wavefront_.obj_file) — vertex, normal, face, and group records.
- [PLY format](https://en.wikipedia.org/wiki/PLY_\(file_format\)) — vertex properties and face connectivity.
- [STL format overview](https://www.3dmag.com/3d-wikipedia/stl-file-standard-3d-mesh-format/) — ASCII and binary record structure.
- [Leapfrog Geo model import and export](https://www.seequent.com/how-to-import-and-export-models-and-designs-in-leapfrog/) and [Leapfrog geological model volumes and surfaces](https://help.seequent.com/Geo/2026.1/en-GB/Content/geo-models/geo-models.htm) — per-unit OBJ and STL export workflow.
- [Petrel geological models with OGS](https://www.opengeosys.org/6.5.9/docs/tutorials/petrel_tutorial/) — GOCAD surface export for simulation coupling.
- [JewelSuite documentation](https://documentation.jewelsuite.com/) — Baker Hughes point set and model input exchange.
- [Kingdom geophysics brochure](https://cdn.ihsmarkit.com/www/pdf/0621/Kingdom-Geophysics-Brochure.pdf) and [Petra geology brochure](https://www.spglobal.com/content/dam/spglobal/ci/en/documents/products/pdf/CI_0625-petra-geology-software-brochure-Upstream.pdf) — S&P Global 3D interpretation surface.
- [OpenWorks data management](https://www.academia.edu/10235441/OpenWorks_Software_Data_Management) — Halliburton/Landmark interpretation data storage.
- [RESQML standards](https://energistics.org/resqml-data-standards) — Energistics earth-model exchange, including mesh representations.

---

<a id="seismic"></a>

## Peforma Seismic — 2D Lines and 3D Cube Data Exchange

Status: shipped Tier 1. Peforma Seismic is live at `#seismic-navigation`, `#seismic-2d`, and `#seismic-3d`. This chapter records the product decisions and the format scope that shipped; formats listed as later tiers are not supported.

Peforma Seismic is the suite member for 2D seismic lines, 3D seismic cubes, and their navigation sidecars. Peforma Horizon/Grid handles regularly sampled surfaces; Peforma Seismic handles the seismic traces, trace headers, and survey geometry that arrive with them. Navigation files (UKOOA P1/90, OGP P1/11, OGP P6/11) are read by the Navigation tab of this tool; they are positions and bin grids, not trace data.

### Problem

Seismic data is the largest and most format-sensitive object in subsurface exchange. A single 3D survey can exceed a hundred gigabytes, and the same cube may carry different trace headers, sampling intervals, byte order, endianness, unit scale, and coordinate scalar conventions depending on which processor produced it. Interpretation applications rarely agree on what "the same cube" means: Petrel, OpenWorks, Kingdom, and GOCAD-based tools all read SEG-Y, but each applies its own defaults for missing headers, sample numbering, and datum.

When a geoscientist moves a cube between applications, one of three things happens. The receiving tool assumes defaults that disagree with the source and misplaces traces. The user resamples, reorders, or re-scales the data to satisfy the receiver, and the values are no longer what the processor produced. Or the data stays locked in a vendor project store, and the exchange tool becomes the only way out.

2D data has the same problem in miniature. A set of 2D SEG-Y files may carry coordinates in header fields, in sidecar navigation files, or not at all, and the conventions for where the line starts, how samples are numbered, and what the vertical unit is vary by vendor.

### Goal

Provide a small browser tool that reads supported seismic exchange formats, shows exactly what was found in the trace headers and survey geometry, and writes a target format without altering sample values, sample count, trace order, or header metadata.

The tool must be honest about size. A 500-gigabyte cube will not load in a browser. Tier 1 reads files up to 256 MB in full and rejects a larger file with its size stated; it never truncates a file or reports a partial result as complete.

### Users

Oil and gas geoscientists and geophysicists who need to move 2D lines or 3D cubes between interpretation systems, open data pipelines, or archiving systems. They know the data and its metadata, and they do not want a converter to invent a missing header field.

### Scope

#### In scope for the shipped tier

- Read SEG-Y revisions 0, 1, 2.0, and 2.1 for both 2D lines and 3D cubes, including the 240-byte trace header, additional trace headers, extended textual headers, and revision-2 trace counts, first-trace offsets, and trailer stanzas.
- Write SEG-Y rev 2.0 for 2D and 3D. The textual header, every trace header, every sample byte, and the trailer are copied unchanged; only the binary-header fields that describe the output layout are normalised.
- Detect geometry from the inline and crossline trace-header fields, report inline and crossline ranges, the expected bin count, and missing bins, and optionally re-sort traces into inline-then-crossline order while moving each trace as a whole.
- Show file-level facts: trace count, sample count, sample interval, sample format, byte order, header revision, extended-header count, trailer count, textual-header lines, coordinate bounds, and the header fields actually used.
- Read and write UKOOA P1/90 as 80-column records, including common headers, S/G/Q/A position records, R receiver records, and EOF.
- Read OGP P1/11 identification, HC header, and P1/S1 position records; write P1/11 with CRS A and CRS B carried verbatim from a P1/11 source. A P1/90 source declares no projected CRS, so both fields are written as WGS 84 geographic 2D (EPSG 4326) and the substitution is reported.
- Read OGP P6/11 header, B6 bin-node, and M6 perimeter records; write a delimited table.
- Write delimited CSV for every navigation source, preserving blank fields as blank.
- Process files fully in the browser, with no network request carrying source data.
- No telemetry and no upload.

#### Out of scope

- OpenZGY and vendor ZGY cubes, SEG-D, Seismic Unix, and SEG-Y ASCII. These need a container implementation or a sample-decoding path that Tier 1 does not ship.
- Embedded P1/11 or P6/11 blocks inside SEG-Y extended textual headers; a standalone navigation file is required.
- Vendor project databases and binary project stores for Petrel, OpenWorks, Kingdom, Petra, RMS, SKUA, JewelSuite, and GeoGraphix.
- Seismic processing. No filters, deconvolution, migration, amplitude scaling, gain adjustment, phase rotation, or interpolation.
- Arbitrary line extraction from a 3D cube. That is a processing operation; only the cube itself and its regular grid geometry are in scope.
- Point clouds, well logs, and reservoir property cubes.
- Reprojection of survey geometry. Datum, geoid, and CRS are carried as metadata, never transformed.
- Batch conversion of multiple files in one operation.

### Seismic data model

Peforma Seismic uses one internal model with two shapes.

| Concept | Meaning | Rules |
| --- | --- | --- |
| 2D line | A set of records that share one survey line | Order is preserved as read; no sorting by shot or CDP |
| 3D cube | A regular grid of inline and crossline traces | Trace order is preserved from the source layout; no re-gridding |
| Trace | One record of sample values with a trace header | Header and data are carried together; header fields are copied verbatim |
| Sample value | A single sample in a trace | Sample count, sample interval, and sample encoding are preserved |
| Header revision | SEG-Y 0, 1, 2.0, or 2.1 | Reported to the user; the revision is part of the metadata |
| Coordinate fields | Inline, crossline, CDP, source, receiver, and position scalars | Copied as-is; not re-derived from geometry |
| Vertical unit | Time, depth, or unknown | Carried as metadata; no time-to-depth conversion |
| Byte order | Native or swapped | Detected and reported; no silent swap |

A 2D line is a flat sequence of traces. A 3D cube is a 3D array of traces indexed by inline, crossline, and sample, and the export layout matches the source layout unless the user explicitly requests inline-major order. The tool never reorders traces to "fix" gaps; gaps are reported as such.

### Format landscape

Seismic exchange travels through a smaller set of formats than line and point data, but each format carries more metadata.

#### Open standards and documented formats

| Format | Steward or origin | Carries | Reading | Writing | Notes |
| --- | --- | --- | --- | --- | --- |
| SEG-Y rev 0 | SEG, 1975 | 2D and 3D traces with 240-byte headers | Yes | Writes rev 2.0 | Original format; many legacy files; header meaning is fixed but sparse |
| SEG-Y rev 1 | SEG | Repeats extended textual headers, clarifies trace header | Yes | Writes rev 2.0 | Common in mid-2000s workflows |
| SEG-Y rev 2.0 | SEG, 2017 | OGP P6/11 bin-grid reference, clarified headers | Yes | Yes | Introduces the byte-order constant and explicit trace count and offset fields |
| SEG-Y rev 2.1 | SEG, October 2023 | Extended textual header clarification, P-format embedding | Yes | Writes rev 2.0 | Current preferred format for new exchange; the rev 2.x header layout is read |
| SEG-D rev 3.x | SEG | Field acquisition data | No | No | Acquisition format, not interpretation exchange |
| OpenZGY / ZGY | Schlumberger Petrel lineage; maintained publicly | 3D cube with compressed trace layout and header model | No | No | Needs a container and compression implementation; Tier 2 |
| IOGP P6/11 | IOGP Geomatics Committee, v2.0 | 3D bin-grid geometry and survey metadata | Yes | CSV table | Standalone reader and table writer ship in the Navigation tab |
| IOGP P1/11 | IOGP Geomatics Committee, v2.0 | Marine positioning and navigation | Yes | Yes | Navigation sidecar; read and written in the Navigation tab |
| IOGP P1/90 | UKOOA, 1990 | 80-column marine positioning | Yes | Yes | Navigation sidecar; read and written in the Navigation tab |
| Seismic Unix (SU) | CWP/Seismic Unix | 240-byte header plus trace data in a binary container | No | No | Later tier; header mapping to SEG-Y is documented |
| SEG-Y ASCII | Informal | 2D traces as whitespace-delimited samples with a text header | No | No | Later tier; needs a sample-decoding path |
| RESQML SeismicCubeRepresentation | Energistics | Seismic cube as part of an EPC earth model | No | No | Different problem domain; out of scope |

#### Vendor ecosystems

| Vendor | Applications | Public seismic exchange | Consequence for Peforma |
| --- | --- | --- | --- |
| SLB | Petrel, GeoFrame, Ocean, Data Integrator | SEG-Y 2.1 and ZGY cubes; 2D lines in SEG-Y; OGP P6/11 embedding in extended headers | SEG-Y and OpenZGY cover the documented exchange surface; Petrel project data stays out of scope |
| Halliburton / Landmark | OpenWorks, DecisionSpace, SeisWorks | 2D and 3D data in OpenWorks tables; SEG-Y export for 2D lines and arbitrary lines; P1/11 and P6/11 sidecars | Provide SEG-Y and P6/11 coverage; do not read OpenWorks tables |
| S&P Global | Kingdom, Petra | SEG-Y 2D and 3D import; Kingdom geophysics modules for 2D/3D visualization and pre-stack gathers; 2D/3D and arbitrary line export | SEG-Y is the public contract; Kingdom-specific data transfer files are out of scope |
| Emerson | GOCAD, Roxar RMS, Aspen SKUA | GOCAD ASCII `.ts` surfaces and model cells; RMS seismic visualization reads SEG-Y; SKUA-GOCAD project stores | SEG-Y is the exchange surface; GOCAD surfaces are grid or polygon concerns |
| Baker Hughes | JewelSuite, JewelSuite Geomechanics | 2D and 3D SEG-Y import documented in the product; CSV exports of model inputs and results | SEG-Y is the relevant surface; CSV exports belong to a different tool |
| DUG | DUG Insight | Import and export of 2D and 3D SEG-Y; coordinate mapping from survey to ENSEMBLE X/Y; interpolation on resample | Confirms SEG-Y 2D/3D as the practical lingua franca; interpolation behavior is out of scope for Peforma |
| OpenSource community | OpenZGY, segyio, ResInsight | Public readers/writers for SEG-Y and OpenZGY; ResInsight ZGY and SEG-Y support | Public implementations make browser-side SEG-Y and OpenZGY reading feasible with a WASM or Web Worker backend |

Two conclusions follow. First, for 2D and 3D seismic the public exchange surface is SEG-Y (all revisions in use) plus OpenZGY for 3D, with IOGP P1/90, P1/11, and P6/11 as documented sidecars. Second, interpolation, resampling, arbitrary-line extraction, and processing are consistently outside the documented public surface of every tool surveyed.

### Shipped support tiers

| Tier | Formats | Direction | Rationale |
| --- | --- | --- | --- |
| 1 — shipped | SEG-Y rev 0, 1, 2.0, and 2.1 | Read; write rev 2.0 | Header and sample bytes are carried without decoding, so every defined sample-format code survives |
| 1 — shipped | UKOOA P1/90 | Read and write | Fixed 80-column layout with a stable point and header definition |
| 1 — shipped | OGP P1/11 | Read and write | Documented position record with CRS A, B, and C fields |
| 1 — shipped | OGP P6/11 | Read; write CSV | Bin-grid geometry is not a position list, so it has no P1/11 or P1/90 output |
| 2 | OpenZGY / ZGY 3D cubes | Read and write | Needs a stable, producer-independent container and compression implementation |
| 2 | Embedded P1/11 and P6/11 in SEG-Y extended headers | Read | A standalone sidecar is the current contract |
| 2 | Seismic Unix container | Read and write | Open processing chain; header mapping is documented |
| 2 | SEG-Y ASCII | Read and write | Needs sample decoding, which the byte-preserving Tier 1 does not do |
| 3 — out of scope | Vendor project stores and binary project files | None | No public, stable, safe contract |
| 3 — out of scope | Processing, interpolation, arbitrary lines | None | Different problem domain |

A format moves from tier 2 to tier 1 only after the parser has been checked against representative files from more than one producer and the assumptions are written down.

### Size model

A seismic cube does not fit in a browser tab the way a grid or a point file does.

- Files up to 256 MB are read fully into memory. A larger file is rejected with its size stated and is never truncated.
- The summary is computed over every trace, not a sample of traces, because the trace loop is cheap once the bytes are in memory.
- Export writes one contiguous output buffer. The UI reports the file size, the sample-memory estimate, and the read cap before conversion.
- A file that cannot be read is rejected with the reason. A partial result is never presented as a complete conversion.

### User experience outline

1. Choose a tab: Navigation, 2D lines, or 3D cube. A SEG-Y on the Navigation tab and a navigation file on a SEG-Y tab are both rejected with a direction to the right tab.
2. Drop or choose one file. Identify the format from the binary header or record contents, not only from the extension.
3. Show the detected revision, trace count, sample count, sample interval, sample encoding, byte order, extended-header and trailer counts, and the textual-header lines.
4. For 3D, show inline and crossline ranges, distinct-value counts, expected bins, missing bins, CDP range, and which coordinate header fields were used.
5. For 2D, show CDP and field-record ranges, coordinate availability, and the CDP or source bounds.
6. For navigation, show the position and receiver counts, line count, point-number range, reference system, extent, record mix, and line names.
7. On a SEG-Y tab, write a rev 2.0 file; on the 3D tab, optionally request inline-major trace order.
8. On the Navigation tab, choose CSV, P1/11, or P1/90. P6/11 offers CSV only.
9. Download the result with a clear file name and extension, and report every field or record the target cannot carry.

Warnings must be specific: which revision was detected, which header fields were empty in the source, which geometry was copied versus measured, and what the user can do about it.

### Validation and errors

- Reject a file whose binary header does not contain a defined sample-format code and revision rather than guessing.
- Reject byte-swapped 16-bit ordering and a contradictory byte-order constant.
- Reject a partial trace, a sample count of zero with no binary-header fallback, and a first-trace offset beyond the file.
- Read non-monotonic inline or crossline order as written and report that the file is not inline-major; source byte order is preserved.
- Reject a negative extended textual header count, which signals a variable-length extended-header block the reader does not locate.
- Report extended textual headers, trailer stanzas, and trailing bytes with the values involved.
- Carry every defined sample-format code, including obsolete fixed point with gain, and say that the bytes are not decoded.
- Never crash the page on malformed input; keep the previous result intact.

### Interoperability cautions

- Header meaning changes across revisions. A field that is a source coordinate in rev 1 may be reserved in rev 0. The detected revision is part of every report.
- Byte order and sample encoding are properties of the file, not of the application. No implicit swap or conversion is allowed.
- Inline and crossline numbers are identifiers, not coordinates. A cube with missing corner coordinates is not re-projected; it is flagged.
- P6/11 bin grids describe a regular grid and never become position records. A bin grid is exported as a table with its own coordinate pairs.
- 2D line files may or may not carry coordinates. When they do not, the tool must say so, not fill in a default.
- Time and depth units are not interchangeable. A cube in time is not silently treated as a cube in depth.
- Output compatibility must be confirmed in the target application, including revision, byte order, sample encoding, trace layout, and header assumptions.

### Acceptance criteria

- A user can load a supported SEG-Y file, see the detected revision and the populated header facts, and download a rev 2.0 file whose trace headers and sample bytes are identical to the source.
- A 3D cube can be re-sorted into inline-major order with each trace moved as a whole and the change reported.
- Navigation files can be read and written as P1/90, P1/11, or CSV, with blank source fields preserved as blank.
- A P1/90 file written by Peforma is exactly 80 columns per record.
- A SEG-Y dropped on the Navigation tab, or a navigation file dropped on a SEG-Y tab, produces a readable cross-tab message.
- Invalid or unsupported files produce a readable error without crashing the page, and the previous result remains available.
- The interface works on desktop and narrow screens and is keyboard accessible, with labelled controls, visible focus, and announced results.
- All parsing, preview, and export run in the browser, with no network request carrying source data.
- The format assumptions and limitations are documented before a format is marked as supported.

### Open questions

- Which OpenZGY producer version should anchor Tier 2? The public OpenZGY layout and Petrel ZGY files may differ in field placement.
- Should Tier 2 add SEG-Y rev 2.1 writing for the revised extended-textual-header fields, or keep rev 2.0 as the normalised target?
- Should embedded P1/11 and P6/11 blocks in SEG-Y extended textual headers be extracted automatically in Tier 2, or remain a separate sidecar workflow?
- How should a 3D cube with a missing bin be surfaced when the target application will not accept a gapped grid: warn and continue, or block the export?

### Sources

- [SEG-Y revision 2.1 clarification](https://seg.org/wp-content/uploads/2025/11/seg-y_rev2-1_clarification_2025-05-01.pdf) and [SEG-Y revision 2.0 specification](https://seg.org/wp-content/uploads/2025/11/seg_y_rev2_0_mar2017.pdf) — trace header, extended textual header, and revision differences.
- [SEG-Y rev 1 specification](https://www.moveoutdata.net/wp-content/uploads/2022/06/SEG-Y-Format-rev-1.pdf) and [USGS SEG-Y description](https://pubs.usgs.gov/of/2003/of03-402/html/segy.htm) — the 240-byte header and sample encoding.
- [SEG-Y trace header format overview](https://www.chemgeo.uni-jena.de/chegemedia/62645/seg-y-trace-header-format.pdf?nonactive=1&suffix=pdf) and [SEG-Y & Seismic Unix formats](https://www.seismicrocks.com/segyformat.html) — SU-to-SEG-Y header mapping.
- [DUG Insight SEG-Y guide](https://help.dugeo.com/online-manual/learning/articles/articles/1002051-the-dug-insight-guide-to-seg-y.html), [importing 3D SEG-Y](https://help.dugeo.com/online-manual/user-manual/articles/importing_3d_seg_y_data/importing_3d_seg_y_data.htm), and [exporting to SEG-Y](https://help.dugeo.com/online-manual/user-manual/articles/exporting_volumes/839349-exporting-to-seg-y.html) — coordinate mapping, interpolation behavior, and export settings.
- [VRGS SEG-Y volume documentation](https://docs.vrgeoscience.com/docs/general/wells-seismic/seismic-volumes/) — rev 2.1 reading and affine geometry fitting from corner traces.
- [IOGP P6/11 user guide](https://www.iogp.org/bookstore/product/iogp-report-483-6u-iogp-p6-11-seismic-bin-grid-data-exchange-format-user-guide/), [P6/11 v2.0 release](https://www.iogp.org/blog/announcements/geomatics-announcements/iogp-releases-version-2-0-of-the-p6-11-seismic-bin-grid-data-exchange-format/), and [P6/11 specification](https://www.moveoutdata.net/wp-content/uploads/2022/06/OGP-P6-11.pdf) — 3D bin-grid geometry and survey coverage.
- [Sodir geophysical guidelines](https://www.sodir.no/48d36a/globalassets/1-sodir/regelverk/forskrifter/en/geophysical-guidelines.pdf) and [Norwegian NDR reporting format](https://www.nstauthority.co.uk/media/khybwf0b/information-reporting-form-and-manner-for-ndr-september-2025-1.pdf) — the reporting context in which SEG-Y rev 2.1 and P1/11/P6/11 co-occur.
- [SLB seismic data management](https://www.slb.com/resource-library/blogs/di/solving-the-challenge-of-seismic-data-management) — ZGY, OpenZGY, and 8-bit compression history in the Petrel lineage.
- [equinor/pyzgy](https://github.com/equinor/pyzgy) and [OSDU Open ZGY repository](https://community.opengroup.org/jackieli/open-zgy/-/tree/master) — public OpenZGY container and reader.
- [JewelSuite Seismic documentation](https://documentation.jewelsuite.com/geomechanics/Content/Main/Seismic.htm) and [JewelSuite subsurface brochure](https://dam.bakerhughes.com/m/6f9eb486a4cfac0a/original/JewelSuite-Subsurface-Modeling-Brochure.pdf) — Baker Hughes SEG-Y 2D/3D import and CSV export behavior.
- [Halliburton Seismic Processing Suite](https://www.halliburton.com/en/products/seismic-processing-suite) and [OpenWorks data management notes](https://www.academia.edu/10235441/OpenWorks_Software_Data_Management) — Landmark 2D/3D exchange via SEG-Y and OpenWorks tables.
- [Kingdom Geophysics brochure](https://cdn.ihsmarkit.com/www/pdf/0621/Kingdom-Geophysics-Brochure.pdf) and [Kingdom training and services](https://www.spglobal.com/energy/en/products-solutions/upstream-midstream-oil-gas/upstream-software/software-training/kingdom-software-training-services) — S&P Global 2D/3D visualization, export, and data transfer surface.
- [USGS SEGY-to-ASCII program](https://www.usgs.gov/publications/segy-ascii-conversion-and-plotting-program-20) and [equinor/segyio](https://github.com/equinor/segyio) — open conversion and reading tooling.
- [IOGP and SEG webinar on grids and P-formats](https://www.iogp.org/wp-content/uploads/2025/09/08_IOGP-SEG-Webinar_20251015_final.pdf) — P-format embedding in extended textual headers.

---

<a id="coordinates"></a>

## Peforma Coordinates — Coordinate Notation Conversion

Status: shipped Tier 1. This chapter describes what the tool does today.

Peforma Coordinates rewrites latitude and longitude between written notations — decimal degrees, degrees minutes seconds (DMS), and degrees decimal minutes (DDM) — without changing the position a value names. It is a reference tool in the Peforma family, alongside Peforma Units.

### Problem

The same position arrives written many ways: `51.5074`, `51°30′26.4″N`, `51 30 26.4 N`, `513026.4N`, `51°30.44′N`. Spreadsheet columns mix these forms freely, and a receiving application usually accepts only one. Hand conversion is slow and error-prone; a wrong hemisphere or a minutes value of 60 silently moves a position.

### Contract

- Only the written form changes. No reprojection, no datum assumption, no datum transformation, no unit conversion.
- Every source column is copied verbatim; the converted pair is appended, never written over the source.
- Row order is preserved. A value that cannot be read unambiguously is reported with its line number and written as a blank cell, never guessed.
- All parsing and writing run in the browser.

### Shipped scope

- Read delimited text (CSV, TSV, semicolon, whitespace) from a file or pasted rows, up to 8 MB and 100,000 rows.
- A non-numeric first row is a header and pre-seeds the latitude/longitude mapping from labels (lat, latitude, y, lon, long, longitude, x). Without a header the user assigns both columns explicitly.
- Accepted notations per cell: signed decimal degrees; DMS with degree/minute/second marks, colons, or spaces; DDM; packed DDMMSS.s / DDDMMSS.s and packed DDMM.m / DDDMM.m with a hemisphere letter. A hemisphere letter may lead or trail.
- Validation: N/S only on latitude, E/W only on longitude; a minus sign and a disagreeing letter is an error; minutes and seconds must be below 60; latitude within ±90, longitude within ±180.
- Write CSV in decimal degrees (0–10 fractional digits), DMS (0–4 second decimals), or DDM (0–6 minute decimals). Rounding carries through seconds into minutes and degrees.
- Summary: row counts, notation mix, packed and hemisphere counts, latitude/longitude ranges, and every unreadable row with its reason and line number.
- A live converted preview shows the first rows in the chosen notation before download.

### Out of scope

- Reprojection, datum shifts, and geodetic transformation. A notation is not a reference frame; the tool cannot tell which datum a value belongs to.
- UTM and other projected grid coordinates. Converting those to geographic coordinates requires a projection and a datum, which this tool does not assume.
- Geometry files (GeoJSON, shapefile, GOCAD). Those belong to Peforma Culture and Peforma Shapefile.
- Navigation records (P1/90, P1/11, P6/11). Those belong to Peforma Seismic.

### Acceptance criteria

- A user can load or paste a table, confirm the column mapping, see the notation mix and ranges, and download a CSV whose source columns are unchanged and whose appended pair names the same positions.
- Unreadable rows are listed with line numbers and written with blank converted cells and a note.
- No value is reprojected, rescaled, or silently repaired.
- Invalid input produces a readable error without crashing the page.
- The interface is keyboard accessible with labelled controls and announced results, on desktop and narrow screens, in light and dark themes.
