// Exact conversion factors. Each linear unit stores its size in the category's
// base unit; temperature units use explicit offset formulas instead.
export const CATEGORIES = [
  {
    key: 'length',
    name: 'Length',
    defaultFrom: 'm',
    defaultTo: 'ft',
    units: [
      { key: 'm', label: 'meter (m)', symbol: 'm', factor: 1 },
      { key: 'ft', label: 'foot (ft)', symbol: 'ft', factor: 0.3048 },
      { key: 'in', label: 'inch (in)', symbol: 'in', factor: 0.0254 },
      { key: 'km', label: 'kilometer (km)', symbol: 'km', factor: 1000 },
      { key: 'mi', label: 'mile (mi)', symbol: 'mi', factor: 1609.344 },
    ],
  },
  {
    key: 'temperature',
    name: 'Temperature',
    defaultFrom: 'c',
    defaultTo: 'f',
    units: [
      {
        key: 'c', label: 'Celsius (°C)', symbol: '°C',
        toBase: value => value + 273.15,
        fromBase: value => value - 273.15,
      },
      {
        key: 'f', label: 'Fahrenheit (°F)', symbol: '°F',
        toBase: value => (value - 32) * 5 / 9 + 273.15,
        fromBase: value => (value - 273.15) * 9 / 5 + 32,
      },
      { key: 'k', label: 'kelvin (K)', symbol: 'K', factor: 1 },
      {
        key: 'r', label: 'Rankine (°R)', symbol: '°R',
        toBase: value => value * 5 / 9,
        fromBase: value => value * 9 / 5,
      },
    ],
  },
  {
    key: 'area',
    name: 'Area',
    defaultFrom: 'm2',
    defaultTo: 'ft2',
    units: [
      { key: 'm2', label: 'square meter (m²)', symbol: 'm²', factor: 1 },
      { key: 'ft2', label: 'square foot (ft²)', symbol: 'ft²', factor: 0.09290304 },
      { key: 'acre', label: 'acre', symbol: 'ac', factor: 4046.8564224 },
      { key: 'ha', label: 'hectare (ha)', symbol: 'ha', factor: 10000 },
    ],
  },
  {
    key: 'volume',
    name: 'Volume',
    defaultFrom: 'bbl',
    defaultTo: 'm3',
    units: [
      { key: 'bbl', label: 'barrel (bbl)', symbol: 'bbl', factor: 0.158987294928 },
      { key: 'm3', label: 'cubic meter (m³)', symbol: 'm³', factor: 1 },
      { key: 'ft3', label: 'cubic foot (ft³)', symbol: 'ft³', factor: 0.028316846592 },
      { key: 'gal_us', label: 'gallon, US (gal)', symbol: 'gal US', factor: 0.003785411784 },
      { key: 'gal_uk', label: 'gallon, UK (gal)', symbol: 'gal UK', factor: 0.00454609 },
      { key: 'l', label: 'liter (L)', symbol: 'L', factor: 0.001 },
    ],
  },
  {
    key: 'mass',
    name: 'Mass',
    defaultFrom: 'kg',
    defaultTo: 'lb',
    units: [
      { key: 'g', label: 'gram (g)', symbol: 'g', factor: 0.001 },
      { key: 'kg', label: 'kilogram (kg)', symbol: 'kg', factor: 1 },
      { key: 'oz', label: 'ounce (oz)', symbol: 'oz', factor: 0.028349523125 },
      { key: 'lb', label: 'pound (lb)', symbol: 'lb', factor: 0.45359237 },
      { key: 't', label: 'ton, metric (t)', symbol: 't', factor: 1000 },
    ],
  },
  {
    key: 'pressure',
    name: 'Pressure',
    defaultFrom: 'psi',
    defaultTo: 'bar',
    units: [
      { key: 'psi', label: 'psi', symbol: 'psi', factor: 6894.757293168 },
      { key: 'kpa', label: 'kilopascal (kPa)', symbol: 'kPa', factor: 1000 },
      { key: 'bar', label: 'bar', symbol: 'bar', factor: 100000 },
      { key: 'atm', label: 'atmosphere (atm)', symbol: 'atm', factor: 101325 },
    ],
  },
  {
    key: 'density',
    name: 'Density',
    defaultFrom: 'gcm3',
    defaultTo: 'lbft3',
    units: [
      { key: 'gcm3', label: 'gram per cm³ (g/cm³)', symbol: 'g/cm³', factor: 1000 },
      { key: 'ppg', label: 'pound per gallon (ppg)', symbol: 'ppg', factor: 119.82642731689663 },
      { key: 'lbft3', label: 'pound per ft³ (lb/ft³)', symbol: 'lb/ft³', factor: 16.01846337396014 },
    ],
  },
  {
    key: 'time',
    name: 'Time',
    defaultFrom: 'day',
    defaultTo: 'hour',
    units: [
      { key: 's', label: 'second (s)', symbol: 's', factor: 1 },
      { key: 'min', label: 'minute (min)', symbol: 'min', factor: 60 },
      { key: 'h', label: 'hour (h)', symbol: 'h', factor: 3600 },
      { key: 'day', label: 'day (d)', symbol: 'd', factor: 86400 },
      { key: 'month', label: 'month, mean (mo)', symbol: 'mo', factor: 2629746 },
      { key: 'quarter', label: 'quarter (qtr)', symbol: 'qtr', factor: 7889238 },
      { key: 'year', label: 'year, mean (yr)', symbol: 'yr', factor: 31556952 },
      { key: 'decade', label: 'decade', symbol: 'decade', factor: 315569520 },
      { key: 'century', label: 'century', symbol: 'century', factor: 3155695200 },
    ],
  },
  {
    key: 'speed',
    name: 'Speed',
    defaultFrom: 'kmh',
    defaultTo: 'mph',
    units: [
      { key: 'ms', label: 'meter per second (m/s)', symbol: 'm/s', factor: 1 },
      { key: 'fts', label: 'foot per second (ft/s)', symbol: 'ft/s', factor: 0.3048 },
      { key: 'kmh', label: 'kilometer per hour (km/h)', symbol: 'km/h', factor: 1 / 3.6 },
      { key: 'mph', label: 'mile per hour (mph)', symbol: 'mph', factor: 0.44704 },
      { key: 'knot', label: 'knot (kn)', symbol: 'kn', factor: 1852 / 3600 },
    ],
  },
  {
    key: 'torque',
    name: 'Torque',
    defaultFrom: 'nm',
    defaultTo: 'lbft',
    units: [
      { key: 'nm', label: 'newton meter (N·m)', symbol: 'N·m', factor: 1 },
      { key: 'lbft', label: 'pound foot (lb·ft)', symbol: 'lb·ft', factor: 1.3558179483314004 },
    ],
  },
];

export function getCategory(key) {
  return CATEGORIES.find(category => category.key === key) ?? CATEGORIES[0];
}

export function findUnit(category, key) {
  return category.units.find(unit => unit.key === key) ?? category.units[0];
}

export function convertValue(category, value, fromKey, toKey) {
  if (!Number.isFinite(value)) return NaN;
  const from = findUnit(category, fromKey);
  const to = findUnit(category, toKey);
  const base = from.toBase ? from.toBase(value) : value * from.factor;
  return to.fromBase ? to.fromBase(base) : base / to.factor;
}

const grouped = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 10 });

export function formatNumber(value) {
  if (!Number.isFinite(value)) return '—';
  const normalized = Object.is(value, -0) ? 0 : value;
  if (normalized === 0) return '0';
  const magnitude = Math.abs(normalized);
  if (magnitude >= 1e15 || magnitude < 1e-9) {
    return normalized.toExponential(6).replace(/\.?0+e/, 'e').replace('e+', 'e');
  }
  return grouped.format(Number(normalized.toPrecision(10)));
}
