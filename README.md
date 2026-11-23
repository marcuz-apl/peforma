# Peforma

<img src="public/app-icon-192.png" alt="Peforma stacked layers icon" width="64" height="64">

**A browser toolbox for oil and gas subsurface data exchange.**

Inspect and convert depth or time grids, vectors, shapefiles, meshes, and seismic data. Peforma processes source files locally in your browser.

## Quick start

Open [localhost:3050](http://localhost:3050/) after starting Peforma with either option below.

### Local development

Use Node.js 22.12 or later and npm. From the repository root, run:

```sh
npm ci
npm run dev
```

### Docker

From the repository root, run:

```sh
docker compose up --build
```

Compose maps port `3050` on your machine to Nginx on port `80` inside the container. Stop the Vite dev server first if it is using port `3050`.

## Tools and formats

The routes below are relative to the running app.

| Tool | Supported data and formats | App routes |
| --- | --- | --- |
| [Grid surfaces](docs/PRD_GRID.md) | Depth or time surfaces in CPS-3, ZMAP+, IRAP Classic, and EarthVision ASCII | `#grid` |
| [Vectors](docs/PRD_CULTURE.md) | Lines and points in delimited text, GeoJSON, and GOCAD ASCII. Closed polygon rings in GeoJSON and GOCAD ASCII | `#culture`, `#culture-polygon` |
| [Shapefiles](docs/PRD_SHAPEFILE.md) | Esri Shapefile bundles and GeoJSON, with attributes and CRS definitions preserved | `#shapefile` |
| [3D meshes](docs/PRD_3D.md) | Triangulated surfaces and geobody shells in STL, OBJ, PLY, and GOCAD TSurf | `#3d-surfaces`, `#3d-solids` |
| [Seismic](docs/PRD_SEISMIC.md) | SEG-Y lines and cubes, plus UKOOA P1/90 and IOGP P1/11 and P6/11 navigation | `#seismic-2d`, `#seismic-3d`, `#seismic-navigation` |
| [Coordinates](docs/PRD_COORDINATES.md) | Latitude and longitude in decimal degrees, degrees minutes seconds, and degrees decimal minutes | `#coordinates` |
| [Engineering units](docs/UNIT_REFERENCE.md) | Conversion factors for ten engineering categories | `#units` |

See the [format reference](docs/FORMAT_REFERENCE.md) for parser and export conventions and the [product requirements](PRD.md) for the project scope. Before using EarthVision, IRAP Classic, or ZMAP+ in production, validate the relevant format variants with representative Petrel and Kingdom files.

## Versioning

After cloning, enable the version hooks:

```sh
git config --local core.hooksPath .githooks
```

[`VERSION`](VERSION) records the release version and UTC build identifier in `vM.m.p+YYMMDDc` format. The hooks sync the release version to both npm manifests.

| Commit subject | Version change |
| --- | --- |
| `feat:` or `release(patch):` | Patch bump |
| `release(minor):` | Minor bump |
| Routine fixes and documentation changes | Build identifier only |

The patch digit rolls over after `9`. For example, a patch bump from `0.3.9` produces `0.4.0`.
