import React from 'react';
import { Globe2, Mail, Moon, Sun } from 'lucide-react';

// Shared site chrome used by both the app shell and the landing page so the
// wordmark, theme control, and footer stay identical across every route.

// Renders the family wordmark with the O replaced by a red oil drop. The lettering
// is split around the drop so the SVG can scale with whatever font size wraps it.
export function Wordmark({ label, className = '' }) {
  return (
    <span
      className={`wordmark${className ? ` ${className}` : ''}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' })}
    >
      <span aria-hidden="true">pef</span>
      <span className="wordmark-drop" aria-hidden="true">
        <svg viewBox="0 0 22 26" focusable="false">
          <path d="M11 1C11 1 2 10.6 2 16.1a9 9 0 0 0 18 0C20 10.6 11 1 11 1Z" />
          <ellipse cx="7.7" cy="16.2" rx="1.7" ry="2.4" />
        </svg>
      </span>
      <span aria-hidden="true">rma</span>
    </span>
  );
}

// Auto is shown as a disc split into white and black halves, so the button reads
// as "both themes" without a text label.
function AutoThemeIcon() {
  return (
    <svg className="auto-theme-icon" width="17" height="17" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="7.1" fill="#ffffff" />
      <path d="M10 2.9a7.1 7.1 0 0 1 0 14.2Z" fill="#000000" />
      <circle cx="10" cy="10" r="7.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 2.9v14.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

const NEXT_THEME = { auto: 'light', light: 'dark', dark: 'auto' };

export function ThemeToggle({ preference, resolved, onChange }) {
  const next = NEXT_THEME[preference] || 'light';
  const description = preference === 'auto'
    ? `Theme: auto, ${resolved} now. Activate for light.`
    : `Theme: ${preference}. Activate for ${next}.`;
  const Icon = preference === 'light' ? Sun : preference === 'dark' ? Moon : AutoThemeIcon;
  return (
    <button
      type="button"
      className="theme-trigger"
      aria-label={description}
      title={description}
      onClick={() => onChange(next)}
    >
      <Icon size={17} aria-hidden="true" />
    </button>
  );
}

// lucide-react has no brand icon, so LinkedIn is a self-drawn monochrome mark.
export function LinkedinIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S.02 4.88.02 3.5 1.13 1 2.5 1s2.48 1.12 2.48 2.5ZM.5 8h4V24h-4V8Zm7.5 0h3.8v2.18h.05c.53-.99 1.83-2.05 3.75-2.05 4 0 4.75 2.63 4.75 6.04V24h-4v-8.5c0-2.03-.04-4.63-2.82-4.63-2.82 0-3.25 2.2-3.25 4.47V24H8V8Z" />
    </svg>
  );
}

export function AppFooter({ onAbout, onDisclaimer, aboutRef, disclaimerRef }) {
  return (
    <footer className="site-footer">
      <div className="footer-legal">
        <div className="footer-legal-links">
          <button ref={aboutRef} type="button" onClick={onAbout}>About</button>
          <button ref={disclaimerRef} type="button" onClick={onDisclaimer}>Disclaimer</button>
        </div>
        <div className="footer-legal-copy">© 2026 Peforma, an Alfazen product. All rights reserved.</div>
        <div className="footer-social">
          <a href="https://www.alfazen.org" target="_blank" rel="noreferrer" aria-label="Peforma on the web">
            <Globe2 size={16} aria-hidden="true" />
          </a>
          <a href="mailto:info@alfazen.org" aria-label="Email Alfazen">
            <Mail size={16} aria-hidden="true" />
          </a>
          <a href="https://www.linkedin.com/in/marcuszou" target="_blank" rel="noreferrer" aria-label="Alfazen on LinkedIn">
            <LinkedinIcon size={16} />
          </a>
        </div>
      </div>
    </footer>
  );
}