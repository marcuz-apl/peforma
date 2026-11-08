# Peforma Grid — Product Requirements

Peforma is the broader product family for oil-sector data exchange. Peforma Grid is its first tool; future capabilities may cover wells, seismic, contours, and other data types. Keep this PRD scoped to grid conversion.

Line and point exchange is specified in [Peforma Lines/Points](PRD_LINES_POINTS.md); its tier-1 open formats are implemented in the app. 2D and 3D seismic exchange is specified in [Peforma Seismic](PRD_SEISMIC.md), polygon and boundary exchange in [Peforma Polygons](PRD_POLYGONS.md), and 3D mesh and geobody exchange in [Peforma 3D](PRD_3D.md). Seismic, polygon, and 3D remain planned products and do not affect the grid scope below.

The app ships an in-app Docs page (`#docs`, linked from the header beside the theme toggle) that documents every live tool in detail: grid header records, node storage order, null conventions, line and point geometry rules, and exact unit factors. It is written and updated alongside each feature so the format knowledge gathered during implementation stays available to users, and it replaces the former per-tool header help link.

## Problem
Geoscientists exchange depth grids between interpretation applications. Petrel can export EarthVision ASCII grids, while receiving tools such as Kingdom may not import that format directly. Manual reformatting is error-prone and risks changing geometry or values.

## Goal
Provide a small, easy-to-use browser application that converts supported EarthVision ASCII depth grids into interoperable ASCII grid formats.

## Users
Oil and gas geoscientists who need to move regularly sampled depth surfaces between interpretation applications.

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
