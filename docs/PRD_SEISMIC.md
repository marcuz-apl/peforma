# Peforma Seismic — 2D Lines and 3D Cube Data Exchange

Status: shipped Tier 1. Peforma Seismic is live at `#seismic-navigation`, `#seismic-2d`, and `#seismic-3d`. This chapter records the product decisions and the format scope that shipped; formats listed as later tiers are not supported.

Peforma Seismic is the suite member for 2D seismic lines, 3D seismic cubes, and their navigation sidecars. Peforma Horizon/Grid handles regularly sampled surfaces; Peforma Seismic handles the seismic traces, trace headers, and survey geometry that arrive with them. Navigation files (UKOOA P1/90, OGP P1/11, OGP P6/11) are read by the Navigation tab of this tool; they are positions and bin grids, not trace data.

## Problem

Seismic data is the largest and most format-sensitive object in subsurface exchange. A single 3D survey can exceed a hundred gigabytes, and the same cube may carry different trace headers, sampling intervals, byte order, endianness, unit scale, and coordinate scalar conventions depending on which processor produced it. Interpretation applications rarely agree on what "the same cube" means: Petrel, OpenWorks, Kingdom, and GOCAD-based tools all read SEG-Y, but each applies its own defaults for missing headers, sample numbering, and datum.

When a geoscientist moves a cube between applications, one of three things happens. The receiving tool assumes defaults that disagree with the source and misplaces traces. The user resamples, reorders, or re-scales the data to satisfy the receiver, and the values are no longer what the processor produced. Or the data stays locked in a vendor project store, and the exchange tool becomes the only way out.

2D data has the same problem in miniature. A set of 2D SEG-Y files may carry coordinates in header fields, in sidecar navigation files, or not at all, and the conventions for where the line starts, how samples are numbered, and what the vertical unit is vary by vendor.

## Goal

Provide a small browser tool that reads supported seismic exchange formats, shows exactly what was found in the trace headers and survey geometry, and writes a target format without altering sample values, sample count, trace order, or header metadata.

The tool must be honest about size. A 500-gigabyte cube will not load in a browser. Tier 1 reads files up to 256 MB in full and rejects a larger file with its size stated; it never truncates a file or reports a partial result as complete.

## Users

Oil and gas geoscientists and geophysicists who need to move 2D lines or 3D cubes between interpretation systems, open data pipelines, or archiving systems. They know the data and its metadata, and they do not want a converter to invent a missing header field.

## Scope

### In scope for the shipped tier

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

### Out of scope

- OpenZGY and vendor ZGY cubes, SEG-D, Seismic Unix, and SEG-Y ASCII. These need a container implementation or a sample-decoding path that Tier 1 does not ship.
- Embedded P1/11 or P6/11 blocks inside SEG-Y extended textual headers; a standalone navigation file is required.
- Vendor project databases and binary project stores for Petrel, OpenWorks, Kingdom, Petra, RMS, SKUA, JewelSuite, and GeoGraphix.
- Seismic processing. No filters, deconvolution, migration, amplitude scaling, gain adjustment, phase rotation, or interpolation.
- Arbitrary line extraction from a 3D cube. That is a processing operation; only the cube itself and its regular grid geometry are in scope.
- Point clouds, well logs, and reservoir property cubes.
- Reprojection of survey geometry. Datum, geoid, and CRS are carried as metadata, never transformed.
- Batch conversion of multiple files in one operation.

## Seismic data model

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

## Format landscape

Seismic exchange travels through a smaller set of formats than line and point data, but each format carries more metadata.

### Open standards and documented formats

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

### Vendor ecosystems

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

## Shipped support tiers

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

## Size model

A seismic cube does not fit in a browser tab the way a grid or a point file does.

- Files up to 256 MB are read fully into memory. A larger file is rejected with its size stated and is never truncated.
- The summary is computed over every trace, not a sample of traces, because the trace loop is cheap once the bytes are in memory.
- Export writes one contiguous output buffer. The UI reports the file size, the sample-memory estimate, and the read cap before conversion.
- A file that cannot be read is rejected with the reason. A partial result is never presented as a complete conversion.

## User experience outline

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

## Validation and errors

- Reject a file whose binary header does not contain a defined sample-format code and revision rather than guessing.
- Reject byte-swapped 16-bit ordering and a contradictory byte-order constant.
- Reject a partial trace, a sample count of zero with no binary-header fallback, and a first-trace offset beyond the file.
- Read non-monotonic inline or crossline order as written and report that the file is not inline-major; source byte order is preserved.
- Reject a negative extended textual header count, which signals a variable-length extended-header block the reader does not locate.
- Report extended textual headers, trailer stanzas, and trailing bytes with the values involved.
- Carry every defined sample-format code, including obsolete fixed point with gain, and say that the bytes are not decoded.
- Never crash the page on malformed input; keep the previous result intact.

## Interoperability cautions

- Header meaning changes across revisions. A field that is a source coordinate in rev 1 may be reserved in rev 0. The detected revision is part of every report.
- Byte order and sample encoding are properties of the file, not of the application. No implicit swap or conversion is allowed.
- Inline and crossline numbers are identifiers, not coordinates. A cube with missing corner coordinates is not re-projected; it is flagged.
- P6/11 bin grids describe a regular grid and never become position records. A bin grid is exported as a table with its own coordinate pairs.
- 2D line files may or may not carry coordinates. When they do not, the tool must say so, not fill in a default.
- Time and depth units are not interchangeable. A cube in time is not silently treated as a cube in depth.
- Output compatibility must be confirmed in the target application, including revision, byte order, sample encoding, trace layout, and header assumptions.

## Acceptance criteria

- A user can load a supported SEG-Y file, see the detected revision and the populated header facts, and download a rev 2.0 file whose trace headers and sample bytes are identical to the source.
- A 3D cube can be re-sorted into inline-major order with each trace moved as a whole and the change reported.
- Navigation files can be read and written as P1/90, P1/11, or CSV, with blank source fields preserved as blank.
- A P1/90 file written by Peforma is exactly 80 columns per record.
- A SEG-Y dropped on the Navigation tab, or a navigation file dropped on a SEG-Y tab, produces a readable cross-tab message.
- Invalid or unsupported files produce a readable error without crashing the page, and the previous result remains available.
- The interface works on desktop and narrow screens and is keyboard accessible, with labelled controls, visible focus, and announced results.
- All parsing, preview, and export run in the browser, with no network request carrying source data.
- The format assumptions and limitations are documented before a format is marked as supported.

## Open questions

- Which OpenZGY producer version should anchor Tier 2? The public OpenZGY layout and Petrel ZGY files may differ in field placement.
- Should Tier 2 add SEG-Y rev 2.1 writing for the revised extended-textual-header fields, or keep rev 2.0 as the normalised target?
- Should embedded P1/11 and P6/11 blocks in SEG-Y extended textual headers be extracted automatically in Tier 2, or remain a separate sidecar workflow?
- How should a 3D cube with a missing bin be surfaced when the target application will not accept a gapped grid: warn and continue, or block the export?

## Sources

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
