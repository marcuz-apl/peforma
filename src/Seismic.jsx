import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, AudioWaveform, Check, ChevronDown, FileUp, Info, RotateCcw, TriangleAlert } from 'lucide-react';
import {
  MAX_SEISMIC_BYTES,
  NAV_TARGET_LABELS,
  SEISMIC_SOURCE_LABELS,
  SEGY_TARGET_LABELS,
  loadSeismicFile,
  summarizeSeismic,
  writeNavigation,
  writeSegy,
} from './seismic.js';

const NAV_TARGET_HINT = {
  csv: 'CSV carries one row per parsed record: S, G, Q, or A positions, P1/S1 positions, or P6/11 bin nodes and perimeters. Source fields that are blank stay blank.',
  p111: 'P1/11 writes S positions with the source latitude and longitude. Grid coordinates, receivers, and other record types are not carried; every omission is reported.',
  p190: 'P1/90 writes 80-column position records. Projection, datum, spheroid, and vertical-datum headers are written as N/A when the source did not declare a value to copy.',
};

const SEGY_HINT = 'SEG-Y rev 2.0 is written with the source textual header, trace headers, and sample bytes unchanged. The binary header is normalised to revision 2.0 with the fixed-length flag, byte-order marker, trace count, and first-trace offset. No sample is decoded, rescaled, or interpolated.';

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1048576).toFixed(1)} MB`;
}

function coord(value) {
  return Number(value.toFixed(3)).toLocaleString('en-CA');
}

function clip(text, length = 68) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}

function span(range) {
  if (!range) return 'None';
  return range[0] === range[1] ? coord(range[0]) : `${coord(range[0])} — ${coord(range[1])}`;
}

function useSeismicFile(expected) {
  const [model, setModel] = useState(null);
  const [fileSize, setFileSize] = useState(0);
  const [error, setError] = useState('');
  const input = useRef(null);

  const load = useCallback(async files => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setError('');
    setModel(null);
    setFileSize(0);
    try {
      if (list.length > 1) throw Error('Add one seismic file at a time.');
      const file = list[0];
      const bytes = new Uint8Array(await file.arrayBuffer());
      const loaded = loadSeismicFile(bytes, file.name);
      if (expected === 'segy' && loaded.kind !== 'segy') {
        throw Error('This is a navigation sidecar. Open the Navigation tab for UKOOA P1/90, OGP P1/11, and OGP P6/11.');
      }
      if (expected === 'navigation' && loaded.kind !== 'navigation') {
        throw Error('This is a SEG-Y trace file. Open the 2D Lines or 3D Cube tab.');
      }
      setModel(loaded);
      setFileSize(file.size);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [expected]);

  const reset = useCallback(() => {
    setModel(null);
    setFileSize(0);
    setError('');
    if (input.current) input.current.value = '';
  }, []);

  return { model, fileSize, error, input, load, reset };
}

function SourceHeader({ model, error, reset }) {
  return (
    <div className="panel-heading">
      <div>
        <div className="section-kicker">01 <span>·</span> SOURCE DATA</div>
        <h2>Bring in your file</h2>
      </div>
      {(model || error) && <button className="reset" onClick={reset}><RotateCcw size={14} /> Start over</button>}
    </div>
  );
}

function Dropzone({ input, load, drag, setDrag, accept, title, hint, ariaLabel }) {
  return (
    <label
      className={`dropzone ${drag ? 'dragging' : ''}`}
      onDragOver={event => { event.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={event => { event.preventDefault(); setDrag(false); load(event.dataTransfer.files); }}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        aria-label={ariaLabel}
        onChange={event => load(event.target.files)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); input.current?.click(); } }}
      />
      <span className="upload-icon"><FileUp size={23} /></span>
      <strong>{title}</strong>
      <span className="drop-sub">or <span className="browse">browse files</span> from your computer</span>
      <span className="file-hint">{hint}</span>
    </label>
  );
}

function Warnings({ warnings, error }) {
  return (
    <>
      {warnings?.map((warning, index) => <div className="error" key={index}><Info size={17} /><span>{warning}</span></div>)}
      {error && <div className="error"><TriangleAlert size={17} /><span>{error}</span></div>}
    </>
  );
}

function SegySource({ tab, model, fileSize, summary, error, drag, setDrag, input, load, reset }) {
  const isCube = summary?.geometryKind === '3d';
  return (
    <>
      <SourceHeader model={model} error={error} reset={reset} />
      <Dropzone
        input={input}
        load={load}
        drag={drag}
        setDrag={setDrag}
        accept=".segy,.sgy"
        title="Drop a SEG-Y file here"
        hint="SEG-Y rev 0, 1, 2.0, and 2.1"
        ariaLabel="Choose a SEG-Y file"
      />

      {model && summary && (
        <div className="loaded">
          <div className="loaded-file">
            <span className="file-icon"><AudioWaveform size={19} /></span>
            <div><b>{model.fileName}</b><small>{summary.revisionLabel} · {summary.endiannessLabel}</small></div>
            <span className="ready"><Check size={13} /> READY</span>
          </div>

          <div className="stats">
            <div>
              <small>TRACES</small>
              <b>{summary.traceCount.toLocaleString()}</b>
              <span>{summary.samplesPerTrace.toLocaleString()} samples</span>
            </div>
            <div>
              <small>SAMPLE FORMAT</small>
              <b>Code {summary.formatCode}</b>
              <span>{summary.bytesPerSample} bytes · {summary.formatLabel}</span>
            </div>
            <div>
              <small>INTERVAL</small>
              <b>{summary.sampleInterval.toLocaleString()} µs</b>
              <span>{(summary.sampleInterval / 1000).toLocaleString('en-CA')} ms per sample</span>
            </div>
            <div>
              <small>{isCube ? 'CUBE' : 'LINE'}</small>
              <b>{isCube ? 'Inline × crossline' : '2D trace sequence'}</b>
              <span>{isCube ? `${summary.inlineCount.toLocaleString()} × ${summary.crosslineCount.toLocaleString()}` : 'Order preserved as read'}</span>
            </div>
          </div>

          <div className="preview loaded-preview">
            <div className="preview-head"><span>HEADER FACTS</span><span>{summary.variableLength ? 'Variable length' : 'Fixed length'}</span></div>
            <div className="preview-values">
              <span>Revision {summary.revision}</span>
              <span>{summary.endiannessLabel}</span>
              <span>{summary.fixedLength ? 'Fixed-length flag set' : 'Fixed-length flag clear'}</span>
              <span>{summary.extendedHeaders} extended textual header{summary.extendedHeaders === 1 ? '' : 's'}</span>
              <span>{summary.maxAdditionalHeaders} additional header{summary.maxAdditionalHeaders === 1 ? '' : 's'}</span>
              <span>{summary.distinctSampleCounts} sample count{summary.distinctSampleCounts === 1 ? '' : 's'} in use</span>
              <span>{summary.distinctIntervals} interval{summary.distinctIntervals === 1 ? '' : 's'} in use</span>
              <span>{summary.trailerRecords} trailer stanza{summary.trailerRecords === 1 ? '' : 's'}</span>
            </div>
          </div>

          {isCube ? (
            <div className="preview loaded-preview">
              <div className="preview-head"><span>3D GEOMETRY</span><span>{summary.inlineMajor ? 'Inline-major order' : 'Not inline-major'}</span></div>
              <div className="preview-values">
                <span>Inline {span(summary.inlineRange)} · {summary.inlineCount.toLocaleString()} values</span>
                <span>Crossline {span(summary.crosslineRange)} · {summary.crosslineCount.toLocaleString()} values</span>
                <span>{summary.expectedTraces.toLocaleString()} bins expected</span>
                <span>{summary.missingBins ? `${summary.missingBins.toLocaleString()} bins missing` : 'No missing bins detected'}</span>
                <span>CDP {span(summary.cdpRange)}</span>
                <span>Coordinates from {summary.coordinateSource} header fields</span>
              </div>
            </div>
          ) : (
            <div className="preview loaded-preview">
              <div className="preview-head"><span>2D LINE FACTS</span><span>Order preserved as read</span></div>
              <div className="preview-values">
                <span>CDP {span(summary.cdpRange)}</span>
                <span>Field record {span(summary.fieldRecordRange)}</span>
                <span>Coordinates from {summary.coordinateSource} header fields</span>
                <span>{summary.bounds ? `X ${span(summary.bounds.x)}` : 'No coordinate values populated'}</span>
                {summary.bounds && <span>Y {span(summary.bounds.y)}</span>}
              </div>
            </div>
          )}

          <div className="preview loaded-preview">
            <div className="preview-head"><span>TEXTUAL HEADER</span><span>{summary.textualLines.filter(Boolean).length} populated lines</span></div>
            <div className="preview-values">
              {summary.textualLines.filter(Boolean).slice(0, 6).map((line, index) => (
                <span key={index} title={line}>{clip(line)}</span>
              ))}
              {summary.textualLines.filter(Boolean).length === 0 && <span>No printable textual header lines</span>}
            </div>
          </div>

          <div className="preview loaded-preview">
            <div className="preview-head"><span>FILE &amp; MEMORY</span><span>{formatBytes(fileSize)}</span></div>
            <div className="preview-values">
              <span>Read cap {MAX_SEISMIC_BYTES / 1048576} MB</span>
              <span>{Math.round((summary.bytesPerSample * summary.samplesPerTrace * summary.traceCount) / 1048576)} MB of sample values</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'seismic-2d' && model?.summary?.geometryKind === '3d' && (
        <div className="error" role="status">
          <Info size={17} />
          <span>This file carries a 3D cube. The same header and geometry summary is available on the 3D Cube tab, where inline-major reordering can be requested.</span>
        </div>
      )}
      {tab === 'seismic-3d' && model?.summary?.geometryKind !== '3d' && model && (
        <div className="error" role="status">
          <Info size={17} />
          <span>This file does not carry both inline and crossline identifiers, so it is read as a 2D trace sequence. It can still be normalised to SEG-Y rev 2.0.</span>
        </div>
      )}
      <Warnings warnings={model?.warnings} error={error} />
    </>
  );
}

function SegyExport({ tab, model, target, setTarget, reorder, setReorder, output, busy, download }) {
  return (
    <>
      <div className="convert-row">
        <div>
          <div className="section-kicker">02 <span>·</span> OUTPUT FORMAT</div>
          <h2>Choose where it’s going</h2>
        </div>
        <div className="format-select">
          <select value={target} onChange={event => setTarget(event.target.value)} aria-label="Output format">
            {Object.entries(SEGY_TARGET_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <ChevronDown size={16} />
        </div>
      </div>
      <div className="line-mapping-hint">{SEGY_HINT}</div>
      {tab === 'seismic-3d' && (
        <div className="preview loaded-preview">
          <div className="preview-head"><span>TRACE ORDER</span><span>{reorder === 'source' ? 'Source order' : 'Inline-major'}</span></div>
          <div className="preview-values">
            <label className="seismic-order">
              <select value={reorder} onChange={event => setReorder(event.target.value)} aria-label="Trace output order">
                <option value="source">Keep source trace order</option>
                <option value="inline-major">Sort inline, then crossline</option>
              </select>
              <ChevronDown size={14} />
            </label>
            <span>Trace headers and sample bytes move with each trace; no sample is changed.</span>
          </div>
        </div>
      )}
      {output?.warnings?.map((warning, index) => <div className="error" key={index}><Info size={17} /><span>{warning}</span></div>)}
      {output?.error && <div className="error"><TriangleAlert size={17} /><span>{output.error}</span></div>}
      <button className="download" disabled={!model || busy} onClick={download}>
        <ArrowDownToLine size={17} />
        {!model ? 'Choose a file to continue' : busy ? 'Converting…' : 'Convert & download SEG-Y rev 2.0'}
        <ArrowLeftRight className="download-arrow" size={16} />
      </button>
    </>
  );
}

function SeismicSegy({ tab }) {
  const { model, fileSize, error, input, load, reset } = useSeismicFile('segy');
  const [drag, setDrag] = useState(false);
  const [target, setTarget] = useState('segy-normalized');
  const [reorder, setReorder] = useState('source');
  const [output, setOutput] = useState(null);
  const [busy, setBusy] = useState(false);
  const summary = useMemo(() => (model ? summarizeSeismic(model) : null), [model]);

  useEffect(() => { setOutput(null); }, [model, target, reorder]);

  const download = useCallback(() => {
    if (!model || busy) return;
    setBusy(true);
    setOutput(null);
    window.setTimeout(() => {
      try {
        const result = writeSegy(model, { reorder });
        setOutput(result);
        const blob = new Blob([result.bytes], { type: result.mime });
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
  }, [model, reorder, busy]);

  return (
    <section className="workspace line-workspace" aria-label={tab === 'seismic-3d' ? 'Peforma Seismic 3D cube converter' : 'Peforma Seismic 2D lines converter'}>
      <div className="line-block">
        <SegySource
          tab={tab}
          model={model}
          fileSize={fileSize}
          summary={summary}
          error={error}
          drag={drag}
          setDrag={setDrag}
          input={input}
          load={load}
          reset={reset}
        />
      </div>
      <div className="line-block">
        <SegyExport
          tab={tab}
          model={model}
          target={target}
          setTarget={setTarget}
          reorder={reorder}
          setReorder={setReorder}
          output={output}
          busy={busy}
          download={download}
        />
      </div>
    </section>
  );
}

function navigationTargets(model) {
  return model?.format === 'p611' ? ['csv'] : ['csv', 'p111', 'p190'];
}

function NavSource({ model, fileSize, summary, error, drag, setDrag, input, load, reset }) {
  const crs = summary?.crs || {};
  return (
    <>
      <SourceHeader model={model} error={error} reset={reset} />
      <Dropzone
        input={input}
        load={load}
        drag={drag}
        setDrag={setDrag}
        accept=".p190,.p111,.p611,.nav,.txt,.csv"
        title="Drop a navigation file here"
        hint="UKOOA P1/90 · OGP P1/11 · OGP P6/11"
        ariaLabel="Choose a navigation file"
      />

      {model && summary && (
        <div className="loaded">
          <div className="loaded-file">
            <span className="file-icon"><AudioWaveform size={19} /></span>
            <div><b>{model.fileName}</b><small>{SEISMIC_SOURCE_LABELS[model.format]} · Ready to convert</small></div>
            <span className="ready"><Check size={13} /> READY</span>
          </div>

          <div className="stats">
            <div>
              <small>POSITIONS</small>
              <b>{summary.pointCount.toLocaleString()}</b>
              <span>{summary.lineCount.toLocaleString()} line{summary.lineCount === 1 ? '' : 's'}</span>
            </div>
            <div>
              <small>RECEIVERS</small>
              <b>{summary.receiverCount.toLocaleString()}</b>
              <span>{summary.receiverCount ? 'Group records' : 'None in this file'}</span>
            </div>
            <div>
              <small>{summary.binCount ? 'BIN NODES' : 'HEADERS'}</small>
              <b>{summary.binCount ? summary.binCount.toLocaleString() : summary.headerCount.toLocaleString()}</b>
              <span>{summary.binCount ? `${summary.perimeterCount.toLocaleString()} perimeter record${summary.perimeterCount === 1 ? '' : 's'}` : 'Common and format headers'}</span>
            </div>
            <div>
              <small>POINT NUMBERS</small>
              <b>{summary.pointRange ? `${summary.pointRange[0].toLocaleString()} — ${summary.pointRange[1].toLocaleString()}` : 'None'}</b>
              <span>{summary.pointCount ? 'As written in the file' : 'No numeric point identifiers'}</span>
            </div>
          </div>

          <div className="preview loaded-preview">
            <div className="preview-head"><span>REFERENCE SYSTEM</span><span>{SEISMIC_SOURCE_LABELS[model.format]}</span></div>
            <div className="preview-values">
              {model.format === 'p190' ? (
                <>
                  <span>Projection {crs.projection || 'Not declared'}</span>
                  <span>Zone {crs.zone || 'Not declared'}</span>
                  <span>Datum {crs.datum || 'Not declared'}</span>
                  <span>Spheroid {crs.spheroid || 'Not declared'}</span>
                  <span>Grid units {crs.units || 'Not declared'}</span>
                  <span>Vertical datum {crs.vertical || 'Not declared'}</span>
                </>
              ) : (
                <>
                  <span>EPSG {crs.epsg || 'Not declared'}</span>
                  <span>Name {crs.name || 'Not declared'}</span>
                  <span>Source {crs.source || 'Not declared'}</span>
                </>
              )}
            </div>
          </div>

          <div className="preview loaded-preview">
            <div className="preview-head"><span>EXTENT</span><span>{summary.pointCount ? 'From written values' : 'No positions'}</span></div>
            <div className="preview-values">
              {summary.latBounds && <span>Latitude range {span(summary.latBounds)}</span>}
              {summary.numericBounds && <span>Grid range {span(summary.numericBounds)}</span>}
              {summary.binsA && <span>CRS 1 range {span(summary.binsA)}</span>}
              {summary.binsB && <span>CRS 2 range {span(summary.binsB)}</span>}
              {!summary.latBounds && !summary.numericBounds && !summary.binsA && <span>No coordinate values present</span>}
            </div>
          </div>

          <div className="preview loaded-preview">
            <div className="preview-head"><span>RECORDS</span><span>{summary.headerCount.toLocaleString()} header{summary.headerCount === 1 ? '' : 's'}</span></div>
            <div className="preview-values">
              {Object.entries(summary.recordCounts).map(([id, count]) => (
                <span key={id}>{id} × {count.toLocaleString()}</span>
              ))}
            </div>
          </div>

          <div className="preview loaded-preview">
            <div className="preview-head"><span>LINE NAMES</span><span>{summary.lineCount.toLocaleString()} distinct</span></div>
            <div className="preview-values">
              {summary.lineNames.length
                ? summary.lineNames.map(name => <span key={name}>{name}</span>)
                : <span>No line name is written in the position records</span>}
              {summary.lineCount > summary.lineNames.length && <span>+{summary.lineCount - summary.lineNames.length} more</span>}
            </div>
          </div>

          <div className="preview loaded-preview">
            <div className="preview-head"><span>FILE &amp; MEMORY</span><span>{formatBytes(fileSize)}</span></div>
            <div className="preview-values">
              <span>Read cap {MAX_SEISMIC_BYTES / 1048576} MB</span>
            </div>
          </div>
        </div>
      )}

      <Warnings warnings={model?.warnings} error={error} />
    </>
  );
}

function NavExport({ model, summary, target, setTarget, output, busy, download }) {
  const targets = navigationTargets(model);
  return (
    <>
      <div className="convert-row">
        <div>
          <div className="section-kicker">02 <span>·</span> OUTPUT FORMAT</div>
          <h2>Choose where it’s going</h2>
        </div>
        <div className="format-select">
          <select value={target} onChange={event => setTarget(event.target.value)} aria-label="Output format">
            {targets.map(key => <option key={key} value={key}>{NAV_TARGET_LABELS[key]}</option>)}
          </select>
          <ChevronDown size={16} />
        </div>
      </div>
      <div className="line-mapping-hint">{NAV_TARGET_HINT[target]}</div>
      {summary?.binCount > 0 && (
        <div className="error" role="status">
          <Info size={17} />
          <span>P6/11 bin-grid geometry converts to a delimited table. A bin grid is not a position list, so it has no P1/11 or P1/90 output.</span>
        </div>
      )}
      {output?.warnings?.map((warning, index) => <div className="error" key={index}><Info size={17} /><span>{warning}</span></div>)}
      {output?.error && <div className="error"><TriangleAlert size={17} /><span>{output.error}</span></div>}
      <button className="download" disabled={!model || busy} onClick={download}>
        <ArrowDownToLine size={17} />
        {!model ? 'Choose a file to continue' : busy ? 'Converting…' : `Convert & download ${NAV_TARGET_LABELS[target]}`}
        <ArrowLeftRight className="download-arrow" size={16} />
      </button>
    </>
  );
}

function SeismicNavigation() {
  const { model, fileSize, error, input, load, reset } = useSeismicFile('navigation');
  const [drag, setDrag] = useState(false);
  const [target, setTarget] = useState('csv');
  const [output, setOutput] = useState(null);
  const [busy, setBusy] = useState(false);
  const summary = useMemo(() => (model ? summarizeSeismic(model) : null), [model]);

  useEffect(() => {
    setOutput(null);
    if (model) setTarget(model.format === 'p611' ? 'csv' : 'p111');
  }, [model]);

  const download = useCallback(() => {
    if (!model || busy) return;
    setBusy(true);
    setOutput(null);
    window.setTimeout(() => {
      try {
        const result = writeNavigation(model, target);
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
  }, [model, target, busy]);

  return (
    <section className="workspace line-workspace" aria-label="Peforma Seismic navigation converter">
      <div className="line-block">
        <NavSource
          model={model}
          fileSize={fileSize}
          summary={summary}
          error={error}
          drag={drag}
          setDrag={setDrag}
          input={input}
          load={load}
          reset={reset}
        />
      </div>
      <div className="line-block">
        <NavExport
          model={model}
          summary={summary}
          target={target}
          setTarget={setTarget}
          output={output}
          busy={busy}
          download={download}
        />
      </div>
    </section>
  );
}

export default function Seismic({ tab = 'seismic-navigation' }) {
  return tab === 'seismic-navigation' ? <SeismicNavigation /> : <SeismicSegy tab={tab} />;
}
