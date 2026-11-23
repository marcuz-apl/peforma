# Peforma

Peforma is a browser-based application for exchanging oil and gas subsurface data. It includes grid, vector, shapefile, 3D mesh, seismic, coordinate, and engineering unit converters.

The application inspects and converts supported formats while keeping source files in the browser.

## Development

Requires Node.js and npm.

```sh
npm install
npm run dev
```

Open [Peforma locally](http://localhost:3050/).

## Docker

Run `docker compose up --build` from the repository root. Nginx serves the production build on port 80 inside the container, and Compose publishes it at [localhost:3050](http://localhost:3050/). Stop the Vite dev server first if it is using port 3050.

## Tools and formats

Grid files are processed in the browser. See [the PRD](PRD.md) and [format reference](docs/FORMAT_REFERENCE.md).

The unit converter covers ten engineering categories at `#units`; its factors and definitions are recorded in [the unit reference](docs/UNIT_REFERENCE.md). Vector conversion is available at `#culture` for lines and points and at `#culture-polygon` for closed polygon rings, with requirements in [the vector exchange chapter](docs/PRD_CULTURE.md). Shapefile conversion is available at `#shapefile` for Esri Shapefile bundles and GeoJSON features with attributes and CRS intact; see [the Shapefile chapter](docs/PRD_SHAPEFILE.md). Mesh conversion is available at `#3d-surfaces` and `#3d-solids`, reading and writing STL, Wavefront OBJ, PLY, and GOCAD TSurf with vertex and face order preserved; see [the mesh exchange chapter](docs/PRD_3D.md). Seismic conversion is available at `#seismic-2d`, `#seismic-3d`, and `#seismic-navigation` for SEG-Y traces and UKOOA/IOGP navigation; see [the seismic chapter](docs/PRD_SEISMIC.md). Coordinate notation conversion is available at `#coordinates`, preserving every source column; see [the coordinates chapter](docs/PRD_COORDINATES.md).

The exact EarthVision and IRAP/ZMAP dialects must be validated using representative Petrel and Kingdom files before relying on the converter for production exchange.

## Versioning

The root `VERSION` file is the source of truth in `vM.m.p+YYMMDDc` form. The Git hooks advance its UTC build identifier for each commit, apply the configured SemVer bump for feature or release commits, and sync the `M.m.p` value to `package.json` and `package-lock.json`.

After cloning, enable the hooks with `git config --local core.hooksPath .githooks`. Use `feat:` or `release(patch):` for a patch bump, or `release(minor):` for a minor bump. Ordinary fixes and documentation commits advance the build identifier.
