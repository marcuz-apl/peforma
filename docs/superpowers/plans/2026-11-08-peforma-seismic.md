# Peforma Seismic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Peforma Seismic with Navigation, 2D Lines, and 3D Cube tabs over a pure-JavaScript SEG-Y and IOGP navigation engine.

**Architecture:** One engine module parses SEG-Y as a byte-preserving trace table and parses P1/90, P1/11, and P6/11 into a common navigation model. One view module switches panels by tab. Routing, docs, landing, and format notes follow the existing 3D pattern.

**Tech Stack:** React 19, JavaScript, Vite, Canvas-free summary UI, Node 24 verification harnesses outside the repository.

**Spec:** `docs/superpowers/specs/2026-11-08-peforma-seismic-design.md`

## Global Constraints

- Browser-local processing only; no upload, telemetry, worker, WASM, or server call.
- Never decode, rescale, resample, or interpolate seismic samples.
- Never reproject navigation coordinates.
- A sample count of zero is a structural error, not a zero-length trace.
- Read cap is 256 MB (`256 * 1024 * 1024` bytes).
- Do not add or run repository tests; verification harnesses live in `C:\tmp`.
- Do not type a version prefix in commit messages.

---

### Task 1: SEG-Y detection and parse

**Files:**
- Create: `src/seismic.js`

**Interfaces:**
- Produces: `detectSeismicFormat(bytes, fileName)`, `loadSeismicFile(bytes, fileName)`, `summarizeSeismic(model)`, `MAX_SEISMIC_BYTES`, `SEISMIC_SOURCE_LABELS`, `SEGY_TARGET_LABELS`, `NAV_TARGET_LABELS`.

- [x] **Step 1: Write the constants and sample-format table**

```js
export const MAX_SEISMIC_BYTES = 256 * 1024 * 1024;
const SAMPLE_FORMATS = {
  1: [4, '4-byte IBM float'], 2: [4, '4-byte signed integer'], 3: [2, '2-byte signed integer'],
  4: [4, '4-byte fixed point with gain (obsolete)'], 5: [4, '4-byte IEEE float'],
  6: [8, '8-byte IEEE float'], 7: [3, '3-byte signed integer'], 8: [1, '1-byte signed integer'],
  9: [8, '8-byte signed integer'], 10: [4, '4-byte unsigned integer'],
  11: [2, '2-byte unsigned integer'], 12: [8, '8-byte unsigned integer'],
  15: [3, '3-byte unsigned integer'], 16: [1, '1-byte unsigned integer'],
};
```

- [x] **Step 2: Implement endianness and byte-order detection**

Read the revision-2 constant at byte offsets 3296–3299 as both `uint32` values. `0x01020304` means big-endian, `0x04030201` means little-endian, `0x02010403` is rejected. Fall back to the data-sample-format code at 3224–3225 and the revision bytes at 3500–3501.

- [x] **Step 3: Decode the textual header**

Try UTF-8 first. If fewer than 90% of decoded characters are printable, decode with the embedded EBCDIC cp037 map. Split into 40 lines of 80 characters and trim trailing blanks.

- [x] **Step 4: Read the binary header**

Return `sampleInterval`, `originalSampleInterval`, `samplesPerTrace`, `originalSamplesPerTrace`, `formatCode`, `ensembleFold`, `sortingCode`, `measurementSystem`, `revisionMajor`, `revisionMinor`, `fixedLength`, `extendedCount`, `maxAdditionalHeaders`, plus the revision-2 trace count, first-trace offset, and trailer count when non-zero.

- [x] **Step 5: Scan traces**

Start at `3600 + extendedCount * 3200`, rejecting a negative extended count, or at the revision-2 first-trace offset when it is plausible. For each trace read the 240-byte header, byte 157–158 extension count, byte 115–116 sample count, and byte 117–118 interval. Use the binary-header values when a trace field is zero. Compute `240 + extra * 240 + samples * bytesPerSample`. Reject a partial final trace and a zero sample count.

- [x] **Step 6: Summarize**

Compute counts, ranges, distinct trace lengths, coordinate bounds with the byte-71 scalar, distinct inline/crossline identities, missing bin count, and fixed/variable length. Report a warning for every value taken from the binary header because the trace header carried zero.

### Task 2: SEG-Y write

- [x] **Step 1: Copy and normalize**

Copy the textual header and 400-byte binary header into the output. Set revision major 2 / minor 0, the fixed-length flag, sample count, sample interval, zero extended-header count, maximum additional headers, endian marker, trace count, first-trace offset, and trailer count. Zero the revision-2 extended overrides so they cannot contradict the normalized fields.

- [x] **Step 2: Copy traces**

For each trace copy the standard header, the extension headers, and the sample bytes verbatim. Trace headers are never patched, so their bytes stay identical to the source.

- [x] **Step 3: Reorder when asked**

If `reorder === 'inline-major'`, sort trace indices by inline, then crossline, then source index. Warn and keep the source order when every inline is zero or the file has no crossline variation.

- [x] **Step 4: Name and return**

Return `{ bytes, fileName: base + '.segy', mime: 'application/octet-stream', warnings }`.

### Task 3: Navigation parse

- [x] **Step 1: P1/90**

Split on CR/LF. Accept `H` header records with a two-digit type and one-digit sub-index, `S`/`G`/`Q`/`A` point records with the P1/84 column layout, `R` receiver records with three groups per line, `C` comments, and `EOF`. Parse latitude, longitude, easting, northing, water depth, day, and time; keep blank fields `null`, never zero.

- [x] **Step 2: P1/11 and P6/11**

Split each non-empty line on commas. Keep the identifier fields and the payload fields in order. Map `P1`/`S1` records to nav points, `R1` to receivers, `B6` to bin nodes, `M6` to perimeter positions, and every `H`/`HC`/`OGP` record to the header list. Never coerce a text field to a number.

- [x] **Step 3: Detect from contents**

A file whose first record is `OGP,...` uses the `OGP` format code (1 = P1/11, 6 = P6/11). Otherwise a first record of `H` + two digits is P1/90, and a first record of `HC,` or `P1,` is P1/11.

- [x] **Step 4: Summarize**

Report record counts by type, line names, point ranges, coordinate bounds, CRS/projection headers, dropped-record counts, and every record identifier that was not recognised.

### Task 4: Navigation write

- [x] **Step 1: CSV**

Write a header row and one row per point, position record, or bin node. Preserve blank fields as empty cells.

- [x] **Step 2: P1/90 → P1/11**

Write the `OGP` identification record, `HC,0,1,0` through `HC,0,7,0`, the reference-system summary, unit records, WGS 84 geographic 2D (EPSG 4326) implicit and explicit CRS records, datum, ellipsoid, coordinate system and axis records, and `H1,1,0,0`. Write one `P1` record per point with line, point, time, CRS A, and CRS B coordinates. A P1/11 source keeps its CRS A and B verbatim; a P1/90 source writes its decimal latitude and longitude to both. Warn for every receiver, grid value, and unknown record not carried, and state that no coordinate is reprojected.

- [x] **Step 3: P1/11 → P1/90**

Write 80-column `H01`–`H20` plus `H26` with the values the source declares and `N/A` elsewhere, one S/G/Q/A record per position with the source record type, and `EOF`. Warn that the source had no water depth, day, or time when those columns are blank.

- [x] **Step 4: Block unresolvable conversions**

A P1/11 source with no latitude/longitude pair cannot become a P1/90 record without inventing a CRS; throw an error naming the missing values and point the user at CSV.

### Task 5: The three-tab view

- [x] **Step 1: Shared panels**

Reuse the Source panel, loaded-file block, stats, preview blocks, warning rows, output selector, and download button classes from `Mesh3D.jsx`. The SEG-Y tabs accept `.segy,.sgy`; the navigation tab accepts `.p190,.p111,.p611,.nav,.txt,.csv`. A file of the wrong kind is rejected with a direction to the right tab.

- [x] **Step 2: Navigation tab**

Show source format, record counts, line names, point ranges, and CRS headers. Offer CSV, P1/11, and P1/90 targets with the one-line target hint from the spec.

- [x] **Step 3: 2D Lines tab**

Show revision, byte order, format, interval, samples, trace count, field-record and CDP ranges, coordinate availability, and distinct trace lengths. Offer normalized SEG-Y.

- [x] **Step 4: 3D Cube tab**

Show inline and crossline ranges, distinct counts, expected versus present traces, missing bins, and current order. Offer normalized SEG-Y with a trace-order selector (source order or inline-major).

- [x] **Step 5: Keyboard and screen-reader behavior**

Every input is labelled, the drop zone opens the picker on Enter, the tab bar uses `aria-current`, and cross-tab and role notes are announced with `role="status"`.

### Task 6: Routes, shell, docs, landing

- [x] **Step 1: Routes and rail**

Add the three routes before the 3D routes, the nested `document.title` entries, the tab bar with `seismic-tabs`, and the Seismic suite children in `SUITES`. Remove the placeholder entry.

- [x] **Step 2: Docs**

Add a `seismic-formats` TOC group and sections for SEG-Y, P1/90, P1/11, P6/11, and integrity. Update the overview's live-tool count.

- [x] **Step 3: Landing**

Move Seismic from the roadmap to the live suites, add the card, and update the live-tool statistic.

- [x] **Step 4: Living documents**

Update `README.md`, `docs/PRD_SEISMIC.md`, `docs/PRD_CULTURE.md`, and `docs/FORMATS.md` to describe only what ships.

### Task 7: Verification and release

- [x] **Step 1: Engine harnesses**

Run the SEG-Y and navigation harnesses in `C:\tmp` and confirm every assertion.

- [x] **Step 2: Browser harness**

Run the CDP harness against `npm run dev`: three tabs, six fixture loads, every download, light/dark layout, 390 px and 1440 px, Docs anchors, and landing card.

- [x] **Step 3: Build**

Run `npm run build`; confirm a clean build.

- [x] **Step 4: Commit and push**

Stage only source and documentation files, commit with a plain `feat:` subject, let the hooks stamp the version, and push.
