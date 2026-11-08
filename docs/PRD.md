# Peforma Horizon/Grid — Product Requirements

Peforma is the broader product family for oil-sector data exchange. Peforma Horizon/Grid is its first tool; future capabilities may cover wells, seismic, contours, and other data types. Keep this PRD scoped to grid conversion.

Point, line, and polygon exchange is specified in [Peforma Culture](PRD_CULTURE.md); its Lines/Points and Polygon converters are implemented. Esri Shapefile and GeoJSON feature exchange is implemented in its own product, specified in [Peforma Shapefile](PRD_SHAPEFILE.md). 2D and 3D seismic exchange is specified in [Peforma Seismic](PRD_SEISMIC.md), and 3D mesh and geobody exchange in [Peforma 3D](PRD_3D.md). Seismic and 3D remain planned capabilities and do not affect the grid scope below.

The app ships an in-app Docs page (`#docs`, linked from the header beside the theme toggle) that documents every live tool in detail: grid header records, node storage order, null conventions, line and point geometry rules, and exact unit factors. It is written and updated alongside each feature so the format knowledge gathered during implementation stays available to users, and it replaces the former per-tool header help link. The privacy and data-integrity guarantees are presented in a Privacy & integrity dialog opened from the footer's Privacy link, to the right of Disclaimer.

The bare root (`/`, also `#home`) presents a Peforma family landing page — Hero, Services, and Contact — that links into the live tools at `#grid` (grid), `#culture` (vector lines and points), `#culture-polygon` (closed polygon rings), `#shapefile` (Esri Shapefile and GeoJSON features), `#units`, and `#docs`; the converters themselves are unchanged and still process files locally in the browser. Contact pairs a validated message form, which hands a prefilled message to the visitor's mail client and never posts to a server, with an interactive map locked to Calgary whose zoom always re-centres on the city; the form and map share equal width. The landing header mirrors the toolbox chrome: section links and a Docs chip sit right-aligned beside the theme toggle, and the toolbox entry point lives in the hero and closing calls-to-action rather than the header.

## Problem
Geoscientists exchange depth and time grids — 2D map surfaces such as horizons — between interpretation applications. Petrel can export EarthVision ASCII grids, while receiving tools such as Kingdom may not import that format directly. Manual reformatting is error-prone and risks changing geometry or values.

## Goal
Provide a small, easy-to-use browser application that converts supported EarthVision ASCII depth or time grids into interoperable ASCII grid formats.

## Users
Oil and gas geoscientists who need to move regularly sampled surfaces — horizons in depth or time — between interpretation applications.

## MVP
- Accept an EarthVision ASCII grid selected by file picker or drag and drop.
- Parse and validate grid dimensions, coordinate bounds, increments, values, and nulls.
- Show a concise grid summary and a lightweight value preview.
- Export ZMAP+ ASCII and IRAP Classic ASCII.
- Download the converted grid with an appropriate extension.
- Process files locally in the browser, without upload or telemetry.
- Show actionable errors for unsupported or malformed input.

## Requirements
- Preserve node count, bounds, axis orientation, row/column ordering, and values.
- Require explicit handling of missing values; do not silently convert a real value to null.
- Reject unsupported EarthVision variants rather than producing a plausible but incorrect grid.
- Explain that output compatibility should be confirmed in the target application, especially for coordinate units, datum, null conventions, and axis direction.

## Out of scope for MVP
- Petrel binary input, irregular grids, reprojection, interpolation, datum conversion, batch conversion, server-side storage, and direct Kingdom integration.

## Acceptance criteria
- A user can choose a supported input and output format, inspect grid metadata, and download an ASCII output.
- Invalid files receive a readable error without crashing the page.
- The interface works on desktop and narrow screens and is keyboard accessible.
- Conversion is performed entirely in the browser.
