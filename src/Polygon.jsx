import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Check, ChevronDown, FileUp, Info, Pentagon, RotateCcw, TriangleAlert } from 'lucide-react';
import { POLYGON_SOURCE_LABELS, POLYGON_TARGETS, parsePolygonFile, ringDirection, summarizePolygons, writePolygons } from './polygons.js';

// A .prj-style WKT is too long for a summary cell. Show the declared name and
// keep the full text in the tooltip.
function crsLabel(crs) {
  if (!crs) return 'Unknown';
  const named = /^(?:PROJCS|GEOGCS|PROJCRS|GEOGCRS|COMPD_CS|COMPDCRS|LOCAL_CS)\s*\[\s*"([^"]+)"/i.exec(crs);
  return named ? named[1] : crs;
}

function baseName(name) {
  return name.replace(/\.[^.]+$/, '') || 'peforma';
}

function usePolygonFile() {
  const [model, setModel] = useState(null);
  const [error, setError] = useState('');
  const input = useRef(null);

  const load = useCallback(async files => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setError('');
    setModel(null);
    try {
      if (list.length > 1) throw Error('Add one polygon file at a time.');
      const file = list[0];
      setModel(parsePolygonFile(await file.text(), file.name));
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

// One row per ring for the preview: which polygon owns it, whether it is the
// exterior or a hole, how many vertices it stores, and its stored closure and
// direction. Nothing is normalised here; this reports the source.
function ringRows(objects, limit = 6) {
  const rows = [];
  for (const o of objects) {
    const polygons = o.kind === 'polygon' ? [o.rings] : o.polygons;
    polygons.forEach((rings, pi) => {
      const base = o.attributes?.name || 'Polygon';
      const name = o.kind === 'multipolygon' ? `${base} · area ${pi + 1}` : base;
      rings.forEach((ring, ri) => {
        const direction = ringDirection(ring);
        rows.push({
          label: name,
          role: ri === 0 ? 'exterior' : `hole ${ri}`,
          vertices: ring.vertices.length,
          closure: ring.closed ? (ring.storedClosed ? 'closed (repeated vertex)' : 'closed (segment)') : 'stored open',
          direction: direction === 'degenerate' ? 'zero area' : direction.toUpperCase(),
        });
      });
    });
    if (rows.length >= limit) break;
  }
  return rows.slice(0, limit);
}

function SourcePanel({ model, error, drag, setDrag, input, load, reset }) {
  const s = model ? summarizePolygons(model.objects) : null;
  const rings = model ? ringRows(model.objects) : [];

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
          accept=".geojson,.json,.pl,.dat,.txt"
          aria-label="Choose a polygon file"
          onChange={e => load(e.target.files)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); input.current?.click(); } }}
        />
        <span className="upload-icon"><FileUp size={23} /></span>
        <strong>Drop a polygon file here</strong>
        <span className="drop-sub">or <span className="browse">browse files</span> from your computer</span>
        <span className="file-hint">GEOJSON · GOCAD .PL CLOSED CURVES</span>
      </label>

      {model && s && (
        <div className="loaded">
          <div className="loaded-file">
            <span className="file-icon"><Pentagon size={19} /></span>
            <div><b>{model.fileName}</b><small>{POLYGON_SOURCE_LABELS[model.format]} · Ready to convert</small></div>
            <span className="ready"><Check size={13} /> READY</span>
          </div>
          <div className="stats">
            <div><small>POLYGONS</small><b>{s.polygonCount.toLocaleString()}</b><span>{s.objectCount.toLocaleString()} feature{s.objectCount === 1 ? '' : 's'}</span></div>
            <div><small>RINGS</small><b>{s.ringCount.toLocaleString()}</b><span>{s.holeCount.toLocaleString()} hole{s.holeCount === 1 ? '' : 's'}</span></div>
            <div><small>VERTICES</small><b>{s.vertexCount.toLocaleString()}</b><span>{s.closedRings.toLocaleString()} closed · {s.openRings.toLocaleString()} open</span></div>
            <div>
              <small>{s.hasZ ? (s.partialZ ? 'Z (PARTIAL)' : 'Z RANGE') : 'CRS'}</small>
              <b title={!s.hasZ && model.crs ? model.crs : undefined}>{s.hasZ ? `${s.zBounds[0]} — ${s.zBounds[1]}` : crsLabel(model.crs)}</b>
              <span>{s.partialZ ? 'Some vertices lack Z' : s.hasZ ? 'Vertical values present' : (model.crs ? 'Declared' : 'No CRS declared')}</span>
            </div>
          </div>
          <div className="preview loaded-preview">
            <div className="preview-head"><span>RING CONVENTIONS AS STORED</span><span>{s.ringCount.toLocaleString()} rings</span></div>
            <div className="preview-values">
              {s.exteriorCCW > 0 && <span>Exterior CCW × {s.exteriorCCW}</span>}
              {s.exteriorCW > 0 && <span>Exterior CW × {s.exteriorCW}</span>}
              {s.holeCCW > 0 && <span>Hole CCW × {s.holeCCW}</span>}
              {s.holeCW > 0 && <span>Hole CW × {s.holeCW}</span>}
              {s.zeroAreaRings > 0 && <span>Zero area × {s.zeroAreaRings}</span>}
              {s.repeatedRings > 0 && <span>Repeated first vertex × {s.repeatedRings}</span>}
              {model.units && <span>Units {model.units}</span>}
            </div>
          </div>
          {s.attrNames.length > 0 && (
            <div className="preview loaded-preview">
              <div className="preview-head"><span>ATTRIBUTES</span><span>{s.attrNames.length} carried</span></div>
              <div className="preview-values">{s.attrNames.map(a => <span key={a}>{a}</span>)}</div>
            </div>
          )}
          <div className="preview loaded-preview">
            <div className="preview-head"><span>RING PREVIEW</span><span>First {rings.length} of {s.ringCount.toLocaleString()}</span></div>
            <div className="preview-values">
              {rings.map((r, i) => (
                <span key={i}>{r.label} · {r.role} · {r.vertices} vertices · {r.closure} · {r.direction}</span>
              ))}
            </div>
          </div>
        </div>
      )}
      {model?.format === 'gocad' && (
        <div className="error"><Info size={17} /><span>GOCAD PLINE has no hole or multipart structure, so each closed curve is read as its own polygon.</span></div>
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
            {Object.entries(POLYGON_TARGETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <ChevronDown size={16} />
        </div>
      </div>
      <div className="line-mapping-hint">
        {target === 'geojson'
          ? 'GeoJSON output closes every ring and applies RFC 7946 orientation: exterior counter-clockwise, holes clockwise.'
          : 'GOCAD output writes each ring as its own closed PLINE by repeating the first vertex. Holes and multipart areas become separate curves, and only the name attribute is carried.'}
      </div>
      {model && output?.warnings?.map((w, i) => <div className="error" key={i}><Info size={17} /><span>{w}</span></div>)}
      {output?.error && <div className="error"><TriangleAlert size={17} /><span>{output.error}</span></div>}
      <button className="download" disabled={!model || !!output?.error} onClick={download}>
        <ArrowDownToLine size={17} />
        {!model ? 'Upload a file to continue' : `Convert & download ${POLYGON_TARGETS[target]}`}
        <ArrowLeftRight className="download-arrow" size={16} />
      </button>
    </>
  );
}

// Drive the whole view. The shell owns routing and theme; this component owns
// file state, the ring summary, and the export.
export default function Polygon() {
  const { model, error, input, load, reset } = usePolygonFile();
  const [drag, setDrag] = useState(false);
  const [target, setTarget] = useState('geojson');

  const output = useMemo(() => {
    if (!model) return null;
    try {
      return writePolygons(model, target);
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [model, target]);

  const download = useCallback(() => {
    if (!model || !output || output.error) return;
    const ext = target === 'geojson' ? 'geojson' : 'pl';
    const blob = new Blob([output.text], { type: target === 'geojson' ? 'application/geo+json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName(model.fileName)}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [model, output, target]);

  return (
    <section className="workspace line-workspace" aria-label="Polygon converter">
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
