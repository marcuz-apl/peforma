import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, BookOpen, Box, Check, Copy, Files, FileText, Grid3x3, Info, LockKeyhole, Ruler, ShieldCheck, TriangleAlert, Waypoints } from 'lucide-react';

// In-page navigation. The hash router owns top-level routes (#grid, #units,
// #culture, #docs), so these anchors never change the hash: clicking one scrolls the
// article and moves focus, leaving the route intact.
const TOC = [
  { id: 'overview', label: 'Overview' },
  {
    id: 'grid-formats', label: 'Grid formats', icon: Grid3x3, children: [
      { id: 'grid-detection', label: 'Content detection' },
      { id: 'grid-cps3', label: 'CPS-3 ASCII' },
      { id: 'grid-zmap', label: 'ZMAP+ ASCII' },
      { id: 'grid-irap', label: 'IRAP Classic ASCII' },
      { id: 'grid-earthvision', label: 'EarthVision ASCII' },
      { id: 'grid-order', label: 'Storage order & nulls' },
      { id: 'grid-reference', label: 'The reference grid' },
      { id: 'grid-caution', label: 'Interoperability' },
    ],
  },
  {
    id: 'line-formats', label: 'Culture', icon: Waypoints, children: [
      { id: 'lines-delimited', label: 'Delimited text' },
      { id: 'lines-geojson', label: 'GeoJSON' },
      { id: 'lines-gocad', label: 'GOCAD ASCII' },
      { id: 'lines-integrity', label: 'Geometry integrity' },
    ],
  },
  {
    id: 'polygon-formats', label: 'Polygon', icon: Waypoints, children: [
      { id: 'polygon-reading', label: 'Reading rings' },
      { id: 'polygon-writing', label: 'Writing rings' },
      { id: 'polygon-integrity', label: 'Ring integrity' },
    ],
  },
  {
    id: 'shapefile-formats', label: 'Shapefile', icon: Files, children: [
      { id: 'shapefile-bundle', label: 'The bundle' },
      { id: 'shapefile-geometry', label: 'Geometry types' },
      { id: 'shapefile-writing', label: 'Writing a set' },
      { id: 'shapefile-caution', label: 'Interoperability' },
    ],
  },
  {
    id: 'mesh-formats', label: '3D meshes', icon: Box, children: [
      { id: 'mesh-objects', label: 'Surfaces & solids' },
      { id: 'mesh-stl', label: 'STL' },
      { id: 'mesh-obj', label: 'Wavefront OBJ' },
      { id: 'mesh-ply', label: 'PLY' },
      { id: 'mesh-tsurf', label: 'GOCAD TSurf' },
      { id: 'mesh-integrity', label: 'Mesh integrity' },
    ],
  },
  {
    id: 'units', label: 'Units', icon: Ruler, children: [
      { id: 'units-factors', label: 'Exact factors' },
      { id: 'units-definitions', label: 'Definitions' },
    ],
  },
];

const FLAT_IDS = TOC.flatMap(entry => [entry.id, ...(entry.children || []).map(c => c.id)]);
const PARENT_OF = Object.fromEntries(TOC.flatMap(entry => (entry.children || []).map(c => [c.id, entry.id])));

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Clipboard with a legacy fallback so copy also works over plain HTTP on the LAN,
// where navigator.clipboard is unavailable, and when the async API rejects.
function copyText(text) {
  const legacy = () => new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy') ? resolve() : reject(new Error('copy command failed'));
    } catch (e) {
      reject(e);
    } finally {
      document.body.removeChild(ta);
    }
  });
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).catch(legacy);
  return legacy();
}

function CodeBlock({ label, code }) {
  const [state, setState] = useState('idle');
  const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onCopy = async () => {
    try {
      await copyText(code);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 1600);
  };
  return (
    <figure className="code-block">
      <figcaption>
        <span className="code-label"><FileText size={13} aria-hidden="true" /> {label}</span>
        <button type="button" className="code-copy" onClick={onCopy} aria-label={`Copy ${label} to clipboard`}>
          {state === 'copied' ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}
        </button>
      </figcaption>
      <div className="code-scroll">
        <pre><code>{code}</code></pre>
      </div>
    </figure>
  );
}

function Callout({ tone = 'info', title, children }) {
  const Icon = tone === 'caution' ? TriangleAlert : tone === 'integrity' ? ShieldCheck : Info;
  return (
    <aside className={`doc-callout ${tone}`}>
      <span className="callout-icon"><Icon size={17} aria-hidden="true" /></span>
      <div className="callout-body">
        <b>{title}</b>
        <div>{children}</div>
      </div>
    </aside>
  );
}

function FormatChip({ fmt, children }) {
  return <span className="format-chip"><span className={`fmt-dot ${fmt}`} aria-hidden="true" />{children}</span>;
}

function Table({ caption, head, rows }) {
  return (
    <figure className="doc-table-wrap">
      <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
        <table className="doc-table">
          <thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

// One labelled subsection with an anchor heading the scroll-spy can observe.
function Sub({ id, title, children }) {
  return (
    <section className="docs-subsection" id={id}>
      <h3>{title}<a className="heading-anchor" href={`#${id}`} aria-label={`Link to ${title}`} onClick={e => scrollToId(e, id)}>#</a></h3>
      {children}
    </section>
  );
}

function scrollToId(event, id) {
  event.preventDefault();
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

export default function Docs() {
  const [active, setActive] = useState('overview');
  const [showTop, setShowTop] = useState(false);

  // Scroll-spy: watch every anchor heading and highlight the one nearest the top
  // reading band. Selection is deterministic (smallest top among intersecting).
  useEffect(() => {
    const tops = new Map();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) tops.set(entry.target.id, entry.boundingClientRect.top);
        else tops.delete(entry.target.id);
      }
      if (tops.size) {
        let best = null, bestTop = Infinity;
        for (const [id, top] of tops) if (top < bestTop) { best = id; bestTop = top; }
        if (best) setActive(best);
      }
    }, { rootMargin: '-100px 0px -68% 0px', threshold: 0 });
    const els = FLAT_IDS.map(id => document.getElementById(id)).filter(Boolean);
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, []);

  const activeParent = PARENT_OF[active] || active;

  return (
    <>
      <section className="content-head">
        <div className="eyebrow"><span /> PEFORMA / DOCS</div>
        <h1>The format reference.<br /><em>Down to the byte.</em></h1>
        <p>How Peforma reads, reorders, and writes subsurface data — the exact headers, node ordering, null conventions, and unit factors behind every conversion. Everything runs in your browser.</p>
      </section>

      <div className="docs-layout">
        <aside className="docs-toc" aria-label="On this page">
          <div className="toc-title"><BookOpen size={14} aria-hidden="true" /> On this page</div>
          <nav>
            <ul className="toc-list">
              {TOC.map(entry => {
                const Icon = entry.icon;
                const parentActive = activeParent === entry.id;
                return (
                  <li key={entry.id}>
                    <a
                      className={`toc-link${active === entry.id ? ' active' : ''}${parentActive && entry.children ? ' branch-active' : ''}`}
                      href={`#${entry.id}`}
                      aria-current={active === entry.id ? 'location' : undefined}
                      onClick={e => scrollToId(e, entry.id)}
                    >
                      {Icon && <Icon size={14} aria-hidden="true" />}
                      <span>{entry.label}</span>
                    </a>
                    {entry.children && (
                      <ul className="toc-sublist">
                        {entry.children.map(child => (
                          <li key={child.id}>
                            <a
                              className={`toc-sublink${active === child.id ? ' active' : ''}`}
                              href={`#${child.id}`}
                              aria-current={active === child.id ? 'location' : undefined}
                              onClick={e => scrollToId(e, child.id)}
                            >
                              {child.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
          <button type="button" className="toc-top" onClick={toTop}><ArrowUp size={13} aria-hidden="true" /> Back to top</button>
        </aside>

        <article className="docs-body">
          <section className="docs-section" id="overview">
            <h2>Overview</h2>
            <p className="doc-lead">Peforma is a family of local-first data-exchange tools for the oil and gas subsurface. Each converter morphs a file from one format into another without changing a single coordinate, value, or attribute.</p>
            <p>Five tools are live today. <b>Peforma Horizon/Grid</b> converts regular grid surfaces — depth or time horizons — between CPS-3, ZMAP+, IRAP Classic, and EarthVision ASCII. <b>Peforma Culture</b> is the vector tool; its Lines/Points/Fault-sticks converter moves open line and point geometry between delimited text, GeoJSON, and GOCAD ASCII, and its Polygon converter moves closed rings between GeoJSON and GOCAD ASCII. <b>Peforma 3D</b> moves triangulated surfaces and geobody shells between STL, OBJ, PLY, and GOCAD TSurf. <b>Peforma Shapefile</b> reads and writes Esri Shapefile sets and GeoJSON, including polygons. <b>Peforma Units</b> converts ten engineering categories with exact factors. Seismic and Coordinates are planned and labelled as such in the suite rail.</p>
            <div className="doc-principles">
              <div className="principle"><span className="principle-icon"><LockKeyhole size={18} aria-hidden="true" /></span><b>Local by design</b><p>Parsing, reordering, and writing happen in your browser, and the result downloads as a new file.</p></div>
              <div className="principle"><span className="principle-icon"><ShieldCheck size={18} aria-hidden="true" /></span><b>Nothing invented</b><p>Geometry, values, node order, attributes, and nulls are preserved. Unsupported variants are rejected, never silently guessed.</p></div>
              <div className="principle"><span className="principle-icon"><FileText size={18} aria-hidden="true" /></span><b>Assumptions stated</b><p>Every format's header meaning, storage order, and null marker is documented here and surfaced in the tool itself.</p></div>
            </div>
            <Callout tone="info" title="How to read this reference">
              <p>Each format section lists the real header records, the node traversal order, the null convention, and exactly what Peforma does on import and export. The bundled examples under <code className="inline-code">examples/</code> are the same reference grid saved in every format, so the rules below are measured, not assumed.</p>
            </Callout>
          </section>

          <section className="docs-section" id="grid-formats">
            <div className="section-head">
              <span className="section-glyph"><Grid3x3 size={20} aria-hidden="true" /></span>
              <div><h2>Grid formats</h2><p className="section-sub">Depth &amp; time surfaces · Peforma Horizon/Grid</p></div>
            </div>
            <p>Peforma Horizon/Grid reads four ASCII grid dialects and writes the same four. Internally every grid is stored once, in a single canonical order, and each exporter reorders from that model. This is why a CPS-3 file and an EarthVision file of the same surface produce identical node values after conversion. The Z values may be depth, two-way time, or another sampled attribute; they are copied verbatim and never rescaled, so a time horizon converts exactly like a depth structure map.</p>

            <Table
              caption="The four grid inputs at a glance. Every dialect is both read and written as a node grid."
              head={['Format', 'Detected by', 'Dimensions record', 'Node order', 'Null marker', 'Grid output']}
              rows={[
                [<FormatChip fmt="cps3">CPS-3</FormatChip>, <code className="inline-code">FSASCI</code>, 'rows, then columns', 'column-major, NW→S', <code className="inline-code">0.1E+31</code>, 'Yes'],
                [<FormatChip fmt="zmap">ZMAP+</FormatChip>, <code className="inline-code">@…,GRID</code>, 'resolved from spans', 'column-major, NW→S', <code className="inline-code">1e30</code>, 'Yes'],
                [<FormatChip fmt="irap">IRAP Classic</FormatChip>, <code className="inline-code">-996</code>, 'rows on rec 1, cols on rec 3', 'row-major, from ymin', <code className="inline-code">9999900</code>, 'Yes'],
                [<FormatChip fmt="earthvision">EarthVision</FormatChip>, <code className="inline-code"># Type: scattered data</code>, 'columns × rows', 'explicit 1-based indices', 'omitted', 'Yes'],
              ]}
            />

            <Sub id="grid-detection" title="Content detection">
              <p>ASCII grids are identified purely from their contents, never from the file extension. A grid renamed to <code className="inline-code">.txt</code>, <code className="inline-code">.dat</code>, or given no extension at all is still recognised. When several files are selected together, each is tried in turn and the first whose contents match a supported format is loaded.</p>
              <CodeBlock label="Detection signatures (matched against file contents)" code={`FSASCI …                         → CPS-3
# Type: scattered data           → EarthVision
-996 …                           → IRAP Classic
@… , GRID , …                    → ZMAP+`} />
            </Sub>

            <Sub id="grid-cps3" title="CPS-3 ASCII">
              <p><FormatChip fmt="cps3">CPS-3</FormatChip> is the classic contour-mapping grid. Its header is a set of <code className="inline-code">FS…</code> records, and the node values follow a <code className="inline-code">-&gt;MSMODL:</code> marker.</p>
              <CodeBlock label="CPS-3 header — reference grid" code={`FSASCI 0 1 COMPUTED 0 0.1E+31
FSATTR 0 0
FSLIMI 358413 365963 3142534 3155084 5899.32959 7601.849609
FSNROW 252 152
FSXINC 50 50
->MSMODL: Converted grid
… node values …`} />
              <ul className="doc-list">
                <li><code className="inline-code">FSNROW &lt;rows&gt; &lt;columns&gt;</code> gives <b>rows then columns</b> — here <code className="inline-code">252 152</code>.</li>
                <li><code className="inline-code">FSXINC &lt;dx&gt; &lt;dy&gt;</code> gives the increments — <code className="inline-code">50 50</code>.</li>
                <li><code className="inline-code">FSLIMI &lt;xmin&gt; &lt;xmax&gt; &lt;ymin&gt; &lt;ymax&gt; &lt;zmin&gt; &lt;zmax&gt;</code> gives the coordinate bounds and value range.</li>
                <li><code className="inline-code">FSASCI</code> declares the null sentinel as its last token: <code className="inline-code">0.1E+31</code>, which is <b>1e30</b> — in both the header and the data.</li>
              </ul>
              <p>Nodes are stored <b>column by column</b>, starting at the north-west corner (<code className="inline-code">xmin</code>, <code className="inline-code">ymax</code>) and running south. Peforma reorders them into its internal row-major grid on import and reorders them back on export. The exporter writes <code className="inline-code">FSNROW &lt;ny&gt; &lt;nx&gt;</code> and the <code className="inline-code">0.1E+31</code> null marker.</p>
            </Sub>

            <Sub id="grid-zmap" title="ZMAP+ ASCII">
              <p><FormatChip fmt="zmap">ZMAP+</FormatChip> wraps its metadata between two <code className="inline-code">@</code> records, then lists node values. Dialects differ on whether the dimensions record declares rows or columns first, so Peforma does not trust either order blindly.</p>
              <CodeBlock label="ZMAP+ header — ZIMS / Kingdom layout" code={`@GRID FILE, GRID, 10
15, 0.1000000E+31, , 7, 1
252, 152, 358413, 365963, 3142534, 3155084
0.0, 50, 50
@
… node values …`} />
              <ul className="doc-list">
                <li>The dimensions record is <code className="inline-code">&lt;rows&gt;, &lt;columns&gt;, &lt;xmin&gt;, &lt;xmax&gt;, &lt;ymin&gt;, &lt;ymax&gt;</code> in a ZIMS/Kingdom export — here <code className="inline-code">252, 152, …</code>.</li>
                <li>The next record is <code className="inline-code">&lt;rotation&gt;, &lt;dx&gt;, &lt;dy&gt;</code> — <code className="inline-code">0.0, 50, 50</code>.</li>
                <li>The null control record is <code className="inline-code">&lt;width&gt;, &lt;null&gt;, &lt;blank&gt;, &lt;decimals&gt;, &lt;flag&gt;</code>; the null is <code className="inline-code">0.1000000E+31</code> = <b>1e30</b>.</li>
              </ul>
              <Callout tone="info" title="Orientation is resolved, not assumed">
                <p>Some writers declare columns first. Peforma matches the coordinate spans against the declared increments and picks the orientation that fits; it falls back to the declared order only when the increments are missing or zero. This keeps both header conventions readable without guessing from the file name. Nodes are stored column-major from the north-west corner, exactly as in CPS-3, and the exporter writes rows first to match the ZIMS/Kingdom layout.</p>
              </Callout>
            </Sub>

            <Sub id="grid-irap" title="IRAP Classic ASCII">
              <p><FormatChip fmt="irap">IRAP Classic</FormatChip> opens with a <code className="inline-code">-996</code> header of four records, then row-major node values. This is the order Peforma uses internally, so IRAP needs no reordering.</p>
              <CodeBlock label="IRAP Classic header — reference grid" code={`-996 252 50 50
358413 365963 3142534 3155084
152 0.000000 358413 3142534
0 0 0 0 0 0 0
… node values …`} />
              <ul className="doc-list">
                <li>Record 1: <code className="inline-code">-996 &lt;rows&gt; &lt;dx&gt; &lt;dy&gt;</code> — <code className="inline-code">-996 252 50 50</code>.</li>
                <li>Record 2: <code className="inline-code">&lt;xmin&gt; &lt;xmax&gt; &lt;ymin&gt; &lt;ymax&gt;</code>.</li>
                <li>Record 3: <code className="inline-code">&lt;columns&gt; 0 &lt;xmin&gt; &lt;ymin&gt;</code> — <code className="inline-code">152 0 358413 3142534</code>.</li>
                <li>Record 4: the seven-value control record. Null nodes use <code className="inline-code">9999900</code>.</li>
              </ul>
              <p>Values are <b>row-major from the southern row</b> (<code className="inline-code">ymin</code>), matching EarthVision's explicit row indices. The exporter writes the null sentinel as <code className="inline-code">9999900.000000</code>.</p>
            </Sub>

            <Sub id="grid-earthvision" title="EarthVision ASCII">
              <p><FormatChip fmt="earthvision">EarthVision</FormatChip> exports scattered data with explicit indices rather than an implied traversal. The bundled example is version 6.</p>
              <CodeBlock label="EarthVision header and a node record" code={`# Type: scattered data
# Version: 6
# Field: 1 x
# Field: 2 y
# Field: 3 z feet
# Field: 4 column
# Field: 5 row
# Grid_size: 152 x 252
# Grid_space: 358413,365963,3142534,3155084
# End:
358413.000000 3142534.000000 6012.340000 1 1
… one record per non-null node …`} />
              <ul className="doc-list">
                <li><code className="inline-code">Grid_size: &lt;columns&gt; x &lt;rows&gt;</code> gives <b>columns then rows</b> — <code className="inline-code">152 x 252</code>.</li>
                <li>Each node record is <code className="inline-code">x y z column row</code> with <b>1-based</b> column and row indices.</li>
                <li>Null nodes are <b>omitted</b> rather than written with a sentinel. Peforma restores the regular grid from the indices and fills the gaps with an internal null.</li>
                <li>A <code className="inline-code">Field:</code> record may carry a unit suffix (for example <code className="inline-code">3 z feet</code>); the field number and name are matched and the suffix is ignored. <code className="inline-code">Z_units</code> is kept as descriptive metadata — values are never rescaled.</li>
              </ul>
              <p>Because the indices are explicit, no storage order needs to be inferred. Unsupported EarthVision variants are rejected rather than guessed.</p>
            </Sub>

            <Sub id="grid-order" title="Storage order & nulls">
              <p>The single most common source of "the surface looks sheared" bugs is node traversal order. Peforma stores every grid internally in the IRAP / EarthVision order — <b>row-major from <code className="inline-code">ymin</code></b> — and reorders only at the edges. For a logical row <code className="inline-code">r</code> counted from <code className="inline-code">ymin</code> and a column <code className="inline-code">c</code> counted from <code className="inline-code">xmin</code>:</p>
              <CodeBlock label="File position of a node, by format" code={`CPS-3 / ZMAP+  (column-major, NW → S):
    fileIndex = c * ny + (ny - 1 - r)

IRAP Classic   (row-major, from ymin):
    fileIndex = r * nx + c

EarthVision    (explicit 1-based column / row indices):
    no order inferred — read from the record`} />
              <p>Null sentinels are mapped to the target format's marker, never recalculated: CPS-3 and ZMAP+ use <code className="inline-code">1e30</code>, IRAP uses <code className="inline-code">9999900</code>, and EarthVision omits the node entirely. Values themselves are never rescaled or altered.</p>
            </Sub>

            <Sub id="grid-reference" title="The reference grid">
              <p>The files under <code className="inline-code">examples/</code> are one reference grid saved in every format. Comparing them node by node established the rules above and confirmed the converters agree.</p>
              <Table
                caption="Reference geometry shared by all bundled grid examples."
                head={['Property', 'Value']}
                rows={[
                  ['Columns × rows', '152 × 252'],
                  ['X bounds', '358413 → 365963'],
                  ['Y bounds', '3142534 → 3155084'],
                  ['Increments', '50 × 50'],
                  ['Nodes', '38,304'],
                  ['Null nodes', '156'],
                  ['Value range', '5899.32959 → 7601.849609'],
                  ['CRS', 'ED50 / UTM zone 34N'],
                ]}
              />
              <p>After the ordering and null fixes, every source example exported to CPS-3 matched the bundled CPS-3 reference with <b>zero value differences and zero null mismatches</b>. The only numeric difference was the ZMAP+ file's float32 precision, at most <code className="inline-code">5e-5</code>. A second, deliberately different 37 × 23 synthetic grid round-tripped through every format the same way.</p>
            </Sub>

            <Sub id="grid-caution" title="Interoperability">
              <Callout tone="caution" title="Confirm in the receiving software before operational use">
                <p>File dialects and node-traversal conventions vary by application and version. The rules here describe the bundled ZIMS/Kingdom exports and the formats they produce, not every possible writer. No reprojection or vertical unit conversion is performed. Always compare converted grids in the target software — orientation, null nodes, coordinates, units, and CRS — before relying on them.</p>
              </Callout>
            </Sub>
          </section>

          <section className="docs-section" id="line-formats">
            <div className="section-head">
              <span className="section-glyph"><Waypoints size={20} aria-hidden="true" /></span>
              <div><h2>Culture — Lines, Points &amp; Fault Sticks</h2><p className="section-sub">Open line and point geometry · Peforma Culture</p></div>
            </div>
            <p>The Culture Lines/Points/Fault-sticks converter handles open geometry — point sets and polylines, including fault sticks — across three formats. Closed polygon geometry belongs to the Polygon converter in the next section; shapefile interchange belongs to Peforma Shapefile, so neither is offered here.</p>

            <Sub id="lines-delimited" title="Delimited text">
              <p>Comma, semicolon, tab, and whitespace-separated files (CSV, TSV, XYZ) are all read. The delimiter is detected from the first line. The first row decides whether a header is present:</p>
              <ul className="doc-list">
                <li>An <b>all-numeric first row is data</b> — the file has no header, and every column is anonymous.</li>
                <li>A <b>non-numeric first row is a header</b> — its labels name the columns, and a mapping is pre-seeded from labels that clearly name each axis.</li>
              </ul>
              <CodeBlock label="Headered CSV — mapping suggested from labels" code={`X,Y,Z,Name
358413,3142534,6012.34,FAULT_A
358463,3142584,6018.10,FAULT_A
358513,3142634,6025.77,FAULT_A`} />
              <p>Suggested columns come only from unambiguous labels: <code className="inline-code">x / lon / easting</code>, <code className="inline-code">y / lat / northing</code>, <code className="inline-code">z / elevation / depth / tvd / md</code>, and <code className="inline-code">name / id / line / well / fault</code>. Anything else stays unmatched so you decide.</p>
              <p>A fault stick is an ordinary polyline. In line mode, consecutive rows that share a fault name form one stick, and the fault name travels as an attribute. A fault plane is a triangulated surface, not line data, so it belongs to Peforma 3D rather than this converter.</p>
              <Callout tone="info" title="Headerless files need an explicit mapping">
                <p>Without a header there are no labels to suggest from, so you must assign the X and Y columns before the rows are treated as geometry. In line mode, consecutive rows are grouped into one polyline and a new line starts whenever the mapped Name column changes; a polyline needs at least two vertices.</p>
              </Callout>
            </Sub>

            <Sub id="lines-geojson" title="GeoJSON">
              <p>A <code className="inline-code">.geojson</code> or <code className="inline-code">.json</code> file is parsed as JSON. Feature, FeatureCollection, and bare geometry objects are all accepted.</p>
              <Table
                caption="GeoJSON geometry support in Culture Lines/Points."
                head={['Geometry', 'Treatment']}
                rows={[
                  ['Point', 'One point'],
                  ['MultiPoint', 'A point set'],
                  ['LineString', 'One open polyline'],
                  ['MultiLineString', 'Several polylines'],
                  ['Polygon / MultiPolygon', 'Skipped — Culture Polygon handles these'],
                  ['GeometryCollection', 'Skipped with a count'],
                ]}
              />
              <p>The CRS is read from <code className="inline-code">crs.name</code> and preserved as a label. Feature properties become attributes and are written back unchanged.</p>
            </Sub>

            <Sub id="lines-gocad" title="GOCAD ASCII">
              <p>A <code className="inline-code">UP TO</code>, <code className="inline-code">PLINE</code>, or <code className="inline-code">VSET</code> marker near the top of the file selects GOCAD. Only <code className="inline-code">PLINE</code> (polylines) and <code className="inline-code">VSET</code> (point sets) are supported here; <code className="inline-code">TSURF</code> belongs to the surface tool.</p>
              <CodeBlock label="GOCAD ASCII — a polyline and a point set" code={`UP TO
CRS: ED50 / UTM zone 34N
UNITS: m

PLINE 3 4 FAULT_A
358413 3142534 6012.34
358463 3142584 6018.10
358513 3142634 6025.77

VSET 1 WELL_01
358700 3142900 6100.00`} />
              <p>The header's <code className="inline-code">CRS</code> and <code className="inline-code">UNITS</code> fields are preserved as text and never reinterpreted. Each vertex is read as <code className="inline-code">X Y (Z)</code>; a missing Z stays missing rather than becoming zero.</p>
            </Sub>

            <Sub id="lines-integrity" title="Geometry integrity">
              <p>Whatever the format, the internal model keeps two geometry kinds — point set and polyline — and preserves everything that matters:</p>
              <ul className="doc-list">
                <li><b>Vertex order</b> is kept exactly as read.</li>
                <li><b>Attribute values</b> travel with their object and are written back unchanged.</li>
                <li>A <b>missing Z</b> is distinct from a <b>zero Z</b> — the distinction is never collapsed.</li>
                <li><b>CRS and units labels</b> are carried through as text. No reprojection or unit conversion is performed.</li>
              </ul>
              <p>Outputs are delimited CSV (<code className="inline-code">X,Y,Z,Name,…</code>), a GeoJSON FeatureCollection, and GOCAD ASCII. Coordinate order, precision, and labels are written exactly as read.</p>
            </Sub>
          </section>

          <section className="docs-section" id="polygon-formats">
            <div className="section-head">
              <span className="section-glyph"><Waypoints size={20} aria-hidden="true" /></span>
              <div><h2>Culture — Polygon</h2><p className="section-sub">Closed rings, holes, and orientation · Peforma Culture</p></div>
            </div>
            <p>The Polygon converter handles closed area geometry. A polygon is an ordered list of rings: the first ring is the exterior and every later ring is a hole. It reads GeoJSON <code className="inline-code">Polygon</code>/<code className="inline-code">MultiPolygon</code> and closed GOCAD PLINE curves, and writes either format.</p>

            <Sub id="polygon-reading" title="Reading rings">
              <p>A GeoJSON ring is treated as stored-closed when its last position repeats its first X/Y position. A GOCAD PLINE is treated as closed when the last vertex repeats the first, or when a <code className="inline-code">SEG</code> record joins the last vertex to the first; both one-based and zero-based segment indices are accepted. An open GOCAD curve is skipped with a warning because open curves belong to Lines/Points.</p>
              <CodeBlock label="GOCAD closed curve — the repeated first vertex marks closure" code={`UP TO
CRS: EPSG:32611
UNITS: m

PLINE 5 4 PROSPECT_A
0 0 0
1000 0 0
1000 800 0
0 800 0
0 0 0`} />
              <p>Polygon order, ring order, hole order, vertex order, duplicate vertices, stored closure, ring direction, attributes, CRS, and units are reported exactly as read. Nothing is reordered, joined, or repaired.</p>
            </Sub>

            <Sub id="polygon-writing" title="Writing rings">
              <p>GeoJSON output closes every ring and applies RFC 7946 orientation: exterior rings counter-clockwise and holes clockwise. Every ring that had to be closed or reversed is counted in a warning, so a change is never silent.</p>
              <p>GOCAD output writes each ring as its own closed <code className="inline-code">PLINE</code> by repeating the first vertex. GOCAD has no hole or multipart structure, so holes and multipart areas become separate curves, and attributes other than the object name cannot be carried; each loss is reported.</p>
              <Table
                caption="What each Polygon target applies and what it cannot carry."
                head={['Target', 'Closure', 'Orientation', 'Cannot carry']}
                rows={[
                  ['GeoJSON', 'Every ring closed', 'RFC 7946 — exterior CCW, holes CW', 'Nothing beyond the model’s attributes'],
                  ['GOCAD ASCII', 'Every ring closed by repeating the first vertex', 'Stored direction kept', 'Holes, multipart containers, non-name attributes'],
                ]}
              />
            </Sub>

            <Sub id="polygon-integrity" title="Ring integrity">
              <ul className="doc-list">
                <li><b>Polygon, ring, hole, and vertex order</b> are preserved exactly.</li>
                <li><b>Stored closure</b> is reported on read; the target convention is applied only on write and every change is counted.</li>
                <li><b>Orientation</b> is computed from the signed area and reported as stored. A zero-area ring has no reportable direction.</li>
                <li><b>Self-intersecting rings</b> are detected and reported, never repaired. Large rings above the check budget are reported as unchecked.</li>
                <li><b>Consecutive duplicate vertices</b> stay in place; a closed ring whose repeated first position has a different Z keeps both values.</li>
                <li><b>CRS and units</b> are carried as text. No reprojection or unit conversion is performed.</li>
              </ul>
            </Sub>
          </section>

          <section className="docs-section" id="shapefile-formats">
            <div className="section-head">
              <span className="section-glyph"><Files size={20} aria-hidden="true" /></span>
              <div><h2>Shapefile</h2><p className="section-sub">Esri Shapefile sets &amp; GeoJSON · Peforma Shapefile</p></div>
            </div>
            <p>Peforma Shapefile reads and writes the Esri Shapefile bundle and GeoJSON, including point, multipoint, polyline, polygon, and multipolygon geometry. Record order, vertex order, attribute values, and present Z values are preserved. No reprojection or unit conversion is performed.</p>

            <Sub id="shapefile-bundle" title="The bundle">
              <p>A shapefile is a set of files that share one base name. All parts are read together:</p>
              <CodeBlock label="A complete set — roads.shp, roads.shx, roads.dbf, roads.prj" code={`roads.shp   geometry records
roads.shx   record offsets
roads.dbf   attribute table
roads.prj   coordinate reference definition (WKT)
roads.cpg   text encoding, when present`} />
              <ul className="doc-list">
                <li><b>.shp and .dbf are required.</b> A set without either is rejected rather than read partially.</li>
                <li><b>.shx is optional</b> but, when present, its record count must match the .shp file. The .dbf row count must match too.</li>
                <li>Geometry is read directly from record content, so a missing .shx produces a warning, not a wrong result.</li>
                <li>Attribute text is decoded as UTF-8 first and falls back to Windows-1252 when those bytes are not valid UTF-8.</li>
                <li>Null geometry records are skipped and counted. Records flagged deleted in the .dbf table keep their geometry and are listed with empty attributes.</li>
              </ul>
            </Sub>

            <Sub id="shapefile-geometry" title="Geometry types">
              <p>The shape type is read from each record, not assumed from the file header. Z variants are decoded as Z; measure (M) variants are read but M values are ignored and reported.</p>
              <Table
                caption="Shape type codes Peforma Shapefile reads and writes."
                head={['Shape type', 'Geometry', 'Z variant']}
                rows={[
                  ['1', 'Point', '11'],
                  ['3', 'PolyLine', '13'],
                  ['5', 'Polygon', '15'],
                  ['8', 'MultiPoint', '18'],
                  ['0', 'Null record', '—'],
                ]}
              />
              <p>Within a polygon record, exterior rings are clockwise and holes are counter-clockwise. Parts are grouped into polygons by that orientation when the bundle is read, so a multi-area record becomes a MultiPolygon rather than one polygon with unrelated rings.</p>
            </Sub>

            <Sub id="shapefile-writing" title="Writing a set">
              <p>GeoJSON output is RFC 7946. Linear rings are closed, exterior rings are written counter-clockwise, and holes clockwise. A short CRS label is written in the legacy <code className="inline-code">crs</code> member; a WKT definition is kept verbatim in a <code className="inline-code">peforma_crs_wkt</code> member so it can be written back to a .prj.</p>
              <p>Shapefile output is a ZIP holding one set per geometry kind. A single shapefile can carry only one geometry type, so a source that mixes points, lines, and polygons produces separate sets inside the ZIP. The applied conventions are reported in the tool:</p>
              <ul className="doc-list">
                <li><b>Z values</b> are written only when every vertex in the set has a Z. A set that mixes present and missing Z is written without Z, with a warning.</li>
                <li><b>Ring closure and ring orientation</b> are applied to the target convention — clockwise exteriors and counter-clockwise holes — and the count of changed rings is reported.</li>
                <li><b>DBF field names</b> are limited to 10 ASCII characters and must be unique; a renamed field is reported. Values keep their text, number, or boolean type.</li>
                <li>A DBF field has no null marker, so a missing attribute value is written as a blank and counted in the warnings.</li>
                <li>Non-ASCII attribute text is written as UTF-8 and a matching <code className="inline-code">.cpg</code> file is included in the ZIP.</li>
              </ul>
            </Sub>

            <Sub id="shapefile-caution" title="Interoperability">
              <Callout tone="caution" title="Confirm in the receiving software before operational use">
                <p>Shapefile readers differ in their support for Z values, UTF-8 attribute text, field widths, and deleted-record handling. Attribute values are not reinterpreted, and coordinate reference definitions are carried as text without reprojection. Compare record order, geometry, attributes, ring orientation, CRS, and Z values in the target application before relying on an exchange.</p>
              </Callout>
            </Sub>
          </section>

          <section className="docs-section" id="mesh-formats">
            <div className="section-head">
              <span className="section-glyph"><Box size={20} aria-hidden="true" /></span>
              <div><h2>3D meshes</h2><p className="section-sub">Triangulated surfaces &amp; geobody shells · Peforma 3D</p></div>
            </div>
            <p>Peforma 3D reads and writes triangular meshes in ASCII and binary STL, Wavefront OBJ, PLY (ASCII and binary little-endian), and GOCAD TSurf. Vertex order, face connectivity, group names, and the normals a file carries are preserved. Closure and normal consistency are measured and reported; nothing is welded, capped, flipped, or re-tessellated.</p>

            <Sub id="mesh-objects" title="Surfaces &amp; solids">
              <p>Both pages use the same reader, writer, and summary. <b>Fault planes &amp; horizons</b> at <code className="inline-code">#3d-surfaces</code> covers fault planes, faulted horizons, and salt tops — surfaces that are usually open at their edges. <b>Geobodies &amp; solids</b> at <code className="inline-code">#3d-solids</code> covers faceted geobodies, salt bodies, and tetrahedral solids, and flags a shell that is not watertight before export.</p>
              <Table
                caption="Where a fault object belongs. Geometry and grid topology decide the owner, not the file extension."
                head={['Object', 'Geometry', 'Tool']}
                rows={[
                  ['Fault stick, well trajectory', 'Open polyline', 'Culture Lines/Points/Fault-sticks'],
                  ['Fault plane, horizon, salt top', 'Triangulated surface', 'Peforma 3D surfaces'],
                  ['Geobody, salt body, tetrahedral solid', 'Closed mesh or tetrahedral cells', 'Peforma 3D solids'],
                  ['Fault polygon, prospect outline', 'Closed planar ring', 'Culture Polygon or Shapefile'],
                  ['Fault pillar, corner-point grid', 'Paired pillars and cell topology', 'Not a mesh format — out of scope'],
                  ['2D seismic line, 3D cube', 'Volume of traces', 'Peforma Seismic'],
                ]}
              />
              <p>A fault stick and the fault plane built through it are different objects. Peforma 3D never infers a surface from sticks, and no tessellation format carries fault pillars or corner-point topology.</p>
            </Sub>

            <Sub id="mesh-stl" title="STL">
              <p>STL stores triangles only. ASCII STL is read from <code className="inline-code">facet normal</code>, three <code className="inline-code">vertex</code> records, and <code className="inline-code">endfacet</code>; the <code className="inline-code">solid</code> name is kept when present. Binary STL is read from the 80-byte header, a 32-bit count, and 50-byte records. The file length must equal <code className="inline-code">84 + 50 × count</code>, or the file is rejected.</p>
              <ul className="doc-list">
                <li>Every facet carries its own three vertices, so STL has no shared vertex list. Peforma stores the facet vertices as written and detects closure by exact coordinate matching, not by index.</li>
                <li>Per-facet normals are kept as face normals. A zero facet normal means "not supplied", not a direction.</li>
                <li>Binary attribute words, which some writers use for colour, are counted and not carried.</li>
                <li>STL output writes the solid name; groups, vertex normals, CRS, and units are reported as not written.</li>
              </ul>
            </Sub>

            <Sub id="mesh-obj" title="Wavefront OBJ">
              <p>OBJ is read for <code className="inline-code">v</code> vertices, <code className="inline-code">vn</code> normals, triangular <code className="inline-code">f</code> faces, and <code className="inline-code">o</code>/<code className="inline-code">g</code> names. Negative indices count back from the end of the current list, as the format defines. A face with more than three vertices is rejected rather than triangulated, because splitting it would add faces the source never had.</p>
              <ul className="doc-list">
                <li><code className="inline-code">o</code> and <code className="inline-code">g</code> records become named face groups. Faces before the first group stay ungrouped.</li>
                <li>Vertex normals are kept per vertex, not per face. A vertex assigned two different normals by different faces is rejected as contradictory.</li>
                <li>Texture coordinates, material libraries, and smoothing records are counted and reported, not carried.</li>
                <li>On write, <code className="inline-code">vn</code> records are emitted only for vertices that carried a normal. Faces whose vertices have no normal are written as plain <code className="inline-code">f</code> references, so a normal is never invented.</li>
              </ul>
            </Sub>

            <Sub id="mesh-ply" title="PLY">
              <p>PLY is read in ASCII and binary little-endian. The header's property list is honoured exactly: <code className="inline-code">x</code>, <code className="inline-code">y</code>, and <code className="inline-code">z</code> are required; vertex normals are read only when all three of <code className="inline-code">nx</code>, <code className="inline-code">ny</code>, and <code className="inline-code">nz</code> are present.</p>
              <ul className="doc-list">
                <li>A face must be an integer property list. A non-triangle face is rejected, and a list-bearing element other than face is rejected because its byte length cannot be computed safely.</li>
                <li>Big-endian binary PLY is rejected with the declared endianness named.</li>
                <li>Other vertex and face properties, texture coordinates, and extra elements are counted and not carried.</li>
                <li>PLY output writes double-precision coordinates, an optional complete vertex-normal set, and a <code className="inline-code">uchar</code>/<code className="inline-code">uint</code> face index list.</li>
              </ul>
            </Sub>

            <Sub id="mesh-tsurf" title="GOCAD TSurf">
              <p>GOCAD TSurf is read from <code className="inline-code">VRTX</code>, <code className="inline-code">PVRTX</code>, and <code className="inline-code">TRGL</code> records. GOCAD ids are mapped to zero-based vertex indices; a record that references an id no vertex declares is an error, never a silent skip.</p>
              <ul className="doc-list">
                <li><code className="inline-code">name</code>, <code className="inline-code">*CRS</code>, and <code className="inline-code">*UNITS</code> are preserved as free text and never interpreted as EPSG codes.</li>
                <li><code className="inline-code">PROPERTY</code> records and extra <code className="inline-code">PVRTX</code> values are counted and not carried.</li>
                <li>A <code className="inline-code">TSolid</code> is detected and rejected with a tier-2 message; it is a solid-cell format, not a triangle surface.</li>
                <li>TSurf output writes <code className="inline-code">GOCAD TSurf 1</code>, a <code className="inline-code">HEADER</code> with the name, CRS, and units that were present, <code className="inline-code">TFACE</code>, sequential <code className="inline-code">VRTX</code> records, <code className="inline-code">TRGL</code> records, and <code className="inline-code">END</code>. Groups and normals are not written.</li>
              </ul>
            </Sub>

            <Sub id="mesh-integrity" title="Mesh integrity">
              <p>Closure is measured from edge use. An edge used by one face is an open boundary; an edge used by more than two faces is non-manifold; a mesh is closed only when every edge is used exactly twice. STL closure is measured by exact coordinate matching because STL has no shared vertex list. Normal consistency is measured from the direction each shared edge is traversed by its two faces.</p>
              <ul className="doc-list">
                <li>Open boundaries, non-manifold edges, degenerate faces, and inconsistent normals are reported, never repaired. No face is added, removed, welded, or flipped.</li>
                <li>When neither a vertex nor a face normal is stored, the normal state is <b>None</b>. When normals exist but no edges are shared, it is <b>Undetermined</b>.</li>
                <li>Files up to 64 MB are read fully. A larger file is rejected with its size stated and is never truncated.</li>
                <li>The 3D preview draws at most 20,000 faces and states when the view is a sample. The numeric summary is always computed over the whole mesh.</li>
              </ul>
              <Callout tone="caution" title="Confirm in the receiving software before operational use">
                <p>Closure, normal direction, and group names are properties of the file, not of the tool that reads it. A target format may not carry groups, vertex normals, face normals, CRS, or units; every such loss is counted and reported. Compare vertex count, face count, bounds, orientation, and normals in the target application before relying on an exchange.</p>
              </Callout>
            </Sub>
          </section>

          <section className="docs-section" id="units">
            <div className="section-head">
              <span className="section-glyph"><Ruler size={20} aria-hidden="true" /></span>
              <div><h2>Units</h2><p className="section-sub">Ten engineering categories · Peforma Units</p></div>
            </div>
            <p>Peforma Units converts ten categories using exact, fixed factors. Each linear unit stores its size in the category's base unit; temperature uses explicit offset formulas instead of a multiplier.</p>

            <Sub id="units-factors" title="Exact factors">
              <Table
                caption="Selected exact conversion factors. The base unit of each category has factor 1."
                head={['Category', 'Unit', 'Exact factor']}
                rows={[
                  ['Length', 'foot (ft)', '0.3048 m'],
                  ['Length', 'mile (mi)', '1609.344 m'],
                  ['Area', 'acre', '4046.8564224 m²'],
                  ['Volume', 'barrel (bbl)', '0.158987294928 m³'],
                  ['Volume', 'gallon, US', '0.003785411784 m³'],
                  ['Mass', 'pound (lb)', '0.45359237 kg'],
                  ['Pressure', 'psi', '6894.757293168 Pa'],
                  ['Pressure', 'atmosphere (atm)', '101325 Pa'],
                  ['Density', 'pound per gallon (ppg)', '119.82642731689663 kg/m³'],
                  ['Time', 'mean year (yr)', '31556952 s'],
                  ['Speed', 'mile per hour (mph)', '0.44704 m/s'],
                  ['Torque', 'pound foot (lb·ft)', '1.3558179483314004 N·m'],
                ]}
              />
              <p>The ten categories are length, temperature, area, volume, mass, pressure, density, time, speed, and torque. Temperature converts between Celsius, Fahrenheit, kelvin, and Rankine with exact offset formulas rather than a single factor.</p>
            </Sub>

            <Sub id="units-definitions" title="Definitions">
              <Callout tone="info" title="Conventions that are easy to get wrong">
                <p>Ton is the metric tonne (1,000 kg). Month is the mean Gregorian month (2,629,746 s) and year is 365.2425 days; quarter, decade, and century follow that year. Barrel is 42 US gallons, ppg is pound per US gallon, and atmosphere is 101,325 Pa. These definitions are fixed so a conversion means the same thing every time.</p>
              </Callout>
            </Sub>
          </section>
        </article>
      </div>

      <button
        type="button"
        className={`docs-to-top${showTop ? ' visible' : ''}`}
        onClick={toTop}
        aria-label="Back to top"
        tabIndex={showTop ? 0 : -1}
      >
        <ArrowUp size={18} aria-hidden="true" />
      </button>
    </>
  );
}