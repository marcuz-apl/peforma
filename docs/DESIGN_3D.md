# Peforma 3D — mesh and geobody exchange design

Date: 2026-11-08
Status: approved for implementation (tier 1)

## Goal

Add Peforma 3D to the live suite: a local browser converter for triangulated surfaces and closed geobody meshes. The first release reads and writes ASCII STL, binary STL, Wavefront OBJ, PLY (ASCII and binary little-endian), and GOCAD `TSurf`. Vertex positions, face connectivity, face order, group names, and normals are preserved. Closure and normal consistency are detected and reported, never repaired.

## Non-goals

- Tier 2 formats: GOCAD `TSolid` (`.so`) and COLLADA (`.dae`). They stay labelled as planned.
- Seismic data. A trace volume is not a mesh; Peforma Seismic owns it.
- Fault sticks, well trajectories, and other open polylines. Peforma Culture Lines/Points owns them.
- Fault pillars, corner-point grids, and reservoir property arrays.
- Mesh repair: welding vertices, filling holes, decimating, smoothing, re-tessellating, or computing new normals.
- Reprojection, datum transformation, or unit conversion.
- Vendor project stores, 3D-print slicer preparation, batch conversion, and server-side processing.
- UV coordinates and materials in tier 1. They are counted and reported when dropped.

## Suite placement

Peforma 3D becomes a live suite with two children, mirroring the Culture pattern. The rail header expands the children; it does not navigate.

| Rail and tab label | Route | Document title |
| --- | --- | --- |
| Fault planes & horizons | `#3d-surfaces` | Peforma 3D Surfaces — Move your surfaces |
| Geobodies & solids | `#3d-solids` | Peforma 3D Solids — Move your geobodies |

The full class names appear in the page subtitle:

- Surfaces: "Convert fault planes, faulted horizons, and salt top between STL, OBJ, PLY, and GOCAD TSurf."
- Solids: "Convert geobodies, salt bodies, and closed tetrahedral surfaces between STL, OBJ, PLY, and GOCAD TSurf."

Page headings:

- Surfaces: "Move your surfaces. / Keep every triangle."
- Solids: "Move your geobodies. / Keep the shell."

Eyebrows: `PEFORMA / 3D · SURFACES` and `PEFORMA / 3D · SOLIDS`.

The landing page and Docs mark 3D as live. The rail no longer shows a `Soon` tag for 3D.

## Architecture

One engine, one view, two parameterized entries.

- `src/meshes.js` — detection, parsing, summary, and writing. No React.
- `src/Mesh3D.jsx` — the converter view, mounted with `kind="surface"` or `kind="solid"`.
- `src/main.jsx` — routes, rail children, titles, page copy, bottom notes.
- `src/style.css` — mesh tabs (shared declarations with Culture tabs), preview canvas, stats.
- `src/Docs.jsx`, `docs/PRD_3D.md`, `docs/FORMATS.md`, `README.md` — documentation.

The two kinds differ only in copy and emphasis:

- **Surface**: an open mesh is expected. The closure card states open/closed like any other fact; no warning is raised merely because the mesh is open.
- **Solid**: closure is the headline. An open mesh raises a persistent, non-blocking warning that the mesh is not watertight and that no repair will be performed.

Neither kind infers a surface from sticks or a pillar from a surface.

## Data model

```js
{
  fileName: string,
  format: 'stl-ascii' | 'stl-binary' | 'obj' | 'ply-ascii' | 'ply-binary' | 'tsurf',
  name: string | null,          // solid name, first OBJ object, or TSurf name
  positions: Float64Array,      // x, y, z triples in file order
  faces: Uint32Array,           // three vertex indices per face in file order
  faceNormals: Float64Array|null,   // three components per face (STL)
  vertexNormals: Float64Array|null, // three components per vertex (OBJ, PLY)
  faceGroups: Int32Array|null,  // group id per face; -1 for ungrouped
  groups: [{ id, name, faceCount }],
  crs: string | null,           // declared text, never interpreted
  units: string | null,         // declared text, never converted
  warnings: string[]
}
```

Rules:

- Positions are parsed as IEEE-754 doubles and written in shortest round-trip decimal form. Textual formatting may normalize (for example `1.5000` becomes `1.5`), but the value is identical.
- Vertex order and face order are never changed.
- Missing normals are `null`, distinct from a zero normal.
- Groups preserve their names and face assignment. A face belongs to the group in effect where it appears in the file.
- A model is triangular. Faces with fewer or more than three distinct vertex references are handled as described per format.

## Format detection

Content decides; the extension is only a hint.

1. PLY — first three bytes are `ply` and the header contains a `format` line.
2. GOCAD — the first non-comment line matches `GOCAD <type> 1`. `TSurf` is accepted; `TSolid` reports that tetrahedral solids arrive in tier 2; other GOCAD types name the suite that owns them where known.
3. Binary STL — byte length is at least 84 and exactly `84 + 50 × triangleCount`, where `triangleCount` is the little-endian uint32 at byte 80. The computed count is reported.
4. ASCII STL — the text begins with `solid` and contains `facet normal` and `endfacet`.
5. OBJ — at least one `v ` record and at least one `f ` record.
6. Otherwise: "Unrecognised mesh file. Peforma 3D reads STL, OBJ, PLY, and GOCAD TSurf."

Binary STL detection runs before the ASCII test because a binary header may begin with `solid`.

## Parsing rules

### STL

- ASCII: read `facet normal nx ny nz`, three `vertex x y z` records, `endfacet`; ignore `solid` and `endsolid` names. The solid name is preserved as `model.name`. Each facet contributes three new vertices in file order; vertices are not shared, matching the file.
- Binary: skip the 80-byte header, read the count, then 50-byte records (`normal` 3×float32, three vertices 3×float32, uint16 attribute). The attribute byte count is ignored and reported once if any record is non-zero. A printable header is preserved as `model.name`; otherwise the header is not treated as a name.
- A binary file whose length disagrees with its count is rejected. A facet with fewer than three vertex records is rejected with the facet number.

### OBJ

- Read `v x y z`; a fourth token is ignored with one aggregated warning.
- Read `vn x y z`.
- `o` and `g` set the current group. The full trimmed remainder of the line is the group name; multiple names on one `g` line are kept literally.
- Read `f` tokens in the forms `v`, `v//vn`, `v/vt/vn`, and `v/vt`. Negative indices resolve relative to the counts at that point in the file.
- All tokens of one face must reference normals consistently or reference none. Mixed references are rejected.
- Faces with fewer than three or more than three vertices are rejected with the 1-based face number: "Face 128 has 4 vertices; Peforma 3D reads triangular meshes only."
- `vt`, `mtllib`, `usemtl`, `s`, and other records are ignored; the counts are aggregated into one warning.
- Indices outside the vertex list are rejected with the face number and index.

### PLY

- Header keywords are case-sensitive per the format: `ply`, `format`, `comment`, `element`, `property`, `end_header`.
- Accept `format ascii 1.0` and `format binary_little_endian 1.0`. Reject big-endian with the declared format text.
- Require `vertex` with `x`, `y`, `z`. Read optional `nx`, `ny`, `nz` and optional texture properties (`u`/`v` or `s`/`t`), which are counted and reported as not carried.
- Require a `face` element with a list property whose item type is an integer and whose name is `vertex_indices` or `vertex_index`. List length must be 3.
- Other vertex properties are read and skipped; their names are reported as not carried.
- Elements other than `vertex` and `face` are skipped when their properties are fixed-size. An element with a list property is rejected with its name, because its byte length cannot be computed safely.
- Binary reading supports `char`, `uchar`, `short`, `ushort`, `int`, `uint`, `float`, and `double`.

### GOCAD TSurf

- Accept `GOCAD TSurf 1`. Read header fields `name:` (or `NAME`), `CRS:`, and `UNITS:` case-insensitively as free text and preserve them verbatim.
- Read `VRTX id x y z` and `PVRTX id x y z values…`. `PVRTX` positions are read; property names declared with `PROPERTY` are reported as not carried.
- Read `TRGL a b c` with 1-based vertex ids and map ids to positions. A triangle that references an unknown id is rejected with the triangle number.
- Other records (`ATOM`, `MODEL`, `END`, comments, and style lines) are ignored and counted. A file with no `VRTX`/`PVRTX` or no `TRGL` is rejected.

## Summary and integrity checks

`summarizeMesh(model)` returns:

| Field | Meaning |
| --- | --- |
| `vertexCount`, `faceCount` | Stored counts |
| `groupCount`, `groupNames` | Groups present, in first-use order |
| `bounds` | min/max X, Y, Z |
| `closed`, `openEdges`, `nonManifoldEdges` | Edge-manifold state |
| `closureMethod` | `indices` or `exact positions` |
| `normalState` | `consistent`, `inconsistent`, `undetermined`, or `none` |
| `inconsistentEdges` | Shared edges whose adjacent faces traverse in the same direction |
| `degenerateFaces` | Faces with repeated vertex references or repeated positions |
| `hasFaceNormals`, `hasVertexNormals` | Normal arrays present |
| `crs`, `units` | Declared text |

- **Closure by indices** is used for OBJ, PLY, and TSurf: an undirected edge is `(min, max)` of vertex ids. An edge used once is open; more than twice is non-manifold. The mesh is closed when no edge is open and no face is degenerate.
- **Closure by exact positions** is used for STL, which duplicates vertices per facet: edge keys use the shortest round-trip string of each coordinate. No tolerance is applied. The UI states "open edges detected by exact coordinates."
- **Normal consistency** compares the traversal direction of each shared edge. In a consistently oriented manifold the two adjacent faces traverse the shared edge in opposite directions. Shared edges traversed in the same direction are counted as inconsistent. With no shared edges the state is undetermined.
- Degenerate faces and inconsistent normals are counted and reported; they are never removed or flipped.

## Writing rules

| Target | Carries | Reported as not carried |
| --- | --- | --- |
| STL ASCII | Triangles, solid name, facet normals when present; a zero normal when absent | Groups, vertex normals, CRS, units |
| STL binary | Same; 80-byte header holds the name when it fits | Same |
| OBJ | Vertices, faces, groups, vertex normals | Face normals, CRS, units |
| PLY ASCII | Vertices, faces, vertex normals | Groups, face normals, CRS, units |
| PLY binary LE | Same | Same |
| GOCAD TSurf | Vertices, faces, name, CRS, units | Groups, normals, non-position properties |

Additional rules:

- All outputs preserve vertex order and face order. Indices are remapped only when a target requires sequential ids (TSurf).
- STL writes every face as three vertices in face order. No welding. If the source had per-facet normals, they are written; otherwise a zero normal is written, which means "not supplied" in STL. The tool says so in the target hint.
- OBJ writes `v`, optional `vn`, `g` on group change, and `f v//vn`. Faces with no normal use `f v`.
- PLY writes `x y z` and optional `nx ny nz`. Coordinates use `double`; indices use `uint`.
- GOCAD writes a `TSurf 1` header, `name:`, optional `CRS:` and `UNITS:` inside the header block, then `TFACE`, `VRTX` with 1-based sequential ids, `TRGL`, and `END`.
- Every writer returns `{ text?, bytes?, warnings, fileName, mime }`. Binary targets return `ArrayBuffer` bytes.
- Warnings name the exact loss and count, for example: "STL does not carry groups; 3 group names were not written."

## Size and limits

- Read the whole file into memory up to **64 MB**. Above that, reject with the size and the reason; never truncate.
- Show file size and estimated data memory (positions + faces + normals) in the loaded panel.
- The preview draws at most **20,000 faces**. Above that, sample evenly and label "Preview sampled — 20,000 of N faces". The summary still covers all faces.
- Export builds the output in one pass with a busy state on the download button. No fake streaming.

## User interface

The view reuses the existing converter layout: dropzone, loaded summary, output format row, download button, and bottom note.

1. **Source data.** Dropzone accepts one `.stl`, `.obj`, `.ply`, or `.ts` file. Hint: `STL · OBJ · PLY · GOCAD .TS`. Multiple files are rejected for tier 1.
2. **Loaded summary.** File name, detected format, `READY` badge, and four stat cards:
   - Vertices
   - Faces
   - Closure: "Closed" or "Open" with the open-edge count
   - Normals: "Consistent", "Inconsistent", "None", or "Undetermined"
   A bounds row shows X, Y, Z ranges. A groups row lists group names, up to six, with the remainder counted.
3. **Preview.** A canvas 2D orthographic view with flat shading. Drag rotates, wheel zooms, double-click fits. A caption states the shown/sampled face count and closure method. The canvas is `aria-hidden`; a visually hidden sentence describes the mesh and points to the stats for the accessible summary.
4. **Output format.** Same 230px desktop and 100% mobile width as the other converters. Options: STL (ASCII), STL (binary), Wavefront OBJ, PLY (ASCII), PLY (binary little-endian), GOCAD TSurf.
5. **Target hint.** One sentence, updated per target, stating what that format cannot carry.
6. **Download.** "Convert & download STL (binary)". File name is the source base name plus the target extension.
7. **Bottom note.** Kind-specific integrity statement. No reassurance about uploading or privacy.

### Solid warning

When `kind === 'solid'` and the mesh is open, show a visible warning:

> This mesh is not watertight: N boundary edges are open. Peforma 3D reports the gap and will not fill, cap, or weld it. Confirm the target application's handling before use.

### Surface note

The surface bottom note states:

> Fault planes, horizons, and salt tops are surfaces, not solids. An open boundary is reported as stored and is never capped or thickened. Normals are never flipped or recomputed.

## Errors

- Errors replace the result only after a failed load; a failed export keeps the current model and shows the export error.
- Every parser error names the format, the record, and what was found.
- No malformed input crashes the page; the error boundary behaviour is the same as the other converters (a readable in-panel error).

## Accessibility

- Dropzone is a labelled button that opens the file picker with Enter or Space; the file input remains keyboard reachable.
- Tabs are links with `aria-current="page"` on the active route.
- Stats use definition-style label/value pairs already used by the other converters.
- The canvas is not the only representation of the mesh: all facts are in text.
- Focus is visible in both themes; reduced motion is respected by not animating the preview.

## Documentation updates

- `docs/PRD_3D.md`: status becomes "Tier 1 implemented; tier 2 planned", the open questions record the decisions made here, and the size section matches the 64 MB cap.
- `docs/FORMATS.md`: a Peforma 3D section with detection order, per-format read/write rules, closure detection, and losses.
- `src/Docs.jsx`: a 3D section with object classes, mesh integrity, one subsection per format, and tier-2 status. Add it to the table of contents.
- `README.md`: add Peforma 3D to the tool list.
- Landing page: 3D becomes a live tool card; no "coming soon".

## Verification

Verification lives in `C:\tmp` and is not added to the repository.

Engine fixtures:

- `surface.stl` — ASCII, two triangles sharing one edge; open.
- `solid.stl` — binary tetrahedron; closed, one facet normal per face.
- `geobody.obj` — two groups, vertex normals, shared vertices.
- `surface.ply` — ASCII quad split into two triangles; open.
- `solid.ply` — binary little-endian tetrahedron; closed.
- `fault.ts` — TSurf with one triangle and declared CRS text.
- Malformed cases: binary STL count mismatch, OBJ quad face, PLY big-endian, TSurf unknown vertex id.

Checks:

- Detection selects the expected format for each fixture.
- Round trips preserve vertex count, face count, connectivity, group names, and normals where the target carries them.
- Open surfaces report open edges; the tetrahedron reports closed.
- STL closure is reported as exact-position matching.
- Every silent-loss case produces a counted warning.
- Browser E2E: load each fixture through the file input, assert stats and warning text, switch targets, download, and inspect the files. Run at 1440 and 390 in both themes. Assert no console errors, no horizontal overflow, and no banned upload copy.
- `npm run build` passes.
- Commit and push, then report the commit hash and hook-stamped version.

## Milestones

1. Engine core: model, detection, STL read/write, summary, closure, normals.
2. OBJ read/write.
3. PLY ASCII and binary LE read/write.
4. GOCAD TSurf read/write.
5. View, preview canvas, routes, rail, tabs, page copy.
6. Docs, PRD, FORMATS, README, landing.
7. Browser E2E, build, commit, push.
