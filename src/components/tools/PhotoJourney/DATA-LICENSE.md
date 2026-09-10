# Photo Journey data and decoder

`places.json` is a compact derivative of GeoNames cities15000 and countryInfo, downloaded 9 September 2026. The subset keeps cities with population at least 50,000 and national capitals (12,442 entries). Coordinates are rounded to three decimal places.

Source: https://download.geonames.org/export/dump/
Attribution: GeoNames, https://www.geonames.org/
License: Creative Commons Attribution 4.0, https://creativecommons.org/licenses/by/4.0/
The nearest city is approximate and does not identify an exact address.

HEIC decoding uses libheif-js (LGPL-3.0), https://github.com/catdad-experiments/libheif-js, and libheif: https://github.com/strukturag/libheif. The decoder remains a separate, on-demand module. Its source and license are included in the installed npm package.
