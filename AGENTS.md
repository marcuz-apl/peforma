# Peforma Grid/2D-Map

## Product naming
- Product family: Peforma.
- Current tool: Peforma Grid/2D-Map.
- Use “Peforma Grid/2D-Map” in user-facing docs and app chrome. Avoid the retired “Petro Gridr” name.
- Keep future oil-sector tools under the Peforma family without implying they exist yet.

## Project guidance
- Build the application with React and JavaScript. Do not use Python.
- Keep grid uploads and conversion local in the browser; do not send source grids to a server.
- Preserve input grid geometry, values, ordering, and null values. Never silently guess unsupported EarthVision variants.
- Grids/2D maps may be depth or time surfaces (or another sampled attribute). Describe them as depth-or-time, never depth-only, and copy Z values verbatim without rescaling.
- Communicate format assumptions in the UI and documentation.
- Keep the interface usable with keyboard and screen readers.
- Do not add or run tests unless requested.

## Documentation
- `docs/PRD.md` is the product requirements document.
- `docs/FORMATS.md` records supported formats and parser/export assumptions.
- Update documentation when supported formats or behavior change.
