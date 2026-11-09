// Peforma Coordinates — tier-1 coordinate notation conversion.
//
// Converts how a latitude/longitude pair is written (decimal degrees, degrees
// minutes seconds, degrees decimal minutes) without changing the value it
// names. Nothing is reprojected, no datum is assumed, and no unit is converted.
// A value that cannot be read unambiguously is reported per row, never guessed.

export const MAX_COORD_BYTES = 8 * 1024 * 1024;
export const MAX_COORD_ROWS = 100000;

export const COORD_NOTATION_LABELS = {
  dd: 'Decimal degrees (51.507400)',
  dms: 'Degrees minutes seconds (51°30′26.40″N)',
  ddm: 'Degrees decimal minutes (51°30.4400′N)',
};

export const COORD_NOTATION_HINTS = {
  dd: 'Signed decimal degrees with no hemisphere letter. The number of decimal places is the precision you choose; the value is rounded for display only.',
  dms: 'Integer degrees and minutes with fractional seconds and an N/S or E/W letter. Rounding carries into minutes and degrees; the position is not moved.',
  ddm: 'Integer degrees with fractional minutes and an N/S or E/W letter. Rounding carries into degrees; the position is not moved.',
};

const NOTATION_NAMES = { dd: 'decimal degrees', dms: 'degrees minutes seconds', ddm: 'degrees decimal minutes' };
const HEMISPHERES = { lat: { N: 1, S: -1 }, lon: { E: 1, W: -1 } };
const AXIS_NAME = { lat: 'latitude', lon: 'longitude' };

function round(value, places) {
  return Number(value.toFixed(places));
}

// Parse one coordinate cell. Returns { value, notation, packed, hemisphere }.
// Throws with a specific reason when the text is blank, ambiguous, contradictory,
// or outside the axis range. Bare numbers are decimal degrees; packed forms
// (513026.4N, 1140426.4W) require a hemisphere letter so they can never be
// confused with a decimal-degree value.
export function parseCoordinateValue(raw, axis) {
  const text = String(raw ?? '').trim();
  if (!text) throw Error('blank');
  const hemis = HEMISPHERES[axis];
  if (!hemis) throw Error(`Unknown axis ${axis}.`);

  let body = text;
  let letter = null;
  const leading = text.match(/^([NSEWnsew])\s*(.+)$/);
  const trailing = text.match(/^(.+?)\s*([NSEWnsew])$/);
  if (leading) { letter = leading[1].toUpperCase(); body = leading[2].trim(); }
  else if (trailing) { letter = trailing[2].toUpperCase(); body = trailing[1].trim(); }
  if (letter && !(letter in hemis)) {
    throw Error(`hemisphere ${letter} does not belong to a ${AXIS_NAME[axis]}`);
  }

  const negative = /^-/.test(body);
  if (letter && negative) throw Error(`a minus sign and ${letter} disagree`);
  const unsigned = body.replace(/^[+-]/, '');

  // Split on degree/minute/second marks, colons, or whitespace. One token is a
  // decimal or packed value, two tokens are degrees + minutes, three are DMS.
  const tokens = unsigned.split(/[°º'′"″:\s]+/).filter(Boolean);
  if (!tokens.length || tokens.some(t => !/^\d+(\.\d+)?$/.test(t))) {
    throw Error(`"${text}" is not a recognised coordinate`);
  }
  const nums = tokens.map(Number);
  let value, notation, packed = false;

  if (nums.length === 1) {
    // Packed forms are recognised only by their exact digit count with a
    // hemisphere letter: 5130.44N / 11404.26W (degrees + decimal minutes) and
    // 513026N / 1140426W (degrees minutes seconds). Anything else, including
    // 51.5N or 51N, is decimal degrees with a hemisphere letter.
    const digits = axis === 'lat' ? 2 : 3;
    const whole = unsigned.split('.')[0];
    if (letter && whole.length === digits + 4) {
      const d = Number(unsigned.slice(0, digits));
      const m = Number(unsigned.slice(digits, digits + 2));
      const s = Number(unsigned.slice(digits + 2));
      if (m >= 60 || s >= 60) throw Error(`minutes ${m} or seconds ${s} are not below 60`);
      value = d + m / 60 + s / 3600; notation = 'dms'; packed = true;
    } else if (letter && unsigned.includes('.') && whole.length === digits + 2) {
      const d = Number(whole.slice(0, digits));
      const m = Number(unsigned.slice(digits));
      if (m >= 60) throw Error(`minutes ${m} are not below 60`);
      value = d + m / 60; notation = 'ddm'; packed = true;
    } else {
      value = Number(unsigned); notation = 'dd';
    }
  } else if (nums.length === 2) {
    const [d, m] = nums;
    if (!Number.isInteger(d)) throw Error(`degrees ${d} are not a whole number`);
    if (m >= 60) throw Error(`minutes ${m} are not below 60`);
    value = d + m / 60; notation = 'ddm';
  } else if (nums.length === 3) {
    const [d, m, s] = nums;
    if (!Number.isInteger(d) || !Number.isInteger(m)) throw Error(`degrees ${d} and minutes ${m} must be whole numbers`);
    if (m >= 60 || s >= 60) throw Error(`minutes ${m} or seconds ${s} are not below 60`);
    value = d + m / 60 + s / 3600; notation = 'dms';
  } else {
    throw Error(`"${text}" has too many parts`);
  }

  if (negative) value = -value;
  else if (letter) value *= hemis[letter];
  const limit = axis === 'lat' ? 90 : 180;
  if (!Number.isFinite(value) || Math.abs(value) > limit) {
    throw Error(`${value} is outside the ${AXIS_NAME[axis]} range (±${limit})`);
  }
  return { value, notation, packed, hemisphere: letter };
}

// Write one value in the requested notation. Decimal degrees keep the sign and
// no letter; DMS and DDM use absolute parts with a hemisphere letter. Rounding
// carries through seconds → minutes → degrees so 59.9999″ never prints as 60.
export function formatCoordinate(value, axis, notation, precision) {
  if (notation === 'dd') return value.toFixed(precision);
  const letter = axis === 'lat' ? (value < 0 ? 'S' : 'N') : (value < 0 ? 'W' : 'E');
  let d = Math.floor(Math.abs(value));
  const minutesFull = (Math.abs(value) - d) * 60;
  if (notation === 'ddm') {
    let m = round(minutesFull, precision);
    if (m >= 60) { m = round(m - 60, precision); d += 1; }
    return `${d}°${m.toFixed(precision).padStart(precision > 0 ? precision + 3 : 2, '0')}′${letter}`;
  }
  let m = Math.floor(minutesFull);
  let s = round((minutesFull - m) * 60, precision);
  if (s >= 60) { s = round(s - 60, precision); m += 1; }
  if (m >= 60) { m -= 60; d += 1; }
  const secondsText = s.toFixed(precision).padStart(precision > 0 ? precision + 3 : 2, '0');
  return `${d}°${String(m).padStart(2, '0')}′${secondsText}″${letter}`;
}

function detectDelimiter(line) {
  if (line.includes('\t')) return '\t';
  if (line.includes(',')) return ',';
  if (line.includes(';')) return ';';
  return 'whitespace';
}

function splitLine(line, delimiter) {
  if (delimiter === 'whitespace') return line.trim().split(/\s+/);
  // Quote-aware split: a quoted cell keeps its commas and its content verbatim;
  // an unquoted cell is trimmed. Doubled quotes inside a quoted cell unescape.
  const cells = [];
  let cell = '';
  let quoted = false;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cell += '"'; i += 1; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"' && cell.trim() === '') {
      inQuotes = true;
      quoted = true;
      cell = '';
    } else if (ch === delimiter) {
      cells.push(quoted ? cell : cell.trim());
      cell = '';
      quoted = false;
    } else cell += ch;
  }
  cells.push(quoted ? cell : cell.trim());
  return cells;
}

// Read delimited text into a mapping-pending table. A non-numeric first row is
// a header; an all-numeric first row is data. Blank lines are dropped but their
// line numbers are kept so row errors point at the original file.
export function parseCoordinateTable(text, fileName) {
  if (text.includes('\0')) throw Error('This file is not plain text.');
  const rawLines = text.replace(/^﻿/, '').split(/\r?\n/);
  const lines = [];
  rawLines.forEach((line, index) => { if (line.trim() !== '') lines.push({ text: line, lineNo: index + 1 }); });
  if (!lines.length) throw Error('This file has no data rows.');

  const delimiter = detectDelimiter(lines[0].text);
  const firstTokens = splitLine(lines[0].text, delimiter);
  if (firstTokens.length < 2) throw Error('At least two columns are needed: one latitude and one longitude.');
  const hasHeader = !firstTokens.every(cell => cell !== '' && Number.isFinite(Number(cell)));
  const headers = hasHeader
    ? firstTokens.map((cell, i) => cell || `Column ${i + 1}`)
    : firstTokens.map((_, i) => `Column ${i + 1}`);
  const dataLines = hasHeader ? lines.slice(1) : lines;
  if (!dataLines.length) throw Error('This file has no data rows after the header.');
  if (dataLines.length > MAX_COORD_ROWS) throw Error(`This file has ${dataLines.length.toLocaleString()} rows; the read cap is ${MAX_COORD_ROWS.toLocaleString()}.`);

  const rows = dataLines.map(line => ({ cells: splitLine(line.text, delimiter), lineNo: line.lineNo }));
  const suggested = { lat: null, lon: null };
  if (hasHeader) {
    const latIndex = headers.findIndex(h => /^(lat|latitude|y)$/i.test(h.trim()));
    const lonIndex = headers.findIndex((h, i) => i !== latIndex && /^(lon|long|longitude|x)$/i.test(h.trim()));
    if (latIndex >= 0) suggested.lat = latIndex;
    if (lonIndex >= 0) suggested.lon = lonIndex;
  }
  return { kind: 'unmapped', fileName, headers, rows, delimiter, hasHeader, suggested };
}

// Resolve the user's column mapping into a converted model. Every row is kept;
// a row whose latitude or longitude cannot be read carries its errors instead
// of a value, and the original cells are never altered.
export function resolveCoordinates(pending, mapping) {
  if (mapping.lat == null || mapping.lon == null) throw Error('Choose the latitude and longitude columns before converting.');
  if (mapping.lat === mapping.lon) throw Error('Latitude and longitude must be two different columns.');
  const { headers, rows, fileName } = pending;
  const results = rows.map(row => {
    const result = { lineNo: row.lineNo, cells: row.cells, lat: null, lon: null, errors: [] };
    for (const axis of ['lat', 'lon']) {
      const cell = row.cells[mapping[axis]];
      try {
        result[axis] = parseCoordinateValue(cell, axis);
      } catch (e) {
        result.errors.push(`${AXIS_NAME[axis]} (line ${row.lineNo}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return result;
  });
  return { kind: 'coordinates', fileName, headers, rows, mapping, results, warnings: [] };
}

export function summarizeCoordinates(model) {
  const { results } = model;
  const ok = results.filter(r => !r.errors.length);
  const failed = results.filter(r => r.errors.length);
  const notationCounts = { dd: 0, dms: 0, ddm: 0 };
  let packedCount = 0, hemisphereCount = 0;
  const bounds = { lat: null, lon: null };
  for (const axis of ['lat', 'lon']) {
    let min = Infinity, max = -Infinity;
    for (const row of ok) {
      const parsed = row[axis];
      notationCounts[parsed.notation] += 1;
      if (parsed.packed) packedCount += 1;
      if (parsed.hemisphere) hemisphereCount += 1;
      min = Math.min(min, parsed.value);
      max = Math.max(max, parsed.value);
    }
    if (ok.length) bounds[axis] = [min, max];
  }
  const notations = Object.entries(notationCounts).filter(([, count]) => count > 0).map(([key]) => key);
  const warnings = [];
  if (notations.length > 1) {
    warnings.push(`The columns mix ${notations.map(n => NOTATION_NAMES[n]).join(' and ')}. Every value is converted from the notation it was written in.`);
  }
  if (packedCount) warnings.push(`${packedCount.toLocaleString()} value${packedCount === 1 ? '' : 's'} use a packed form such as 513026N; these are read as degrees minutes seconds or decimal minutes.`);
  if (failed.length) warnings.push(`${failed.length.toLocaleString()} row${failed.length === 1 ? '' : 's'} could not be fully read and will be written with blank converted cells.`);
  return {
    rowCount: results.length,
    okCount: ok.length,
    failed,
    notationCounts,
    notations,
    packedCount,
    hemisphereCount,
    bounds,
    warnings,
  };
}

function csvCell(text) {
  const value = String(text ?? '');
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Write the table with every source column preserved verbatim and the converted
// pair appended in the chosen notation. When any row failed, a trailing note
// column records the reason per row; the failure is also returned as a warning.
export function writeCoordinateCsv(model, { notation, precision }) {
  if (!COORD_NOTATION_LABELS[notation]) throw Error(`Unknown notation ${notation}.`);
  const summary = summarizeCoordinates(model);
  if (!summary.okCount) throw Error('No row could be read, so there is nothing to convert. Check the column mapping and the coordinate values.');
  const suffix = notation === 'dd' ? 'dd' : notation === 'dms' ? 'dms' : 'dm';
  const header = [...model.headers, `latitude_${suffix}`, `longitude_${suffix}`];
  if (summary.failed.length) header.push('peforma_note');
  const lines = [header.map(csvCell).join(',')];
  for (const row of model.results) {
    const cells = [...row.cells];
    while (cells.length < model.headers.length) cells.push('');
    cells.length = model.headers.length;
    if (row.errors.length) {
      cells.push('', '');
      cells.push(row.errors.join('; '));
    } else {
      cells.push(formatCoordinate(row.lat.value, 'lat', notation, precision));
      cells.push(formatCoordinate(row.lon.value, 'lon', notation, precision));
      if (summary.failed.length) cells.push('');
    }
    lines.push(cells.map(csvCell).join(','));
  }
  const warnings = [...summary.warnings];
  warnings.push('Source columns are copied verbatim; the converted pair is appended. No value is reprojected and no datum is assumed.');
  const base = model.fileName.replace(/\.[^.]+$/, '') || 'coordinates';
  return { text: `${lines.join('\r\n')}\r\n`, fileName: `${base}.coordinates.csv`, mime: 'text/csv;charset=utf-8', warnings };
}