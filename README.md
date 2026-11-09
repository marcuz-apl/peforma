# Peforma Horizon/Grid

Peforma Horizon/Grid is the grid data-exchange tool in the broader Peforma product family. It focuses on oil and gas subsurface grid formats — 2D map surfaces in depth or time — alongside sibling tools for vectors, meshes, seismic, shapefiles, coordinates, and units.

This browser-based app inspects and converts supported subsurface grid formats. “Peforma” is the product family; “Grid” is the current tool.

## Development

Requires Node.js and npm.

```sh
npm install
npm run dev
```

Grid files are processed in the browser. See [the PRD](PRD.md) and [format notes](docs/FORMATS.md).

The Peforma Units converter covers ten engineering categories at `#units`; its factors and definitions are recorded in [unit notes](docs/UNITS.md). Peforma Culture is live at `#culture` for vector lines and points and at `#culture-polygon` for closed polygon rings, with both converters specified in [the Peforma Culture chapter](PRD.md#culture). Peforma Shapefile is live at `#shapefile`, reading and writing Esri Shapefile bundles and GeoJSON features with attributes and CRS intact; it is specified in [the Peforma Shapefile chapter](PRD.md#shapefile). Peforma 3D is live at `#3d-surfaces` for triangulated surfaces and at `#3d-solids` for geobodies and solids, reading and writing ASCII and binary STL, Wavefront OBJ, PLY, and GOCAD TSurf with vertex and face order preserved; it is specified in [the Peforma 3D chapter](PRD.md#3d). Peforma Seismic is live at `#seismic-2d` and `#seismic-3d` for SEG-Y trace files and at `#seismic-navigation` for UKOOA P1/90, OGP P1/11, and OGP P6/11 navigation; it is specified in [the Peforma Seismic chapter](PRD.md#seismic). Peforma Coordinates is live at `#coordinates`, rewriting latitude and longitude between decimal degrees, degrees minutes seconds, and degrees decimal minutes with every source column preserved; it is specified in [the Peforma Coordinates chapter](PRD.md#coordinates).

The exact EarthVision and IRAP/ZMAP dialects must be validated using representative Petrel and Kingdom files before relying on the converter for production exchange.
