import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownToLine, ArrowLeftRight, AudioWaveform, BookOpen, Box, Check, ChevronDown, FileSpreadsheet, FileText, FileUp, Files, Globe2, Grid3x3, Layers3, Menu, PanelLeftClose, PanelLeftOpen, Pentagon, RotateCcw, Ruler, ShieldCheck, TriangleAlert, Info, Waypoints, X } from 'lucide-react';
import VERSION from '../VERSION?raw';
import UnitConverter from './UnitConverter.jsx';
import LinePoints from './LinePoints.jsx';
import Polygon from './Polygon.jsx';
import Shapefile from './Shapefile.jsx';
import Mesh3D from './Mesh3D.jsx';
import Seismic from './Seismic.jsx';
import Docs from './Docs.jsx';
import Landing from './Landing.jsx';
import { Wordmark, ThemeToggle, AppFooter } from './chrome.jsx';
import { applyTheme, readThemePreference, resolveTheme, THEME_KEY } from './theme.js';
import './style.css';
// Loaded after style.css so landing paddings win ties against shared .shell rules.
import './landing.css';

const FORMATS = {
  cps3: 'CPS-3 grid (ASCII)', earthvision: 'EarthVision grid (ASCII)', irap: 'IRAP Classic grid (ASCII)', zmap: 'ZMAP+ grid (ASCII)'
};
const NULLS = { cps3: 1e30, irap: 9999900, zmap: 1e30, earthvision: 1e31 };
// Product-family navigation. Only the grid suite is live; the rest are labelled
// placeholders so the rail never offers a link that does nothing.
const SUITES = [
  { key: 'grid', name: 'Peforma Horizon/Grid', tool: 'Time-Horizon/Depth-Grid', href: '#grid', icon: Grid3x3, live: true },
  {
    key: 'culture', name: 'Peforma Culture', icon: Waypoints,
    children: [
      { key: 'culture', name: 'Lines/Points/Fault-sticks', href: '#culture', live: true },
      { key: 'culture-polygon', name: 'Polygon', href: '#culture-polygon', live: true },
    ],
  },
  { key: 'shapefile', name: 'Peforma Shapefile', tool: 'Shapefile bundle', href: '#shapefile', icon: Files, live: true },
  {
    key: '3d', name: 'Peforma 3D', icon: Box,
    children: [
      { key: '3d-surfaces', name: 'Fault planes & horizons', href: '#3d-surfaces', live: true },
      { key: '3d-solids', name: 'Geobodies & solids', href: '#3d-solids', live: true },
    ],
  },
  {
    key: 'seismic', name: 'Peforma Seismic', icon: AudioWaveform,
    children: [
      { key: 'seismic-navigation', name: 'Navigation', href: '#seismic-navigation', live: true },
      { key: 'seismic-2d', name: '2D lines', href: '#seismic-2d', live: true },
      { key: 'seismic-3d', name: '3D cube', href: '#seismic-3d', live: true },
    ],
  },
  { key: 'coordinates', name: 'Peforma Coordinates', icon: Globe2, reference: true },
  { key: 'units', name: 'Peforma Units', tool: 'Unit converter', href: '#units', icon: Ruler, reference: true, live: true },
];
const SUITE_GROUPS = [
  { label: 'Data converters', items: SUITES.filter(s => !s.reference) },
  { label: 'Reference', items: SUITES.filter(s => s.reference) },
];
// True only for tokens that are actually numeric; empty/whitespace strings coerce to 0
// and must not be treated as valid header or grid values.
const number = x => typeof x === 'string' ? x.trim() !== '' && Number.isFinite(Number(x)) : Number.isFinite(x);
const splitRows = s => s.replace(/^\uFEFF/, '').split(/\r?\n/);
function gridOf(meta, values, source, name) {
  const { nx, ny, xmin, xmax, ymin, ymax, dx, dy, nodata = NULLS[source] ?? -99999, units = '', projection = '' } = meta;
  if (![nx,ny,xmin,xmax,ymin,ymax].every(number) || nx < 2 || ny < 2 || !Number.isInteger(nx) || !Number.isInteger(ny)) throw Error('Grid header has invalid dimensions or coordinate bounds.');
  if (values.length !== nx * ny) throw Error(`Grid header describes ${nx * ny} nodes but ${values.length} values were found.`);
  return { nx,ny,xmin,xmax,ymin,ymax,dx:dx ?? (xmax-xmin)/(nx-1),dy:dy ?? (ymax-ymin)/(ny-1),nodata,values,source,name,units,projection };
}
// CPS-3 and ZMAP+ list nodes column by column from the north-west corner (ymax)
// toward the south. Convert that order to the internal row-major, ymin-first grid,
// and back again for writing.
function fromColumnMajor(flat, nx, ny) {
  if (flat.length !== nx * ny) return flat;
  const values = new Array(flat.length);
  for (let i = 0; i < flat.length; i++) {
    const column = Math.floor(i / ny), row = ny - 1 - (i % ny);
    values[row * nx + column] = flat[i];
  }
  return values;
}
function toColumnMajor(values, nx, ny) {
  const flat = [];
  for (let column = 0; column < nx; column++)
    for (let row = ny - 1; row >= 0; row--) flat.push(values[row * nx + column]);
  return flat;
}
function parseEarthvision(text, name) {
  const lines=splitRows(text), get=k=>lines.find(x=>x.trim().toLowerCase().startsWith(`# ${k.toLowerCase()}:`))?.split(':').slice(1).join(':').trim();
  const size=get('Grid_size')?.match(/(\d+)\s*x\s*(\d+)/i), space=get('Grid_space')?.split(/[ ,]+/).map(Number), fields=lines.filter(x=>/^#\s*Field:/i.test(x)).map(x=>x.split(':').slice(1).join(':').trim().toLowerCase());
  // Field records carry an optional unit suffix (e.g. "3 z feet"), so match on the
  // leading field number and name rather than the whole string.
  const hasField = (num, name) => fields.some(f => new RegExp(`^${num}\\s+${name}(\\s|$)`).test(f));
  if (!size || !space || space.length<4 || !hasField(1,'x') || !hasField(2,'y') || !hasField(3,'z')) throw Error('Unsupported EarthVision ASCII variant. Expected scattered-data header with Grid_size, Grid_space and x/y/z fields.');
  const [nx,ny]=size.slice(1).map(Number), [xmin,xmax,ymin,ymax]=space;
  const ix=fields.findIndex(x=>/^4\s+column/.test(x)), iy=fields.findIndex(x=>/^5\s+row/.test(x));
  if(ix<0||iy<0) throw Error('EarthVision grid is missing column/row indices; safe node ordering cannot be established.');
  const values=Array(nx*ny).fill(NULLS.earthvision), seen=new Uint8Array(nx*ny); let records=0;
  for(const line of lines){if(!line.trim()||line.trim().startsWith('#'))continue;const a=line.trim().split(/[\s,]+/).map(Number);if(a.length<5||!a.every(Number.isFinite))continue;
    // EarthVision field order: X,Y,Z,column,row. Indices in the supplied export start at 1.
    const col=a[3]-1,row=a[4]-1;if(col<0||col>=nx||row<0||row>=ny)throw Error(`EarthVision node index ${a[3]},${a[4]} is outside the declared grid.`);
    const idx=row*nx+col;if(seen[idx])throw Error('EarthVision input contains duplicate node indices.');seen[idx]=1;values[idx]=a[2];records++;
  }
  if(!records)throw Error('No EarthVision node records were found.');
  return gridOf({nx,ny,xmin,xmax,ymin,ymax,dx:space[4],dy:space[5],nodata:NULLS.earthvision,units:get('Z_units')||'',projection:get('Projection')||''},values,'earthvision',name);
}
// Returns the whitespace-split tokens of the first line whose trimmed text starts with `prefix`.
function readHeaderRecord(lines, prefix) {
  const line = lines.find(x => x.trim().startsWith(prefix));
  return line ? line.trim().split(/\s+/) : undefined;
}

function parseCps3(text, name) {
  const lines = splitRows(text);
  const limits = readHeaderRecord(lines, 'FSLIMI');
  const size = readHeaderRecord(lines, 'FSNROW');
  const increment = readHeaderRecord(lines, 'FSXINC');
  if (!limits || !size || !increment) throw Error('Unsupported CPS-3 ASCII grid; expected FSASCI, FSLIMI, FSNROW and FSXINC records.');

  const ny = Number(size[1]);
  const nx = Number(size[2]);
  const raw = [];
  let started = false;
  for (const line of lines) {
    const s = line.trim();
    if (!started) {
      if (s.startsWith('->MSMODL:')) started = true;
      continue;
    }
    if (!s) continue;
    for (const token of s.split(/\s+/)) if (number(token)) raw.push(Number(token));
  }

  // The FSASCI record carries the null sentinel as its last token; fall back to the
  // documented CPS-3 default when that token is missing or not a finite number.
  const declaredNull = Number(lines[0].trim().split(/\s+/).at(-1));
  const nodata = Number.isFinite(declaredNull) ? declaredNull : NULLS.cps3;
  return gridOf({
    nx, ny,
    xmin: Number(limits[1]), xmax: Number(limits[2]),
    ymin: Number(limits[3]), ymax: Number(limits[4]),
    dx: Number(increment[1]), dy: Number(increment[2]),
    nodata,
  }, fromColumnMajor(raw, nx, ny), 'cps3', name);
}

function parseIrap(text, name) {
  const lines = splitRows(text).filter(x => x.trim());
  const header = lines.slice(0, 4).map(x => x.trim().split(/\s+/).map(Number));
  if (header[0]?.[0] !== -996 || header.length < 4) throw Error('Unsupported IRAP Classic ASCII variant; expected the classic -996 header.');

  const [first, bounds, dims] = header;
  const ny = first[1], dx = first[2], dy = first[3];
  const xmin = bounds[0], xmax = bounds[1], ymin = bounds[2], ymax = bounds[3];
  const nx = dims[0];
  const headerNumbers = [nx, ny, dx, dy, xmin, xmax, ymin, ymax];
  if (!headerNumbers.every(Number.isFinite) || !Number.isInteger(nx) || !Number.isInteger(ny) || nx < 1 || ny < 1) {
    throw Error('IRAP Classic header has non-numeric or invalid dimensions, increments, or coordinate bounds.');
  }
  const nodata = NULLS.irap;
  const values = lines.slice(4)
    .flatMap(x => x.trim().split(/\s+/).map(Number))
    .filter(Number.isFinite);

  return gridOf({ nx, ny, xmin, xmax, ymin, ymax, dx, dy, nodata }, values, 'irap', name);
}

function parseZmap(text, name) {
  const lines = splitRows(text);
  const start = lines.findIndex(x => x.trim().startsWith('@'));
  const end = start < 0 ? -1 : lines.findIndex((x, i) => i > start && x.trim() === '@');
  if (start < 0 || end < 0) throw Error('ZMAP+ header not found. Expected @ header, metadata records, and closing @.');

  const header = lines.slice(start, end).map(x =>
    x.trim().replace(/^@|@$/g, '').split(',').map(y => y.trim())
  );
  if (!/GRID/i.test(header[0]?.[1] || '')) throw Error('The @ record does not identify a ZMAP+ GRID.');

  const dimsIndex = header.findIndex(a => a.length >= 6 && a.slice(0, 2).every(number));
  const dims = header[dimsIndex];
  const control = header.find((a, i) => i < dimsIndex && a.length >= 2 && number(a[0]) && number(a[1]) && a.length <= 5);
  if (!dims || !control) throw Error('ZMAP+ dimensions or null-value header record is missing.');

  const [first, second] = dims.slice(0, 2).map(Number);
  const xmin = Number(dims[2]), xmax = Number(dims[3]);
  const ymin = Number(dims[4]), ymax = Number(dims[5]);
  // The record after the dimensions carries rotation and the declared increments.
  const increment = header.find((a, i) => i > dimsIndex && a.length >= 3 && a.slice(1, 3).every(number));
  const xinc = increment ? Number(increment[1]) : 0;
  const yinc = increment ? Number(increment[2]) : 0;
  // Real ZIMS/Kingdom exports declare rows then columns, while the ZMAP+ record is
  // often described as columns then rows. Resolve the orientation from the coordinate
  // span and the declared increments instead of trusting either order.
  let nx = first, ny = second;
  if (xinc > 0 && yinc > 0) {
    const columns = (xmax - xmin) / xinc, rows = (ymax - ymin) / yinc;
    const declared = Math.abs(columns - (first - 1)) + Math.abs(rows - (second - 1));
    const swapped = Math.abs(columns - (second - 1)) + Math.abs(rows - (first - 1));
    if (swapped < declared) { nx = second; ny = first; }
  }
  if (!Number.isInteger(nx) || !Number.isInteger(ny) || nx < 1 || ny < 1) throw Error('ZMAP+ header has invalid dimensions.');
  const nodata = Number(control[1]);
  if (!Number.isFinite(nodata)) throw Error('ZMAP+ null-value header record is not numeric.');
  const raw = lines.slice(end + 1)
    .flatMap(x => x.trim().split(/[\s,]+/).filter(Boolean).map(Number))
    .filter(Number.isFinite);

  return gridOf({ nx, ny, xmin, xmax, ymin, ymax, dx: xinc > 0 ? xinc : undefined, dy: yinc > 0 ? yinc : undefined, nodata }, fromColumnMajor(raw, nx, ny), 'zmap', name);
}
// Single-pass min/max over values, skipping nulls. Avoids Math.min(...values), which
// throws RangeError once a grid has more nodes than the engine's argument limit.
function valueRange(values, nodata) {
  let min = Infinity, max = -Infinity, count = 0;
  for (const v of values) {
    if (v === nodata || !Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
    count++;
  }
  return count ? { min, max, count } : { min: 0, max: 0, count: 0 };
}
// Identifies an ASCII grid purely from its contents. The file extension is never used:
// a grid renamed to .txt, .dat or anything else is still recognised.
function detect(text){if(/^FSASCI\b/m.test(text))return'cps3';if(/^# Type: scattered data/m.test(text))return'earthvision';if(/^\s*-996\s/m.test(text))return'irap';if(/^\s*@.*?,\s*GRID\s*,/m.test(text))return'zmap';return null;}
// Formats a value for ASCII output, substituting the target format's null sentinel.
function formatValue(v, nodata, nullValue) {
  if (v === nodata) return nullValue;
  return Number(v).toPrecision(10).replace(/\.0+$/, '');
}
// Renders a flat value list as space-separated lines, mapping nulls to the target sentinel.
function formatFlat(values, nodata, nullValue, perLine) {
  const tokens = values.map(v => formatValue(v, nodata, nullValue));
  const lines = [];
  for (let i = 0; i < tokens.length; i += perLine) lines.push(tokens.slice(i, i + perLine).join(' '));
  return lines.join('\n');
}
function exportGrid(g, fmt) {
  const { nx, ny, values } = g;
  if (fmt === 'zmap') {
    // Matches the ZIMS/Kingdom layout: rows then columns, real increments after the
    // rotation, and nodes ordered column by column from the north-west corner.
    return `! Peforma Horizon/Grid ZMAP+ ASCII
! Converted with Peforma toolbox of Alfazen Inc.
@GRID FILE, GRID, 10
15, 0.1000000E+31, , 7, 1
${ny}, ${nx}, ${g.xmin}, ${g.xmax}, ${g.ymin}, ${g.ymax}
0.0, ${g.dx}, ${g.dy}
@
${formatFlat(toColumnMajor(values, nx, ny), g.nodata, '0.1000000E+31', nx)}
`;
  }
  if (fmt === 'irap') {
    return `-996 ${ny} ${g.dx} ${g.dy}
${g.xmin} ${g.xmax} ${g.ymin} ${g.ymax}
${nx} 0.000000 ${g.xmin} ${g.ymin}
0 0 0 0 0 0 0
${formatFlat(values, g.nodata, '9999900.000000', nx)}
! Converted with Peforma toolbox of Alfazen Inc.
`;
  }
  if (fmt === 'cps3') {
    const range = valueRange(values, g.nodata);
    return `FSASCI 0 1 COMPUTED 0 0.1E+31
FSATTR 0 0
FSLIMI ${g.xmin} ${g.xmax} ${g.ymin} ${g.ymax} ${range.min} ${range.max}
FSNROW ${ny} ${nx}
FSXINC ${g.dx} ${g.dy}
->MSMODL: Converted grid
${formatFlat(toColumnMajor(values, nx, ny), g.nodata, '0.1E+31', nx)}
! Converted with Peforma toolbox of Alfazen Inc.
`;
  }
  if (fmt === 'earthvision') {
    const out = [`# Type: scattered data`, `# Version: 6`, `# Description: Converted by Peforma Horizon/Grid\n# Converted with Peforma toolbox of Alfazen Inc.`, `# Format: free`, `# Field: 1 x`, `# Field: 2 y`, `# Field: 3 z ${g.units || 'unknown'}`, `# Field: 4 column`, `# Field: 5 row`, `# Projection: ${g.projection || 'Unknown'}`, `# Units: Unknown`, `# End:`, `# Information from grid:`, `# Grid_size: ${nx} x ${ny}`, `# Grid_space: ${g.xmin},${g.xmax},${g.ymin},${g.ymax}`, `# Z_units: ${g.units || 'unknown'}`];
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
      const v = values[r * nx + c];
      if (v !== g.nodata) out.push(`${(g.xmin + c * g.dx).toFixed(6)} ${(g.ymin + r * g.dy).toFixed(6)} ${Number(v).toPrecision(10)} ${c + 1} ${r + 1}`);
    }
    return out.join('\n') + '\n';
  }
  throw Error('Unsupported output format.');
}
function useGridFile() {
  const [grid, setGrid] = useState(null);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');
  const [format, setFormat] = useState('zmap');
  const input = useRef(null);

  const load = useCallback(async files => {
    if (!files?.length) return;
    setError('');
    setGrid(null);
    try {
      const fs = [...files];
      // Try each selected file in turn and use the first one whose contents are a
      // recognised grid, so the extension never decides whether a file is accepted.
      let text = '', fmt = null, file = null;
      for (const candidate of fs) {
        const candidateText = await candidate.text();
        const candidateFmt = detect(candidateText);
        if (candidateFmt) { text = candidateText; fmt = candidateFmt; file = candidate; break; }
      }
      if (!fmt) throw Error('Could not identify the source format from its contents. Select a supported CPS-3, EarthVision, IRAP Classic, or ZMAP+ ASCII grid.');
      const g = fmt === 'cps3' ? parseCps3(text, file.name)
        : fmt === 'irap' ? parseIrap(text, file.name)
        : fmt === 'zmap' ? parseZmap(text, file.name)
        : parseEarthvision(text, file.name);
      setGrid(g);
      setSource(fmt);
      setFormat(fmt === 'zmap' ? 'irap' : 'zmap');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const download = () => {
    if (!grid) return;
    let data;
    try {
      data = exportGrid(grid, format);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${grid.name.replace(/\.[^.]+$/, '')}.${format}.grid`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const reset = () => {
    setGrid(null);
    setError('');
    setSource('');
    if (input.current) input.current.value = '';
  };

  return { grid, error, source, format, setFormat, input, load, download, reset };
}

function UploadPanel({ grid, error, source, drag, setDrag, input, load, reset }) {
  const values = grid?.values || [];
  const range = valueRange(values, grid?.nodata);
  return (
    <>
      <div className="panel-heading">
        <div>
          <div className="section-kicker">01 <span>·</span> SOURCE DATA</div>
          <h2>Bring in your file</h2>
        </div>
        {grid && <button className="reset" onClick={reset}><RotateCcw size={14} /> Start over</button>}
      </div>
      <label
        className={`dropzone ${drag ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files); }}
      >
        <input ref={input} type="file" multiple aria-label="Choose a grid file" onChange={e => load(e.target.files)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); input.current?.click(); } }} />
        <span className="upload-icon"><FileUp size={23} /></span>
        <strong>Drop a grid file here</strong>
        <span className="drop-sub">or <span className="browse">browse files</span> from your computer</span>
        <span className="file-hint">CPS-3 · EARTHVISION · IRAP · ZMAP+</span>
      </label>
      {grid && <GridSummary grid={grid} source={source} range={range} />}
      {error && <div className="error"><TriangleAlert size={17} /><span>{error}</span></div>}
    </>
  );
}

function GridSummary({ grid, source, range }) {
  const values = grid.values;
  return (
    <div className="loaded">
      <div className="loaded-file">
        <span className="file-icon"><FileSpreadsheet size={19} /></span>
        <div><b>{grid.name}</b><small>{FORMATS[source]} · Ready to convert</small></div>
        <span className="ready"><Check size={13} /> READY</span>
      </div>
      <div className="stats">
        <div><small>GRID SIZE</small><b>{grid.nx} <i>×</i> {grid.ny}</b><span>{(grid.nx * grid.ny).toLocaleString()} nodes</span></div>
        <div><small>X RANGE</small><b>{grid.xmin} — {grid.xmax}</b><span>Δ {grid.dx}</span></div>
        <div><small>Y RANGE</small><b>{grid.ymin} — {grid.ymax}</b><span>Δ {grid.dy}</span></div>
        <div><small>VALUE RANGE</small><b>{range.min.toFixed(2)} — {range.max.toFixed(2)}</b><span>{(values.length - range.count).toLocaleString()} null nodes</span></div>
      </div>
    </div>
  );
}

function ExportPanel({ grid, format, setFormat, download }) {
  const values = grid?.values || [];
  // Preview the first real values rather than the leading nulls, which many grids
  // (EarthVision exports in particular) start with and which say nothing useful.
  const preview = grid ? values.filter(v => v !== grid.nodata).slice(0, 12) : [];
  return (
    <>
      <div className="convert-row">
        <div>
          <div className="section-kicker">02 <span>·</span> OUTPUT FORMAT</div>
          <h2>Choose where it’s going</h2>
        </div>
        <div className="format-select">
          <select value={format} onChange={e => setFormat(e.target.value)} aria-label="Output format">
            {Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <ChevronDown size={16} />
        </div>
      </div>
      {grid && (
        <div className="preview">
          <div className="preview-head"><span>VALUE PREVIEW</span><span>First {preview.length} of {values.length.toLocaleString()} nodes</span></div>
          <div className="preview-values">
            {preview.length
              ? preview.map((v, i) => <span key={i}>{v.toFixed(2)}</span>)
              : <span className="null">No non-null values</span>}
          </div>
        </div>
      )}
      <button className="download" disabled={!grid} onClick={download}>
        <ArrowDownToLine size={17} />
        {grid ? `Convert & download ${FORMATS[format]}` : 'Upload a grid to continue'}
        <ArrowLeftRight className="download-arrow" size={16} />
      </button>
    </>
  );
}

function SuiteRail({ collapsed, onToggle, open, onClose, onNavigate, route }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <nav
      id="suite-rail"
      className={`suite-rail${collapsed ? ' collapsed' : ''}${open ? ' open' : ''}`}
      aria-label="Peforma suites"
      role={open ? 'dialog' : undefined}
      aria-modal={open ? 'true' : undefined}
    >
      <div className="rail-head">
        <span className="rail-title">Suites</span>
        <button
          type="button"
          className="rail-collapse"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls="suite-rail"
          aria-label={collapsed ? 'Expand suite navigation' : 'Collapse suite navigation'}
          title={collapsed ? 'Expand suite navigation' : 'Collapse suite navigation'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
        <button type="button" ref={closeRef} className="rail-close" onClick={onClose} aria-label="Close suite navigation">
          <X size={18} />
        </button>
      </div>
      {SUITE_GROUPS.map(group => (
        <div className="rail-group" key={group.label}>
          <div className="rail-label">{group.label}</div>
          <ul className="rail-list">
            {group.items.map(({ key, name, tool, href, icon: Icon, live, children }) => (
              <li key={key}>
                {children ? (
                  <>
                    <a
                      className={`rail-suite${children.some(c => c.key === route) ? ' current' : ''}`}
                      href={children.find(c => c.live)?.href}
                      title={name}
                      onClick={onNavigate}
                    >
                      <Icon size={16} />
                      <span className="rail-text">{name}</span>
                      <ChevronDown className="rail-chevron" size={14} />
                    </a>
                    <div className="rail-tools">
                      {children.map(child => child.live ? (
                        <a
                          key={child.key}
                          className={`rail-tool${child.key === route ? ' current' : ''}`}
                          href={child.href}
                          aria-current={child.key === route ? 'page' : undefined}
                          onClick={onNavigate}
                        >
                          {child.name}
                        </a>
                      ) : (
                        <span key={child.key} className="rail-tool planned" aria-disabled="true">
                          {child.name}<span className="soon">Soon</span>
                        </span>
                      ))}
                    </div>
                  </>
                ) : live ? (
                  <>
                    <a
                      className={`rail-suite${key === route ? ' current' : ''}`}
                      href={href}
                      aria-current={key === route ? 'page' : undefined}
                      title={name}
                      onClick={onNavigate}
                    >
                      <Icon size={16} />
                      <span className="rail-text">{name}</span>
                      <ChevronDown className="rail-chevron" size={14} />
                    </a>
                    <div className="rail-tools">
                      <div className={`rail-tool${key === route ? ' current' : ''}`}>{tool}</div>
                    </div>
                  </>
                ) : (
                  <span className="rail-suite disabled" aria-disabled="true" title={`${name} — coming soon`}>
                    <Icon size={16} />
                    <span className="rail-text">{name}</span>
                    <span className="soon">Soon</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SiteHeader({ drawerOpen, onOpen, menuRef, route, themePref, resolvedTheme, onThemeChange }) {
  return (
    <header className="site-header">
      <div className="topbar shell">
        <a className="brand" href="#home" aria-label="Peforma home">
          <span className="brand-icon"><Layers3 size={24} aria-hidden="true" /></span>
          <span className="brand-text">
            <Wordmark />
            <span className="brand-slogan">We morph data</span>
          </span>
        </a>
        <div className="top-right">
          <a className="docs-link" href="#docs" aria-label="Documentation" aria-current={route === 'docs' ? 'page' : undefined}>
            <BookOpen size={16} aria-hidden="true" /> <span className="docs-link-text">Docs</span>
          </a>
          <ThemeToggle preference={themePref} resolved={resolvedTheme} onChange={onThemeChange} />
          <button
            ref={menuRef}
            type="button"
            className="menu-button"
            aria-expanded={drawerOpen}
            aria-controls="suite-rail"
            aria-label="Open suite navigation"
            onClick={onOpen}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}

function AboutDialog({ onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);

  const onDialogKeyDown = event => {
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll('button, a[href]');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onKeyDown={onDialogKeyDown}
      >
        <button ref={closeRef} type="button" className="about-close" onClick={onClose} aria-label="Close About">
          <X size={17} aria-hidden="true" />
        </button>
        <Wordmark label="Peforma" className="about-wordmark" />
        <h2 id="about-title">About Peforma</h2>
        <p className="about-copy">Subsurface data tools built for the field. Convert grids and engineering units.</p>
        <div className="about-meta">
          <span className="about-meta-label">Version</span>
          <span className="about-version">{VERSION.trim()}</span>
        </div>
      </div>
    </div>
  );
}

function DisclaimerDialog({ onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);

  const onDialogKeyDown = event => {
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll('button, a[href]');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        onKeyDown={onDialogKeyDown}
      >
        <button ref={closeRef} type="button" className="about-close" onClick={onClose} aria-label="Close disclaimer">
          <X size={17} aria-hidden="true" />
        </button>
        <Wordmark label="Peforma" className="about-wordmark" />
        <h2 id="disclaimer-title">Disclaimer</h2>
        <p className="about-copy">
          Peforma tools are provided for convenience. Always verify converted files in your receiving
          application before production use, and confirm coordinate units, datum, and null conventions
          match your project.
        </p>
      </div>
    </div>
  );
}

function PrivacyDialog({ onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);

  const onDialogKeyDown = event => {
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll('button, a[href]');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        className="about-dialog privacy-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        onKeyDown={onDialogKeyDown}
      >
        <button ref={closeRef} type="button" className="about-close" onClick={onClose} aria-label="Close privacy and integrity">
          <X size={17} aria-hidden="true" />
        </button>
        <Wordmark label="Peforma" className="about-wordmark" />
        <h2 id="privacy-title">Privacy &amp; integrity</h2>
        <p className="about-copy">
          Peforma runs entirely in your browser. The files you convert are read and written on your
          own machine and never leave it — there are no accounts, no telemetry, and no server-side
          storage.
        </p>
        <p className="privacy-label">What every conversion guarantees</p>
        <div className="doc-principles">
          <div className="principle"><span className="principle-icon"><ShieldCheck size={18} aria-hidden="true" /></span><b>No silent guessing</b><p>Unsupported variants are rejected with a clear message rather than producing a plausible but wrong file.</p></div>
          <div className="principle"><span className="principle-icon"><FileText size={18} aria-hidden="true" /></span><b>Values preserved</b><p>Node values, ordering, bounds, and nulls are copied verbatim — no interpolation, reprojection, or rescaling.</p></div>
          <div className="principle"><span className="principle-icon"><Check size={18} aria-hidden="true" /></span><b>Verify before use</b><p>Always confirm converted files in the receiving application — orientation, units, datum, and null conventions — before production.</p></div>
        </div>
        <aside className="doc-callout integrity privacy-contract">
          <span className="callout-icon"><ShieldCheck size={17} aria-hidden="true" /></span>
          <div className="callout-body">
            <b>The contract</b>
            <p>Peforma morphs the container, not the content. If a conversion would require inventing data — interpolating a boundary into nodes, reprojecting coordinates, or rescaling values — the tool stops and tells you instead of guessing.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// The bare origin and any landing anchor (#home, #top, #services, #contact) resolve
// to the marketing page; tool hashes resolve to their converter. Landing anchors
// keep route === 'home' so native anchor scrolling is not interrupted.
function routeFromHash(hash) {
  if (hash === '#units') return 'units';
  if (hash === '#seismic-navigation') return 'seismic-navigation';
  if (hash === '#seismic-2d') return 'seismic-2d';
  if (hash === '#seismic-3d') return 'seismic-3d';
  if (hash === '#culture') return 'culture';
  if (hash === '#culture-polygon') return 'culture-polygon';
  if (hash === '#3d-surfaces') return '3d-surfaces';
  if (hash === '#3d-solids') return '3d-solids';
  if (hash === '#shapefile') return 'shapefile';
  if (hash === '#docs') return 'docs';
  if (hash === '#grid') return 'grid';
  return 'home';
}

function App() {
  const { grid, error, source, format, setFormat, input, load, download, reset } = useGridFile();
  const [drag, setDrag] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [route, setRoute] = useState(() => routeFromHash(window.location.hash));
  const [themePref, setThemePref] = useState(readThemePreference);
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(readThemePreference()));
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try { return localStorage.getItem('peforma.rail') === 'collapsed'; }
    catch { return false; }
  });
  const menuRef = useRef(null);
  const aboutRef = useRef(null);
  const disclaimerRef = useRef(null);
  const privacyRef = useRef(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    requestAnimationFrame(() => menuRef.current?.focus());
  }, []);

  const closeAbout = useCallback(() => {
    setAboutOpen(false);
    requestAnimationFrame(() => aboutRef.current?.focus());
  }, []);

  const closeDisclaimer = useCallback(() => {
    setDisclaimerOpen(false);
    requestAnimationFrame(() => disclaimerRef.current?.focus());
  }, []);

  const closePrivacy = useCallback(() => {
    setPrivacyOpen(false);
    requestAnimationFrame(() => privacyRef.current?.focus());
  }, []);

  const changeTheme = useCallback(value => {
    setThemePref(value);
    try { localStorage.setItem(THEME_KEY, value); } catch { /* storage is optional */ }
  }, []);

  const toggleRail = useCallback(() => {
    setRailCollapsed(value => {
      const next = !value;
      try { localStorage.setItem('peforma.rail', next ? 'collapsed' : 'expanded'); } catch { /* storage is optional */ }
      return next;
    });
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.title = route === 'home'
      ? 'Peforma — Subsurface Data Exchange Toolbox'
      : route === 'units'
        ? 'Peforma Units — Engineering Unit Converter'
        : route === 'seismic-navigation'
          ? 'Peforma Seismic Navigation — P1/90, P1/11, P6/11'
          : route === 'seismic-2d'
            ? 'Peforma Seismic 2D — Seismic Line Converter'
            : route === 'seismic-3d'
              ? 'Peforma Seismic 3D — Seismic Cube Converter'
              : route === 'culture'
          ? 'Peforma Culture — Vector Data Converter'
          : route === 'culture-polygon'
            ? 'Peforma Culture Polygon — Closed-Ring Converter'
            : route === '3d-surfaces'
              ? 'Peforma 3D Surfaces — Move your surfaces'
              : route === '3d-solids'
                ? 'Peforma 3D Solids — Move your geobodies'
                : route === 'shapefile'
                  ? 'Peforma Shapefile — Esri Shapefile Bundle Converter'
                  : route === 'docs'
                    ? 'Peforma Docs — Format Reference & Guides'
                    : 'Peforma Horizon/Grid — Subsurface Grid Converter';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [route]);

  // Auto mode follows local clock hours: 07:00–19:00 is light, the rest dark.
  // The inline script in index.html applies the same rule before first paint.
  useEffect(() => {
    let timer;
    const update = () => {
      const next = resolveTheme(themePref);
      applyTheme(next);
      setResolvedTheme(next);
    };
    update();
    if (themePref === 'auto') {
      timer = window.setInterval(update, 30_000);
      document.addEventListener('visibilitychange', update);
    }
    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [themePref]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [drawerOpen]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 761px)');
    const onChange = () => { if (desktop.matches) setDrawerOpen(false); };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  const navigate = useCallback(() => { if (drawerOpen) closeDrawer(); }, [drawerOpen, closeDrawer]);

  return (
    <>
      <a className="skip-link" href={route === 'home' ? '#main' : `#${route}`}>{route === 'home' ? 'Skip to content' : route === 'docs' ? 'Skip to documentation' : 'Skip to converter'}</a>
      {route === 'home' ? (
        <Landing
          themePref={themePref}
          resolvedTheme={resolvedTheme}
          onThemeChange={changeTheme}
          onAbout={() => setAboutOpen(true)}
          onDisclaimer={() => setDisclaimerOpen(true)}
          onPrivacy={() => setPrivacyOpen(true)}
          aboutRef={aboutRef}
          disclaimerRef={disclaimerRef}
          privacyRef={privacyRef}
        />
      ) : (
      <>
      <SiteHeader
        drawerOpen={drawerOpen}
        onOpen={() => setDrawerOpen(true)}
        menuRef={menuRef}
        route={route}
        themePref={themePref}
        resolvedTheme={resolvedTheme}
        onThemeChange={changeTheme}
      />
      <div className={`app-shell${railCollapsed ? ' rail-collapsed' : ''}`}>
        <SuiteRail collapsed={railCollapsed} onToggle={toggleRail} open={drawerOpen} onClose={closeDrawer} onNavigate={navigate} route={route} />
        {drawerOpen && <button type="button" className="rail-backdrop" aria-label="Close suite navigation" onClick={closeDrawer} />}
        <div className="app-main">
          <main id={route} tabIndex={-1}>
            {route === 'docs' ? (
              <Docs />
            ) : route === 'units' ? (
              <>
                <section className="content-head">
                  <div className="eyebrow"><span /> PEFORMA / UNITS</div>
                  <h1>Change units.<br /><em>Keep the value.</em></h1>
                  <p>Convert ten engineering categories with exact factors.</p>
                </section>
                <UnitConverter />
                <section className="bottom-info" id="unit-note">
                  <div className="info-icon"><Info size={17} /></div>
                  <div>
                    <b>Conversion definitions</b>
                    <p>Ton is the metric tonne (1,000 kg). Month is the mean Gregorian month (2,629,746 s) and year is 365.2425 days; quarter, decade, and century follow that year. Barrel is 42 US gallons, ppg is pound per US gallon, and atmosphere is 101,325 Pa. Temperature conversions use exact offset formulas.</p>
                  </div>
                </section>
              </>
            ) : route === 'culture' || route === 'culture-polygon' ? (
              <>
                <section className="content-head">
                  <div className="eyebrow"><span /> PEFORMA / CULTURE</div>
                  {route === 'culture' ? (
                    <>
                      <h1>Move your vectors.<br /><em>Keep the geometry.</em></h1>
                      <p>Convert point, polyline, and fault-stick data between CSV, GeoJSON, and GOCAD ASCII.</p>
                    </>
                  ) : (
                    <>
                      <h1>Move your polygons.<br /><em>Keep every ring.</em></h1>
                      <p>Convert polygon geometry between GeoJSON and GOCAD ASCII closed curves.</p>
                    </>
                  )}
                  <nav className="culture-tabs" aria-label="Peforma Culture tools">
                    <a className={`culture-tab${route === 'culture' ? ' active' : ''}`} href="#culture" aria-current={route === 'culture' ? 'page' : undefined}>Lines/Points/Fault-sticks</a>
                    <a className={`culture-tab${route === 'culture-polygon' ? ' active' : ''}`} href="#culture-polygon" aria-current={route === 'culture-polygon' ? 'page' : undefined}>Polygon</a>
                  </nav>
                </section>
                {route === 'culture' ? <LinePoints /> : <Polygon />}
                {route === 'culture' ? (
                  <section className="bottom-info" id="culture-note">
                    <div className="info-icon"><Info size={17} /></div>
                    <div>
                      <b>Format and geometry integrity</b>
                      <p>CSV, GeoJSON, and GOCAD PLINE/VSET are recognised from contents. Vertex order, attributes, missing-Z distinctions, and CRS/units labels are preserved exactly. Delimited files without a header require an explicit column mapping. Polygon geometry belongs to the Polygon tab; shapefile interchange is handled by Peforma Shapefile.</p>
                    </div>
                  </section>
                ) : (
                  <section className="bottom-info" id="culture-polygon-note">
                    <div className="info-icon"><Info size={17} /></div>
                    <div>
                      <b>Ring and hole integrity</b>
                      <p>GeoJSON Polygon and MultiPolygon geometry and closed GOCAD PLINE curves are recognised from contents. Polygon count, ring order, hole order, vertex order, stored closure, and attribute values are preserved; orientation is reported as stored. GeoJSON output applies RFC 7946 closure and orientation, and GOCAD output writes each ring as its own closed curve. Every change is reported; no ring is repaired and no coordinate is reprojected.</p>
                    </div>
                  </section>
                )}
              </>
            ) : route === 'shapefile' ? (
              <>
                <section className="content-head">
                  <div className="eyebrow"><span /> PEFORMA / SHAPEFILE</div>
                  <h1>Move your shapefiles.<br /><em>Keep every record.</em></h1>
                  <p>Read and write Esri Shapefile sets and GeoJSON with attributes and CRS intact.</p>
                </section>
                <Shapefile />
                <section className="bottom-info" id="shapefile-note">
                  <div className="info-icon"><Info size={17} /></div>
                  <div>
                    <b>Format and bundle integrity</b>
                    <p>A shapefile is a set: .shp geometry and .dbf attributes, with an .shx index and an optional .prj definition. Record order, vertex order, attribute values, and Z values are preserved. When a source mixes geometry types, each type is written as its own set inside the ZIP. Ring closure and ring orientation follow the target convention and are reported. Confirm the target application’s handling of CRS, field types, and deleted records before operational use.</p>
                  </div>
                </section>
              </>
            ) : route === 'seismic-navigation' || route === 'seismic-2d' || route === 'seismic-3d' ? (
              <>
                <section className="content-head">
                  <div className="eyebrow">
                    <span /> {route === 'seismic-navigation' ? 'PEFORMA / SEISMIC · NAVIGATION' : route === 'seismic-2d' ? 'PEFORMA / SEISMIC · 2D LINES' : 'PEFORMA / SEISMIC · 3D CUBE'}
                  </div>
                  {route === 'seismic-navigation' ? (
                    <>
                      <h1>Move your navigation.<br /><em>Keep every position.</em></h1>
                      <p>Read UKOOA P1/90, OGP P1/11, and OGP P6/11; write CSV, P1/11, or P1/90.</p>
                    </>
                  ) : route === 'seismic-2d' ? (
                    <>
                      <h1>Move your 2D lines.<br /><em>Keep every trace.</em></h1>
                      <p>Read SEG-Y rev 0, 1, 2.0, and 2.1 line files and write a normalised rev 2.0 file.</p>
                    </>
                  ) : (
                    <>
                      <h1>Move your cubes.<br /><em>Keep every bin.</em></h1>
                      <p>Read SEG-Y rev 0, 1, 2.0, and 2.1 cubes, inspect the grid, and write a normalised rev 2.0 file.</p>
                    </>
                  )}
                  <nav className="seismic-tabs" aria-label="Peforma Seismic tools">
                    <a
                      className={`seismic-tab${route === 'seismic-navigation' ? ' active' : ''}`}
                      href="#seismic-navigation"
                      aria-current={route === 'seismic-navigation' ? 'page' : undefined}
                    >
                      Navigation
                    </a>
                    <a
                      className={`seismic-tab${route === 'seismic-2d' ? ' active' : ''}`}
                      href="#seismic-2d"
                      aria-current={route === 'seismic-2d' ? 'page' : undefined}
                    >
                      2D lines
                    </a>
                    <a
                      className={`seismic-tab${route === 'seismic-3d' ? ' active' : ''}`}
                      href="#seismic-3d"
                      aria-current={route === 'seismic-3d' ? 'page' : undefined}
                    >
                      3D cube
                    </a>
                  </nav>
                </section>
                <Seismic tab={route} />
                <section className="bottom-info" id={route === 'seismic-navigation' ? 'seismic-navigation-note' : route === 'seismic-2d' ? 'seismic-2d-note' : 'seismic-3d-note'}>
                  <div className="info-icon"><Info size={17} /></div>
                  <div>
                    {route === 'seismic-navigation' ? (
                      <>
                        <b>Navigation record integrity</b>
                        <p>P1/90 is read by fixed column, P1/11 and P6/11 by comma-separated record. Position order, point numbers, line names, times, and blank fields are preserved as written. P1/11 output uses WGS 84 geographic 2D (EPSG 4326) and reports every record the target cannot carry. P1/90 output writes N/A for projection and datum headers the source did not declare. No coordinate is reprojected or re-derived.</p>
                      </>
                    ) : (
                      <>
                        <b>Trace and header integrity</b>
                        <p>SEG-Y is read from the binary header, not the extension. The textual header, every trace header, and every sample byte are copied unchanged; only the binary-header revision, fixed-length flag, byte-order marker, trace count, and first-trace offset are normalised. Samples are never decoded, rescaled, or interpolated. Trace order stays as read unless inline-major order is explicitly requested. Missing bins and zero-valued header fields are reported, never filled.</p>
                      </>
                    )}
                  </div>
                </section>
              </>
            ) : route === '3d-surfaces' || route === '3d-solids' ? (
              <>
                <section className="content-head">
                  <div className="eyebrow">
                    <span /> {route === '3d-surfaces' ? 'PEFORMA / 3D · SURFACES' : 'PEFORMA / 3D · SOLIDS'}
                  </div>
                  {route === '3d-surfaces' ? (
                    <>
                      <h1>Move your surfaces.<br /><em>Keep every triangle.</em></h1>
                      <p>Convert fault planes, faulted horizons, and salt top between STL, OBJ, PLY, and GOCAD TSurf.</p>
                    </>
                  ) : (
                    <>
                      <h1>Move your geobodies.<br /><em>Keep the shell.</em></h1>
                      <p>Convert geobodies, salt bodies, and closed tetrahedral surfaces between STL, OBJ, PLY, and GOCAD TSurf.</p>
                    </>
                  )}
                  <nav className="mesh-tabs" aria-label="Peforma 3D tools">
                    <a
                      className={`mesh-tab${route === '3d-surfaces' ? ' active' : ''}`}
                      href="#3d-surfaces"
                      aria-current={route === '3d-surfaces' ? 'page' : undefined}
                    >
                      Fault planes &amp; horizons
                    </a>
                    <a
                      className={`mesh-tab${route === '3d-solids' ? ' active' : ''}`}
                      href="#3d-solids"
                      aria-current={route === '3d-solids' ? 'page' : undefined}
                    >
                      Geobodies &amp; solids
                    </a>
                  </nav>
                </section>
                <Mesh3D kind={route === '3d-surfaces' ? 'surface' : 'solid'} />
                <section className="bottom-info" id={route === '3d-surfaces' ? 'surface-note' : 'solid-note'}>
                  <div className="info-icon"><Info size={17} /></div>
                  <div>
                    {route === '3d-surfaces' ? (
                      <>
                        <b>Surface integrity</b>
                        <p>Fault planes, horizons, and salt tops are surfaces, not solids. An open boundary is reported as stored and is never capped or thickened. Normals are never flipped or recomputed.</p>
                      </>
                    ) : (
                      <>
                        <b>Solid integrity</b>
                        <p>Closure is detected from shared edges and reported, never repaired. An open shell is flagged before export and is not filled, capped, or welded. Vertex positions, face order, connectivity, group names, and normals are preserved; no mesh is decimated, smoothed, or reprojected.</p>
                      </>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="content-head">
                  <div className="eyebrow"><span /> PEFORMA / HORIZON-GRID</div>
                  <h1>Move your grids.<br /><em>Keep your data.</em></h1>
                  <p>Convert depth or time grid surfaces between four subsurface formats.</p>
                </section>
                <section className="workspace">
                  <UploadPanel grid={grid} error={error} source={source} drag={drag} setDrag={setDrag} input={input} load={load} reset={reset} />
                  <ExportPanel grid={grid} format={format} setFormat={setFormat} download={download} />
                </section>
                <section className="bottom-info" id="format-note">
                  <div className="info-icon"><Info size={17} /></div>
                  <div>
                    <b>Format and grid integrity</b>
                    <p>All four source formats are recognized from their contents. Confirm row direction, units, null values, and target software import settings before operational use.</p>
                  </div>
                </section>
              </>
            )}
          </main>
        </div>
        <AppFooter
          onAbout={() => setAboutOpen(true)}
          onDisclaimer={() => setDisclaimerOpen(true)}
          onPrivacy={() => setPrivacyOpen(true)}
          aboutRef={aboutRef}
          disclaimerRef={disclaimerRef}
          privacyRef={privacyRef}
        />
      </div>
      </>
      )}
      {aboutOpen && <AboutDialog onClose={closeAbout} />}
      {disclaimerOpen && <DisclaimerDialog onClose={closeDisclaimer} />}
      {privacyOpen && <PrivacyDialog onClose={closePrivacy} />}
    </>
  );
}
createRoot(document.getElementById('root')).render(<App/>);
