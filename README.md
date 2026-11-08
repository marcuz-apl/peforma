# Peforma Horizon/Grid

Peforma Horizon/Grid is the first data-exchange tool in the broader Peforma product direction. It focuses on oil and gas subsurface grid formats — 2D map surfaces in depth or time — with room for future tools for wells, seismic, contours, and other sector data.

This browser-based app inspects and converts supported subsurface grid formats. “Peforma” is the product family; “Grid” is the current tool.

## Development

Requires Node.js and npm.

```sh
npm install
npm run dev
```

Grid files are processed in the browser and are not uploaded. See [the PRD](docs/PRD.md) and [format notes](docs/FORMATS.md).

The Peforma Units converter covers ten engineering categories at `#units`; its factors and definitions are recorded in [unit notes](docs/UNITS.md). Peforma Culture is live at `#culture` for vector lines and points and at `#culture-polygon` for closed polygon rings, with both converters specified in [the Peforma Culture chapter](docs/PRD_CULTURE.md). Peforma Shapefile is live at `#shapefile`, reading and writing Esri Shapefile bundles and GeoJSON features with attributes and CRS intact; it is specified in [the Peforma Shapefile chapter](docs/PRD_SHAPEFILE.md). The planned 2D/3D seismic tool is scoped in [the Peforma Seismic chapter](docs/PRD_SEISMIC.md) and the planned 3D mesh and geobody tool in [the Peforma 3D chapter](docs/PRD_3D.md).

The exact EarthVision and IRAP/ZMAP dialects must be validated using representative Petrel and Kingdom files before relying on the converter for production exchange.
