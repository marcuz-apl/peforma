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

## Documentation

See the [tool guide](docs/TOOLS.md), [format reference](docs/FORMAT_REFERENCE.md), and [product requirements](PRD.md).

## License

Peforma is licensed under the [MIT License](LICENSE).
