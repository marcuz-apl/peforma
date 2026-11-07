# Peforma Seismic — 2D Lines and 3D Cube Data Exchange

Status: planned. This chapter defines the product and the intended format scope. No seismic converter is implemented yet, and nothing here should be read as a claim of current support.

Peforma Seismic is the suite member for 2D seismic lines and 3D seismic cubes. Peforma Grid handles regularly sampled surfaces; Peforma Seismic handles the seismic traces, trace headers, and survey geometry that arrive with them. Polyline and point navigation belong to the separate Peforma Lines tool; this chapter covers the data itself.

## Problem

Seismic data is the largest and most format-sensitive object in subsurface exchange. A single 3D survey can exceed a hundred gigabytes, and the same cube may carry different trace headers, sampling intervals, byte order, endianness, unit scale, and coordinate scalar conventions depending on which processor produced it. Interpretation applications rarely agree on what "the same cube" means: Petrel, OpenWorks, Kingdom, and GOCAD-based tools all read SEG-Y, but each applies its own defaults for missing headers, sample numbering, and datum.

When a geoscientist moves a cube between applications, one of three things happens. The receiving tool assumes defaults that disagree with the source and misplaces traces. The user resamples, reorders, or re-scales the data to satisfy the receiver, and the values are no longer what the processor produced. Or the data stays locked in a vendor project store, and the exchange tool becomes the only way out.

2D data has the same problem in miniature. A set of 2D SEG-Y files may carry coordinates in header fields, in sidecar navigation files, or not at all, and the conventions for where the line starts, how samples are numbered, and what the vertical unit is vary by vendor.

## Goal

Provide a small browser tool that reads and writes supported 2D and 3D seismic exchange formats, shows exactly what was found in the trace headers and survey geometry, and writes a target format without altering sample values, sample count, trace order, or header metadata.

The tool must be honest about size. A 500-gigabyte cube will not load in a browser. For large data the tool must work from a streaming or file-backed representation, expose a small preview, and refuse to fake in-memory completion.

## Users

Oil and gas geoscientists and geophysicists who need to move 2D lines or 3D cubes between interpretation systems, open data pipelines, or archiving systems. They know the data and its metadata, and they do not want a converter to invent a missing header field.

## Scope

### In scope for the first release

- Read SEG-Y revisions 0, 1, and 2.1 for both 2D lines and 3D cubes, including the 240-byte trace header and extended textual headers.
- Read OpenZGY and Schlumberger ZGY cubes, using a publicly available implementation of the container layout.
- Write SEG-Y 2.1 for 2D and 3D with trace order and header metadata preserved.
- Write OpenZGY cubes where the source data and geometry support the layout.
- Show file-level facts: record count, sample count, sample interval, sample format, byte order, header revision, inline/crossline ranges, and the header fields actually present.
- Extract and display navigation embedded in trace headers (source, receiver, CDP, and inline/crossline identifiers) as a lightweight geometry summary.
- Read IOGP P6/11 bin-grid metadata when it is embedded in an extended textual header.
- Process small files fully in the browser. For large files, use a file-backed streaming path with a hard preview limit and an explicit size warning.
- Preserve sample values, sample ordering, trace ordering, header bytes, and the vertical reference when present.
- No telemetry and no upload.

### Out of scope

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

A 2D line is a flat sequence of traces. A 3D cube is a 3D array of traces indexed by inline, crossline, and sample, and the export layout must match the source layout. The tool never reorders traces to "fix" gaps; gaps are reported as such.

## Format landscape

Seismic exchange travels through a smaller set of formats than line and point data, but each format carries more metadata.

### Open standards and documented formats

| Format | Steward or origin | Carries | Reading | Writing | Notes |
| --- | --- | --- | --- | --- | --- |
| SEG-Y rev 0 | SEG, 1975 | 2D and 3D traces with 240-byte headers | Yes | Yes | Original format; many legacy files; header meaning is fixed but sparse |
| SEG-Y rev 1 | SEG | Repeats extended textual headers, clarifies trace header | Yes | Yes | Common in mid-2000s workflows |
| SEG-Y rev 2.0 | SEG, 2017 | OGP P6/11 bin-grid reference, clarified headers | Yes | Yes | Introduces P6/11 embedding |
| SEG-Y rev 2.1 | SEG, October 2023 | Extended textual header clarification, P-format embedding | Yes | Yes | Current preferred format for new exchange; most modern tools target it |
| SEG-D rev 3.x | SEG | Field acquisition data | No | No | Acquisition format, not interpretation exchange |
| OpenZGY / ZGY | Schlumberger Petrel lineage; maintained publicly | 3D cube with compressed trace layout and header model | Yes | Yes | OpenZGY is the public implementation; Petrel ZGY files are the common production case |
| IOGP P6/11 | IOGP Geomatics Committee, v2.0 | 3D bin-grid geometry and survey metadata | Yes | Later | Often embedded in SEG-Y extended textual headers; also a standalone reporting format |
| IOGP P1/11 | IOGP Geomatics Committee, v2.0 | Marine positioning and navigation | Later | Later | Navigation sidecar; covered by Peforma Lines, not by this tool |
| Seismic Unix (SU) | CWP/Seismic Unix | 240-byte header plus trace data in a binary container | Later | Later | Common in open processing chains; header mapping to SEG-Y is documented |
| SEG-Y ASCII | Informal | 2D traces as whitespace-delimited samples with a text header | Yes | Yes | Produced by SEG-Y to ASCII conversion tools and often seen in teaching data |
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

Two conclusions follow. First, for 2D and 3D seismic the public exchange surface is SEG-Y (all revisions in use) plus OpenZGY for 3D, with IOGP P1/11 and P6/11 as documented sidecars. Second, interpolation, resampling, arbitrary-line extraction, and processing are consistently outside the documented public surface of every tool surveyed.

## Proposed support tiers

The tiers separate what can be built with confidence from what needs a representative file set and a stable container implementation.

| Tier | Formats | Direction | Rationale |
| --- | --- | --- | --- |
| 1 — first release | SEG-Y rev 0, 1, 2.0, and 2.1 | Import and export | Covers the documented trace header and extended textual header; revisions are well specified |
| 1 — first release | OpenZGY 3D cubes | Import and export | Public container with a stable layout; widely used for 3D distribution |
| 1 — first release | 2D SEG-Y ASCII | Import and export | Small, common, and straightforward; useful for teaching and inspection |
| 2 — after validation | IOGP P6/11 embedded or standalone | Import | Required for complete survey geometry; a stable reader exists in the standard |
| 2 — after validation | IOGP P1/11 sidecar | Import | Navigation sidecar; useful context, not seismic data |
| 2 — after validation | Seismic Unix container | Import and export | Open processing chain; header mapping is documented |
| 3 — out of scope | Vendor project stores and binary project files | None | No public, stable, safe contract |
| 3 — out of scope | Processing, interpolation, arbitrary lines | None | Different problem domain |

A format moves from tier 2 to tier 1 only after the parser has been checked against representative files from more than one producer and the assumptions are written down.

## Size and streaming model

A seismic cube does not fit in a browser tab the way a grid or a point file does. The design separates a small in-browser summary from the large data body.

- Small files (target: under 256 MB) are read fully into memory and previewed.
- Large files are streamed from the file system in chunks, with a hard preview limit on trace count.
- Header and geometry summaries are built from the first N traces plus the extended textual headers, not from every trace.
- Export writes trace by trace with a fixed output layout and progress reporting.
- The UI must show the file size, the estimated memory requirement, and whether a preview is partial before any conversion begins.
- A file that cannot be streamed in the target browser is rejected with the reason, not truncated.

## User experience outline

1. Drop or choose one file. Identify the format from the binary header, not only from the extension.
2. Show the detected revision, record count, sample count, sample interval, sample encoding, byte order, and the header fields that are populated.
3. For 3D, show inline and crossline ranges, the corner trace coordinates, and the P6/11 bin-grid reference when present.
4. For 2D, show line identifiers, shot and CDP ranges, and coordinate availability.
5. Let the user choose an output format and confirm the target revision, byte order, sample encoding, and trace layout.
6. Download the result with a clear file name and extension, and report any header fields that the target format cannot carry.

Warnings must be specific: which revision was detected, which header fields were empty in the source, which geometry was inferred versus copied, and what the user can do about it.

## Validation and errors

- Reject files whose binary header does not match a known revision rather than guessing.
- Reject byte-order inconsistencies between header and sample data.
- Report a sample count of zero as a structural error, not a zero-length trace.
- Reject inline/crossline values that are non-monotonic in a 3D cube when the source layout claims regularity; the user must confirm the layout before writing.
- Report extended textual header blocks that are truncated or have mismatched stanza terminators.
- Detect a sample encoding that the target format does not support and stop, not silently convert.
- For OpenZGY, validate the container layout before opening the data body and report the exact missing field.
- Bound memory use with a hard preview limit, and report which preview was built.
- Never crash the page on malformed input; keep the previous result intact.

## Interoperability cautions

- Header meaning changes across revisions. A field that is a source coordinate in rev 1 may be reserved in rev 0. The detected revision is part of every report.
- Byte order and sample encoding are properties of the file, not of the application. No implicit swap or conversion is allowed.
- Inline and crossline numbers are identifiers, not coordinates. A cube with missing corner coordinates is not re-projected; it is flagged.
- P6/11 bin grids describe a regular grid; a survey that is not regular will not fit and must be rejected.
- 2D line files may or may not carry coordinates. When they do not, the tool must say so, not fill in a default.
- Time and depth units are not interchangeable. A cube in time is not silently treated as a cube in depth.
- OpenZGY containers have a defined layout but differ across producer versions. A reader that assumes a single layout will misparse cubes from other producers; the reader must record which layout it used.
- Output compatibility must be confirmed in the target application, including revision, byte order, sample encoding, trace layout, and header assumptions.

## Acceptance criteria

- A user can load a supported SEG-Y or OpenZGY file, see the detected revision and the populated header fields, and download a supported output without changing sample values.
- A large file that cannot be previewed in full shows the size, the preview limit, and which preview was built before any write begins.
- The exported file has the same record count, sample count, trace order, header revision target, and sample encoding as confirmed by the user.
- Inline, crossline, CDP, source, and receiver identifiers are copied verbatim when present and reported as missing when absent.
- No reprojection, no resampling, no interpolation, and no amplitude scaling occur.
- Invalid or unsupported files produce a readable error without crashing the page, and the previous result remains available.
- The interface works on desktop and narrow screens and is keyboard accessible, with labelled controls, visible focus, and announced results.
- All parsing, preview, and export run in the browser, with no network request carrying source data.
- The format assumptions and limitations are documented before a format is marked as supported.

## Open questions

- Which OpenZGY producer version should anchor the first release? The public OpenZGY layout and Petrel ZGY files may differ in field placement.
- Should SEG-Y rev 2.1 writing ship in the first release, or should the first release be rev 2.0 and 2.1 reading only?
- What is the hard preview trace limit for a 4-gigabyte cube in a browser tab, and how is that communicated without a misleading "success" state?
- Is a P6/11 standalone reader part of the first release, or only the embedded P6/11 in extended textual headers?
- How should the tool behave when a 3D cube has missing corner traces: refuse, warn and continue, or fill with a declared default?

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
