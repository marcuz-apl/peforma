import React, { useEffect, useRef, useState } from 'react';
import {
  Accessibility, ArrowDown, ArrowRight, ArrowUpRight, AudioWaveform, BookOpen, Box, Check, ChevronDown,
  Copy, Crosshair, Files, Globe2, Grid3x3, Layers3, Lock, Mail, MapPin, Menu, Minus,
  Plus, Ruler, ScanSearch, Send, ShieldCheck, Waypoints, X,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AppFooter, ThemeToggle, Wordmark } from './chrome.jsx';
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
    key: 'grid', icon: Grid3x3, name: 'Peforma Horizon/Grid', href: '#grid',
    blurb: 'Depth or time grid surfaces moved between the four ASCII dialects interpretation packages actually read.',
    formats: ['CPS-3', 'EarthVision', 'IRAP Classic', 'ZMAP+'],
  },
  {
    key: 'culture', icon: Waypoints, name: 'Peforma Culture', href: '#culture',
    blurb: 'Point, polyline, and polygon vectors exchanged with vertex order, ring structure, attributes, and missing-Z distinctions left intact.',
    formats: ['CSV', 'GeoJSON', 'GOCAD'],
  },
  {
    key: 'shapefile', icon: Files, name: 'Peforma Shapefile', href: '#shapefile',
    blurb: 'Esri Shapefile sets and GeoJSON exchanged with every record, attribute, and CRS definition kept in place.',
    formats: ['SHP', 'DBF', 'PRJ', 'GeoJSON'],
  },
  {
    key: 'units', icon: Ruler, name: 'Peforma Units', href: '#units',
    blurb: 'Ten engineering categories on exact factors — pressure, volume, density, temperature, and the rest.',
    formats: ['10 categories', 'Exact factors'],
  },
];

const ROADMAP = [
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
        <div className="lp-nav-right">
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
          </nav>
          <a className="docs-link lp-docs-link" href="#docs" aria-label="Documentation">
            <BookOpen size={16} aria-hidden="true" />
            <span>Docs</span>
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
          <ThemeToggle preference={themePref} resolved={resolvedTheme} onChange={onThemeChange} />
        </div>
      </div>
      <div id="lp-mobile-menu" className={`lp-mobile-menu${menuOpen ? ' open' : ''}`} hidden={!menuOpen}>
        {NAV_LINKS.map(link => (
          <a key={link.id} href={`#${link.id}`} className="lp-mobile-link" onClick={close}>{link.label}</a>
        ))}
        <a href="#docs" className="lp-mobile-link" onClick={close}>Docs</a>
        <a href="#grid" className="lp-cta" onClick={close}>Open the toolbox <ArrowDown size={16} aria-hidden="true" /></a>
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
            <a className="lp-cta" href="#grid">Open the toolbox <ArrowDown size={17} aria-hidden="true" /></a>
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

const CALGARY = { lat: 51.0447, lng: -114.0719 };
const CALGARY_ZOOM = 11;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The map stays centred on Calgary: panning and cursor-relative zoom are off,
// and every zoom is re-pinned to the Calgary coordinate.
function CalgaryMap() {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const [zoom, setZoom] = useState(CALGARY_ZOOM);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const map = L.map(hostRef.current, {
      center: [CALGARY.lat, CALGARY.lng],
      zoom: CALGARY_ZOOM,
      minZoom: 9,
      maxZoom: 16,
      zoomControl: false,
      dragging: false,
      keyboard: false,
      boxZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      scrollWheelZoom: 'center',
    });
    mapRef.current = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.marker([CALGARY.lat, CALGARY.lng], {
      keyboard: false,
      icon: L.divIcon({ className: 'lp-map-pin', html: '<span></span>', iconSize: [26, 34], iconAnchor: [13, 32] }),
    }).addTo(map);
    const recenter = () => {
      setZoom(map.getZoom());
      map.setView([CALGARY.lat, CALGARY.lng], map.getZoom(), { animate: false });
    };
    map.on('zoomend', recenter);
    map.whenReady(() => map.invalidateSize());
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(hostRef.current);
    return () => {
      ro.disconnect();
      map.off('zoomend', recenter);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const recenter = () => {
    mapRef.current?.setView([CALGARY.lat, CALGARY.lng], CALGARY_ZOOM, { animate: true });
  };

  return (
    <div className="lp-map-frame lp-reveal">
      <div className="lp-map-canvas" ref={hostRef} aria-label="Map of Calgary, Alberta, Canada" />
      <div className="lp-map-controls">
        <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in, stays centered on Calgary"><Plus size={16} aria-hidden="true" /></button>
        <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out, stays centered on Calgary"><Minus size={16} aria-hidden="true" /></button>
        <button type="button" onClick={recenter} aria-label="Recenter map on Calgary"><Crosshair size={16} aria-hidden="true" /></button>
        <span className="lp-map-level" aria-hidden="true">z{zoom}</span>
      </div>
    </div>
  );
}

function ContactForm() {
  const [fields, setFields] = useState({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [copied, setCopied] = useState(false);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const update = key => event => {
    const value = event.target.value;
    setFields(f => ({ ...f, [key]: value }));
    setErrors(e => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const compose = () => {
    const name = fields.name.trim();
    const email = fields.email.trim();
    const subject = `[Peforma] Message from ${name || 'website visitor'}`;
    const body = `${fields.message.trim()}\n\n— ${name}\n${email}`;
    return {
      subject,
      body,
      mailto: `mailto:info@alfazen.org?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    };
  };

  const onSubmit = event => {
    event.preventDefault();
    const next = {};
    if (!fields.name.trim()) next.name = 'Please enter your name.';
    if (!fields.email.trim()) next.email = 'Please enter your email.';
    else if (!EMAIL_RE.test(fields.email.trim())) next.email = 'Please enter a valid email address.';
    if (!fields.message.trim()) next.message = 'Please enter a message.';
    else if (fields.message.trim().length < 10) next.message = 'Please add a little more detail (at least 10 characters).';
    setErrors(next);
    const firstError = Object.keys(next)[0];
    if (firstError) {
      document.getElementById(`cf-${firstError}`)?.focus();
      return;
    }
    const { mailto } = compose();
    window.location.href = mailto;
    setStatus('sent');
  };

  const copyMessage = async () => {
    const { subject, body } = compose();
    try {
      await navigator.clipboard.writeText(`To: info@alfazen.org\nSubject: ${subject}\n\n${body}`);
      setCopied(true);
      timers.current.push(setTimeout(() => setCopied(false), 2000));
    } catch {
      setCopied(false);
    }
  };

  const reset = () => {
    setFields({ name: '', email: '', message: '' });
    setErrors({});
    setStatus('idle');
    setCopied(false);
    timers.current.push(setTimeout(() => document.getElementById('cf-name')?.focus(), 0));
  };

  if (status === 'sent') {
    return (
      <div className="lp-form-success" role="status" aria-live="polite">
        <span className="lp-form-success-icon"><Check size={20} aria-hidden="true" /></span>
        <h3>Your message is ready</h3>
        <p>We opened your email app with the message addressed to <b>info@alfazen.org</b>. Press <b>Send</b> there to deliver it — nothing is sent until you do.</p>
        <div className="lp-form-success-actions">
          <button type="button" className="lp-ghost" onClick={copyMessage}>
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} {copied ? 'Copied' : 'Copy message'}
          </button>
          <button type="button" className="lp-ghost" onClick={reset}>Write another</button>
        </div>
      </div>
    );
  }

  return (
    <form className="lp-form" noValidate onSubmit={onSubmit}>
      <div className="lp-field">
        <label htmlFor="cf-name">Name</label>
        <input
          id="cf-name"
          type="text"
          autoComplete="name"
          value={fields.name}
          onChange={update('name')}
          aria-invalid={errors.name ? 'true' : undefined}
          aria-describedby={errors.name ? 'cf-name-error' : undefined}
        />
        {errors.name && <p className="lp-field-error" id="cf-name-error" role="alert">{errors.name}</p>}
      </div>
      <div className="lp-field">
        <label htmlFor="cf-email">Email</label>
        <input
          id="cf-email"
          type="email"
          autoComplete="email"
          value={fields.email}
          onChange={update('email')}
          aria-invalid={errors.email ? 'true' : undefined}
          aria-describedby={errors.email ? 'cf-email-error' : undefined}
        />
        {errors.email && <p className="lp-field-error" id="cf-email-error" role="alert">{errors.email}</p>}
      </div>
      <div className="lp-field">
        <label htmlFor="cf-message">Message</label>
        <textarea
          id="cf-message"
          rows={5}
          value={fields.message}
          onChange={update('message')}
          aria-invalid={errors.message ? 'true' : undefined}
          aria-describedby={errors.message ? 'cf-message-error' : undefined}
        />
        {errors.message && <p className="lp-field-error" id="cf-message-error" role="alert">{errors.message}</p>}
      </div>
      <div className="lp-form-foot">
        <button type="submit" className="lp-cta lp-form-submit">
          Send message <Send size={15} aria-hidden="true" />
        </button>
        <span className="lp-form-note"><Mail size={14} aria-hidden="true" /> Goes to info@alfazen.org</span>
      </div>
    </form>
  );
}

function Contact() {
  return (
    <section id="contact" className="lp-section lp-contact">
      <div className="shell">
        <div className="lp-section-head lp-reveal">
          <div className="lp-kicker">Get in touch</div>
          <h2>Built in Calgary. <em>Used everywhere.</em></h2>
          <p>Questions about a format, a conversion, or a workflow? Send the team behind Peforma a message.</p>
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
            <ContactForm />
          </div>
          <CalgaryMap />
        </div>
        <div className="lp-closing lp-reveal">
          <div>
            <h3>Ready to move your data?</h3>
            <p>Open a converter and bring a file — the first conversion takes seconds.</p>
          </div>
          <a className="lp-cta" href="#grid">Open the toolbox <ArrowDown size={17} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}

export default function Landing({ themePref, resolvedTheme, onThemeChange, onAbout, onDisclaimer, onPrivacy, aboutRef, disclaimerRef, privacyRef }) {
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
          <AppFooter onAbout={onAbout} onDisclaimer={onDisclaimer} onPrivacy={onPrivacy} aboutRef={aboutRef} disclaimerRef={disclaimerRef} privacyRef={privacyRef} />
        </div>
      </div>
    </div>
  );
}