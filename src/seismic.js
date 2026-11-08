// Peforma Seismic — SEG-Y and IOGP navigation exchange.
//
// SEG-Y is treated as a byte-preserving container: the textual header, every trace
// header, and every sample byte are copied unchanged. Only the binary-header fields
// named in the design are normalised on write. Samples are never decoded, scaled,
// resampled, or interpolated, which is why every defined sample-format code can be
// carried even though Peforma never looks inside a sample.
//
// Navigation sidecars are read as records, not as a single schema: P1/90 is fixed
// width, P1/11 and P6/11 are comma separated. Blank fields stay blank; a missing
// value is never replaced with zero or a default.

export const MAX_SEISMIC_BYTES = 256 * 1024 * 1024;

export const SEISMIC_SOURCE_LABELS = {
  segy: 'SEG-Y',
  p190: 'UKOOA P1/90',
  p111: 'OGP P1/11',
  p611: 'OGP P6/11',
};

export const SEGY_TARGET_LABELS = {
  'segy-normalized': 'SEG-Y rev 2.0 (normalized)',
};

export const NAV_TARGET_LABELS = {
  csv: 'Delimited text (CSV)',
  p111: 'OGP P1/11',
  p190: 'UKOOA P1/90',
};

const SAMPLE_FORMATS = {
  1: [4, '4-byte IBM float'],
  2: [4, '4-byte signed integer'],
  3: [2, '2-byte signed integer'],
  4: [4, '4-byte fixed point with gain (obsolete)'],
  5: [4, '4-byte IEEE float'],
  6: [8, '8-byte IEEE float'],
  7: [3, '3-byte signed integer'],
  8: [1, '1-byte signed integer'],
  9: [8, '8-byte signed integer'],
  10: [4, '4-byte unsigned integer'],
  11: [2, '2-byte unsigned integer'],
  12: [8, '8-byte unsigned integer'],
  15: [3, '3-byte unsigned integer'],
  16: [1, '1-byte unsigned integer'],
};

const EBCDIC = (() => {
  const map = new Array(256).fill(' ');
  const set = (from, chars) => {
    for (let i = 0; i < chars.length; i++) map[from + i] = chars[i];
  };
  set(0x81, 'abcdefghi');
  set(0x91, 'jklmnopqr');
  set(0xa2, 'stuvwxyz');
  set(0xc1, 'ABCDEFGHI');
  set(0xd1, 'JKLMNOPQR');
  set(0xe2, 'STUVWXYZ');
  set(0xf0, '0123456789');
  const pairs = [
    [0x40, ' '], [0x4a, '¢'], [0x4b, '.'], [0x4c, '<'], [0x4d, '('], [0x4e, '+'], [0x4f, '|'],
    [0x50, '&'], [0x5a, '!'], [0x5b, '$'], [0x5c, '*'], [0x5d, ')'], [0x5e, ';'], [0x5f, '¬'],
    [0x60, '-'], [0x61, '/'], [0x6a, '¦'], [0x6b, ','], [0x6c, '%'], [0x6d, '_'], [0x6e, '>'],
    [0x6f, '?'], [0x79, '`'], [0x7a, ':'], [0x7b, '#'], [0x7c, '@'], [0x7d, "'"], [0x7e, '='],
    [0x7f, '"'], [0xad, '['], [0xbd, ']'], [0xba, '^'], [0xbb, '~'],
  ];
  for (const [code, char] of pairs) map[code] = char;
  return map;
})();

function decodeText(bytes, length = bytes.byteLength) {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, Math.min(length, bytes.byteLength)));
}

function decodeTextual(bytes) {
  const ascii = decodeText(bytes);
  const printable = ascii.replace(/[^\x20-\x7e\r\n\t]/g, '').length;
  const characters = ascii.length || 1;
  const text = printable / characters >= 0.9 && /[A-Za-z]/.test(ascii)
    ? ascii
    : Array.from(bytes, byte => EBCDIC[byte]).join('');
  return text.match(/.{1,80}/g)?.map(line => line.replace(/\s+$/, '')) || [];
}

const views = new WeakMap();

function view(bytes) {
  let data = views.get(bytes);
  if (!data) {
    data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    views.set(bytes, data);
  }
  return data;
}

function u16(bytes, offset, big) { return view(bytes).getUint16(offset, !big); }
function i16(bytes, offset, big) { return view(bytes).getInt16(offset, !big); }
function i32(bytes, offset, big) { return view(bytes).getInt32(offset, !big); }
function u64(bytes, offset, big) {
  return view(bytes).getBigUint64(offset, !big);
}
function raw32(bytes, offset) {
  return view(bytes).getUint32(offset, false);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// The revision-2 byte-order constant is authoritative when it is present. Files
// written before revision 2 are resolved from the sample-format code and the
// revision bytes, which is unambiguous for every defined format code.
function endiannessOf(bytes) {
  const marker = raw32(bytes, 3296);
  if (marker === 0x02010403) throw Error('This SEG-Y file uses byte-swapped 16-bit ordering, which Peforma Seismic does not decode.');
  if (marker === 0x01020304) return 'big';
  if (marker === 0x04030201) return 'little';

  const bigFormat = u16(bytes, 3224, true);
  const littleFormat = u16(bytes, 3224, false);
  const revisionOk = bytes[3500] <= 2 && bytes[3501] <= 9;
  const bigOk = SAMPLE_FORMATS[bigFormat] && revisionOk;
  const littleOk = SAMPLE_FORMATS[littleFormat] && revisionOk;
  if (bigOk && !littleOk) return 'big';
  if (littleOk && !bigOk) return 'little';
  if (bigOk && littleOk) {
    const bigSamples = u16(bytes, 3220, true);
    const littleSamples = u16(bytes, 3220, false);
    if (bigSamples && !littleSamples) return 'big';
    if (littleSamples && !bigSamples) return 'little';
    return 'big';
  }
  throw Error('The SEG-Y binary header does not contain a defined sample-format code and revision.');
}

function looksLikeSegy(bytes) {
  if (bytes.length < 3600) return false;
  if (raw32(bytes, 3296) === 0x02010403) return true;
  try {
    endiannessOf(bytes);
    return true;
  } catch {
    return false;
  }
}

function firstTextLine(bytes) {
  const head = decodeText(bytes.subarray(0, Math.min(bytes.length, 65536)))
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line !== '');
  return head || '';
}

export function detectSeismicFormat(bytes, fileName) {
  if (looksLikeSegy(bytes)) return 'segy';
  const first = firstTextLine(bytes);
  if (/^OGP,/i.test(first)) {
    const code = first.split(',')[2]?.trim();
    if (code === '6') return 'p611';
    if (code === '1') return 'p111';
    throw Error(`The OGP identification record names format code ${code || '(blank)'}; Peforma Seismic reads P1/11 (1) and P6/11 (6).`);
  }
  if (/^(B6|M6|H6),/i.test(first)) return 'p611';
  if (/^(HC|P1|S1|R1|X1|A1|N1),/i.test(first)) {
    const head = decodeText(bytes.subarray(0, Math.min(bytes.length, 262144)));
    return /^(B6|M6|H6),/im.test(head) ? 'p611' : 'p111';
  }
  if (/^H\d{2}/i.test(first)) return 'p190';
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'p111') return 'p111';
  if (ext === 'p611') return 'p611';
  if (ext === 'p190' || ext === 'nav') return 'p190';
  throw Error('This file is not a SEG-Y, UKOOA P1/90, OGP P1/11, or OGP P6/11 file.');
}

function num(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function range(values) {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return Number.isFinite(min) ? [min, max] : null;
}

function mode(values) {
  const counts = new Map();
  let best = null;
  let bestCount = 0;
  for (const value of values) {
    if (!Number.isFinite(value) || value <= 0) continue;
    const next = (counts.get(value) || 0) + 1;
    counts.set(value, next);
    if (next > bestCount) {
      best = value;
      bestCount = next;
    }
  }
  return best;
}

function distinct(values) {
  const set = new Set();
  for (const value of values) set.add(value);
  return set;
}

function convertDms(degrees, minutes, seconds, hemisphere, width) {
  const deg = num(degrees);
  const min = num(minutes);
  const sec = num(seconds);
  if (deg === null && min === null && sec === null) return null;
  const value = Math.abs(deg || 0) + Math.abs(min || 0) / 60 + Math.abs(sec || 0) / 3600;
  const sign = /^-/.test(String(degrees).trim()) ? -1 : 1;
  const hemi = String(hemisphere || '').trim().toUpperCase();
  if (hemi === 'S' || hemi === 'W') return -value;
  return value * sign;
}

function signedDegrees(text) {
  const value = num(text);
  return value === null ? null : value;
}

function parseSegy(bytes, fileName) {
  if (bytes.length < 3600) throw Error(`A SEG-Y file is at least 3600 bytes; this file is ${formatBytes(bytes.length)}.`);
  const endian = endiannessOf(bytes);
  const big = endian === 'big';

  const formatCode = u16(bytes, 3224, big);
  const sampleFormat = SAMPLE_FORMATS[formatCode];
  if (!sampleFormat) throw Error(`SEG-Y sample format code ${formatCode} is not defined for a seismic trace.`);
  const [bytesPerSample, formatLabel] = sampleFormat;

  const revisionMajor = bytes[3500];
  const revisionMinor = bytes[3501];
  if (revisionMajor > 2) throw Error(`SEG-Y revision ${revisionMajor}.${revisionMinor} is newer than revision 2 and is not read.`);

  const binaryHeader = bytes.slice(3200, 3600);
  const binary = {
    sampleInterval: u16(bytes, 3216, big),
    originalSampleInterval: u16(bytes, 3218, big),
    samplesPerTrace: u16(bytes, 3220, big),
    originalSamplesPerTrace: u16(bytes, 3222, big),
    formatCode,
    ensembleFold: u16(bytes, 3226, big),
    sortingCode: i16(bytes, 3228, big),
    measurementSystem: u16(bytes, 3254, big),
    revisionMajor,
    revisionMinor,
    fixedLength: revisionMajor >= 1 ? u16(bytes, 3502, big) : 0,
    extendedCount: revisionMajor >= 1 ? i16(bytes, 3504, big) : 0,
    maxAdditionalHeaders: revisionMajor >= 2 ? u16(bytes, 3506, big) : 0,
  };

  if (binary.extendedCount < 0) {
    throw Error('This file declares a variable number of extended textual headers ((SEG: EndText) termination), which Peforma Seismic does not locate.');
  }
  const extendedStart = 3600;
  const extendedBytes = binary.extendedCount * 3200;
  if (extendedStart + extendedBytes > bytes.length) {
    throw Error(`The binary header declares ${binary.extendedCount} extended textual header record(s), but the file ends before them.`);
  }
  const extendedText = [];
  for (let index = 0; index < binary.extendedCount; index++) {
    extendedText.push(decodeTextual(bytes.subarray(3600 + index * 3200, 3600 + (index + 1) * 3200)).join('\n'));
  }

  let firstTrace = 3600 + extendedBytes;
  let traceCountField = 0;
  let trailerRecords = 0;
  if (revisionMajor >= 2) {
    const count = u64(bytes, 3512, big);
    traceCountField = count > 0n ? Number(count) : 0;
    const offset = u64(bytes, 3520, big);
    if (offset > 0n) {
      const candidate = Number(offset);
      if (candidate >= 3600 + extendedBytes && candidate <= bytes.length) firstTrace = candidate;
    }
    trailerRecords = i32(bytes, 3528, big);
    if (trailerRecords < 0) trailerRecords = 0;
  }
  const trailerBytes = trailerRecords * 3200;
  if (trailerBytes >= bytes.length) throw Error('The binary header declares a data trailer that is larger than the file.');
  const dataEnd = bytes.length - trailerBytes;
  if (dataEnd <= firstTrace) throw Error('No trace records follow the textual, binary, and extended textual headers.');

  const capacity = Math.max(1, Math.ceil((dataEnd - firstTrace) / (240 + bytesPerSample)));
  const sizes = {
    headerOffset: new Uint32Array(capacity),
    length: new Uint32Array(capacity),
    extra: new Uint8Array(capacity),
    samples: new Uint32Array(capacity),
    interval: new Uint32Array(capacity),
    inline: new Int32Array(capacity),
    crossline: new Int32Array(capacity),
    fieldRecord: new Int32Array(capacity),
    cdp: new Int32Array(capacity),
    sourceX: new Int32Array(capacity),
    sourceY: new Int32Array(capacity),
    cdpX: new Int32Array(capacity),
    cdpY: new Int32Array(capacity),
    scalar: new Int16Array(capacity),
  };

  let count = 0;
  let offset = firstTrace;
  let assumedSamples = 0;
  let assumedIntervals = 0;
  let inlineMajor = true;
  let previousInline = -Infinity;
  let previousCrossline = -Infinity;

  while (offset + 240 <= dataEnd) {
    const declaredSamples = u16(bytes, offset + 114, big);
    const declaredInterval = u16(bytes, offset + 116, big);
    const extraHeaders = u16(bytes, offset + 156, big);
    let samples = declaredSamples || binary.samplesPerTrace;
    if (!declaredSamples) assumedSamples++;
    if (!declaredInterval) assumedIntervals++;
    const interval = declaredInterval || binary.sampleInterval;
    if (!samples) {
      throw Error(`Trace ${count + 1} at byte ${offset + 1} declares zero samples and the binary header supplies none.`);
    }
    const length = 240 + extraHeaders * 240 + samples * bytesPerSample;
    if (offset + length > dataEnd) {
      throw Error(`Trace ${count + 1} at byte ${offset + 1} needs ${length} bytes but only ${dataEnd - offset} remain. The file ends in a partial trace.`);
    }
    if (count >= capacity) throw Error('This file contains more trace records than its header layout allows.');
    const inline = i32(bytes, offset + 188, big);
    const crossline = i32(bytes, offset + 192, big);
    if (inline < previousInline || (inline === previousInline && crossline < previousCrossline)) inlineMajor = false;
    previousInline = inline;
    previousCrossline = crossline;

    sizes.headerOffset[count] = offset;
    sizes.length[count] = length;
    sizes.extra[count] = extraHeaders;
    sizes.samples[count] = samples;
    sizes.interval[count] = interval;
    sizes.inline[count] = inline;
    sizes.crossline[count] = crossline;
    sizes.fieldRecord[count] = i32(bytes, offset + 8, big);
    sizes.cdp[count] = i32(bytes, offset + 20, big);
    sizes.scalar[count] = i16(bytes, offset + 70, big);
    sizes.sourceX[count] = i32(bytes, offset + 72, big);
    sizes.sourceY[count] = i32(bytes, offset + 76, big);
    sizes.cdpX[count] = i32(bytes, offset + 180, big);
    sizes.cdpY[count] = i32(bytes, offset + 184, big);

    count++;
    offset += length;
  }

  const trailingBytes = dataEnd - offset;
  if (trailingBytes >= 240) {
    throw Error(`The file ends with ${trailingBytes} bytes after the last complete trace, which is a partial trace header.`);
  }

  const warnings = [];
  if (trailingBytes > 0) warnings.push(`${trailingBytes} byte${trailingBytes === 1 ? '' : 's'} after the last trace ${trailingBytes === 1 ? 'was' : 'were'} ignored.`);
  if (assumedSamples) warnings.push(`${assumedSamples.toLocaleString()} trace${assumedSamples === 1 ? '' : 's'} left the sample count at zero; the binary-header count ${binary.samplesPerTrace || '(none)'} was used.`);
  if (assumedIntervals) warnings.push(`${assumedIntervals.toLocaleString()} trace${assumedIntervals === 1 ? '' : 's'} left the sample interval at zero; the binary-header interval ${binary.sampleInterval || '(none)'} was used.`);
  if (formatCode === 4) warnings.push('Sample format 4 (fixed point with gain) is obsolete; its bytes are copied verbatim and are not decoded.');
  if (traceCountField && traceCountField !== count) {
    warnings.push(`The binary header names ${traceCountField.toLocaleString()} traces; ${count.toLocaleString()} complete traces were found.`);
  }
  if (trailerRecords > 0) warnings.push(`${trailerRecords} data trailer stanza record${trailerRecords === 1 ? '' : 's'} after the traces are carried through unchanged.`);

  const samplesPerTrace = mode(sizes.samples.subarray(0, count));
  const sampleInterval = mode(sizes.interval.subarray(0, count));
  const lengths = distinct(sizes.samples.subarray(0, count));
  const intervals = distinct(sizes.interval.subarray(0, count));
  const inlineValues = sizes.inline.subarray(0, count);
  const crosslineValues = sizes.crossline.subarray(0, count);
  const scalarFor = index => {
    const scalar = sizes.scalar[index];
    if (!scalar) return 1;
    return scalar < 0 ? 1 / Math.abs(scalar) : scalar;
  };

  let inlineRange = range(inlineValues);
  let crosslineRange = range(crosslineValues);
  let geometryKind = 'unknown';
  let expectedTraces = 0;
  let missingBins = 0;
  if (count) {
    const inlineCount = distinct(inlineValues).size;
    const crosslineCount = distinct(crosslineValues).size;
    if (inlineCount > 1 && crosslineCount > 1) {
      geometryKind = '3d';
      const pairs = new Set();
      for (let index = 0; index < count; index++) pairs.add(`${inlineValues[index]}:${crosslineValues[index]}`);
      expectedTraces = inlineCount * crosslineCount;
      missingBins = Math.max(0, expectedTraces - pairs.size);
    } else {
      geometryKind = '2d';
    }
  }

  const coordinateSource = count && sizes.cdpX.some((value, index) => index < count && value) ? 'CDP' : 'Source';
  const xValues = [];
  const yValues = [];
  for (let index = 0; index < count; index++) {
    const rawX = coordinateSource === 'CDP' ? sizes.cdpX[index] : sizes.sourceX[index];
    const rawY = coordinateSource === 'CDP' ? sizes.cdpY[index] : sizes.sourceY[index];
    if (!rawX && !rawY) continue;
    const factor = scalarFor(index);
    xValues.push(rawX * factor);
    yValues.push(rawY * factor);
  }

  const summary = {
    revision: `${binary.revisionMajor}.${binary.revisionMinor}`,
    revisionLabel: `SEG-Y rev ${binary.revisionMajor}.${binary.revisionMinor}`,
    endianness: endian,
    endiannessLabel: endian === 'big' ? 'Big-endian' : 'Little-endian',
    formatCode,
    formatLabel,
    bytesPerSample,
    sampleInterval,
    samplesPerTrace,
    traceCount: count,
    fixedLength: Boolean(binary.fixedLength),
    variableLength: lengths.size > 1,
    distinctSampleCounts: lengths.size,
    distinctIntervals: intervals.size,
    extendedHeaders: binary.extendedCount,
    maxAdditionalHeaders: binary.maxAdditionalHeaders,
    trailerRecords,
    geometryKind,
    inlineRange,
    crosslineRange,
    inlineCount: count ? distinct(inlineValues).size : 0,
    crosslineCount: count ? distinct(crosslineValues).size : 0,
    expectedTraces,
    missingBins,
    inlineMajor,
    cdpRange: count ? range(sizes.cdp.subarray(0, count)) : null,
    fieldRecordRange: count ? range(sizes.fieldRecord.subarray(0, count)) : null,
    coordinateSource,
    bounds: xValues.length ? { x: range(xValues), y: range(yValues) } : null,
    textualLines: decodeTextual(bytes.subarray(0, 3200)),
    binaryHeader,
    warnings,
    trailingBytes,
  };

  return {
    kind: 'segy',
    format: 'segy',
    fileName,
    size: bytes.length,
    bytes,
    endian,
    big,
    bytesPerSample,
    textualBytes: bytes.slice(0, 3200),
    binaryHeader,
    firstTrace,
    extraHeaders: sizes.extra,
    trailerBytes,
    traces: {
      count,
      headerOffset: sizes.headerOffset.subarray(0, count),
      length: sizes.length.subarray(0, count),
      extra: sizes.extra.subarray(0, count),
      samples: sizes.samples.subarray(0, count),
      interval: sizes.interval.subarray(0, count),
      inline: sizes.inline.subarray(0, count),
      crossline: sizes.crossline.subarray(0, count),
    },
    summary,
    warnings,
  };
}

export function loadSeismicFile(bytes, fileName) {
  if (bytes.length > MAX_SEISMIC_BYTES) {
    throw Error(`This file is ${formatBytes(bytes.length)}. Peforma Seismic reads ${MAX_SEISMIC_BYTES / 1048576} MB or less in the browser and will not truncate a seismic file.`);
  }
  const format = detectSeismicFormat(bytes, fileName);
  if (format === 'segy') return parseSegy(bytes, fileName);
  const text = decodeText(bytes);
  if (format === 'p190') return parseP190(text, fileName, bytes.length);
  if (format === 'p111') return parseP111(text, fileName, bytes.length);
  return parseP611(text, fileName, bytes.length);
}

export function summarizeSeismic(model) {
  return model.summary;
}

// ---------------------------------------------------------------------------
// SEG-Y write

export function writeSegy(model, { reorder = 'source' } = {}) {
  if (!model || model.kind !== 'segy') throw Error('Load a SEG-Y file before writing one.');
  const { traces } = model;
  const warnings = [];
  const order = Array.from({ length: traces.count }, (_, index) => index);
  const canReorder = traces.count > 1
    && traces.inline.some(value => value !== traces.inline[0])
    && traces.crossline.some(value => value !== traces.crossline[0]);

  if (reorder === 'inline-major') {
    if (!canReorder) {
      warnings.push('Every trace carries the same inline or crossline identifier, so the source order is kept.');
    } else {
      order.sort((a, b) => traces.inline[a] - traces.inline[b] || traces.crossline[a] - traces.crossline[b] || a - b);
      if (!model.summary.inlineMajor) warnings.push('Traces were re-sorted into inline-then-crossline order; trace headers and samples moved with their traces.');
    }
  }

  const prefixEnd = 3600 + model.summary.extendedHeaders * 3200;
  let dataBytes = 0;
  for (let index = 0; index < traces.count; index++) dataBytes += traces.length[index];
  const output = new Uint8Array(prefixEnd + dataBytes + model.trailerBytes);
  output.set(model.bytes.subarray(0, prefixEnd), 0);

  const header = model.binaryHeader.slice();
  const headerView = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const big = model.big;
  const field = offset => offset - 3200;
  const setU16 = (offset, value) => headerView.setUint16(field(offset), value, !big);
  const setI16 = (offset, value) => headerView.setInt16(field(offset), value, !big);
  const setI32 = (offset, value) => headerView.setInt32(field(offset), value, !big);
  const setU64 = (offset, value) => headerView.setBigUint64(field(offset), BigInt(value), !big);

  header[300] = 2;
  header[301] = 0;
  setU16(3502, model.summary.variableLength ? 0 : 1);
  setI16(3504, model.summary.extendedHeaders);
  setU16(3506, model.summary.maxAdditionalHeaders);
  setU16(3220, model.summary.samplesPerTrace || u16(model.bytes, 3220, big));
  setU16(3216, model.summary.sampleInterval || u16(model.bytes, 3216, big));
  header.fill(0, field(3260), field(3296));
  headerView.setUint32(field(3296), big ? 0x01020304 : 0x04030201, false);
  setU64(3512, traces.count);
  setU64(3520, prefixEnd);
  setI32(3528, model.summary.trailerRecords || 0);
  output.set(header, 3200);

  let at = prefixEnd;
  for (const index of order) {
    const from = traces.headerOffset[index];
    const length = traces.length[index];
    output.set(model.bytes.subarray(from, from + length), at);
    at += length;
  }
  if (model.trailerBytes) {
    output.set(model.bytes.subarray(model.bytes.length - model.trailerBytes), at);
    at += model.trailerBytes;
  }

  return {
    bytes: output,
    fileName: replaceExtension(model.fileName, 'segy'),
    mime: 'application/octet-stream',
    warnings,
  };
}

function replaceExtension(fileName, extension) {
  const base = fileName.replace(/\.[^.\\/]+$/, '');
  return `${base || 'peforma-seismic'}.${extension}`;
}

// ---------------------------------------------------------------------------
// P1/90

function parseP190(text, fileName, size) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const headers = [];
  const points = [];
  const receivers = [];
  const recordCounts = {};
  const warnings = [];
  let unknown = 0;
  let preamble = 0;

  for (const raw of lines) {
    if (raw.trim() === '') continue;
    const line = raw.padEnd(80, ' ');
    const id = line[0].toUpperCase();
    if (/^H\d{2}/.test(line)) {
      const type = `H${line.slice(1, 3)}`;
      const sub = line[3] || '0';
      recordCounts[type] = (recordCounts[type] || 0) + 1;
      headers.push({
        id: `${type}${sub}`,
        type,
        description: line.slice(4, 32).trim(),
        value: line.slice(32, 80).trim(),
      });
    } else if (id === 'S' || id === 'G' || id === 'Q' || id === 'A') {
      recordCounts[id] = (recordCounts[id] || 0) + 1;
      points.push(parseP190Point(line, id));
    } else if (id === 'R') {
      recordCounts.R = (recordCounts.R || 0) + 1;
      for (let group = 0; group < 3; group++) {
        const start = 1 + group * 26;
        const number = line.slice(start, start + 4).trim();
        const x = num(line.slice(start + 4, start + 13));
        const y = num(line.slice(start + 13, start + 22));
        const depth = num(line.slice(start + 22, start + 26));
        if (number === '' && x === null && y === null) continue;
        receivers.push({ group: number, x, y, depth });
      }
    } else if (id === 'C' || /^EOF/i.test(line)) {
      recordCounts[id === 'C' ? 'C' : 'EOF'] = (recordCounts[id === 'C' ? 'C' : 'EOF'] || 0) + 1;
    } else if (/^\d/.test(line) || line.trim().length < 8) {
      preamble++;
    } else {
      unknown++;
    }
  }

  if (!points.length) throw Error('This P1/90 file has no S, G, Q, or A position records.');
  if (unknown) warnings.push(`${unknown} P1/90 record${unknown === 1 ? '' : 's'} did not begin with a recognised identifier and ${unknown === 1 ? 'was' : 'were'} not carried.`);
  if (preamble) warnings.push(`${preamble} short or numeric line${preamble === 1 ? '' : 's'} before the records ${preamble === 1 ? 'was' : 'were'} ignored.`);
  if (!headers.some(header => header.type === 'H18')) warnings.push('No H18 projection record was found; the P1/90 file declares no projection.');

  const summary = navigationSummary('p190', headers, points, receivers, [], [], recordCounts, warnings);
  return {
    kind: 'navigation',
    format: 'p190',
    fileName,
    size,
    headers,
    points,
    receivers,
    bins: [],
    perimeters: [],
    recordCounts,
    warnings,
    summary,
  };
}

function parseP190Point(line, id) {
  return {
    record: id,
    line: line.slice(1, 17).trim(),
    point: line.slice(17, 25).trim(),
    lat: convertDms(line.slice(25, 27), line.slice(27, 29), line.slice(29, 34), line.slice(34, 35)),
    lon: convertDms(line.slice(35, 38), line.slice(38, 40), line.slice(40, 45), line.slice(45, 46)),
    x: num(line.slice(46, 55)),
    y: num(line.slice(55, 64)),
    depth: num(line.slice(64, 70)),
    day: num(line.slice(70, 73)),
    time: line.slice(73, 79).trim(),
  };
}

// ---------------------------------------------------------------------------
// P1/11 and P6/11

function splitRecords(text) {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim() !== '').map(line => line.split(',').map(part => part.trim()));
}

function parseP111(text, fileName, size) {
  const records = splitRecords(text);
  const headers = [];
  const points = [];
  const receivers = [];
  const recordCounts = {};
  const warnings = [];
  let ignored = 0;

  for (const parts of records) {
    const id = parts[0] || '';
    recordCounts[id] = (recordCounts[id] || 0) + 1;
    if (id === 'HC' || id === 'H1') {
      headers.push({
        id: parts.slice(0, 4).join(','),
        type: parts[0],
        description: parts[4] || '',
        value: parts.slice(5).join(', '),
        parts,
      });
    } else if (id === 'P1' || id === 'S1') {
      points.push({
        record: id,
        version: parts[1] ?? '',
        line: parts[2] ?? '',
        preplotLine: parts[3] ?? '',
        point: parts[4] ?? '',
        preplotPoint: parts[5] ?? '',
        index: parts[6] ?? '',
        time: parts[7] ?? '',
        a: [parts[12] ?? '', parts[13] ?? '', parts[14] ?? ''],
        b: [parts[15] ?? '', parts[16] ?? '', parts[17] ?? ''],
        c: [parts[18] ?? '', parts[19] ?? '', parts[20] ?? ''],
      });
    } else if (id === 'R1') {
      receivers.push({ line: parts[2] ?? '', point: parts[4] ?? '', a: [parts[12] ?? '', parts[13] ?? '', parts[14] ?? ''] });
    } else if (id === 'OGP' || id === 'CC') {
      // carried as a header line for display
      if (id === 'OGP') headers.push({ id: 'OGP', type: 'OGP', description: 'File identification', value: parts.slice(1).join(', ') });
    } else {
      ignored++;
    }
  }

  if (!points.length) throw Error('This P1/11 file has no P1 or S1 position records.');
  if (ignored) warnings.push(`${ignored} P1/11 record${ignored === 1 ? '' : 's'} of another type ${ignored === 1 ? 'was' : 'were'} not carried by this view.`);

  const summary = navigationSummary('p111', headers, points, receivers, [], [], recordCounts, warnings);
  return {
    kind: 'navigation',
    format: 'p111',
    fileName,
    size,
    headers,
    points,
    receivers,
    bins: [],
    perimeters: [],
    recordCounts,
    warnings,
    summary,
  };
}

function parseP611(text, fileName, size) {
  const records = splitRecords(text);
  const headers = [];
  const bins = [];
  const perimeters = [];
  const recordCounts = {};
  const warnings = [];
  let ignored = 0;

  for (const parts of records) {
    const id = parts[0] || '';
    recordCounts[id] = (recordCounts[id] || 0) + 1;
    if (id === 'HC' || id === 'H6') {
      headers.push({
        id: parts.slice(0, 4).join(','),
        type: parts[0],
        description: parts[4] || '',
        value: parts.slice(5).join(', '),
        parts,
      });
    } else if (id === 'B6') {
      bins.push({
        version: parts[1] ?? '',
        type: parts[2] ?? '',
        a: [parts[3] ?? '', parts[4] ?? '', parts[5] ?? ''],
        b: [parts[6] ?? '', parts[7] ?? '', parts[8] ?? ''],
      });
    } else if (id === 'M6') {
      perimeters.push({ parts: parts.slice(1) });
    } else if (id !== 'OGP' && id !== 'CC') {
      ignored++;
    }
  }

  if (!bins.length && !perimeters.length) throw Error('This P6/11 file has no B6 bin-node or M6 perimeter records.');
  if (ignored) warnings.push(`${ignored} P6/11 record${ignored === 1 ? '' : 's'} of another type ${ignored === 1 ? 'was' : 'were'} not carried by this view.`);

  const summary = navigationSummary('p611', headers, [], [], bins, perimeters, recordCounts, warnings);
  return {
    kind: 'navigation',
    format: 'p611',
    fileName,
    size,
    headers,
    points: [],
    receivers: [],
    bins,
    perimeters,
    recordCounts,
    warnings,
    summary,
  };
}

function navCrs(format, headers) {
  if (format === 'p190') {
    const value = type => headers.find(header => header.type === type)?.value || '';
    return {
      projection: value('H18'),
      zone: value('H19'),
      datum: value('H14'),
      spheroid: value('H12'),
      units: value('H20'),
      vertical: value('H17'),
    };
  }
  const record = headers.find(header => header.id === 'HC,1,3,0');
  const parts = record?.parts || [];
  return {
    epsg: parts[6] || '',
    name: parts[7] || '',
    source: parts[10] || '',
  };
}

function navigationSummary(format, headers, points, receivers, bins, perimeters, recordCounts, warnings) {
  const numeric = values => range(values.map(value => num(value)).filter(value => value !== null));
  const pointNumbers = points.map(point => num(point.point)).filter(value => value !== null);
  const binsA = bins.length ? range(bins.flatMap(bin => [num(bin.a[0]), num(bin.a[1])]).filter(value => value !== null)) : null;
  const binsB = bins.length ? range(bins.flatMap(bin => [num(bin.b[0]), num(bin.b[1])]).filter(value => value !== null)) : null;
  return {
    formatLabel: SEISMIC_SOURCE_LABELS[format],
    headerCount: headers.length,
    pointCount: points.length,
    receiverCount: receivers.length,
    binCount: bins.length,
    perimeterCount: perimeters.length,
    recordCounts,
    lineNames: [...new Set(points.map(point => point.line).filter(Boolean))].slice(0, 24),
    lineCount: new Set(points.map(point => point.line).filter(Boolean)).size,
    pointRange: range(pointNumbers),
    numericBounds: numeric(points.flatMap(point => [point.x, point.y])),
    latBounds: numeric(points.flatMap(point => (
      point.lat === undefined ? [num(point.b?.[0]), num(point.b?.[1])] : [point.lat, point.lon]
    ))),
    binsA,
    binsB,
    crs: navCrs(format, headers),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Navigation write

export function writeNavigation(model, target) {
  if (!model || model.kind !== 'navigation') throw Error('Load a navigation file before writing one.');
  if (target === 'csv') return writeNavCsv(model);
  if (target === 'p111') return writeP111(model);
  if (target === 'p190') return writeP190(model);
  throw Error(`Unknown navigation target ${target}.`);
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeNavCsv(model) {
  const rows = [];
  if (model.format === 'p611') {
    rows.push(['record', 'crs1_1', 'crs1_2', 'crs1_3', 'crs2_1', 'crs2_2', 'crs2_3']);
    for (const bin of model.bins) rows.push(['B6', ...bin.a, ...bin.b]);
    for (const perimeter of model.perimeters) rows.push(['M6', ...perimeter.parts]);
  } else if (model.format === 'p111') {
    rows.push(['record', 'line', 'preplot_line', 'point', 'preplot_point', 'time', 'crs_a_1', 'crs_a_2', 'crs_a_3', 'crs_b_1', 'crs_b_2', 'crs_b_3']);
    for (const point of model.points) rows.push([point.record, point.line, point.preplotLine, point.point, point.preplotPoint, point.time, ...point.a, ...point.b]);
  } else {
    rows.push(['record', 'line', 'point', 'latitude', 'longitude', 'easting', 'northing', 'water_depth', 'day_of_year', 'time']);
    for (const point of model.points) rows.push([point.record, point.line, point.point, point.lat, point.lon, point.x, point.y, point.depth, point.day, point.time]);
  }
  return {
    text: `${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`,
    fileName: replaceExtension(model.fileName, 'csv'),
    mime: 'text/csv',
    warnings: [],
  };
}

function writeP111(model) {
  if (model.format === 'p611') throw Error('A P6/11 bin grid converts to CSV. P1/11 carries position records, not bin nodes.');
  const points = model.format === 'p111' ? model.points : model.points.filter(point => point.record === 'S');
  const coordinate = point => {
    if (model.format === 'p111') {
      const a = point.a || ['', '', ''];
      const b = point.b && point.b.some(value => value !== '') ? point.b : a;
      return { a, b };
    }
    const lat = pointLatitude(point);
    const lon = pointLongitude(point);
    const value = [lat === null ? '' : lat.toFixed(8), lon === null ? '' : lon.toFixed(8), ''];
    return { a: value, b: value };
  };
  const usable = points.filter(point => {
    const { a, b } = coordinate(point);
    return (num(a[0]) !== null && num(a[1]) !== null) || (num(b[0]) !== null && num(b[1]) !== null);
  });
  if (!usable.length) {
    throw Error('This file has no latitude/longitude positions, so a P1/11 file cannot be built without inventing a CRS. Convert to CSV to keep the grid coordinates.');
  }
  const warnings = [];
  if (usable.length !== model.points.length) {
    warnings.push(`${(model.points.length - usable.length).toLocaleString()} record${model.points.length - usable.length === 1 ? '' : 's'} without a latitude/longitude pair ${model.points.length - usable.length === 1 ? 'was' : 'were'} not written. Use CSV to keep every record.`);
  }
  if (model.receivers.length) warnings.push(`${model.receivers.length.toLocaleString()} receiver record${model.receivers.length === 1 ? '' : 's'} are not carried into P1/11.`);
  if (model.points.some(point => point.x !== null && point.x !== undefined && point.x !== '')) {
    warnings.push('P1/90 grid easting and northing are not carried into P1/11; the geographic position is carried and the grid values remain available in CSV.');
  }
  warnings.push('Peforma writes CRS A and CRS B as WGS 84 geographic 2D (EPSG 4326). No source coordinate is reprojected.');

  const lats = usable.map(pointLatitude);
  const lons = usable.map(pointLongitude);
  const [south, north] = range(lats) || [0, 0];
  const [west, east] = range(lons) || [0, 0];
  const now = new Date();
  const date = `${now.getUTCFullYear()}:${String(now.getUTCMonth() + 1).padStart(2, '0')}:${String(now.getUTCDate()).padStart(2, '0')}`;
  const clock = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}`;
  const name = replaceExtension(model.fileName, 'p111').replace(/\.[^.]+$/, '');
  const lines = [
    `OGP,OGP P1,1,1.1,1,${date},${clock},${name}.p111,Peforma`,
    `HC,0,1,0,Project Name...,${name},${name},,,`,
    'HC,0,2,0,Survey Description...,Converted position data,,,,',
    `HC,0,3,0,Geographic Extent...,${west.toFixed(6)},${east.toFixed(6)},${south.toFixed(6)},${north.toFixed(6)}`,
    'HC,0,4,0,Client...,,',
    'HC,0,5,0,Geophysical Contractor...,,',
    'HC,0,6,0,Positioning Contractor...,,',
    'HC,0,7,0,Position Processing Contractor...,,',
    'HC,1,0,0,Reference Systems Summary...,4,0,1,0',
    'HC,1,1,0,Unit of Measure...,1,metre,length,2,,,,,,SI base unit of length,9001,EPSG Dataset,7.6,9001',
    'HC,1,1,0,Unit of Measure...,2,radian,angle,2,,,,,,SI angular measure unit,9101,EPSG Dataset,7.6,9101',
    'HC,1,1,0,Unit of Measure...,3,degree,angle,2,2,0,3.141592654,180,0,Measure of plane angle,9102,EPSG Dataset,7.6,9102',
    'HC,1,1,0,Unit of Measure...,4,unity,scale,2,,,,,,For unitless entities,9201,EPSG Dataset,7.6,9201',
    'HC,1,3,0,CRS Number/EPSG Code/Name/Source...,1,4326,WGS 84,7.6,2010:11:02,EPSG,',
    'HC,1,4,0,CRS Number/EPSG Code/Type/Name...,1,4326,2,geographic 2D,WGS 84',
    'HC,1,4,4,Geodetic Datum...,1,6326,World Geodetic System 1984,1984:01:01',
    'HC,1,4,6,Ellipsoid...,1,7030,WGS 84,6378137,1,metre,298.257223563',
    'HC,1,6,0,Coordinate System...,1,6402,Ellipsoidal 2D CS,3,Ellipsoidal,2',
    'HC,1,6,1,Coordinate System Axis 1...,1,1,1,Geodetic latitude,north,N,3,degree',
    'HC,1,6,1,Coordinate System Axis 2...,1,2,2,Geodetic longitude,east,E,3,degree',
    'H1,1,0,0,Position Record Type Definition...,1,1,1,,,1,0,',
  ];
  for (const point of usable) {
    const { a, b } = coordinate(point);
    const line = point.line || '';
    const number = point.point || '';
    const time = timeForP111(point.time);
    lines.push([
      'P1', '0', csvCell(line), '', csvCell(number), '', '1', time, '1', 'P1', '1', '',
      ...a, ...b, '', '', '', '', '', '', '', '', '', '',
    ].join(','));
  }
  return {
    text: `${lines.join('\r\n')}\r\n`,
    fileName: replaceExtension(model.fileName, 'p111'),
    mime: 'text/plain',
    warnings,
  };
}

function pointLatitude(point) {
  const value = point.record === 'S' || point.record === 'G' || point.record === 'Q' || point.record === 'A' || point.record === undefined
    ? point.lat
    : num(point.b?.[0]);
  return value === null || value === undefined || value === '' ? null : num(value);
}

function pointLongitude(point) {
  const value = point.record === 'S' || point.record === 'G' || point.record === 'Q' || point.record === 'A' || point.record === undefined
    ? point.lon
    : num(point.b?.[1]);
  return value === null || value === undefined || value === '' ? null : num(value);
}

function timeForP111(time) {
  const text = String(time || '').trim();
  if (/^\d{4}:\d{3}:\d{2}:\d{2}:\d{2}/.test(text)) return text;
  return '';
}

function writeP190(model) {
  const points = model.format === 'p190' ? model.points : model.points.filter(point => point.record === 'P1' || point.record === 'S1');
  if (!points.length) throw Error('This file has no position record that P1/90 can carry.');
  const warnings = [];
  if (model.format === 'p111') {
    warnings.push('P1/90 is an 80-column format. Projection, datum, spheroid, and vertical-datum records are written as N/A because the source did not declare values that can be copied into those columns.');
    warnings.push('Degree-minute-second fields are written from the source coordinates; no coordinate is reprojected.');
  }
  if (model.receivers.length) warnings.push(`${model.receivers.length.toLocaleString()} receiver record${model.receivers.length === 1 ? '' : 's'} are not carried into P1/90.`);

  const lines = [];
  const header = (type, description, value, sub = '0') => `H${type}${sub}${description.padEnd(28, ' ').slice(0, 28)}${String(value).padEnd(48, ' ').slice(0, 48)}`;
  const date = new Date();
  const stamp = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  lines.push(header('01', 'DESCRIPTION OF SURVEY AREA', model.fileName));
  lines.push(header('02', 'DATE OF SURVEY', stamp));
  lines.push(header('02', 'DATE OF ISSUE OF POST-PLOT TAPE', stamp, '1'));
  lines.push(header('02', 'TAPE VERSION IDENTIFIER', 'PEFORMA SEISMIC', '2'));
  lines.push(header('03', 'DETAILS OF CLIENT', 'N/A'));
  lines.push(header('04', 'DETAILS OF GEOPHYSICAL CONTRACTOR', 'N/A'));
  lines.push(header('05', 'DETAILS OF POSITIONING CONTRACTOR', 'N/A'));
  lines.push(header('06', 'DETAILS OF POSITIONING PROCESSING CONTRACTOR', 'N/A'));
  lines.push(header('07', 'POSITIONING AND COMPUTER SYSTEMS', 'PEFORMA SEISMIC'));
  lines.push(header('08', 'COORDINATE LOCATION', 'N/A'));
  lines.push(header('09', 'OFFSETS FROM SHIP SYSTEM POSITION', 'N/A'));
  lines.push(header('10', 'CLOCK TIME IN RESPECT OF GMT', 'GMT +0'));
  lines.push(header('11', 'RECEIVER GROUPS PER SHOT', 'N/A'));
  lines.push(header('12', 'SPHEROID DEFINITION', 'N/A'));
  lines.push(header('13', 'SPHEROID DEFINITION FOR POST PLOT', 'N/A'));
  lines.push(header('14', 'GEODETIC DATUM', 'N/A'));
  lines.push(header('15', 'GEODETIC DATUM FOR POST PLOT', 'N/A'));
  lines.push(header('16', 'DATUM TRANSFORMATION PARAMETERS', 'N/A'));
  lines.push(header('17', 'VERTICAL DATUM FOR WATER DEPTHS', 'N/A'));
  lines.push(header('18', 'PROJECTION TYPE', 'N/A'));
  lines.push(header('19', 'PROJECTION ZONE', 'N/A'));
  lines.push(header('20', 'DESCRIPTION OF GRID UNITS', 'N/A'));
  lines.push(header('26', 'ANY OTHER RELEVANT INFORMATION', `CONVERTED FROM ${SEISMIC_SOURCE_LABELS[model.format]} BY PEFORMA SEISMIC`));

  if (model.format === 'p111') {
    warnings.push('P1/11 coordinates are written to the latitude and longitude columns. Easting and northing are left blank because the source does not declare that CRS A is a projected grid.');
  }
  for (const point of points) {
    lines.push(p190Point({
      record: model.format === 'p190' ? point.record : 'S',
      line: point.line || '',
      point: point.point || '',
      lat: pointLatitude(point),
      lon: pointLongitude(point),
      x: model.format === 'p190' ? point.x : null,
      y: model.format === 'p190' ? point.y : null,
      depth: point.depth ?? null,
      day: point.day ?? null,
      time: normalizeClock(point.time),
    }));
  }
  lines.push('EOF'.padEnd(80, ' '));
  return {
    text: `${lines.join('\r\n')}\r\n`,
    fileName: replaceExtension(model.fileName, 'p190'),
    mime: 'text/plain',
    warnings,
  };
}

function p190Point({ record = 'S', line, point, lat, lon, x, y, depth, day, time }) {
  const text = [
    ['S', 'G', 'Q', 'A'].includes(record) ? record : 'S',
    String(line).slice(0, 16).padEnd(16, ' '),
    String(point).slice(0, 8).padStart(8, ' '),
    formatDms(lat, 2, 'NS'),
    formatDms(lon, 3, 'EW'),
    formatFixed(x, 9, 1),
    formatFixed(y, 9, 1),
    formatFixed(depth, 6, 1),
    formatInteger(day, 3),
    String(time || '').slice(0, 6).padStart(6, ' '),
    ' ',
  ].join('');
  return text.padEnd(80, ' ').slice(0, 80);
}

function formatDms(value, degreeWidth, hemispheres) {
  if (value === null || value === undefined || !Number.isFinite(value)) return ' '.repeat(degreeWidth + 8);
  const absolute = Math.abs(value);
  let degrees = Math.floor(absolute);
  let minutes = Math.floor((absolute - degrees) * 60);
  let seconds = ((absolute - degrees) * 60 - minutes) * 60;
  if (seconds >= 59.995) {
    seconds = 0;
    minutes += 1;
    if (minutes >= 60) {
      minutes = 0;
      degrees += 1;
    }
  }
  const hemisphere = value < 0 ? hemispheres[1] : hemispheres[0];
  return `${String(degrees).padStart(degreeWidth, ' ')}${String(minutes).padStart(2, ' ')}${seconds.toFixed(2).padStart(5, ' ')}${hemisphere}`;
}

function formatFixed(value, width, decimals) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return ' '.repeat(width);
  const text = Number(value).toFixed(decimals);
  return text.length > width ? text.slice(-width) : text.padStart(width, ' ');
}

function formatInteger(value, width) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return ' '.repeat(width);
  return String(Math.trunc(Number(value))).padStart(width, ' ').slice(-width);
}

function normalizeClock(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  return digits.slice(0, 6);
}
