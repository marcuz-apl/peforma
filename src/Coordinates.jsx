import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Check, ChevronDown, FileUp, Globe2, Info, RotateCcw, TriangleAlert } from 'lucide-react';
import {
  COORD_NOTATION_HINTS,
  COORD_NOTATION_LABELS,
  MAX_COORD_BYTES,
  formatCoordinate,
  parseCoordinateTable,
  resolveCoordinates,
  summarizeCoordinates,
  writeCoordinateCsv,
} from './coordinates.js';

const PRECISION_RANGES = { dd: [0, 10], dms: [0, 4], ddm: [0, 6] };
const PRECISION_DEFAULTS = { dd: 6, dms: 2, ddm: 4 };
const NOTATION_SHORT = { dd: 'decimal degrees', dms: 'DMS', ddm: 'decimal minutes' };

function coord(value) {
  return Number(value.toFixed(6)).toLocaleString('en-CA');
}

function span(range) {
  if (!range) return 'None';
  return range[0] === range[1] ? coord(range[0]) : `${coord(range[0])} — ${coord(range[1])}`;
}

function useCoordinatesSource() {
  const [pending, setPending] = useState(null);
  const [model, setModel] = useState(null);
  const [error, setError] = useState('');
  const input = useRef(null);

  const readText = useCallback((text, fileName) => {
    setError('');
    setPending(null);
    setModel(null);
    try {
      setPending(parseCoordinateTable(text, fileName));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const load = useCallback(async files => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setError('');
    setPending(null);
    setModel(null);
    try {
      if (list.length > 1) throw Error('Add one coordinate file at a time.');
      const file = list[0];
      if (file.size > MAX_COORD_BYTES) throw Error(`This file is ${(file.size / 1048576).toFixed(1)} MB; the read cap is ${MAX_COORD_BYTES / 1048576} MB.`);
      readText(await file.text(), file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [readText]);

  const confirm = useCallback(mapping => {
    try {
      setModel(resolveCoordinates(pending, mapping));
      setPending(null);
      setError('');
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

  return { pending, model, error, input, load, readText, confirm, reset };
}

function ColumnMapping({ pending, onConfirm }) {
  const [mapping, setMapping] = useState(() => ({ lat: pending.suggested?.lat, lon: pending.suggested?.lon }));
  const pick = (key, event) => {
    const value = event.target.value;
    setMapping(prev => ({ ...prev, [key]: value === '' ? null : Number(value) }));
  };
  const ready = mapping.lat != null && mapping.lon != null && mapping.lat !== mapping.lon;
  const samples = pending.rows.slice(0, 3);
  const hasSuggestion = pending.suggested && (pending.suggested.lat != null || pending.suggested.lon != null);

  return (
    <div className="line-mapping">
      <p className="line-mapping-lead">
        {hasSuggestion
          ? 'A mapping was suggested from the header. Confirm or adjust which column is each axis.'
          : 'The columns are not labelled, so assign latitude and longitude before converting.'}
      </p>
      <div className="line-mapping-grid">
        {[
          ['lat', 'Latitude column'],
          ['lon', 'Longitude column'],
        ].map(([key, label]) => (
          <label className="line-mapping-field" key={key}>
            <span className="field-label">{label} <em>required</em></span>
            <div className="line-mapping-select">
              <select value={mapping[key] ?? ''} onChange={event => pick(key, event)} aria-label={label}>
                <option value="">— none —</option>
                {pending.headers.map((header, index) => <option key={index} value={index}>{header}</option>)}
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
              <tr>{pending.headers.map((header, index) => <th key={index} scope="col">{header}</th>)}</tr>
            </thead>
            <tbody>
              {samples.map((row, rowIndex) => (
                <tr key={rowIndex}>{row.cells.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <button type="button" className="download" disabled={!ready} onClick={() => onConfirm(mapping)}>
        <Check size={16} /> Confirm mapping
      </button>
      {!ready && <div className="line-mapping-hint">Choose two different columns for latitude and longitude to continue.</div>}
    </div>
  );
}

function PasteRows({ onRead }) {
  const [text, setText] = useState('');
  return (
    <div className="coords-paste">
      <label className="field-label" htmlFor="coords-paste-input">Or paste rows</label>
      <textarea
        id="coords-paste-input"
        value={text}
        onChange={event => setText(event.target.value)}
        placeholder={'name,lat,lon\nWP-1,51°30′26.4″N,114°04′26.4″W\nWP-2,51.5074,-114.0719'}
        rows={4}
        spellCheck={false}
      />
      <button type="button" className="coords-paste-button" disabled={!text.trim()} onClick={() => onRead(text, 'pasted-rows.csv')}>
        Read pasted rows
      </button>
    </div>
  );
}

function SourcePanel({ pending, model, summary, error, drag, setDrag, input, load, readText, confirm, reset }) {
  return (
    <>
      <div className="panel-heading">
        <div>
          <div className="section-kicker">01 <span>·</span> SOURCE DATA</div>
          <h2>Bring in your coordinates</h2>
        </div>
        {(pending || model || error) && <button className="reset" onClick={reset}><RotateCcw size={14} /> Start over</button>}
      </div>
      <label
        className={`dropzone ${drag ? 'dragging' : ''}`}
        onDragOver={event => { event.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={event => { event.preventDefault(); setDrag(false); load(event.dataTransfer.files); }}
      >
        <input
          ref={input}
          type="file"
          accept=".csv,.tsv,.txt,.xyz,.dat"
          aria-label="Choose a coordinate table file"
          onChange={event => load(event.target.files)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); input.current?.click(); } }}
        />
        <span className="upload-icon"><FileUp size={23} /></span>
        <strong>Drop a coordinate table here</strong>
        <span className="drop-sub">or <span className="browse">browse files</span> from your computer</span>
        <span className="file-hint">CSV · TSV · TXT · one latitude and one longitude column</span>
      </label>

      {!pending && !model && <PasteRows onRead={readText} />}

      {pending && (
        <div className="loaded">
          <div className="loaded-file">
            <span className="file-icon"><Globe2 size={19} /></span>
            <div><b>{pending.fileName}</b><small>Delimited text · mapping required</small></div>
            <span className="ready"><Check size={13} /> MAPPING</span>
          </div>
          <ColumnMapping pending={pending} onConfirm={confirm} />
        </div>
      )}

      {model && summary && (
        <div className="loaded">
          <div className="loaded-file">
            <span className="file-icon"><Globe2 size={19} /></span>
            <div><b>{model.fileName}</b><small>{summary.okCount.toLocaleString()} of {summary.rowCount.toLocaleString()} rows read</small></div>
            <span className="ready"><Check size={13} /> READY</span>
          </div>

          <div className="stats">
            <div>
              <small>ROWS</small>
              <b>{summary.rowCount.toLocaleString()}</b>
              <span>{summary.okCount.toLocaleString()} converted · {summary.failed.length.toLocaleString()} unreadable</span>
            </div>
            <div>
              <small>NOTATIONS</small>
              <b>{summary.notations.length}</b>
              <span>{summary.notations.map(n => NOTATION_SHORT[n]).join(' · ') || 'None'}</span>
            </div>
            <div>
              <small>LATITUDE</small>
              <b>{span(summary.bounds.lat)}</b>
              <span>From written values</span>
            </div>
            <div>
              <small>LONGITUDE</small>
              <b>{span(summary.bounds.lon)}</b>
              <span>From written values</span>
            </div>
          </div>

          <div className="preview loaded-preview">
            <div className="preview-head"><span>READING</span><span>{model.hasHeader ? 'Header row' : 'No header row'}</span></div>
            <div className="preview-values">
              <span>Latitude from “{model.headers[model.mapping.lat]}”</span>
              <span>Longitude from “{model.headers[model.mapping.lon]}”</span>
              <span>{summary.hemisphereCount.toLocaleString()} value{summary.hemisphereCount === 1 ? '' : 's'} carry a hemisphere letter</span>
              {summary.packedCount > 0 && <span>{summary.packedCount.toLocaleString()} packed value{summary.packedCount === 1 ? '' : 's'}</span>}
              <span>Row order and every source cell are preserved</span>
            </div>
          </div>

          {summary.failed.length > 0 && (
            <div className="preview loaded-preview">
              <div className="preview-head"><span>UNREADABLE ROWS</span><span>{summary.failed.length.toLocaleString()} row{summary.failed.length === 1 ? '' : 's'}</span></div>
              <div className="preview-values">
                {summary.failed.slice(0, 5).map(row => (
                  <span key={row.lineNo} title={row.errors.join('; ')}>{row.errors[0]}</span>
                ))}
                {summary.failed.length > 5 && <span>+{summary.failed.length - 5} more</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {summary?.warnings.map((warning, index) => <div className="error" role="status" key={index}><Info size={17} /><span>{warning}</span></div>)}
      {error && <div className="error" role="alert"><TriangleAlert size={17} /><span>{error}</span></div>}
    </>
  );
}

function ExportPanel({ model, summary, notation, setNotation, precision, setPrecision, output, busy, download }) {
  const [min, max] = PRECISION_RANGES[notation];
  const options = [];
  for (let value = min; value <= max; value += 1) options.push(value);
  const previewRows = model ? model.results.slice(0, 5) : [];

  return (
    <>
      <div className="convert-row">
        <div>
          <div className="section-kicker">02 <span>·</span> OUTPUT NOTATION</div>
          <h2>Choose how it’s written</h2>
        </div>
        <div className="format-select">
          <select value={notation} onChange={event => setNotation(event.target.value)} aria-label="Output notation">
            {Object.entries(COORD_NOTATION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <ChevronDown size={16} />
        </div>
      </div>
      <div className="line-mapping-hint">{COORD_NOTATION_HINTS[notation]}</div>

      <div className="coords-precision">
        <label className="field-label" htmlFor="coords-precision">Fractional digits</label>
        <div className="line-mapping-select">
          <select id="coords-precision" value={precision} onChange={event => setPrecision(Number(event.target.value))}>
            {options.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          <ChevronDown size={14} />
        </div>
      </div>

      {model && (
        <div className="line-mapping-preview" aria-label="Converted preview">
          <div className="preview-head"><span>CONVERTED PREVIEW</span><span>First {previewRows.length} rows · {NOTATION_SHORT[notation]}</span></div>
          <div className="line-mapping-table-wrap">
            <table className="line-mapping-table">
              <thead>
                <tr><th scope="col">Source latitude</th><th scope="col">Source longitude</th><th scope="col">Written latitude</th><th scope="col">Written longitude</th></tr>
              </thead>
              <tbody>
                {previewRows.map(row => (
                  <tr key={row.lineNo}>
                    <td>{row.cells[model.mapping.lat]}</td>
                    <td>{row.cells[model.mapping.lon]}</td>
                    <td>{row.lat ? formatCoordinate(row.lat.value, 'lat', notation, precision) : '—'}</td>
                    <td>{row.lon ? formatCoordinate(row.lon.value, 'lon', notation, precision) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {output?.warnings?.map((warning, index) => <div className="error" role="status" key={index}><Info size={17} /><span>{warning}</span></div>)}
      {output?.error && <div className="error" role="alert"><TriangleAlert size={17} /><span>{output.error}</span></div>}
      <button className="download" disabled={!model || !summary?.okCount || busy} onClick={download}>
        <ArrowDownToLine size={17} />
        {!model ? 'Choose a file to continue' : busy ? 'Converting…' : 'Convert & download CSV'}
        <ArrowLeftRight className="download-arrow" size={16} />
      </button>
    </>
  );
}

export default function Coordinates() {
  const { pending, model, error, input, load, readText, confirm, reset } = useCoordinatesSource();
  const [drag, setDrag] = useState(false);
  const [notation, setNotationState] = useState('dd');
  const [precision, setPrecision] = useState(PRECISION_DEFAULTS.dd);
  const [output, setOutput] = useState(null);
  const [busy, setBusy] = useState(false);
  const summary = useMemo(() => (model ? summarizeCoordinates(model) : null), [model]);

  const setNotation = useCallback(value => {
    setNotationState(value);
    setPrecision(PRECISION_DEFAULTS[value]);
    setOutput(null);
  }, []);

  const download = useCallback(() => {
    if (!model || busy) return;
    setBusy(true);
    setOutput(null);
    window.setTimeout(() => {
      try {
        const result = writeCoordinateCsv(model, { notation, precision });
        setOutput(result);
        const blob = new Blob([result.text], { type: result.mime });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = result.fileName;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      } catch (e) {
        setOutput({ error: e instanceof Error ? e.message : String(e) });
      } finally {
        setBusy(false);
      }
    }, 0);
  }, [model, notation, precision, busy]);

  return (
    <section className="workspace line-workspace" aria-label="Peforma Coordinates converter">
      <div className="line-block">
        <SourcePanel
          pending={pending}
          model={model}
          summary={summary}
          error={error}
          drag={drag}
          setDrag={setDrag}
          input={input}
          load={load}
          readText={readText}
          confirm={confirm}
          reset={reset}
        />
      </div>
      <div className="line-block">
        <ExportPanel
          model={model}
          summary={summary}
          notation={notation}
          setNotation={setNotation}
          precision={precision}
          setPrecision={setPrecision}
          output={output}
          busy={busy}
          download={download}
        />
      </div>
    </section>
  );
}