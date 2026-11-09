# Peforma — Product Requirements

Peforma is a browser-based family of tools for exchanging oil and gas subsurface data. It helps geoscientists move data between interpretation, modeling, GIS, and archival workflows without silently changing the source geometry, values, ordering, or metadata.

## Product principles

- Process files locally in the browser; do not upload source data or collect telemetry.
- Preserve supported data exactly, apart from conventions a target format requires and reports.
- Make ambiguity visible: require explicit mappings, reject unsupported dialects, and never guess missing metadata.
- Report format assumptions, applied conventions, and information a target cannot carry.
- Keep every tool usable with a keyboard and screen reader on desktop and narrow screens.

## Tool requirements

The root document defines the shared product direction. Each detailed PRD below owns its tool’s scope, format rules, limitations, and acceptance criteria.

| Tool | Purpose | Detailed requirements |
| --- | --- | --- |
| Peforma Horizon/Grid | Regularly sampled depth-or-time surfaces | [PRD_GRID.md](docs/PRD_GRID.md) |
| Peforma Culture | Vector points, lines, fault sticks, and polygon rings | [PRD_CULTURE.md](docs/PRD_CULTURE.md) |
| Peforma Shapefile | Esri Shapefile bundles and GeoJSON features | [PRD_SHAPEFILE.md](docs/PRD_SHAPEFILE.md) |
| Peforma 3D | Triangulated surfaces and closed geobodies | [PRD_3D.md](docs/PRD_3D.md) |
| Peforma Seismic | Navigation, 2D lines, and 3D seismic cubes | [PRD_SEISMIC.md](docs/PRD_SEISMIC.md) |
| Peforma Coordinates | Latitude/longitude notation conversion | [PRD_COORDINATES.md](docs/PRD_COORDINATES.md) |
| Peforma Units | Engineering unit conversion | [UNIT_REFERENCE.md](docs/UNIT_REFERENCE.md) |

## Supporting documentation

- [FORMAT_REFERENCE.md](docs/FORMAT_REFERENCE.md) records supported formats and parser/export assumptions.
- [GRID_FORMAT_STUDY.md](docs/GRID_FORMAT_STUDY.md) records the historical grid-format investigation.
- The in-app Docs page (`#docs`) provides the user-facing format reference and is updated with supported behavior.
- Design and implementation records remain in `docs/DESIGN_*.md` and `docs/PLAN_*.md`.

Update the relevant detailed PRD and supporting documentation whenever supported formats or behavior change.
