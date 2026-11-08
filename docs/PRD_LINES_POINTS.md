# Peforma Lines/Points — Lines and Points Data Exchange

Status: tier-1 open formats are implemented in the app. Delimited text with an explicit column mapping, Petrel-style unambiguous ASCII, GOCAD ASCII `.pl` and `.vs`, GeoJSON points and lines, and Esri Shapefile points and polylines are supported for import and export. The tier-2 navigation, SEG-Y header, RESQML, DXF, KML, and WITSML formats remain planned, and no shape should be read as a claim of support for them.

Peforma Lines/Points is the suite member for polyline and point geometry. Peforma Grid/2D-Map handles regularly sampled surfaces; Peforma Lines/Points handles ordered coordinates that are not a grid: fault sticks, contour lines, culture lines, seismic navigation, well trajectories, well picks, and other point sets. Polygon topology and boundary cleanup belong to the separate Peforma Polygons tool and are not part of this scope.

## Problem

Line and point geometry is exchanged constantly between interpretation systems, but the exchange is fragile. The geometry itself is simple — coordinates in order — while the files that carry it differ in delimiter, column order, header conventions, coordinate reference system, vertical reference, units, attribute names, and whether a line is one object or a collection of segments.

Most large applications store lines and points inside a project database. When a geoscientist needs to move that geometry to another application, they export a text or GIS interchange file, hand-map columns, and often resample or reorder vertices to satisfy the receiver. Each manual step can silently change vertex count, order, closure, Z values, or the meaning of an attribute column.

The same geometry also arrives from outside interpretation software: navigation from a seismic contractor, well trajectories from a drilling database, picks from a colleague, or culture data from a GIS team. These sources use different standards and different vendor dialects, and the receiving application may accept only one of them.

## Goal

Provide a small browser tool that reads supported line and point exchange files, shows exactly what geometry and attributes were found, lets the user resolve ambiguous column mappings explicitly, and writes a supported interchange file without changing coordinates, vertex order, or attributes.

The tool must be honest about ambiguity. A file with no header and three numeric columns could be X Y Z, Y X Z, X Z Y, or a measured-depth curve. Peforma Lines/Points must ask rather than guess, and must reject a dialect it does not fully understand.

## Users

Oil and gas geoscientists, data managers, and interpreters who need to move polylines or point sets between interpretation applications, GIS, and well-data systems. They are comfortable with coordinate systems and file formats but do not want to write conversion scripts for every exchange.

## Scope

### In scope for the first release

- Read and write delimited text point and polyline files with an explicit column mapping chosen by the user.
- Read and write the common Petrel-style ASCII point and line layout where the columns are unambiguous.
- Read and write GOCAD ASCII polylines (`.pl`) and point sets (`.vs`).
- Read and write GeoJSON `Point`, `MultiPoint`, `LineString`, and `MultiLineString` geometry with property preservation.
- Read Esri Shapefile point and polyline geometry with the accompanying projection file.
- Read marine navigation in UKOOA P1/90 and IOGP P1/11 form, presenting navigation lines as polylines and shot points as points.
- Read navigation from SEG-Y trace headers without touching seismic amplitudes.
- Show geometry counts, bounds, vertex totals, attribute names, and a lightweight map or list preview.
- Preserve coordinate reference system metadata when present and label it as unknown when absent.
- Process files locally in the browser, with no upload and no telemetry.
- Produce actionable errors for unsupported dialects and malformed records.

### Out of scope

- Vendor project databases and binary project files, including Petrel, OpenWorks, DecisionSpace, Kingdom, Petra, Roxar RMS, JewelSuite, GeoGraphix, and PaleoScan project stores.
- Reading or writing seismic trace data. Seismic amplitudes belong to Peforma Seismic; this tool reads only navigation stored in SEG-Y headers.
- Well log curves (LAS, DLIS, LIS) and petrophysical interpretation objects.
- Polygon topology, hole handling, boundary validation, and area computation.
- Interpolation, smoothing, densification, simplification, snapping, node adjustment, and Z recalculation.
- Coordinate reprojection, datum transformation, geoid conversion, and unit conversion.
- Point-cloud formats such as LAS/LAZ, which are lidar products rather than geoscience line data.
- Batch conversion and server-side storage.

## Geometry model

Peforma Lines/Points uses a single internal model with two geometry kinds. Keeping it narrow makes both parsing and writing predictable.

| Concept | Meaning | Rules |
| --- | --- | --- |
| Point set | An unordered collection of points | Point order is preserved as read; no spatial sorting |
| Polyline | One ordered path of vertices | Vertex order and duplicates are preserved; no simplification |
| Vertex | X, Y, optional Z, and optional per-vertex attributes | Missing Z is distinct from Z = 0 |
| Object attributes | Name, type, and other per-line or per-set fields | Preserved as typed strings or numbers, never merged by name guesswork |
| Closure | A polyline may repeat its first vertex | Preserved as stored; not normalized to a polygon |
| CRS | Horizontal and vertical reference | Carried as metadata; never reprojected or silently assumed |
| Units | Horizontal and vertical units | Carried as metadata; never converted |

A line object is a single path. Multi-part geometry imported from GeoJSON or a shapefile becomes a collection of polylines that retain their shared attributes and a part index. The tool must not join parts or split lines at self-intersections.

Coordinate order is a property of the file, not an assumption. Every reader states which axis it read first and records that decision in the result metadata so the export and the UI can report it.

## Format landscape

Line and point data travels through three families of formats: open exchange standards, vendor ASCII exports, and vendor project databases. Only the first two are candidates for a browser converter.

### Open standards and documented formats

| Format | Steward or origin | Carries | Reading | Writing | Notes |
| --- | --- | --- | --- | --- | --- |
| CSV, TSV, XYZ, ASCII | No single owner | Arbitrary point and vertex tables | Yes, with explicit mapping | Yes, with chosen columns | Delimiter, decimal mark, header row, and column meaning must be declared by the user |
| GeoJSON | IETF RFC 7946 | Points, multipoints, lines, multilines, properties | Yes | Yes | WGS 84 longitude/latitude by specification; projected coordinates in GeoJSON are outside the RFC and must be flagged |
| Esri Shapefile | Esri technical description | Point and polyline geometry with DBF attributes and `.prj` | Yes | Yes, as a bundle | Requires `.shp`, `.shx`, `.dbf`, and optional `.prj`; geometry order and record order are preserved |
| GOCAD ASCII `.pl` | Paradigm/Emerson GOCAD, publicly documented | Polyline vertices and segments with properties | Yes | Yes | `PLINE` objects use vertices and segments; `VSET` uses point coordinates; CRS is declared in the header or absent |
| GOCAD ASCII `.vs` | Paradigm/Emerson GOCAD | Point or voxel sets | Yes | Yes | JewelSuite documents `.vs` as a point-set exchange option |
| DXF | Autodesk, documented | 2D and 3D polylines, points, blocks | Yes, limited entities | Yes, limited entities | Version drift and block references make full support unrealistic; only simple `POINT`, `POLYLINE`, and `LWPOLYLINE` entities are candidates |
| KML | OGC | Points and line strings for display | Yes, limited | Yes, limited | WGS 84 longitude/latitude; styling and folders are not preserved as data |
| UKOOA P1/90 | Legacy UKOOA/IOGP | Marine navigation lines, shot points, source and receiver positions | Yes | Later | Fixed-width records; widely used legacy exchange |
| IOGP P1/11 | IOGP Geomatics Committee, v2.0 user guide | Geophysical position data with richer metadata | Yes | Later | Successor to P1/90; binary and ASCII encodings exist, so only the documented text form is in scope |
| P2/11 | IOGP Geomatics Committee | Positioning data for non-seismic operations | Later | Later | Adjacent standard; evaluate only if users ask for it |
| P6/11 | IOGP Geomatics Committee | Seismic bin-grid geometry | No | No | Bin grids are a grid concern, not a line or point concern |
| SEG-UKOOA ADS | SEG and UKOOA | Acquisition data storage metafile | No | No | Defines field-tape metadata rather than an interpretation exchange file |
| SEG-Y rev 2.1 | SEG | Seismic traces with a 240-byte trace header | Navigation fields only | No | Trace headers carry source and receiver coordinates, line and shot identifiers, and CDP information; amplitudes remain out of scope |
| SEG-D rev 3.x | SEG | Field seismic records | No | No | Acquisition format; out of scope |
| RESQML 2.2 | Energistics | Earth-model objects, including polyline and point-set representations | Later | Later | Packaged as an EPC container with XML parts; a subset reader is feasible, a full implementation is not |
| WITSML 2.x | Energistics | Well, wellbore, and trajectory objects | Later | Later | XML objects; useful for well trajectories but not a general line format |
| LAS 2.0 | CWLS | Well log curves referenced to depth | No | No | A depth-referenced curve, not line geometry; relevant only as a caution when users confuse it with trajectory data |

### Vendor ecosystems

The table records how each vendor's tools exchange line and point geometry in public documentation. It does not imply that Peforma will read the vendor's project store.

| Vendor | Applications | Public line and point exchange | Consequence for Peforma |
| --- | --- | --- | --- |
| SLB | Petrel, GeoFrame, Charisma, Techlog, Data Integrator | Petrel imports and exports ASCII points and lines, well paths, deviation surveys, and shapefiles; Data Integrator and OpenSpirit move objects between stores | Target the documented ASCII and GIS exports, not the Petrel project |
| Halliburton / Landmark | OpenWorks, DecisionSpace, SeisWorks | Geometry lives in the OpenWorks database; ASCII export utilities and OpenSpirit connectors extract wells, paths, and interpretation objects; SEG-Y carries seismic navigation | Provide well-path and generic ASCII readers; do not read OpenWorks tables directly |
| Baker Hughes | JewelSuite, JewelSuite Geomechanics | JewelSuite documents GOCAD `.vs`, JOA ASCII point sets, and JOA XML point sets; WITSML and SEG-Y cover well and seismic exchange | GOCAD point sets are a realistic shared format; JOA formats are candidates |
| S&P Global | Kingdom, Petra | Kingdom exports culture and interpretation data to text and shapefile; Petra exports well and interpretation data to ASCII; Kingdom uses a planimeter polygon text format | Support shapefile and plain text; treat undocumented Kingdom and Petra text dialects as later work |
| Emerson | GOCAD, Roxar RMS, SKUA | GOCAD ASCII `.pl`, `.vs`, and `.ts` are documented and read by third-party tools; RMS and SKUA project stores are proprietary | GOCAD ASCII is a strong interchange target |
| Dynamic Graphics | EarthVision | EarthVision grids and its own project data; interchange often goes through ASCII and GIS | Grids are already covered by Peforma Grid/2D-Map; lines are not a documented public strength |
| LMKR | GeoGraphix | Project database with ASCII and shapefile exchange for well and culture data | Generic ASCII and shapefile coverage is sufficient initially |
| DUG | DUG Insight | Imports and exports columnar text, UKOOA navigation, Kingdom polygon files, shapefiles, and SEG-Y; well paths use a simple ASCII layout | Confirms that columnar text, P1/90, and shapefile are the practical lingua franca |
| OpenSpirit / TIBCO | Multi-vendor connector | Extracts well paths, position logs, and point sets from Petrel, OpenWorks, and other stores into other applications | A model for what users expect, not a file format Peforma can consume |

Two conclusions follow from the landscape. First, there is no single vendor-neutral line format comparable to CPS-3 for grids; the practical exchange set is columnar text, shapefile, GeoJSON, GOCAD ASCII, and navigation standards. Second, the vendor project database is where most geometry lives, and it is precisely the part a local browser tool should not pretend to read.

## Proposed support tiers

The tiers separate what can be built with confidence from what needs a published specification or representative files before it can be promised.

| Tier | Formats | Direction | Rationale |
| --- | --- | --- | --- |
| 1 — first release | Delimited text with explicit mapping | Import and export | Covers the most common hand exchange and makes ambiguity visible |
| 1 — first release | Petrel-style ASCII points and polylines | Import and export | Simple, widely produced, and verifiable against real exports |
| 1 — first release | GOCAD ASCII `.pl` and `.vs` | Import and export | Publicly documented, used across Paradigm/Emerson and JewelSuite |
| 1 — first release | GeoJSON points and lines | Import and export | Precise specification and straightforward geometry mapping |
| 1 — first release | Shapefile points and polylines | Import and export | Standard GIS delivery, including `.prj` metadata |
| 2 — after validation | UKOOA P1/90 and IOGP P1/11 | Import, then export | Valuable for seismic navigation but record layouts need representative files |
| 2 — after validation | SEG-Y navigation headers | Import | Read-only extraction of trace-header coordinates and line identifiers |
| 2 — after validation | RESQML 2.2 polyline and point-set subsets | Import, then export | Standards-based but requires EPC package handling and careful subsetting |
| 2 — after validation | DXF and KML simple geometry | Import, then export | Useful for GIS and CAD users, with a deliberately small entity set |
| 2 — after validation | WITSML 2.x trajectory objects | Import | Well trajectories only, not a general geometry exchange |
| 3 — out of scope | Vendor project stores and binary project files | None | No public, stable, safe contract |
| 3 — out of scope | Seismic amplitudes, well logs, point clouds | None | Different problem domains |

A format moves from tier 2 to tier 1 only after the parser has been checked against representative files from more than one producer and the assumptions are written down.

## Design principles

- Preserve vertex count, vertex order, object order, part order, and attribute values exactly. Do not deduplicate, sort, simplify, or close geometry.
- Make column meaning explicit. Delimited files require a user-confirmed mapping before a preview is treated as geometry.
- Distinguish missing Z from zero Z, and missing attributes from empty strings.
- Carry CRS and units as metadata. Never reproject, never rescale, never substitute a default datum.
- Treat closure as stored data. A repeated first vertex is not silently removed, and an open line is not silently closed.
- Reject unknown dialects with a specific reason. Never fall back to a positional guess when a header is missing or contradictory.
- Keep the geometry core independent of the grid code. Lines and points should not inherit grid assumptions about rows, columns, or null sentinels.
- Report what was read: object count, vertex count, bounds, attribute names, CRS source, and any records skipped.

## User experience outline

1. Drop or choose one or more files. Identify candidate formats from content and extension, and show the detected format with a confidence note.
2. If the format is delimited text, show the first records and ask the user to assign X, Y, optional Z, object name, and optional measure or attribute columns. Do not preselect a mapping when the header is absent.
3. Show a summary: geometry kind, object and vertex counts, coordinate bounds, Z range, CRS, units, and attribute list.
4. Show a lightweight preview as a list and a small map when coordinates are plausible. The preview must be optional for large files.
5. Let the user choose an output format and confirm the assumptions that will be written: coordinate order, delimiter, precision, Z handling, CRS label, and attribute columns.
6. Download the result with a clear file name and extension, and report any information the target format cannot carry.

Warnings must be specific and actionable: which record failed, which column was ambiguous, which attribute was dropped, and what the user can do about it. A partial conversion is not offered silently; either the user accepts a listed loss of metadata or the conversion stops.

## Validation and errors

- Validate numeric fields before building geometry, and report the line and column of the first failure.
- Reject files with inconsistent vertex counts in fixed-width or declared-length records.
- Reject a polyline with fewer than two vertices and a point with fewer than two coordinates.
- Reject coordinates that are not finite numbers; do not coerce text to zero.
- Treat a declared CRS that contradicts the coordinate range as a warning, not a silent correction.
- Detect truncated shapefile bundles, missing `.dbf` files, and unreadable `.prj` files.
- Detect unsupported SEG-Y revisions and non-textual P1/11 encodings rather than parsing them as text.
- Bound memory use for large files and report when a file is too large for an in-browser preview.
- Never crash the page on malformed input; surface a readable error and keep the previous result intact.

## Interoperability cautions

- Column order is not standardized across vendors even when the values look familiar. An unlabeled `X Y Z` file may be easting, northing, elevation, or a local grid in a different order.
- Horizontal and vertical units are often omitted. A metric grid with feet in Z is a common and expensive mistake.
- Elevation sign conventions differ: elevation positive up, depth positive down, and subsea depth negative are all in use.
- CRS definitions may be absent, approximate, or stored only in a companion file. A shapefile without `.prj` is not self-describing.
- GeoJSON is WGS 84 longitude/latitude by specification. Projected coordinates in a `.geojson` file are a common informal extension and must be labeled as such.
- Shapefile attribute names are limited and may be truncated. Preserve the stored names and warn when a name cannot be written back exactly.
- GOCAD headers may declare a coordinate reference system in a free-text field. Preserve the text and do not interpret it as an EPSG code.
- Navigation formats describe acquisition geometry, not interpreted horizons. Shot-point order and line direction must be preserved even when they look irregular.
- SEG-Y trace headers are not guaranteed to be populated consistently. Report which header fields were used and let the user confirm the coordinate convention.
- RESQML and WITSML objects carry explicit units and CRS; a partial reader must either honor them or refuse the object.
- Output compatibility should be confirmed in the target application, including orientation, CRS, units, Z sign, null handling, and attribute mapping.

## Acceptance criteria

- A user can load a supported point or polyline file, see the detected format, confirm or assign the geometry columns, inspect counts, bounds, CRS, and attributes, and download a supported output.
- A delimited file without a header is never interpreted without an explicit user mapping.
- The exported geometry has the same vertex count, vertex order, object order, and coordinate values as the imported geometry, apart from documented precision rounding.
- Missing Z, missing attributes, and empty strings remain distinguishable in the result.
- CRS and units are either preserved or explicitly reported as unknown; no reprojection or unit conversion occurs.
- Invalid or unsupported files produce a readable error without crashing the page, and the previous result remains available.
- The interface works on desktop and narrow screens and is keyboard accessible, with labelled controls, visible focus, and announced results.
- All parsing, preview, and export run in the browser, with no network request carrying source geometry.
- The format assumptions and limitations are documented before a format is marked as supported.

## Open questions

- Which single vendor export should anchor the first release: a Petrel ASCII point and line export, a Kingdom culture export, or a JewelSuite point set?
- Should UKOOA P1/90 import ship with the first release, given how often seismic navigation is the actual exchange need?
- Is a map preview required for the first release, or is a numeric summary and a table enough?
- Should shapefile export be deferred until the polygon tool exists, so that point, line, and polygon writing share one implementation?
- How should very large navigation files be handled in a browser: a hard size limit, a streaming summary, or a worker with progress?

## Sources

- [SEG-Y revision 2.1 clarification](https://seg.org/wp-content/uploads/2025/11/seg-y_rev2-1_clarification_2025-05-01.pdf) and [SEG-Y rev 1 specification](https://www.moveoutdata.net/wp-content/uploads/2022/06/SEG-Y-Format-rev-1.pdf) — trace header layout, revisions, and navigation fields.
- [SEG Technical Standards](https://seg.org/publications/seg-technical-standards/) and [SEG-D rev 3.0](https://www.scribd.com/document/556462067/SEG-D-rev3-0-Format-jun2012) — field tape standards.
- [IOGP P1/11 user guide](https://www.iogp.org/bookstore/product/iogp-p1-11-geophysical-position-data-exchange-format-user-guide/), [IOGP release announcement](https://www.iogp.org/blog/announcements/geomatics-announcements/iogp-releases-version-2-0-of-geophysical-position-data-exchange-formats/), [OGP P2/11](https://www.moveoutdata.net/wp-content/uploads/2022/06/OGP-P2-11.pdf), and [SEG-UKOOA ADS metafile format](https://seg.org/wp-content/uploads/2025/11/seg_ukooa_ads_meta_format_ver1.pdf) — marine positioning and acquisition metadata.
- [RESQML standards](https://energistics.org/resqml-data-standards), [RESQML v2.2 release note](https://energistics.org/resqml-developers-users), and [OSDU RESQML parser](https://community.opengroup.org/osdu/platform/data-flow/ingestion/energistics/resqml-parser) — polyline and point-set representations.
- [WITSML schema overview](https://energistics.org/sites/default/files/witsml_schema_overview.html) and [WITSML 2.0 overview](https://energistics.org/sites/default/files/2023-03/witsml-v2-webinar-v2.pdf) — well and trajectory objects.
- [LAS 2.0 documentation](https://kcpetrophysics.mynucleus.ca/LAS_2_Documentation_Feb2017.pdf) and [USGS LAS description](https://www.usgs.gov/programs/national-geological-and-geophysical-data-preservation-program/las-format) — log curves, included to separate them from trajectory geometry.
- [GOCAD ASCII format description](https://paulbourke.net/dataformats/gocad/gocad.pdf), [OpenGeoSys GOCAD reader](https://www.opengeosys.org/stable/docs/tools/fileio/gocadtsurfacereader/), and [LaGriT GOCAD reader](https://lanl.github.io/LaGriT/pages/docs/read_gocad.html) — `PLINE`, `VSET`, and `TSURF` structure.
- [JewelSuite point sets](https://documentation.jewelsuite.com/geomechanics/Content/Main/External-formats-Point-sets.htm) — GOCAD `.vs`, JOA ASCII, and JOA XML point-set exchange.
- [ASCII data transfer to Petrel](https://www.scribd.com/document/407812520/GF-to-Petrel), [Petrel data import notes](https://www.scribd.com/doc/290493967/Petrel-2011-Data-Import), and [OpenDTect ASCII well track](https://doc.opendtect.org/7.0.0/doc/od_userdoc/content/survey/import/import_wells/from_ascii_files/track.htm) — Petrel-style deviation and path columns.
- [OpenWorks data management](https://www.academia.edu/10235441/OpenWorks_Software_Data_Management), [Halliburton OpenWorks](https://www.halliburton.com/en/software/decisionspace-365-enterprise/ds365-ai/openworks-software), and [OpenSpirit well paths and position logs](https://support.tibco.com/external/article/KB0071288/creating-wellpaths-and-position-logs.html) — Landmark store and extraction behavior.
- [Petra export tools](https://onlinehelp.ihsmarkit.com/Energy/Petra/2024/Content/1-Overview/ovr_exportingdata.htm), [Petra log export](https://onlinehelp.ihs.com/Energy/Petra/2020/Content/1-Overview/ovr_export_logs.htm), and [Kingdom vendor formats](https://www.scribd.com/document/753195959/VendorFormats) — Kingdom and Petra text exchange.
- [DUG Insight navigation loader](https://help.dugeo.com/m/Insight/l/438585-loading-navigation-data-files) and [DUG Insight well paths](https://help.dugeo.com/m/Insight/l/438717-defining-well-path) — columnar text and UKOOA use in practice.
- [ResInsight well paths](https://resinsight.org/wells-and-completions/wellpaths/index.html) — simple ASCII path conventions.
- [Esri Shapefile technical description](https://www.esri.com/content/dam/esrisites/sitecore-archive/Files/Pdfs/library/whitepapers/pdfs/shapefile.pdf) and [GeoJSON RFC 7946](https://www.rfc-editor.org/rfc/rfc7946) — GIS geometry and coordinate rules.
- [JewelSuite subsurface modeling brochure](https://dam.bakerhughes.com/m/6f9eb486a4cfac0a/original/JewelSuite-Subsurface-Modeling-Brochure.pdf) and [JewelSuite ecosystem](https://www.bakerhughes.com/oilfield-services-and-equipment-digital/well-planning/jewelsuite-ecosystem) — Baker Hughes tool scope.
