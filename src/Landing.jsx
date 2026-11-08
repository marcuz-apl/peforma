import React, { useEffect, useRef, useState } from 'react';
import {
  Accessibility, ArrowRight, ArrowUpRight, AudioWaveform, BookOpen, Box, ChevronDown,
  ExternalLink, Globe2, Grid3x3, Layers3, Lock, Mail, MapPin, Menu, Pentagon, Ruler,
  ScanSearch, ShieldCheck, Waypoints, X,
} from 'lucide-react';
import { AppFooter, LinkedinIcon, ThemeToggle, Wordmark } from './chrome.jsx';
import heroImg from './assets/peforma-hero.png';
import morphImg from './assets/peforma-morph.png';

// The marketing front door. It sits above the tool routes: the bare origin lands
// here, and every CTA hands off to a converter hash without leaving the SPA.

const NAV_LINKS = [
  { id: 'services', label: 'Services' },
  { id: 'contact', label: 'Contact' },
];

const LIVE_SUITES = [
  {
    key: 'grid', icon: Grid3x3, name: 'Peforma Grid/2D-Map', href: '#converter',
    blurb: 'Depth or time grid surfaces moved between the four ASCII dialects interpretation packages actually read.',
    formats: ['CPS-3', 'EarthVision', 'IRAP Classic', 'ZMAP+'],
  },
  {
    key: 'lines', icon: Waypoints, name: 'Peforma Lines/Points', href: '#lines',
    blurb: 'Points and polylines exchanged with vertex order, attributes, and missing-Z distinctions left intact.',
    formats: ['CSV', 'GeoJSON', 'GOCAD'],
  },
  {
    key: 'units', icon: Ruler, name: 'Peforma Units', href: '#units',
    blurb: 'Ten engineering categories on exact factors — pressure, volume, density, temperature, and the rest.',
    formats: ['10 categories', 'Exact factors'],
  },
];

const ROADMAP = [
  { key: 'polygons', icon: Pentagon, name: 'Peforma Polygons' },
  { key: '3d', icon: Box, name: 'Peforma 3D' },
  { key: 'seismic', icon: AudioWaveform, name: 'Peforma Seismic' },
  { key: 'coordinates', icon: Globe2, name: 'Peforma Coordinates' },
];

const GUARANTEES = [
  { icon: Lock, title: 'Local by design', body: 'Parsing and writing run inside your browser session, on your machine.' },
  { icon: ShieldCheck, title: 'Exact preservation', body: 'Node count, bounds, ordering, values, and nulls survive the round trip.' },
  { icon: ScanSearch, title: 'Content-based detection', body: 'A format is recognised from its contents, never from the file extension.' },
  { icon: Accessibility, title: 'Built for everyone', body: 'Keyboard navigable and screen-reader friendly, in light or dark.' },
];

const STATS = [
  { value: '4', label: 'grid dialects' },
  { value: '3', label: 'live converters' },
  { value: '10', label: 'unit categories' },
  { value: '0', label: 'values lost' },
];

const FORMAT_RIBBON = [
  { name: 'CPS-3', tone: 'cps3' },
  { name: 'EarthVision', tone: 'earthvision' },
  { name: 'IRAP Classic', tone: 'irap' },
  { name: 'ZMAP+', tone: 'zmap' },
  { name: 'CSV', tone: '' },
  { name: 'GeoJSON', tone: '' },
  { name: 'GOCAD PLINE', tone: '' },
];

const MORPH_PAIRS = [
  ['IRAP Classic', 'ZMAP+'],
  ['EarthVision', 'CPS-3'],
  ['ZMAP+', 'IRAP Classic'],
  ['CPS-3', 'EarthVision'],
];

// lucide-react dropped brand glyphs, so GitHub is a self-drawn monochrome mark.
function GithubIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88 1.54-3.88 1.54-.52 1.33-1.28 1.68-1.28 1.68-1.05.72.08.71.08.71 1.16-.08 1.77-1.19 1.77-1.19 1.03-1.77 2.7-1.26 3.36-.96.1.75.4 1.26.73 1.55 2.55-.29 5.23-1.28 5.23-5.7 0-1.26-.45-2.29-1.19-3.1.12-.29.52-1.46-.11-3.05 0 0-.97-.31-3.18 1.18a11.1 11.1 0 0 0-5.8 0C7.28 5.5 6.31 5.81 6.31 5.81c-.63 1.59-.23 2.76-.11 3.05-.74.81-1.19 1.84-1.19 3.1 0 4.41 2.68 5.42 5.22 5.71-.33.28-.62.78-.72 1.51-.65.29-2.3.79-3.31-.94 0 0-.6-1.09-1.74-1.17 0 0-1.11-.02-.08.69 0 0 .74.35 1.25 1.65 0 0 .66 2.02 3.78 1.34.01.92.02 1.79.02 2.03 0 .31.21.67.8.56A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function LandingNav({ themePref, resolvedTheme, onThemeChange, scrolled, active, menuOpen, setMenuOpen }) {
  const close = () => setMenuOpen(false);
  return (
    <header className={`lp-nav${scrolled ? ' scrolled' : ''}${menuOpen ? ' menu-open' : ''}`}>
      <div className="shell lp-nav-inner">
        <a className="lp-brand" href="#top" onClick={close} aria-label="Peforma home">
          <span className="brand-icon"><Layers3 size={22} aria-hidden="true" /></span>
          <span className="brand-text">
            <Wordmark />
            <span className="brand-slogan">We morph data</span>
          </span>
        </a>
        <nav className="lp-links" aria-label="Landing sections">
          {NAV_LINKS.map(link => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className={`lp-link${active === link.id ? ' active' : ''}`}
              aria-current={active === link.id ? 'true' : undefined}
            >
              {link.label}
            </a>
          ))}
          <a className="lp-link" href="#docs">Docs</a>
        </nav>
        <div className="lp-nav-right">
          <ThemeToggle preference={themePref} resolved={resolvedTheme} onChange={onThemeChange} />
          <a className="lp-cta lp-cta-sm" href="#converter">
            Open toolbox <ArrowRight size={15} aria-hidden="true" />
          </a>
          <button
            type="button"
            className="lp-menu-button"
            aria-expanded={menuOpen}
            aria-controls="lp-mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen(v => !v)}
          >
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div id="lp-mobile-menu" className={`lp-mobile-menu${menuOpen ? ' open' : ''}`} hidden={!menuOpen}>
        {NAV_LINKS.map(link => (
          <a key={link.id} href={`#${link.id}`} className="lp-mobile-link" onClick={close}>{link.label}</a>
        ))}
        <a href="#docs" className="lp-mobile-link" onClick={close}>Docs</a>
        <a href="#converter" className="lp-cta" onClick={close}>Open the toolbox <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
    </header>
  );
}

function Hero() {
  const bgRef = useRef(null);
  const [pair, setPair] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const onScroll = () => {
      if (bgRef.current) {
        const y = Math.min(window.scrollY, 900);
        bgRef.current.style.transform = `translate3d(0, ${y * 0.16}px, 0) scale(1.08)`;
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setPair(v => (v + 1) % MORPH_PAIRS.length), 3400);
    return () => window.clearInterval(timer);
  }, []);

  const [from, to] = MORPH_PAIRS[pair];
  return (
    <section id="top" className="lp-hero">
      <div ref={bgRef} className="lp-hero-bg" style={{ backgroundImage: `url(${heroImg})` }} aria-hidden="true" />
      <div className="lp-hero-scrim" aria-hidden="true" />
      <svg className="lp-contours" viewBox="0 0 1440 720" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M-40 560 C 240 500, 420 620, 720 560 S 1180 470, 1480 540" />
        <path d="M-40 610 C 260 550, 440 670, 740 610 S 1200 520, 1480 590" />
        <path d="M-40 660 C 280 600, 460 720, 760 660 S 1220 570, 1480 640" />
        <path d="M-40 505 C 220 450, 400 565, 700 505 S 1160 420, 1480 485" />
      </svg>
      <div className="shell lp-hero-inner">
        <div className="lp-hero-copy">
          <div className="lp-kicker lp-reveal"><span className="lp-pulse" aria-hidden="true" /> An Alfazen product · Calgary, Alberta</div>
          <h1 className="lp-reveal">We morph data.<br /><em>You keep every value.</em></h1>
          <p className="lp-lead lp-reveal">
            Peforma is a browser-native toolbox for oil-and-gas data exchange. Move grids, lines, points,
            and engineering units between the dialects your interpretation software speaks — exactly,
            locally, and losslessly.
          </p>
          <div className="lp-hero-actions lp-reveal">
            <a className="lp-cta" href="#converter">Open the toolbox <ArrowRight size={17} aria-hidden="true" /></a>
            <a className="lp-ghost" href="#services">Explore the suites <ChevronDown size={16} aria-hidden="true" /></a>
          </div>
          <dl className="lp-stats lp-reveal">
            {STATS.map(stat => (
              <div key={stat.label} className="lp-stat">
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="lp-hero-card" aria-hidden="true">
          <div className="lp-hero-card-head"><span className="lp-pulse" /> Live converter</div>
          <div className="lp-morph-row" key={pair}>
            <span className="lp-morph-from">{from}</span>
            <ArrowRight size={16} className="lp-morph-arrow" />
            <span className="lp-morph-to">{to}</span>
          </div>
          <div className="lp-hero-card-meta">38,304 nodes · 156 nulls · 0 values changed</div>
        </div>
      </div>
      <div className="lp-format-ribbon shell" aria-label="Supported formats">
        {FORMAT_RIBBON.map(fmt => (
          <span key={fmt.name} className="lp-format-chip">
            {fmt.tone && <span className={`fmt-dot ${fmt.tone}`} aria-hidden="true" />}
            {fmt.name}
          </span>
        ))}
      </div>
      <a className="lp-scroll-cue" href="#services" aria-label="Scroll to services">
        <ChevronDown size={18} aria-hidden="true" />
      </a>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="lp-section lp-services">
      <div className="shell">
        <div className="lp-section-head lp-reveal">
          <div className="lp-kicker">The toolbox</div>
          <h2>One family. <em>Every exchange.</em></h2>
          <p>Start with the converters that are live today. The rest of the family is on the way — same shell, same guarantees.</p>
        </div>
        <div className="lp-suite-grid">
          {LIVE_SUITES.map((suite, i) => (
            <a key={suite.key} href={suite.href} className="lp-suite-card lp-reveal" style={{ '--i': i }}>
              <div className="lp-suite-top">
                <span className="lp-suite-icon"><suite.icon size={22} aria-hidden="true" /></span>
                <span className="lp-live-tag">Live</span>
              </div>
              <h3>{suite.name}</h3>
              <p>{suite.blurb}</p>
              <div className="lp-suite-formats">
                {suite.formats.map(f => <span key={f} className="lp-format-chip small">{f}</span>)}
              </div>
              <span className="lp-suite-open">Open converter <ArrowUpRight size={15} aria-hidden="true" /></span>
            </a>
          ))}
        </div>
        <div className="lp-roadmap lp-reveal">
          <span className="lp-roadmap-label">On the roadmap</span>
          <div className="lp-roadmap-items">
            {ROADMAP.map(item => (
              <span key={item.key} className="lp-roadmap-item">
                <item.icon size={16} aria-hidden="true" />
                {item.name}
                <span className="lp-soon">Soon</span>
              </span>
            ))}
          </div>
        </div>

        <div className="lp-morph-band">
          <figure className="lp-morph-figure lp-reveal">
            <img src={morphImg} alt="Topographic contours morphing into a regular node grid, illustrating lossless format conversion" loading="lazy" />
            <figcaption>Contours in, node grid out — the same surface, a different dialect.</figcaption>
          </figure>
          <div className="lp-morph-copy lp-reveal">
            <h3>From one dialect to another.</h3>
            <p>
              Every Peforma converter reads a format the way its authoring package writes it, then writes
              the target the way the receiving package expects it. Nothing is interpolated, resampled,
              or quietly rounded along the way.
            </p>
            <ul className="lp-guarantees">
              {GUARANTEES.map(g => (
                <li key={g.title}>
                  <span className="lp-guarantee-icon"><g.icon size={18} aria-hidden="true" /></span>
                  <div><b>{g.title}</b><span>{g.body}</span></div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lp-integrity lp-reveal">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <b>Geometry, values, ordering, and nulls survive every conversion.</b>
            <p>Confirm coordinate units, datum, and null conventions in your receiving application before production use.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const CONTACT_ROWS = [
  { icon: Mail, label: 'Email', value: 'info@alfazen.org', href: 'mailto:info@alfazen.org' },
  { icon: Globe2, label: 'Web', value: 'www.alfazen.org', href: 'https://www.alfazen.org' },
  { icon: LinkedinIcon, label: 'LinkedIn', value: 'marcuszou', href: 'https://www.linkedin.com/in/marcuszou' },
  { icon: GithubIcon, label: 'GitHub', value: 'marcuz-apl/peforma', href: 'https://github.com/marcuz-apl/peforma' },
];

function Contact() {
  return (
    <section id="contact" className="lp-section lp-contact">
      <div className="shell">
        <div className="lp-section-head lp-reveal">
          <div className="lp-kicker">Get in touch</div>
          <h2>Built in Calgary. <em>Used everywhere.</em></h2>
          <p>Questions about a format, a conversion, or a workflow? Reach the team behind Peforma.</p>
        </div>
        <div className="lp-contact-grid">
          <div className="lp-contact-card lp-reveal">
            <div className="lp-contact-org">
              <span className="lp-contact-pin"><MapPin size={18} aria-hidden="true" /></span>
              <div>
                <b>Alfazen Inc.</b>
                <span>Calgary, Alberta, Canada</span>
              </div>
            </div>
            <ul className="lp-contact-rows">
              {CONTACT_ROWS.map(row => (
                <li key={row.label}>
                  <a href={row.href} {...(row.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>
                    <span className="lp-contact-icon"><row.icon size={16} /></span>
                    <span className="lp-contact-label">{row.label}</span>
                    <span className="lp-contact-value">{row.value}</span>
                    <ArrowUpRight size={14} className="lp-contact-arrow" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
            <a className="lp-ghost lp-contact-docs" href="#docs"><BookOpen size={15} aria-hidden="true" /> Read the format reference</a>
          </div>
          <div className="lp-map-frame lp-reveal">
            <iframe
              title="Map of Calgary, Alberta, Canada"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-114.16%2C50.99%2C-113.98%2C51.10&layer=mapnik&marker=51.0447%2C-114.0719"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="lp-map-caption">
              <span><MapPin size={14} aria-hidden="true" /> Calgary · 51.0447° N, 114.0719° W</span>
              <a href="https://www.openstreetmap.org/?mlat=51.0447&mlon=-114.0719#map=12/51.0447/-114.0719" target="_blank" rel="noreferrer">
                Open in OpenStreetMap <ExternalLink size={13} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
        <div className="lp-closing lp-reveal">
          <div>
            <h3>Ready to move your data?</h3>
            <p>Open a converter and bring a file — the first conversion takes seconds.</p>
          </div>
          <a className="lp-cta" href="#converter">Open the toolbox <ArrowRight size={17} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}

export default function Landing({ themePref, resolvedTheme, onThemeChange, onAbout, onDisclaimer, aboutRef, disclaimerRef }) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('top');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
      let current = 'top';
      for (const id of ['top', 'services', 'contact']) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll('.lp-reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('in-view'));
      return undefined;
    }
    const io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = event => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 901px)');
    const onChange = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="landing">
      <LandingNav
        themePref={themePref}
        resolvedTheme={resolvedTheme}
        onThemeChange={onThemeChange}
        scrolled={scrolled}
        active={active}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Services />
        <Contact />
      </main>
      <div className="lp-footer">
        <div className="shell">
          <AppFooter onAbout={onAbout} onDisclaimer={onDisclaimer} aboutRef={aboutRef} disclaimerRef={disclaimerRef} />
        </div>
      </div>
    </div>
  );
}