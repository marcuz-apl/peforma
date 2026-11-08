# Peforma Grid

Peforma Grid is the first data-exchange tool in the broader Peforma product direction. It focuses on oil and gas subsurface grid formats — 2D map surfaces in depth or time — with room for future tools for wells, seismic, contours, and other sector data.

This browser-based app inspects and converts supported subsurface grid formats. “Peforma” is the product family; “Grid” is the current tool.

## Development

Requires Node.js and npm.

```sh
npm install
npm run dev
```

Grid files are processed in the browser and are not uploaded. See [the PRD](docs/PRD.md) and [format notes](docs/FORMATS.md).

The Peforma Units converter covers ten engineering categories at `#units`; its factors and definitions are recorded in [unit notes](docs/UNITS.md). Peforma Culture is live at `#culture`, covering vector lines and points; polygon geometry and shapefile bundles are planned next and are scoped in [the Peforma Culture chapter](docs/PRD_CULTURE.md), alongside the planned 2D/3D seismic tool in [the Peforma Seismic chapter](docs/PRD_SEISMIC.md) and the planned 3D mesh and geobody tool in [the Peforma 3D chapter](docs/PRD_3D.md).

The exact EarthVision and IRAP/ZMAP dialects must be validated using representative Petrel and Kingdom files before relying on the converter for production exchange.
