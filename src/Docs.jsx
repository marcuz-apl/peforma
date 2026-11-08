import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, BookOpen, Check, Copy, FileText, Grid3x3, Info, LockKeyhole, Ruler, ShieldCheck, TriangleAlert, Waypoints } from 'lucide-react';

// In-page navigation. The hash router owns top-level routes (#converter, #units,
// #lines, #docs), so these anchors never change the hash: clicking one scrolls the
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
    id: 'line-formats', label: 'Lines & Points', icon: Waypoints, children: [
      { id: 'lines-delimited', label: 'Delimited text' },
      { id: 'lines-geojson', label: 'GeoJSON' },
      { id: 'lines-gocad', label: 'GOCAD ASCII' },
      { id: 'lines-integrity', label: 'Geometry integrity' },
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
            <p>Three tools are live today. <b>Peforma Grid/2D-Map</b> converts regular grid surfaces — depth or time horizons — between CPS-3, ZMAP+, IRAP Classic, and EarthVision ASCII. <b>Peforma Lines/Points</b> converts open line and point geometry between delimited text, GeoJSON, and GOCAD ASCII. <b>Peforma Units</b> converts ten engineering categories with exact factors. Polygons, 3D, Seismic, and Coordinates are planned and labelled as such in the suite rail.</p>
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
              <div><h2>Grid formats</h2><p className="section-sub">Depth &amp; time surfaces · Peforma Grid/2D-Map</p></div>
            </div>
            <p>Peforma Grid/2D-Map reads four ASCII grid dialects and writes the same four. Internally every grid is stored once, in a single canonical order, and each exporter reorders from that model. This is why a CPS-3 file and an EarthVision file of the same surface produce identical node values after conversion. The Z values may be depth, two-way time, or another sampled attribute; they are copied verbatim and never rescaled, so a time horizon converts exactly like a depth structure map.</p>

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
              <div><h2>Lines & Points</h2><p className="section-sub">Open line and point geometry · Peforma Lines/Points</p></div>
            </div>
            <p>Peforma Lines/Points handles open geometry — point sets and polylines — across three formats. Closed polygon topology belongs to the planned Peforma Polygons tool, and shapefile writing is shared with it, so neither is offered here.</p>

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
              <Callout tone="info" title="Headerless files need an explicit mapping">
                <p>Without a header there are no labels to suggest from, so you must assign the X and Y columns before the rows are treated as geometry. In line mode, consecutive rows are grouped into one polyline and a new line starts whenever the mapped Name column changes; a polyline needs at least two vertices.</p>
              </Callout>
            </Sub>

            <Sub id="lines-geojson" title="GeoJSON">
              <p>A <code className="inline-code">.geojson</code> or <code className="inline-code">.json</code> file is parsed as JSON. Feature, FeatureCollection, and bare geometry objects are all accepted.</p>
              <Table
                caption="GeoJSON geometry support in Lines/Points."
                head={['Geometry', 'Treatment']}
                rows={[
                  ['Point', 'One point'],
                  ['MultiPoint', 'A point set'],
                  ['LineString', 'One open polyline'],
                  ['MultiLineString', 'Several polylines'],
                  ['Polygon / MultiPolygon', 'Skipped — a Peforma Polygons case'],
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