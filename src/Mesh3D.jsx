import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Box, Check, ChevronDown, FileUp, Info, RotateCcw, TriangleAlert } from 'lucide-react';
import { MESH_SOURCE_LABELS, MESH_TARGETS, PREVIEW_FACE_LIMIT, loadMeshFile, summarizeMesh, writeMesh } from './meshes.js';

const TARGET_HINT = {
  'stl-ascii': 'STL carries triangles and a solid name. Groups, vertex normals, CRS, and units are not written; a zero facet normal means "not supplied".',
  'stl-binary': 'Binary STL carries the same records as ASCII STL and rounds values to 32-bit floats. Groups, vertex normals, CRS, and units are not written.',
  obj: 'OBJ carries vertices, faces, groups, and vertex normals. Face normals, CRS, and units are not written.',
  'ply-ascii': 'PLY carries vertices, faces, and vertex normals. Groups, face normals, CRS, and units are not written.',
  'ply-binary': 'Binary PLY carries the same records as ASCII PLY, little-endian. Groups, face normals, CRS, and units are not written.',
  tsurf: 'GOCAD TSurf carries vertices, faces, a name, CRS, and units. Groups and normals are not written.',
};

const NORMAL_LABELS = {
  none: 'None',
  consistent: 'Consistent',
  inconsistent: 'Inconsistent',
  undetermined: 'Undetermined',
};

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1048576).toFixed(1)} MB`;
}

function coord(value) {
  return Number(value.toFixed(3)).toLocaleString('en-CA');
}

function useMeshFile() {
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
      if (list.length > 1) throw Error('Add one mesh file at a time.');
      const file = list[0];
      const bytes = new Uint8Array(await file.arrayBuffer());
      setModel(loadMeshFile(bytes, file.name));
      setFileSize(file.size);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const reset = useCallback(() => {
    setModel(null);
    setFileSize(0);
    setError('');
    if (input.current) input.current.value = '';
  }, []);

  return { model, fileSize, error, input, load, reset };
}

function previewSample(model) {
  const faceCount = model.faces.length / 3;
  const step = Math.max(1, Math.ceil(faceCount / PREVIEW_FACE_LIMIT));
  return { faceCount, step, shown: Math.ceil(faceCount / step), sampled: step > 1 };
}

function drawMesh(context, model, summary, view, sample, width, height) {
  const lightTheme = document.body.classList.contains('light');
  context.clearRect(0, 0, width, height);
  context.fillStyle = lightTheme ? '#eef1f5' : '#14181f';
  context.fillRect(0, 0, width, height);
  if (!summary.bounds) return;

  const { min, max } = summary.bounds;
  const center = [0, 1, 2].map(axis => (min[axis] + max[axis]) / 2);
  const cosYaw = Math.cos(view.yaw);
  const sinYaw = Math.sin(view.yaw);
  const cosPitch = Math.cos(view.pitch);
  const sinPitch = Math.sin(view.pitch);
  const projected = new Map();

  const project = index => {
    if (projected.has(index)) return projected.get(index);
    const at = index * 3;
    const dx = model.positions[at] - center[0];
    const dy = model.positions[at + 1] - center[1];
    const dz = model.positions[at + 2] - center[2];
    const rx = dx * cosYaw - dy * sinYaw;
    const ry = dx * sinYaw + dy * cosYaw;
    const depth = ry * cosPitch + dz * sinPitch;
    const up = -ry * sinPitch + dz * cosPitch;
    const point = [rx, -up, depth];
    projected.set(index, point);
    return point;
  };

  const faces = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let f = 0; f < sample.faceCount; f += sample.step) {
    const at = f * 3;
    const points = [project(model.faces[at]), project(model.faces[at + 1]), project(model.faces[at + 2])];
    for (const [x, y] of points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    faces.push({ points, depth: (points[0][2] + points[1][2] + points[2][2]) / 3 });
  }
  if (!faces.length || !Number.isFinite(minX)) return;

  const scale = Math.min((width * 0.88) / (maxX - minX || 1), (height * 0.88) / (maxY - minY || 1)) * view.zoom;
  const originX = width / 2 - ((minX + maxX) / 2) * scale;
  const originY = height / 2 - ((minY + maxY) / 2) * scale;
  const base = lightTheme ? [74, 96, 125] : [126, 156, 196];

  faces.sort((a, b) => a.depth - b.depth);
  context.lineJoin = 'round';
  context.lineWidth = faces.length > 6000 ? 0 : 0.6;
  context.strokeStyle = lightTheme ? 'rgba(20, 30, 45, .12)' : 'rgba(235, 242, 255, .10)';

  for (const face of faces) {
    const [a, b, c] = face.points;
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    const shade = 0.42 + 0.58 * Math.abs((nx * 0.35 + ny * 0.45 + nz * 0.82) / length);
    context.fillStyle = `rgb(${Math.round(base[0] * shade)}, ${Math.round(base[1] * shade)}, ${Math.round(base[2] * shade)})`;
    context.beginPath();
    context.moveTo(originX + a[0] * scale, originY + a[1] * scale);
    context.lineTo(originX + b[0] * scale, originY + b[1] * scale);
    context.lineTo(originX + c[0] * scale, originY + c[1] * scale);
    context.closePath();
    context.fill();
    if (context.lineWidth) context.stroke();
  }
}

function MeshPreview({ model, summary }) {
  const canvasRef = useRef(null);
  const [view, setView] = useState({ yaw: -0.7, pitch: 0.45, zoom: 1 });
  const drag = useRef(null);
  const sample = useMemo(() => previewSample(model), [model]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const context = canvas.getContext('2d');
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawMesh(context, model, summary, view, sample, width, height);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [model, summary, view, sample]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = event => {
      event.preventDefault();
      setView(current => ({
        ...current,
        zoom: Math.max(0.4, Math.min(4, current.zoom * (event.deltaY < 0 ? 1.1 : 0.9))),
      }));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <>
      <div className="mesh-preview-wrap">
        <canvas
          ref={canvasRef}
          className="mesh-canvas"
          aria-hidden="true"
          onPointerDown={event => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, yaw: view.yaw, pitch: view.pitch };
          }}
          onPointerMove={event => {
            const start = drag.current;
            if (!start) return;
            const yaw = start.yaw + (event.clientX - start.x) * 0.01;
            const pitch = Math.max(-1.4, Math.min(1.4, start.pitch + (event.clientY - start.y) * 0.01));
            setView(current => ({ ...current, yaw, pitch }));
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onDoubleClick={() => setView({ yaw: -0.7, pitch: 0.45, zoom: 1 })}
        />
        <div className="mesh-preview-caption">
          <span>
            {sample.sampled
              ? `Preview sampled — ${sample.shown.toLocaleString()} of ${sample.faceCount.toLocaleString()} faces`
              : `${sample.faceCount.toLocaleString()} faces`}
          </span>
          <span>Closure by {summary.closureMethod}</span>
        </div>
      </div>
      <p className="sr-only">
        3D preview of {summary.faceCount.toLocaleString()} triangles. Vertex count, face count,
        closure, normal state, bounds, and groups are listed as text above this preview.
      </p>
    </>
  );
}

function SourcePanel({ model, fileSize, error, drag, setDrag, input, load, reset, summary, dataBytes }) {
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
        onDragOver={event => { event.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={event => { event.preventDefault(); setDrag(false); load(event.dataTransfer.files); }}
      >
        <input
          ref={input}
          type="file"
          accept=".stl,.obj,.ply,.ts"
          aria-label="Choose a mesh file"
          onChange={event => load(event.target.files)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); input.current?.click(); } }}
        />
        <span className="upload-icon"><FileUp size={23} /></span>
        <strong>Drop a mesh file here</strong>
        <span className="drop-sub">or <span className="browse">browse files</span> from your computer</span>
        <span className="file-hint">STL · OBJ · PLY · GOCAD .TS</span>
      </label>

      {model && summary && (
        <div className="loaded">
          <div className="loaded-file">
            <span className="file-icon"><Box size={19} /></span>
            <div><b>{model.fileName}</b><small>{MESH_SOURCE_LABELS[model.format]} · Ready to convert</small></div>
            <span className="ready"><Check size={13} /> READY</span>
          </div>
          <div className="stats">
            <div>
              <small>VERTICES</small>
              <b>{summary.vertexCount.toLocaleString()}</b>
              <span>{summary.groupCount ? `${summary.groupCount.toLocaleString()} group${summary.groupCount === 1 ? '' : 's'}` : 'No groups'}</span>
            </div>
            <div>
              <small>FACES</small>
              <b>{summary.faceCount.toLocaleString()}</b>
              <span>{summary.degenerateFaces ? `${summary.degenerateFaces.toLocaleString()} degenerate` : 'Triangles only'}</span>
            </div>
            <div>
              <small>CLOSURE</small>
              <b>{summary.closed ? 'Closed' : 'Open'}</b>
              <span>
                {summary.closed
                  ? 'Every edge shared twice'
                  : `${summary.openEdges.toLocaleString()} open edge${summary.openEdges === 1 ? '' : 's'}${summary.nonManifoldEdges ? ` · ${summary.nonManifoldEdges.toLocaleString()} non-manifold` : ''}`}
              </span>
            </div>
            <div>
              <small>NORMALS</small>
              <b>{NORMAL_LABELS[summary.normalState]}</b>
              <span>
                {summary.normalState === 'none'
                  ? 'No normals stored'
                  : summary.normalState === 'undetermined'
                    ? 'No shared edges to compare'
                    : summary.normalState === 'consistent' ? 'Shared edges agree' : `${summary.inconsistentEdges.toLocaleString()} edge${summary.inconsistentEdges === 1 ? '' : 's'} disagree`}
              </span>
            </div>
          </div>

          <div className="preview loaded-preview">
            <div className="preview-head"><span>BOUNDS</span><span>{model.units ? `Units ${model.units}` : 'No units declared'}</span></div>
            <div className="preview-values">
              <span>X {coord(summary.bounds.min[0])} — {coord(summary.bounds.max[0])}</span>
              <span>Y {coord(summary.bounds.min[1])} — {coord(summary.bounds.max[1])}</span>
              <span>Z {coord(summary.bounds.min[2])} — {coord(summary.bounds.max[2])}</span>
            </div>
          </div>

          <div className="preview loaded-preview">
            <div className="preview-head"><span>GROUPS &amp; REFERENCE</span><span>{summary.groupCount} group{summary.groupCount === 1 ? '' : 's'}</span></div>
            <div className="preview-values">
              {summary.groupNames.length
                ? summary.groupNames.slice(0, 6).map(name => <span key={name}>{name}</span>)
                : <span>No groups</span>}
              {summary.groupNames.length > 6 && <span>+{summary.groupNames.length - 6} more</span>}
              {model.crs && <span title={model.crs}>CRS declared</span>}
              {model.units && <span>Units {model.units}</span>}
            </div>
          </div>

          <div className="preview loaded-preview">
            <div className="preview-head"><span>FILE &amp; MEMORY</span><span>{formatBytes(fileSize)}</span></div>
            <div className="preview-values">
              <span>Data model ~ {formatBytes(dataBytes)}</span>
              <span>Read cap 64 MB</span>
            </div>
          </div>

          <MeshPreview model={model} summary={summary} />
        </div>
      )}

      {model?.warnings.map((warning, index) => <div className="error" key={index}><Info size={17} /><span>{warning}</span></div>)}
      {error && <div className="error"><TriangleAlert size={17} /><span>{error}</span></div>}
    </>
  );
}

function ExportPanel({ model, target, setTarget, output, busy, download }) {
  return (
    <>
      <div className="convert-row">
        <div>
          <div className="section-kicker">02 <span>·</span> OUTPUT FORMAT</div>
          <h2>Choose where it’s going</h2>
        </div>
        <div className="format-select">
          <select value={target} onChange={event => setTarget(event.target.value)} aria-label="Output format">
            {Object.entries(MESH_TARGETS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <ChevronDown size={16} />
        </div>
      </div>
      <div className="line-mapping-hint">{TARGET_HINT[target]}</div>
      {output?.warnings?.map((warning, index) => <div className="error" key={index}><Info size={17} /><span>{warning}</span></div>)}
      {output?.error && <div className="error"><TriangleAlert size={17} /><span>{output.error}</span></div>}
      <button className="download" disabled={!model || busy} onClick={download}>
        <ArrowDownToLine size={17} />
        {!model ? 'Choose a file to continue' : busy ? 'Converting…' : `Convert & download ${MESH_TARGETS[target]}`}
        <ArrowLeftRight className="download-arrow" size={16} />
      </button>
    </>
  );
}

export default function Mesh3D({ kind }) {
  const { model, fileSize, error, input, load, reset } = useMeshFile();
  const [drag, setDrag] = useState(false);
  const [target, setTarget] = useState('stl-binary');
  const [output, setOutput] = useState(null);
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => (model ? summarizeMesh(model) : null), [model]);
  const dataBytes = useMemo(() => {
    if (!model) return 0;
    return model.positions.byteLength
      + model.faces.byteLength
      + (model.faceNormals?.byteLength || 0)
      + (model.vertexNormals?.byteLength || 0)
      + (model.faceGroups?.byteLength || 0);
  }, [model]);

  useEffect(() => { setOutput(null); }, [model, target]);

  const download = useCallback(() => {
    if (!model || busy) return;
    setBusy(true);
    setOutput(null);
    window.setTimeout(() => {
      try {
        const result = writeMesh(model, target);
        setOutput(result);
        const blob = new Blob([result.bytes ?? result.text], { type: result.mime });
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

  const openSolid = kind === 'solid' && summary && !summary.closed;

  return (
    <section className="workspace line-workspace" aria-label={kind === 'solid' ? 'Peforma 3D solids converter' : 'Peforma 3D surfaces converter'}>
      <div className="line-block">
        <SourcePanel
          model={model}
          fileSize={fileSize}
          error={error}
          drag={drag}
          setDrag={setDrag}
          input={input}
          load={load}
          reset={reset}
          summary={summary}
          dataBytes={dataBytes}
        />
      </div>
      <div className="line-block">
        {openSolid && (
          <div className="error" role="status">
            <TriangleAlert size={17} />
            <span>
              This mesh is not watertight: {summary.openEdges.toLocaleString()} boundary edge{summary.openEdges === 1 ? ' is' : 's are'} open.
              {' '}Peforma 3D reports the gap and will not fill, cap, or weld it. Confirm the target application’s handling before use.
            </span>
          </div>
        )}
        <ExportPanel
          model={model}
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
