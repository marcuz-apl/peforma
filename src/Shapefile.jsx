import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Check, ChevronDown, FileUp, Info, Layers3, RotateCcw, TriangleAlert } from 'lucide-react';
import { SHAPEFILE_TARGETS, parseShapefileBundle, parseGeoJsonFile, summarizeFeatures, buildGeoJson, buildShapefileZip } from './shapefile.js';

const PARTS = new Set(['shp', 'shx', 'dbf', 'prj', 'cpg']);

function extensionOf(name) {
  const m = /\.([^.]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

function baseName(name) {
  return name.replace(/\.[^.]+$/, '') || 'peforma';
}

// A .prj is WKT, which is far too long for a summary cell. Show the declared
// name from the outermost definition and keep the full text in the tooltip.
function crsLabel(crs) {
  if (!crs) return 'Unknown';
  const named = /^(?:PROJCS|GEOGCS|PROJCRS|GEOGCRS|COMPD_CS|COMPDCRS|LOCAL_CS)\s*\[\s*"([^"]+)"/i.exec(crs);
  return named ? named[1] : crs;
}

// Owns the loaded model. A GeoJSON file is parsed on its own; shapefile files
// are grouped by base name and read as one bundle.
function useShapefileFile() {
  const [model, setModel] = useState(null);
  const [error, setError] = useState('');
  const input = useRef(null);

  const load = useCallback(async files => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setError('');
    setModel(null);
    try {
      const geoJson = list.filter(f => /\.(geojson|json)$/i.test(f.name));
      if (geoJson.length) {
        if (list.length > 1) throw Error('Add one GeoJSON file or one shapefile set, not both.');
        setModel(parseGeoJsonFile(await geoJson[0].text(), geoJson[0].name));
        return;
      }

      const parts = new Map();
      for (const file of list) {
        const ext = extensionOf(file.name);
        if (!PARTS.has(ext)) throw Error(`"${file.name}" is not part of a shapefile set. Add .shp, .shx, .dbf, .prj, or .cpg files.`);
        if (parts.has(ext)) throw Error(`Two files end in .${ext}. Add one shapefile set at a time.`);
        parts.set(ext, file);
      }
      const bases = [...new Set(list.map(f => baseName(f.name).toLowerCase()))];
      if (bases.length > 1) throw Error(`The files belong to more than one set (${bases.join(', ')}). Add one shapefile set at a time.`);

      const read = ext => parts.get(ext);
      const shp = read('shp') ? await read('shp').arrayBuffer() : undefined;
      const shx = read('shx') ? await read('shx').arrayBuffer() : undefined;
      const dbf = read('dbf') ? await read('dbf').arrayBuffer() : undefined;
      const prj = read('prj') ? await read('prj').text() : '';
      setModel(parseShapefileBundle({ shp, shx, dbf, prj, fileName: `${baseName(list[0].name)}.shp` }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const reset = useCallback(() => {
    setModel(null);
    setError('');
    if (input.current) input.current.value = '';
  }, []);

  return { model, error, input, load, reset };
}

function kindsOf(features) {
  const labels = { point: 'Point', multipoint: 'MultiPoint', polyline: 'Line', polygon: 'Polygon', multipolygon: 'MultiPolygon' };
  const counts = new Map();
  for (const f of features) {
    const label = labels[f.kind] || f.kind;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => `${label} × ${count.toLocaleString()}`);
}

function firstFeatures(features, n) {
  const labels = { point: 'Point', multipoint: 'MultiPoint', polyline: 'Line', polygon: 'Polygon', multipolygon: 'MultiPolygon' };
  return features.slice(0, n).map(f => {
    if (f.kind === 'point') {
      const p = f.points[0];
      return `${labels[f.kind]} ${p.x}, ${p.y}${Number.isFinite(p.z) ? ', ' + p.z : ''}`;
    }
    if (f.kind === 'multipoint') return `${labels[f.kind]} · ${f.points.length.toLocaleString()} points`;
    if (f.kind === 'polyline') {
      const vertices = f.parts.reduce((n2, part) => n2 + part.length, 0);
      return `${f.parts.length > 1 ? 'MultiLine' : 'Line'} · ${vertices.toLocaleString()} vertices`;
    }
    if (f.kind === 'polygon') return `${labels[f.kind]} · ${f.rings.length.toLocaleString()} ring${f.rings.length === 1 ? '' : 's'}`;
    return `${labels[f.kind]} · ${f.polygons.length.toLocaleString()} areas`;
  });
}

function SourcePanel({ model, error, drag, setDrag, input, load, reset }) {
  const stats = model ? summarizeFeatures(model.features) : null;

  return (
    <>
      <div className="panel-heading">
        <div>
          <div className="section-kicker">01 <span>·</span> SOURCE DATA</div>
          <h2>Bring in your file</h2>
        </div>
        {(model || error) && <button className="reset" onClick={reset}><RotateCcw size={14} /> Start over</button>}
      </div>
      <label
        className={`dropzone ${drag ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files); }}
      >
        <input
          ref={input}
          type="file"
          multiple
          accept=".shp,.shx,.dbf,.prj,.cpg,.geojson,.json"
          aria-label="Choose shapefile or GeoJSON files"
          onChange={e => load(e.target.files)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); input.current?.click(); } }}
        />
        <span className="upload-icon"><FileUp size={23} /></span>
        <strong>Drop a shapefile set or GeoJSON here</strong>
        <span className="drop-sub">or <span className="browse">browse files</span> from your computer</span>
        <span className="file-hint">SHP · SHX · DBF · PRJ · GEOJSON</span>
      </label>

      {model && stats && (
        <div className="loaded">
          <div className="loaded-file">
            <span className="file-icon"><Layers3 size={19} /></span>
            <div>
              <b>{model.fileName}</b>
              <small>{model.format === 'shapefile' ? 'Esri Shapefile bundle' : 'GeoJSON'} · Ready to convert</small>
            </div>
            <span className="ready"><Check size={13} /> READY</span>
          </div>
          <div className="stats">
            <div><small>FEATURES</small><b>{stats.featureCount.toLocaleString()}</b><span>{stats.vertexCount.toLocaleString()} vertices</span></div>
            <div><small>X RANGE</small><b>{stats.bounds ? `${stats.bounds[0]} — ${stats.bounds[2]}` : '—'}</b><span>Coordinate bounds</span></div>
            <div><small>Y RANGE</small><b>{stats.bounds ? `${stats.bounds[1]} — ${stats.bounds[3]}` : '—'}</b><span>Coordinate bounds</span></div>
            <div><small>{stats.hasZ || stats.partialZ ? (stats.partialZ ? 'Z (PARTIAL)' : 'Z RANGE') : 'CRS'}</small><b title={!stats.hasZ && !stats.partialZ && model.crs ? model.crs : undefined}>{stats.hasZ || stats.partialZ ? `${stats.zBounds[0]} — ${stats.zBounds[1]}` : crsLabel(model.crs)}</b><span>{stats.partialZ ? 'Some vertices lack Z' : stats.hasZ ? 'Vertical values present' : (model.crs ? 'Declared' : 'No CRS declared')}</span></div>
          </div>
          <div className="preview loaded-preview">
            <div className="preview-head"><span>GEOMETRY</span><span>{stats.featureCount.toLocaleString()} features</span></div>
            <div className="preview-values">{kindsOf(model.features).map(k => <span key={k}>{k}</span>)}</div>
          </div>
          {stats.attrNames.length > 0 && (
            <div className="preview loaded-preview">
              <div className="preview-head"><span>ATTRIBUTES</span><span>{stats.attrNames.length} carried</span></div>
              <div className="preview-values">{stats.attrNames.map(a => <span key={a}>{a}</span>)}</div>
            </div>
          )}
          <div className="preview loaded-preview">
            <div className="preview-head"><span>FEATURE PREVIEW</span><span>First {Math.min(6, stats.featureCount)} of {stats.featureCount.toLocaleString()}</span></div>
            <div className="preview-values">{firstFeatures(model.features, 6).map((f, i) => <span key={i}>{f}</span>)}</div>
          </div>
        </div>
      )}
      {model?.warnings.map((w, i) => <div className="error" key={i}><Info size={17} /><span>{w}</span></div>)}
      {error && <div className="error"><TriangleAlert size={17} /><span>{error}</span></div>}
    </>
  );
}

function ExportPanel({ model, target, setTarget, output, download }) {
  return (
    <>
      <div className="convert-row">
        <div>
          <div className="section-kicker">02 <span>·</span> OUTPUT FORMAT</div>
          <h2>Choose where it’s going</h2>
        </div>
        <div className="format-select">
          <select value={target} onChange={e => setTarget(e.target.value)} aria-label="Output format">
            {Object.entries(SHAPEFILE_TARGETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <ChevronDown size={16} />
        </div>
      </div>
      {model && output?.warnings?.map((w, i) => <div className="error" key={i}><Info size={17} /><span>{w}</span></div>)}
      {output?.error && <div className="error"><TriangleAlert size={17} /><span>{output.error}</span></div>}
      <button className="download" disabled={!output || !!output.error} onClick={download}>
        <ArrowDownToLine size={17} />
        {!model ? 'Upload a file to continue' : `Convert & download ${target === 'geojson' ? 'GeoJSON' : 'shapefile bundle'}`}
        <ArrowLeftRight className="download-arrow" size={16} />
      </button>
    </>
  );
}

// Drive the whole view. The shell owns routing and theme; this component owns
// file state, the source summary, and the export.
export default function Shapefile() {
  const { model, error, input, load, reset } = useShapefileFile();
  const [drag, setDrag] = useState(false);
  const [target, setTarget] = useState('geojson');

  const output = useMemo(() => {
    if (!model) return null;
    try {
      return target === 'geojson' ? buildGeoJson(model) : buildShapefileZip(model);
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [model, target]);

  const download = useCallback(() => {
    if (!model || !output || output.error) return;
    const base = baseName(model.fileName);
    const zip = target === 'shapefile';
    const blob = zip
      ? new Blob([output.bytes], { type: 'application/zip' })
      : new Blob([output.text], { type: 'application/geo+json' });
    const name = zip ? output.fileName : `${base}.geojson`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [model, output, target]);

  return (
    <section className="workspace line-workspace" aria-label="Shapefile converter">
      <div className="line-block">
        <SourcePanel
          model={model}
          error={error}
          drag={drag}
          setDrag={setDrag}
          input={input}
          load={load}
          reset={reset}
        />
      </div>
      <div className="line-block">
        <ExportPanel
          model={model}
          target={target}
          setTarget={setTarget}
          output={output}
          download={download}
        />
      </div>
    </section>
  );
}
