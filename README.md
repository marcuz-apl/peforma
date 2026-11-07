# Peforma Grid

Peforma Grid is the first data-exchange tool in the broader Peforma product direction. It focuses on oil and gas subsurface grid formats, with room for future tools for wells, seismic, contours, and other sector data.

This browser-based app inspects and converts supported subsurface grid formats. “Peforma” is the product family; “Grid” is the current tool.

## Development

Requires Node.js and npm.

```sh
npm install
npm run dev
```

Grid files are processed in the browser and are not uploaded. See [the PRD](docs/PRD.md) and [format notes](docs/FORMATS.md).

The exact EarthVision and IRAP/ZMAP dialects must be validated using representative Petrel and Kingdom files before relying on the converter for production exchange.
