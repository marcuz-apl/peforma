# Peforma 3D — Mesh and Geobody Data Exchange

Status: planned. This chapter defines the product and the intended format scope. No 3D converter is implemented yet, and nothing here should be read as a claim of current support.

Peforma 3D is the suite member for triangular surface meshes and closed solid "geobodies". Peforma Grid handles regularly sampled surfaces; Peforma Culture handles points, open polylines, and closed planar rings — fault sticks, well trajectories, fault polygons, and prospect outlines; Peforma Seismic handles 2D seismic lines and 3D cubes; Peforma 3D handles the tessellated objects that come from 3D geological modeling workflows: horizon and fault surfaces, faceted geobody boundaries, salt bodies, and the STL/OBJ/PLY/COLLADA/GOCAD files that interpretation and 3D-print tools exchange. Seismic volumes are trace data, not mesh objects, and are never read here. Geobody- and fault-specific semantics (stratigraphic ordering, facies, fault separation) are carried as attributes, not as a separate data model.

## Problem

A 3D geobody is a set of triangles with an implicit meaning: which side is "inside" the reservoir, which face separates two stratigraphic units, which edge is shared with the adjacent block. The mesh file itself rarely carries that meaning. Exporters strip it. An STL is just triangles; an OBJ may have group headers but no topology; a COLLADA file carries material names but not reservoir semantics. When a geobody moves between applications, the receiving tool has to re-derive unit identities, or the user has to remap them by hand, or the data is simply lost.

Most 3D geological modeling systems keep the meaningful model in a project database. The public exchange surface is a handful of tessellation formats: GOCAD `TSurf` and `TSolid`, STL, OBJ, PLY, and COLLADA. Each makes different decisions about which vertices are shared, which faces are present, and whether a "solid" is actually watertight. A converter that silently rewelds vertices, flips face normals, or fills boundary gaps has changed the geometry, even if the surface looks the same.

## Goal

Provide a small browser tool that reads supported mesh and geobody tessellation files, shows exactly what the geometry contains, and writes a target format without altering vertex position, face connectivity, normals, or attribute values.

The tool must be honest about what a mesh is. A surface mesh with open boundaries is not the same object as a watertight solid, and the tool must say which one it found rather than guess.

## Users

Oil and gas geoscientists, reservoir modelers, and 3D-print or visualization specialists who need to move triangulated surfaces or faceted geobodies between interpretation tools, modeling tools, and external 3D software. They need to know whether a mesh is open or closed, whether the normals are consistent, and which attributes carried over.

## Scope

### In scope for the first release

- Read and write ASCII STL (solid and non-solid) with vertex and face preservation.
- Read binary STL where the byte layout is well-defined; report the detected record count and byte size.
- Read and write Wavefront OBJ with `v`, `vn`, `f`, and `o`/`g` group records; preserve face indices, vertex normals, and group names.
- Read and write PLY (ASCII and binary little-endian) with vertex position, optional vertex normal, and face connectivity.
- Read GOCAD `TSurf` (`.ts`) triangle surfaces and `TSolid` (`.so`) tetrahedral cells as meshes.
- Read triangular fault and horizon surfaces as meshes; fault identity is carried only by the group or object name and by attributes, not by a separate fault object.
- Read COLLADA (`dae`) with one or more meshes, limited to the `triods` and `triangles` primitives.
- Show mesh-level facts: vertex count, face count, whether the mesh is closed or open (detected by open edges), normal consistency, bounding box, and attribute group names.
- Preserve vertex positions, face connectivity, group or object names, and normals where present.
- Report, not repair, open boundaries, inconsistent normals, and shared-vertex gaps.
- Process files locally in the browser, with no upload and no telemetry.
- For large files, use a streaming path with a hard preview limit and an explicit size warning.

### Out of scope

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

## 3D data model

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

## Object classification

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

## Format landscape

3D tessellation exchange travels through a small set of documented formats plus a group of vendor dialects.

### Open standards and documented formats

| Format | Steward or origin | Carries | Reading | Writing | Notes |
| --- | --- | --- | --- | --- | --- |
| ASCII STL | De facto standard | Triangular facets with or without a solid name | Yes | Yes | Simplest tessellation format; no group, no normal, no UV |
| Binary STL | De facto standard | Same facets, packed in 50-byte records | Yes | Yes | No header metadata beyond the record count |
| Wavefront OBJ | Wavefront, documented | Vertices, normals, UVs, faces, groups, objects | Yes | Yes | Rich but free-form; the group and object records carry the only semantics |
| PLY | Stanford, documented | Vertices with properties, faces, and an optional texture | Yes | Yes | ASCII or binary; property list is explicit |
| GOCAD TSurf `.ts` | Paradigm/Emerson GOCAD, publicly documented | Triangulated surface with vertices, triangles, and properties | Yes | Yes | A surface mesh; CRS may be declared in the header |
| GOCAD TSolid `.so` | Paradigm/Emerson GOCAD | Tetrahedral cells with faces | Yes | Later | A solid mesh; confirm against a representative file before writing |
| COLLADA `dae` | Khronos, documented | Multiple meshes in a scene, each with primitives | Yes, limited | Yes, limited | Limited to `triangles` and `triods` primitives; materials and transforms are out of scope |
| KML ground overlay | OGC | Raster overlays, not mesh | No | No | Not a 3D mesh format |

### Vendor exchange surface

| Vendor | Application | Public 3D exchange | Consequence for Peforma |
| --- | --- | --- | --- |
| SLB | Petrel, GeoFrame, Ocean | Petrel exports geological and reservoir models to COLLADA (`.dae`) and VRML (`.wrl`); GOCAD `TSurf` surfaces can be exported for simulation coupling | Provide COLLADA and GOCAD TSurf coverage; do not read the Petrel project |
| Halliburton / Landmark | OpenWorks, DecisionSpace, SeisWorks | Geometry lives in the OpenWorks database; external exchange goes through SEG-Y for seismic and ASCII/standard formats for interpretation objects; 3D geobody is not a documented public export | Generic mesh and surface formats are sufficient; OpenWorks tables stay out of scope |
| S&P Global | Kingdom, Petra | Kingdom exports 2D/3D seismic, wells, and interpretation objects; geobody surfaces are not a documented public export; Petra supports 3D view but not a documented mesh exchange format | Standard mesh formats cover what a user needs; vendor-specific files are out of scope |
| Emerson | GOCAD, Roxar RMS, SKUA, Leapfrog Geo | GOCAD `TSurf` and `TSolid` are the documented exchange formats; RMS reads and writes GOCAD surfaces; Leapfrog Geo exports per-unit OBJ and STL geobodies | GOCAD surfaces are a strong target; Leapfrog per-unit OBJ/STL is the practical geobody export |
| Baker Hughes | JewelSuite, JewelSuite Geomechanics | JewelSuite documents point sets, well paths, and model inputs in CSV; 3D geobody is not a documented public export format | Generic mesh and CSV are sufficient; no geobody format to support |
| DUG | DUG Insight | 2D/3D SEG-Y and columnar text; 3D geobody is not a documented public export | No direct geobody format; covered by generic mesh formats |

Two conclusions follow. First, the public 3D exchange surface is STL, OBJ, PLY, GOCAD TSurf, and COLLADA, with GOCAD TSolid as the solid-mesh format. Second, the meaningful "geobody" object — a faceted solid with stratigraphic identity — is most commonly exported by interpretation tools as a set of per-unit OBJ or STL files, one file per unit, with the unit identity carried only by the file name or a group record.

## Proposed support tiers

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

## Size and streaming model

A geobody mesh can be large. A full reservoir model tessellated at interpretation density can exceed a million triangles. The design separates a small in-browser summary from the full data body.

- Small files (target: under 64 MB) are read fully into memory and previewed.
- Large files are streamed from the file system in chunks, with a hard preview limit on triangle count.
- Mesh-level summaries (vertex count, face count, closure state, normal consistency, bounds) are built from the first N faces, not from every face.
- Export writes face by face with a fixed layout and progress reporting.
- The UI must show the file size, the estimated memory requirement, and whether the preview is partial before any conversion begins.
- A file that cannot be streamed in the target browser is rejected with the reason, not truncated.

## User experience outline

1. Drop or choose one or more files. Identify the format from content and magic bytes, not only from the extension.
2. Show the mesh summary: vertex count, face count, whether the mesh is closed or open, whether normals are consistent, bounding box, and group or object names.
3. For GOCAD `TSurf` or `TSolid`, show the declared CRS and property list.
4. Let the user choose an output format and confirm the target conventions: face encoding, whether to preserve group names, and whether to keep vertex normals.
5. Download the result with a clear file name and extension, and report any information the target format cannot carry, such as UV coordinates, a face normal, or a group name.

Warnings must be specific: which face has no normal, which boundary edge is open, which group name is longer than the target allows, and what the user can do about it.

## Validation and errors

- Reject a face with a vertex index outside the vertex list.
- Reject a PLY property list that has a type the binary reader cannot decode.
- Reject a binary STL whose byte size does not match the declared record count.
- Report open edges and inconsistent normals; never repair them silently.
- Reject a COLLADA file that uses a primitive type outside the supported set.
- Report a GOCAD `TSurf` that has triangles referencing vertex indices beyond the declared count.
- Detect a declared CRS that contradicts the coordinate range and surface it as a warning.
- Never crash the page on malformed input; keep the previous result intact.

## Interoperability cautions

- "Closed" and "open" are properties of the mesh, not of the file extension. An STL file can be an open surface or a closed solid, and the tool must say which.
- A fault plane is an open surface even when a viewer makes it look closed. Report its closure state; never cap, thicken, or merge it into a solid.
- A fault stick, a fault plane, and a fault pillar are different objects. Never infer a surface from sticks or a pillar from a surface; each has its own owner in the suite.
- Face normal direction is a property of the file, not of the software that reads it. Flipping normals to "face outward" is a geometric decision the user must make, and the tool must state it.
- Group and object names in OBJ carry the stratigraphic or facies identity in many geobody workflows. A target format that cannot carry group names must have that limitation reported, not silently dropped.
- GOCAD `TSurf` may declare a coordinate reference system in a free-text field. Preserve the text and do not interpret it as an EPSG code.
- Per-unit geobody exports (one OBJ per stratigraphic unit) carry unit identity in the file name. The tool should let the user confirm the unit-to-file mapping before writing a single combined file.
- A mesh with one million triangles does not need to be read in full to be summarized. The preview limit must be stated, not hidden.
- Output compatibility should be confirmed in the target application, including CRS, units, face orientation, and attribute mapping.

## Acceptance criteria

- A user can load a supported mesh or geobody file, see the detected format, mesh closure state, normal consistency, vertex and face counts, group names, and CRS, and download a supported output.
- A mesh with open boundaries or inconsistent normals is never silently repaired; the state is reported and the user confirms the export.
- The exported mesh has the same vertex count, face count, vertex order, face connectivity, and group names as the imported mesh, apart from documented precision rounding.
- CRS and units are preserved or explicitly reported as unknown; no reprojection or unit conversion occurs.
- Invalid or unsupported files produce a readable error without crashing the page, and the previous result remains available.
- The interface works on desktop and narrow screens and is keyboard accessible, with labelled controls, visible focus, and announced results.
- All parsing, preview, and export run in the browser, with no network request carrying source geometry.
- The format assumptions and limitations are documented before a format is marked as supported.

## Open questions

- Which producer's OBJ should anchor the first release: Leapfrog Geo per-unit exports or a generic triangulation tool? Leapfrog is the most common geobody producer in the field.
- Should GOCAD `TSolid` be in the first release, given that it is the only public format that carries a true solid rather than a surface?
- Is a map preview required for the first release, or is a numeric summary and face list enough?
- Should per-unit OBJ files be combined into a single OBJ with group records during import, and is that combination a loss of information?
- How should the tool handle UV coordinates and face normals in formats that do not carry them: drop with a note, or refuse the export?

## Sources

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
