# Tools and formats

The routes below are relative to the running app.

| Tool | Supported data and formats | App routes |
| --- | --- | --- |
| [Grid surfaces](PRD_GRID.md) | Depth or time surfaces in CPS-3, ZMAP+, IRAP Classic, and EarthVision ASCII | `#grid` |
| [Vectors](PRD_CULTURE.md) | Lines and points in delimited text, GeoJSON, and GOCAD ASCII. Closed polygon rings in GeoJSON and GOCAD ASCII | `#culture`, `#culture-polygon` |
| [Shapefiles](PRD_SHAPEFILE.md) | Esri Shapefile bundles and GeoJSON, with attributes and CRS definitions preserved | `#shapefile` |
| [3D meshes](PRD_3D.md) | Triangulated surfaces and geobody shells in STL, OBJ, PLY, and GOCAD TSurf | `#3d-surfaces`, `#3d-solids` |
| [Seismic](PRD_SEISMIC.md) | SEG-Y lines and cubes, plus UKOOA P1/90 and IOGP P1/11 and P6/11 navigation | `#seismic-2d`, `#seismic-3d`, `#seismic-navigation` |
| [Coordinates](PRD_COORDINATES.md) | Latitude and longitude in decimal degrees, degrees minutes seconds, and degrees decimal minutes | `#coordinates` |
| [Engineering units](UNIT_REFERENCE.md) | Conversion factors for ten engineering categories | `#units` |

See the [format reference](FORMAT_REFERENCE.md) for parser and export conventions and the [product requirements](../PRD.md) for the project scope. Before using EarthVision, IRAP Classic, or ZMAP+ in production, validate the relevant format variants with representative Petrel and Kingdom files.
