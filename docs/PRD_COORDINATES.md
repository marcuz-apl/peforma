# Peforma Coordinates — Coordinate Notation Conversion

Status: shipped Tier 1. This chapter describes what the tool does today.

Peforma Coordinates rewrites latitude and longitude between written notations — decimal degrees, degrees minutes seconds (DMS), and degrees decimal minutes (DDM) — without changing the position a value names. It is a reference tool in the Peforma family, alongside Peforma Units.

## Problem

The same position arrives written many ways: `51.5074`, `51°30′26.4″N`, `51 30 26.4 N`, `513026.4N`, `51°30.44′N`. Spreadsheet columns mix these forms freely, and a receiving application usually accepts only one. Hand conversion is slow and error-prone; a wrong hemisphere or a minutes value of 60 silently moves a position.

## Contract

- Only the written form changes. No reprojection, no datum assumption, no datum transformation, no unit conversion.
- Every source column is copied verbatim; the converted pair is appended, never written over the source.
- Row order is preserved. A value that cannot be read unambiguously is reported with its line number and written as a blank cell, never guessed.
- All parsing and writing run in the browser.

## Shipped scope

- Read delimited text (CSV, TSV, semicolon, whitespace) from a file or pasted rows, up to 8 MB and 100,000 rows.
- A non-numeric first row is a header and pre-seeds the latitude/longitude mapping from labels (lat, latitude, y, lon, long, longitude, x). Without a header the user assigns both columns explicitly.
- Accepted notations per cell: signed decimal degrees; DMS with degree/minute/second marks, colons, or spaces; DDM; packed DDMMSS.s / DDDMMSS.s and packed DDMM.m / DDDMM.m with a hemisphere letter. A hemisphere letter may lead or trail.
- Validation: N/S only on latitude, E/W only on longitude; a minus sign and a disagreeing letter is an error; minutes and seconds must be below 60; latitude within ±90, longitude within ±180.
- Write CSV in decimal degrees (0–10 fractional digits), DMS (0–4 second decimals), or DDM (0–6 minute decimals). Rounding carries through seconds into minutes and degrees.
- Summary: row counts, notation mix, packed and hemisphere counts, latitude/longitude ranges, and every unreadable row with its reason and line number.
- A live converted preview shows the first rows in the chosen notation before download.

## Out of scope

- Reprojection, datum shifts, and geodetic transformation. A notation is not a reference frame; the tool cannot tell which datum a value belongs to.
- UTM and other projected grid coordinates. Converting those to geographic coordinates requires a projection and a datum, which this tool does not assume.
- Geometry files (GeoJSON, shapefile, GOCAD). Those belong to Peforma Culture and Peforma Shapefile.
- Navigation records (P1/90, P1/11, P6/11). Those belong to Peforma Seismic.

## Acceptance criteria

- A user can load or paste a table, confirm the column mapping, see the notation mix and ranges, and download a CSV whose source columns are unchanged and whose appended pair names the same positions.
- Unreadable rows are listed with line numbers and written with blank converted cells and a note.
- No value is reprojected, rescaled, or silently repaired.
- Invalid input produces a readable error without crashing the page.
- The interface is keyboard accessible with labelled controls and announced results, on desktop and narrow screens, in light and dark themes.