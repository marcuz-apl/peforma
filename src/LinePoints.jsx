import React, { useCallback, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Check, ChevronDown, FileSpreadsheet, FileUp, RotateCcw, TriangleAlert, Info } from 'lucide-react';
import { LINE_TARGETS, LINE_SOURCE_LABELS, parseLinePoints, resolveDelimited, writeLinePoints, summarize } from './lines.js';

// Owns file state for the converter. A loaded delimited source resolves to a
// `pending` mapping step; GeoJSON and GOCAD sources are resolved immediately
// into `model`. Confirming the column mapping swaps pending for model.
function useLineFile() {
  const [pending, setPending] = useState(null);
  const [model, setModel] = useState(null);
  const [error, setError] = useState('');
  const input = useRef(null);

  const load = useCallback(async files => {
    if (!files?.length) return;
    setError('');
    setPending(null);
    setModel(null);
    try {
      const file = files[0];
      const text = await file.text();
      const parsed = parseLinePoints(text, file.name);
      if (parsed.kind === 'unmapped') setPending(parsed);
      else setModel(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const confirm = useCallback((mapping, isLine) => {
    setError('');
    try {
      setModel(resolveDelimited(pending, mapping, { isLine }));
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [pending]);

  const reset = useCallback(() => {
    setPending(null);
    setModel(null);
    setError('');
    if (input.current) input.current.value = '';
  }, []);

  return { pending, model, error, input, load, confirm, reset };
}

// The column-mapping step for a delimited (pending) source. The user assigns
// X/Y (and optionally Z and Name), then confirms. When a header suggested a
// mapping the selects start pre-seeded; otherwise they start blank so the user
// must choose explicitly.
function ColumnMapping({ pending, lineMode, onConfirm }) {
  const [mapping, setMapping] = useState(() => ({
    x: pending.suggested?.x,
    y: pending.suggested?.y,
    z: pending.suggested?.z,
    name: pending.suggested?.name,
  }));

  const pick = (key, e) => {
    const v = e.target.value;
    setMapping(prev => ({ ...prev, [key]: v === '' ? null : Number(v) }));
  };

  const ready = mapping.x != null && mapping.y != null;
  const samples = pending.rows.slice(0, 3);
  const hasSuggestion = pending.suggested && Object.values(pending.suggested).some(v => v != null);

  return (
    <div className="line-mapping">
      <p className="line-mapping-lead">
        {hasSuggestion
          ? 'A mapping was suggested from the header. Confirm or adjust which column is each field.'
          : 'The columns are not labelled, so assign X and Y before converting.'}
      </p>
      <div className="line-mapping-grid">
        {[
          ['x', 'X column', 'required'],
          ['y', 'Y column', 'required'],
          ['z', 'Z column', 'optional'],
          ['name', 'Name / ID column', 'optional'],
        ].map(([key, label, note]) => (
          <label className="line-mapping-field" key={key}>
            <span className="field-label">{label} <em>{note}</em></span>
            <div className="line-mapping-select">
              <select value={mapping[key] ?? ''} onChange={e => pick(key, e)} aria-label={label}>
                <option value="">— none —</option>
                {pending.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
              </select>
              <ChevronDown size={14} />
            </div>
          </label>
        ))}
      </div>
      <div className="line-mapping-preview" aria-label="First data rows">
        <div className="preview-head"><span>DATA PREVIEW</span><span>First {samples.length} of {pending.rows.length.toLocaleString()} rows</span></div>
        <div className="line-mapping-table-wrap">
          <table className="line-mapping-table">
            <thead>
              <tr>{pending.headers.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {samples.map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <button type="button" className="download" disabled={!ready} onClick={() => onConfirm(mapping, lineMode)}>
        <Check size={16} /> Confirm mapping
      </button>
      {!ready && <div className="line-mapping-hint">Choose the X and Y columns to continue.</div>}
    </div>
  );
}

// Two chip buttons to choose whether pending rows become points (each row is
// one point) or lines (consecutive rows under one name form one polyline).
function LineKindToggle({ lineMode, onToggle }) {
  return (
    <div className="line-kind-toggle" role="group" aria-label="Geometry kind">
      <button type="button" className={`line-kind-chip${!lineMode ? ' active' : ''}`} aria-pressed={!lineMode} onClick={() => onToggle(false)}>Points</button>
      <button type="button" className={`line-kind-chip${lineMode ? ' active' : ''}`} aria-pressed={lineMode} onClick={() => onToggle(true)}>Lines</button>
    </div>
  );
}

function LineSourcePanel({ pending, model, error, drag, setDrag, input, load, reset, onConfirm }) {
  const [lineMode, setLineMode] = useState(false);
  const s = model ? summarize(model.objects, model.crs, model.units) : null;

  return (
    <>
      <div className="panel-heading">
        <div>
          <div className="section-kicker">01 <span>·</span> SOURCE DATA</div>
          <h2>Bring in your file</h2>
        </div>
        {(pending || model || error) && <button className="reset" onClick={reset}><RotateCcw size={14} /> Start over</button>}
      </div>
      <label
        className={`dropzone ${drag ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files); }}
      >
        <input ref={input} type="file" accept=".csv,.tsv,.xyz,.dat,.txt,.pl,.vs,.ts,.geojson,.json" aria-label="Choose a line or point file" onChange={e => load(e.target.files)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); input.current?.click(); } }} />
        <span className="upload-icon"><FileUp size={23} /></span>
        <strong>Drop a line or point file here</strong>
        <span className="drop-sub">or <span className="browse">browse files</span> from your computer</span>
        <span className="file-hint">CSV · TSV · XYZ · GEOJSON · GOCAD .PL / .VS</span>
      </label>

      {pending && (
        <div className="loaded">
          <div className="loaded-file">
            <span className="file-icon"><FileSpreadsheet size={19} /></span>
            <div><b>{pending.fileName}</b><small>{LINE_SOURCE_LABELS[pending.format]} · mapping required</small></div>
            <span className="ready"><Check size={13} /> MAPPING</span>
          </div>
          <LineKindToggle lineMode={lineMode} onToggle={setLineMode} />
          <ColumnMapping pending={pending} lineMode={lineMode} onConfirm={m => onConfirm(m, lineMode)} />
        </div>
      )}

      {model && s && (
        <div className="loaded">
          <div className="loaded-file">
            <span className="file-icon"><FileSpreadsheet size={19} /></span>
            <div><b>{model.fileName}</b><small>{LINE_SOURCE_LABELS[model.format]} · Ready to convert</small></div>
            <span className="ready"><Check size={13} /> READY</span>
          </div>
          <div className="stats">
            <div><small>{model.kind === 'polyline' ? 'LINES' : 'POINTS'}</small><b>{s.objectCount.toLocaleString()}</b><span>{s.vertexCount.toLocaleString()} vertices</span></div>
            <div><small>X RANGE</small><b>{s.bounds ? `${s.bounds[0]} — ${s.bounds[2]}` : '—'}</b><span>Coordinate bounds</span></div>
            <div><small>Y RANGE</small><b>{s.bounds ? `${s.bounds[1]} — ${s.bounds[3]}` : '—'}</b><span>Coordinate bounds</span></div>
            <div><small>{s.hasZ ? 'Z RANGE' : 'CRS'}</small><b>{s.hasZ ? `${s.zBounds[0]} — ${s.zBounds[1]}` : (model.crs || 'Unknown')}</b><span>{s.hasZ ? 'Vertical values present' : (model.crs ? 'Declared' : 'No CRS declared')}</span></div>
          </div>
          {s.attrNames.length > 0 && (
            <div className="preview">
              <div className="preview-head"><span>ATTRIBUTES</span><span>{s.attrNames.length} carried</span></div>
              <div className="preview-values">{s.attrNames.map(a => <span key={a}>{a}</span>)}</div>
            </div>
          )}
          {model.note && <div className="error"><Info size={17} /><span>{model.note}</span></div>}
        </div>
      )}
      {error && <div className="error"><TriangleAlert size={17} /><span>{error}</span></div>}
    </>
  );
}

function LineExportPanel({ model, target, setTarget, download, canDownload }) {
  const s = model ? summarize(model.objects, model.crs, model.units) : null;
  return (
    <>
      <div className="convert-row">
        <div>
          <div className="section-kicker">02 <span>·</span> OUTPUT FORMAT</div>
          <h2>Choose where it’s going</h2>
        </div>
        <div className="format-select">
          <select value={target} onChange={e => setTarget(e.target.value)} aria-label="Output format">
            {Object.entries(LINE_TARGETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <ChevronDown size={16} />
        </div>
      </div>
      {s && s.vertexCount > 0 && (
        <div className="preview">
          <div className="preview-head"><span>VERTEX PREVIEW</span><span>First {Math.min(12, s.vertexCount)} of {s.vertexCount.toLocaleString()}</span></div>
          <div className="preview-values">
            {collectPreviewVertices(model.objects, 12).map((v, i) => (
              <span key={i}>{v.x}{v.y != null ? ', ' + v.y : ''}{v.z != null ? ', ' + v.z : ''}</span>
            ))}
          </div>
        </div>
      )}
      <button className="download" disabled={!canDownload} onClick={download}>
        <ArrowDownToLine size={17} />
        {!model ? 'Upload a file to continue' : `Convert & download ${LINE_TARGETS[target]}`}
        <ArrowLeftRight className="download-arrow" size={16} />
      </button>
    </>
  );
}

function collectPreviewVertices(objects, n) {
  const out = [];
  for (const o of objects) {
    if (out.length >= n) break;
    if (o.vertex) out.push(o.vertex);
    if (o.multiPoints) for (const v of o.multiPoints) { if (out.length >= n) break; out.push(v); }
    if (o.vertices) {
      const rings = o.multiLines ? o.vertices : [o.vertices];
      for (const ring of rings) for (const v of ring) { if (out.length >= n) break; out.push(v); }
    }
  }
  return out.slice(0, n);
}

// Drive the whole view. The shell owns routing and theme; this component owns
// file state and the two panels.
export default function LinePoints() {
  const { pending, model, error, input, load, confirm, reset } = useLineFile();
  const [drag, setDrag] = useState(false);
  const [target, setTarget] = useState('csv');

  const download = useCallback(() => {
    if (!model) return;
    try {
      const data = writeLinePoints(model, target);
      const ext = target === 'csv' ? 'csv' : target === 'geojson' ? 'geojson' : 'pl';
      const base = model.fileName.replace(/\.[^.]+$/, '') || 'peforma';
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      /* the model is already validated; a serialization error is unexpected */
    }
  }, [model, target]);

  return (
    <section className="workspace line-workspace" aria-label="Line and point converter">
      <div className="line-block">
        <LineSourcePanel
          pending={pending}
          model={model}
          error={error}
          drag={drag}
          setDrag={setDrag}
          input={input}
          load={load}
          reset={reset}
          onConfirm={confirm}
        />
      </div>
      <div className="line-block">
        <LineExportPanel
          model={model}
          target={target}
          setTarget={setTarget}
          download={download}
          canDownload={!!model}
        />
      </div>
    </section>
  );
}
