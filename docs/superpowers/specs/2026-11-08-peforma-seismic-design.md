# Peforma Seismic Design

**Status:** approved for implementation (four decisions recorded below)

**Goal:** Ship one Peforma Seismic tool with three tabs — Navigation, 2D Lines, and 3D Cube — that reads and writes SEG-Y revisions 0, 1, and 2.x in the browser and exchanges IOGP navigation sidecars without guessing.

## Recorded decisions

1. **Tier-1 anchor: SEG-Y plus navigation, no WASM.** SEG-Y revisions 0, 1, and 2.x are read; SEG-Y revision 2.0 is written as a normalized, header-faithful copy. IOGP P1/90, P1/11, and P6/11 text files are read. No ZGY, no OpenVDS, no streaming, no worker/WASM.
2. **One tool, three tabs.** A single `Peforma Seismic` rail entry opens `#seismic-navigation`, `#seismic-2d`, and `#seismic-3d` with a shared tab bar.
3. **Conversion contract: header-faithful rewrite.** No sample is decoded, rescaled, resampled, or interpolated. Sample bytes are copied verbatim in their source byte order. The binary header is normalized (revision 2.0, fixed-length flag, sample count, sample interval, extended-header count, endian marker). Trace headers are copied verbatim except that a zero sample count or sample interval is filled from the binary header. An optional inline-major reorder is offered for 3D and is reported.
4. **Result view: header and geometry summary.** No amplitude rendering, slice viewer, or colour map. The UI shows counts, ranges, populated header fields, geometry gaps, and any record that the target cannot carry.

## Scope

### SEG-Y

- Detect from the binary header, not the extension: revision bytes 3501–3502, data-sample-format code 3225–3226, and the revision-2 byte-order constant at 3297–3300.
- Read big-endian and little-endian files. Reject the byte-swapped `0x02010403` ordering and any file whose header and trace scan disagree.
- Read the 3200-byte textual header as ASCII or EBCDIC. Preserve its bytes on write.
- Read 400-byte binary header fields: sample interval, original interval, samples per trace, original samples, format code, ensemble fold, sorting code, measurement system, revision, fixed-length flag, extended textual header count, maximum additional trace headers, and revision-2 trace count / first-trace offset / trailer count when present.
- Read 3200-byte extended textual headers when the count is non-negative. A count of `-1` (variable, terminated by `((SEG: EndText))`) is rejected with an explicit message.
- Scan every trace: 240-byte standard header, zero or more 240-byte extension headers, and `samples × bytesPerSample` data bytes. A partial final trace is an error, not a silent truncation.
- Support sample format codes 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, and 16 for sizing. The samples are never decoded, so every code is carried; code 4 is reported as obsolete.
- Summary for both 2D and 3D: revision, byte order, format code, sample interval, samples per trace, trace count, fixed/variable length, extended header count, inline/crossline ranges, CDP range, field-record range, coordinate bounds with the applied scalar, and distinct trace lengths.
- 3D geometry: distinct inline and crossline counts, expected trace count, missing-bin count, and whether inline-major order already holds. A non-regular cube is reported, never re-gridded.
- 2D geometry: distinct field-record and inline identifiers, shot and CDP ranges, and coordinate availability. Nothing is sorted by shot or CDP.
- Write SEG-Y revision 2.0 in the source byte order. Copy textual and trace header bytes. Copy sample bytes verbatim. Normalize the binary header fields listed in decision 3. Write zero extended textual headers and carry any trailer stanzas through unchanged.
- 256 MB in-memory cap. A larger file is rejected before parsing with its size in the message.

### Navigation

- **P1/90**: 80-column records. Header records `H` + two-digit type + one-digit sub-index (for example `H0100`). Point records `S`, `G`, `Q`, `A` with the P1/84-derived layout (line 2–17, point 18–25, latitude 26–35, longitude 36–46, easting 47–55, northing 56–64, water depth 65–70, day 71–73, time 74–79). Receiver records `R` carry three receiver groups per record.
- **P1/11**: comma-separated records. `OGP` identification, `HC` common headers, `H1` P1 headers, `P1`/`S1` position records, `R1` receiver records, `X1` receiver-group definitions, `A1`/`N1` auxiliary records.
- **P6/11**: comma-separated records. `OGP`, `HC`, `H6` bin-grid headers, `B6` bin-node positions, `M6` survey-perimeter positions.
- Read and summarise all three. Export a CSV of the geometry (nav points, position records, or bin nodes).
- Convert **P1/90 → P1/11** position records and **P1/11 → P1/90** position records. Header records are rebuilt only where the target requires them; every dropped source record is counted and named in a warning. No receiver or bin record is carried by this conversion.
- P1/90 → P1/11 resolves a CRS to EPSG when the source declares UTM with a zone; otherwise it declares WGS 84 geographic and warns that the source declared no resolvable projected CRS. If the source carries only grid coordinates and no CRS, the conversion is blocked with a readable explanation; CSV remains available.
- Coordinate values are never reprojected or rescaled. P1/11 coordinates are carried as written.

### Out of scope

ZGY/OpenVDS, SEG-D, SEG-Y ASCII, Seismic Unix, RESQML, amplitude rendering, trace editing, resampling, interpolation, arbitrary-line extraction, reprojection, and vendor project stores.

## Engine shape

`src/seismic.js` exports:

- `MAX_SEISMIC_BYTES`, `SEISMIC_SOURCE_LABELS`, `SEGY_TARGET_LABELS`, `NAV_TARGET_LABELS`
- `detectSeismicFormat(bytes, fileName)`
- `loadSeismicFile(bytes, fileName)` → a model with `kind: 'segy' | 'navigation'`
- `summarizeSeismic(model)`
- `writeSegy(model, { reorder })` → `{ bytes, fileName, mime, warnings }`
- `writeNavigation(model, target)` → `{ text, fileName, mime, warnings }`

The SEG-Y model keeps the raw textual and binary headers, typed arrays of per-trace offsets, lengths, sample counts, intervals, inlines, and crosslines, and the parse summary. It never keeps decoded amplitudes.

`src/Seismic.jsx` renders the three tabs. The Navigation tab uses nav sources and nav/CSV targets; the 2D and 3D tabs use SEG-Y and the normalized SEG-Y target. Both reuse the existing workspace, panel, stats, preview, error, and download classes from the other converters.

## Error handling

- Every parse error is a readable sentence naming the field or byte range that failed.
- A failed load clears the previous result and never leaves a half-built model behind.
- Warnings are separate from errors: a warning describes something carried, dropped, or assumed; an error stops the conversion.
- No message claims that a file was uploaded, sent, or stored.

## Verification

- Node harnesses in `C:\tmp` build synthetic SEG-Y revisions 0, 1, and 2.0 (ASCII and EBCDIC textual headers, big- and little-endian, fixed and variable length, several sample formats) and P1/90, P1/11, and P6/11 fixtures, then assert parse, summary, write, and round-trip facts.
- A CDP browser harness loads each fixture through the real file input, checks the three tabs, downloads each target, checks the light and dark canvas-free layout, checks 390 px and 1440 px widths, checks the Docs anchors, and checks the landing card.
- `npm run build` must pass.
