# Peforma Polygons — Polygon and Boundary Data Exchange

Status: planned. This chapter defines the product and the intended format scope. No polygon converter is implemented yet, and nothing here should be read as a claim of current support.

Peforma Polygons is the suite member for polygon and boundary geometry. Peforma Lines handles open polylines and point sets; Peforma Polygons handles closed geometry that bounds an area: fault polygons, horizon boundaries, prospect volumes, flow zones, and interpretation areas. Open polylines remain in Peforma Lines even when they are later closed; a polygon is a polygon only when the source declares it closed or when the geometry is topologically a closed loop.

## Problem

Polygon data is where interpretation applications disagree the most. The geometry is closed and ordered, which makes it look simple, but the rules for what makes a polygon valid — ring orientation, duplicate first/last vertex, holes, self-intersection, attribute inheritance, and the Z convention for "planar" versus "closed solid" — vary by producer. Two files that draw the same shape on a screen can fail to import in the receiving application because one stores the first vertex repeated at the end and the other does not, or because one ring is clockwise and the other is counter-clockwise.

Most large applications keep polygons in a project database. The practical exchange surface is a handful of ASCII and GIS formats: Petrel's IESX fault-polygon export, Kingdom's planimeter polygon, ZMAP fault polygons, GOCAD curves, and Esri Shapefile. Each of those formats makes a different decision about ring closure, ring orientation, and which attributes survive the write. A converter that silently normalizes those decisions has changed the data, even if the picture looks the same.

## Goal

Provide a small browser tool that reads supported polygon and boundary exchange files, shows exactly what ring, closure, and attribute state was found, lets the user choose the target conventions explicitly, and writes a supported format without altering vertex order, ring orientation, hole structure, or attribute values.

The tool must never close an open ring, reverse a ring, drop a duplicate endpoint, or reorder vertices on its own. Each of those operations is either a geometric decision the user must make or a format requirement the target specifies, and the tool must surface which one is happening.

## Users

Oil and gas geoscientists and interpreters who move fault polygons, horizon boundaries, flow zones, or well fences between interpretation applications, GIS, and reservoir models. They need to know, before writing a file, exactly how the ring is closed, which way it runs, and which attributes will be carried.

## Scope

### In scope for the first release

- Read and write Esri Shapefile polygon and multipolygon features, including `.shp`, `.shx`, `.dbf`, and `.prj` sidecars.
- Read and write GeoJSON `Polygon` and `MultiPolygon` with RFC 7946 ring orientation and property preservation.
- Read and write GOCAD ASCII closed polylines (`.pl`) as polygon boundaries where the curve is declared closed.
- Read the documented Petrel IESX fault-polygon ASCII export (`.dat` or `.iesx`) and the CPS-3 Lines ASCII polygon export.
- Read the Kingdom planimeter polygon format (`.plg`) and the ZMAP fault-polygon records marked with `@FALT`.
- Read and write simple 2D and 3D closed `LWPOLYLINE` and `POLYLINE` DXF entities.
- Show polygon counts, vertex totals, ring counts, whether each ring is closed and in which direction, hole structure, attribute names, and CRS.
- Preserve vertex order, ring order, hole order, and attribute values exactly.
- Report, not change, ring closure state, ring orientation, and any duplicate first/last vertex.
- Process files locally in the browser, with no upload and no telemetry.

### Out of scope

- Vendor project databases and binary project stores for Petrel, OpenWorks, DecisionSpace, Kingdom, Petra, Roxar RMS, JewelSuite, and GeoGraphix.
- Topological operations: union, intersection, difference, buffer, dissolve, validity repair, and self-intersection fixing.
- Reprojection, datum transformation, geoid conversion, and unit conversion.
- Rasterized polygon fills and polygonization of line work. A polygon is exchanged as ring geometry, not as a mask.
- Z-aware solid polygons (closed 3D volumes). A "Z" value per vertex is preserved, but the tool does not build or validate a closed solid.
- Batch conversion and server-side storage.

## Polygon data model

Peforma Polygons uses one internal model built from rings.

| Concept | Meaning | Rules |
| --- | --- | --- |
| Polygon | One outer ring plus zero or more inner rings | Rings are stored in source order; no reordering |
| Multipolygon | A collection of polygons | Polygons keep their source order |
| Outer ring | The exterior boundary | First ring of the polygon |
| Inner ring | A hole | All rings after the first |
| Vertex | X, Y, optional Z, and optional per-vertex attributes | Order preserved; missing Z is distinct from Z = 0 |
| Ring closure | Whether the last vertex equals the first | Reported, never auto-fixed |
| Ring orientation | Clockwise or counter-clockwise | Reported; RFC 7946 expects exterior CCW and interior CW in a geographic coordinate system |
| Self-intersection | A ring that crosses itself | Reported as a warning; not repaired |
| CRS | Horizontal and vertical reference | Carried as metadata; never transformed |
| Units | Horizontal and vertical units | Carried as metadata; never converted |
| Object attributes | Name, type, and per-ring or per-vertex fields | Preserved; attribute names are not guessed |

A polygon that arrives closed in one format may arrive open in another because the exporter dropped the duplicated endpoint. The tool must not add or remove that endpoint silently. The reader records the closure state it found, and the writer applies the closure convention the target requires, stating that decision in the summary.

## Format landscape

Polygon exchange travels through a small set of documented formats plus a group of vendor ASCII dialects that are only partially specified publicly.

### Open standards and documented formats

| Format | Steward or origin | Carries | Reading | Writing | Notes |
| --- | --- | --- | --- | --- | --- |
| Esri Shapefile | Esri technical description | Polygon and multipolygon features with DBF attributes and `.prj` | Yes | Yes, as a bundle | Requires `.shp`, `.shx`, `.dbf`, and optional `.prj`; ring orientation and record order are preserved |
| GeoJSON | IETF RFC 7946 | Polygon and MultiPolygon with properties | Yes | Yes | WGS 84 longitude/latitude by specification; RFC 7946 ring orientation is exterior CCW and interior CW |
| GOCAD ASCII `.pl` | Paradigm/Emerson GOCAD, publicly documented | Closed curves and polylines with properties | Yes | Yes | A closed `PLINE` is read as a polygon boundary; the CRS may be declared in the header or absent |
| DXF | Autodesk, documented | 2D and 3D closed `LWPOLYLINE` and `POLYLINE` entities | Yes, limited | Yes, limited | Simple closed entities only; blocks, hatches, and arcs with bulge are out of scope |
| RESQML 2.2 | Energistics | Earth-model objects, including fault-set representations | Later | Later | Packaged in an EPC container; a subset reader is feasible, a full implementation is not |
| KML | OGC | Polygon placemarks for display | Later | Later | WGS 84 longitude/latitude; styling and folders are not preserved as data |

### Vendor ASCII dialects

These are real, commonly produced exports. Several are not fully specified in public documents, so they are treated as observed dialects that must be confirmed against representative files before they are promoted to tier 1.

| Format | Producer | Carries | Reading | Writing | Notes |
| --- | --- | --- | --- | --- | --- |
| IESX fault polygon ASCII | Petrel / GeoQuest lineage | Closed fault polygon rings with per-polygon attributes | Yes | Yes | Petrel's documented polygon export; extensions `.dat` or `.iesx` |
| CPS-3 Lines ASCII | Petrel | Polygon or contour vertices in CPS-3 line style | Yes | Yes | The polygon variant of a CPS-3 line export |
| Kingdom planimeter polygon | S&P Global Kingdom | Closed planimeter boundary with attributes | Yes | Later | Extension `.plg`; used to import Kingdom polygons into other tools |
| ZMAP fault polygon | ZMAP / Kingdom lineage | Fault polygon records introduced by `@FALT` | Yes | Later | Identified by the `@FALT` marker in record one |
| EarthVision fault polygon | Dynamic Graphics | Fault polygon records introduced by `FFASCI` | Later | Later | Vendor dialect; confirm against a representative file |
| DUG `.dupoly` | DUG Insight | Picked polygon vertices | Later | Later | Vendor dialect; not publicly specified, so tier 3 until representative files exist |

Two conclusions follow. First, the public, well-specified exchange set is Shapefile, GeoJSON, GOCAD closed polylines, and DXF closed entities — the same set Peforma Lines uses, with closure and orientation added. Second, the vendor ASCII dialects (IESX, CPS-3 lines, Kingdom `.plg`, ZMAP `@FALT`) are real but only partially documented, so they belong in a validation tier and must not be promoted without representative files.

## Proposed support tiers

The tiers separate what can be built with confidence from what needs a published specification or representative files before it can be promised.

| Tier | Formats | Direction | Rationale |
| --- | --- | --- | --- |
| 1 — first release | Shapefile polygon and multipolygon | Import and export | Standard GIS delivery, including `.prj` metadata |
| 1 — first release | GeoJSON Polygon and MultiPolygon | Import and export | Precise specification and unambiguous ring rules |
| 1 — first release | GOCAD closed `.pl` | Import and export | Documented closed-curve structure, used across GOCAD-based tools |
| 1 — first release | Petrel IESX fault-polygon ASCII and CPS-3 Lines polygon | Import and export | The most common interpretation-exchange polygon exports |
| 2 — after validation | Kingdom `.plg` and ZMAP `@FALT` | Import, then export | Real dialects, partially documented; need representative files |
| 2 — after validation | DXF closed entities | Import, then export | GIS/CAD users, with a deliberately small entity set |
| 2 — after validation | RESQML 2.2 fault-set and polygon representations | Import, then export | Standards-based but requires EPC package handling |
| 3 — out of scope | Vendor project stores and binary project files | None | No public, stable, safe contract |
| 3 — out of scope | Topology, rasterization, solid polygons | None | Different problem domain |

A format moves from tier 2 to tier 1 only after the parser has been checked against representative files from more than one producer and the assumptions are written down.

## Design principles

- Preserve vertex order, ring order, hole order, and attribute values exactly. Do not reorder rings, drop holes, or merge polygons.
- Distinguish a stored closed ring from a stored open ring. Never add or remove the duplicated first vertex without stating the convention being applied.
- Report ring orientation. Do not reverse a ring to "fix" it; the target format decides the convention and the tool names that decision.
- Treat self-intersection as a warning, not an error to repair. A valid-looking polygon that crosses itself is passed through with a note.
- Distinguish missing Z from zero Z, and missing attributes from empty strings.
- Carry CRS and units as metadata. Never reproject, never rescale, never substitute a default datum.
- Reject a file whose ring structure is ambiguous and never silently pick one. A shapefile without `.dbf`, a GeoJSON with a ring of fewer than four coordinates, or a GOCAD `PLINE` that is neither closed nor declared is a specific error, not a guess.
- Keep the polygon core independent of the grid code. Polygons must not inherit grid assumptions about rows, columns, or null sentinels.
- Report what was read: polygon count, ring count, vertex count, closure state, orientation, CRS source, and any records skipped.

## User experience outline

1. Drop or choose one or more files. Identify candidate formats from content and extension, and show the detected format with a confidence note.
2. Show the ring summary: polygon count, ring count, vertex totals, which rings are closed, which direction they run, and which holes exist.
3. Show attribute names and the CRS source. If the CRS is absent, say so rather than assuming WGS 84.
4. Let the user choose an output format and confirm the target conventions: ring closure (repeat or drop the first vertex), ring orientation, delimiter, precision, CRS label, and attribute columns.
5. Download the result with a clear file name and extension, and report any information the target format cannot carry, such as a Z value or an attribute name that is truncated.

Warnings must be specific and actionable: which ring is self-intersecting, which attribute was dropped, which convention the writer applied, and what the user can do about it. A partial conversion is not offered silently; the user either accepts a listed loss of metadata or the conversion stops.

## Validation and errors

- Require at least four coordinates in a GeoJSON ring and at least three distinct vertices in a polygon, matching the target's rule.
- Reject a shapefile bundle that is missing `.dbf` or whose `.shp` and `.shx` record counts disagree.
- Report, not fix, a ring that is not closed in a format that expects closure.
- Reject coordinates that are not finite numbers; do not coerce text to zero.
- Detect a declared CRS that contradicts the coordinate range and surface it as a warning.
- Detect self-intersecting rings and report them; never repair them automatically.
- Detect a duplicate first/last vertex and report it; the writer decides whether to keep or drop it based on the chosen convention.
- Never crash the page on malformed input; surface a readable error and keep the previous result intact.

## Interoperability cautions

- Ring closure conventions differ. Some writers repeat the first vertex, some do not. The tool must state which convention a file uses and which the target requires.
- Ring orientation conventions differ. RFC 7946 expects exterior rings counter-clockwise and holes clockwise in a geographic coordinate system; a projected system may use the opposite. Reversing rings without recording the decision changes the data.
- WGS 84 longitude/latitude is the GeoJSON and KML default. A polygon in projected coordinates stored as a `.geojson` file is an informal extension and must be labeled as such.
- Shapefile attribute names are limited to sixteen characters and may be truncated. Preserve the stored names and warn when a name cannot be written back exactly.
- GOCAD headers may declare a coordinate reference system in a free-text field. Preserve the text and do not interpret it as an EPSG code.
- Vendor IESX and `.plg` dialects carry attributes that are named differently by different producers. A field that means "fault type" in one export may be unnamed in another; the mapping is explicit, never by position alone.
- A "polygon" in a fault-polygon export is a closed interpretation ring, not a validated topological surface. Do not treat it as a watertight solid.
- Output compatibility should be confirmed in the target application, including orientation, closure, CRS, units, and attribute mapping.

## Acceptance criteria

- A user can load a supported polygon file, see the detected format, ring closure state, ring orientation, hole structure, CRS, and attributes, and download a supported output.
- A file whose rings are ambiguous or malformed is never interpreted without an explicit user choice.
- The exported geometry has the same polygon count, ring count, vertex count, vertex order, ring order, and coordinate values as the imported geometry, apart from the explicitly chosen closure and orientation conventions.
- Ring closure state and orientation are reported on import and the applied convention is reported on export.
- CRS and units are preserved or explicitly reported as unknown; no reprojection or unit conversion occurs.
- Invalid or unsupported files produce a readable error without crashing the page, and the previous result remains available.
- The interface works on desktop and narrow screens and is keyboard accessible, with labelled controls, visible focus, and announced results.
- All parsing, preview, and export run in the browser, with no network request carrying source geometry.
- The format assumptions and limitations are documented before a format is marked as supported.

## Open questions

- Which vendor dialect should anchor the first release: Petrel IESX, Kingdom `.plg`, or ZMAP `@FALT`? IESX has the strongest public documentation trail.
- Should ring-orientation normalization be offered as an explicit user choice in the first release, or only reported?
- Is Z per vertex required for the first release, or should the first release be strictly planar X/Y polygons with an optional Z column?
- Should shapefile writing be deferred to share one implementation with the grid tool's shapefile reader, or built now?
- How should the tool treat a self-intersecting ring: refuse, warn and pass through, or isolate the offending vertex?

## Sources

- [DUG Insight: export polygons from Petrel](https://help.dugeo.com/online-manual/faq/articles/petrel/77999-how-do-i-export-polygons-from-petrel-to-import-into-insight.html) and [DUG Insight: import a Kingdom polygon](https://help.dugeo.com/online-manual/faq/articles/kingdom/222070-how-do-i-import-a-kingdom-polygon-to-use-in-insight.html) — IESX fault-polygon export and Kingdom `.plg` import.
- [DUG Insight: exporting a polygon](https://help.dugeo.com/m/Insight/l/438755-exporting-a-polygon) and [using fault polygons](https://help.dugeo.com/online-manual/user-manual/articles/polygons/438752-using-fault-polygons.html) — DUG polygon export formats.
- [Recognized polygon files and markers](https://migris.no/migrix-userguide/input-subfixes_print.html) — `@FALT`, `@FAULT`, and `FFASCI` record markers.
- [Exporting contour, fault polygon, and grid data from Petrel](https://www.coursehero.com/file/29778492/petrel-to-ofmpdf/) — CPS-3 Lines polygon export.
- [Esri Shapefile technical description](https://www.esri.com/content/dam/esrisites/sitecore-archive/Files/Pdfs/library/whitepapers/pdfs/shapefile.pdf) and [GeoJSON RFC 7946](https://datatracker.ietf.org/doc/html/rfc7946) — GIS geometry and ring orientation rules.
- [GOCAD ASCII format description](https://paulbourke.net/dataformats/gocad/gocad.pdf) and [OpenGeoSys GOCAD reader](https://www.opengeosys.org/stable/docs/tools/fileio/gocadtsurfacereader/) — closed-curve and polyline structure.
- [DXF LWPOLYLINE entity](https://ezdxf.readthedocs.io/en/stable/dxfentities/lwpolyline.html) — closed 2D and 3D polyline entities.
- [RESQML standards](https://energistics.org/resqml-data-standards) — earth-model object exchange.
- [JewelSuite documentation](https://documentation.jewelsuite.com/) — Baker Hughes well and subsurface exchange surface.
- [Kingdom geophysics brochure](https://cdn.ihsmarkit.com/www/pdf/0621/Kingdom-Geophysics-Brochure.pdf) — S&P Global polygon and interpretation exchange.
- [OpenWorks data management](https://www.academia.edu/10235441/OpenWorks_Software_Data_Management) — Halliburton/Landmark interpretation data storage.
