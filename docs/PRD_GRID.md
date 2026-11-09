# Peforma Horizon/Grid — Product Requirements

This chapter is part of the [Peforma product requirements](../PRD.md) and is scoped to grid conversion.

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
