# Peforma suite shell — design

## Goal

Give Peforma Grid a professional application shell that introduces the wider Peforma suite without implying the other tools already exist. The change covers a suite rail, a revised header, a real footer, and a corrected type scale. Converters and file handling are untouched.

## Non-goals

- Implementing Lines, Polygons, 3D, Seismic, Coordinates or Units.
- Routing between tools. Future suites are non-clickable placeholders.
- Dark theme. The app stays light-only; colour tokens prepare a later palette swap.
- New dependencies, backend work, or changes to parsers, exporters, or file handling.
- Accounts, upload, or telemetry.

## Information architecture

The rail is a suite switcher, not a workflow tree. Products are the navigation; category labels are quiet section headings.

| Section | Suite | Scope | Status |
| --- | --- | --- | --- |
| Data converters | Peforma Grid | CPS-3, ZMAP+, IRAP Classic, EarthVision, shapefile inspection | Live |
| Data converters | Peforma Lines | Polyline and general-line conversion | Soon |
| Data converters | Peforma Polygons | Polygon and boundary conversion | Soon |
| Data converters | Peforma 3D | 3D object exchange | Soon |
| Data converters | Peforma Seismic | 2D lines and 3D cubes | Soon |
| Reference | Peforma Coordinates | ED50↔WGS84, UTM↔Lambert Conformal Conic | Soon |
| Reference | Peforma Units | Oil-sector unit conversion | Soon |

Only Peforma Grid expands, showing `Grid converter` as the active tool. Every other row is a `<span aria-disabled="true">` with a visible `Soon` tag, excluded from the tab order and with no `href`.

## Layout

Desktop uses a two-column shell beneath a full-width header: a 232px suite rail and a content column. The content column is capped at 880px inside a 1200px shell. The rail is sticky below the header and scrolls independently when needed.

```
┌─────────────────────────────────────────────────────────────┐
│ [icon] peforma grid  v…        ● Local processing  Format guide │
├───────────────┬─────────────────────────────────────────────┤
│ PEFORMA       │  PEFORMA / GRID                             │
│ Data converters│  Move your grids. Keep your data.          │
│   Peforma Grid │  Convert between five subsurface formats.  │
│   Peforma Lines│  ┌───────────────────────────────────────┐  │
│   …            │  │ 01 Source data                        │  │
│ Reference      │  │ 02 Output format                      │  │
│   Coordinates  │  └───────────────────────────────────────┘  │
│   Units        │  Format integrity note                     │
│               │  footer                                    │
└───────────────┴─────────────────────────────────────────────┘
```

## Header

- Full width, 64px desktop and 56px mobile, sticky at the top, one-pixel bottom border, page background.
- Left: brand icon, `peforma` wordmark with lighter `grid`, and the existing version pill read from `VERSION`.
- Right: local-processing indicator, vertical divider, and `Format guide` button. On mobile, the format guide and local-processing text move into the drawer and footer; the header keeps the brand, version, and a menu button.
- The header stays the product identity; the active suite is shown in the rail and the content eyebrow, not repeated as another wordmark.

## Suite rail

- 232px wide on desktop. Sticky below the header with its own scroll area.
- Header row: `PEFORMA` label in 11px mono with a collapse control.
- Section labels `DATA CONVERTERS` and `REFERENCE` in 11px mono, muted.
- Product rows are 13px medium text with 16px icons, a 10px right chevron on expandable rows, and an active state using a soft green background, dark ink, and a 2px accent bar on the left.
- Peforma Grid expands to `Grid converter`, marked `aria-current="page"`.
- Collapse control reduces the rail to 64px icon-only mode with `title` and accessible labels on every item. The collapsed state is remembered in `localStorage` under `peforma.rail`; failures to read or write storage are ignored.
- At 761–1023px the rail is icon-only by default and the collapse control is hidden.
- At 760px and below the rail becomes a left drawer, 280px or 85vw, with a backdrop, close button, Escape handling, body scroll lock, and focus returned to the menu button on close.

## Content

- Eyebrow `PEFORMA / GRID` in 11px mono replaces `GRID CONVERSION WORKSPACE`.
- H1 keeps the existing line `Move your grids.` / `Keep your data.` at 34px, weight 700, line-height 1.15, letter-spacing -0.9px. The second line stays lighter green.
- Supporting text becomes one 14px line: `Convert between five subsurface grid formats. Local processing, no uploads.` at a 52-character measure.
- Hero padding drops from 72px to 36px top and 24px bottom.
- The workspace card, dropzone, loaded summary, stats, preview, buttons, and integrity note keep their current structure and behaviour.
- The footer sits inside the content column, not beneath the rail.

## Footer

- Three columns on desktop: `Tools` (the seven suites with status), `Formats` (the five supported inputs), and `Build` (version, local processing, format guide).
- 11px mono column labels, 12px links, 1.6 line-height.
- Bottom row: `© 2026 Peforma · Peforma Grid · Made for the field.` in 11px muted text.
- On mobile the columns stack, with Tools using two columns.

## Typography

Replace the current 8–10px labels and 50px hero with one scale.

| Role | Current | Proposed |
| --- | --- | --- |
| Hero | 50px / -2.2 | 34px / -0.9, line-height 1.15 |
| Section title | 17px | 18px / -0.2 |
| Body | 14px | 14px / 1.6 |
| Secondary | 12px | 13px / 1.5 |
| Mono labels | 9–10px | 11px, letter-spacing 0.5px |
| Data values | 10px mono | 12px mono |
| Buttons and selects | 12px | 13px / 600 |
| Footer | 9px | 12px |
| Version pill | 9px | 10px |

No visible text below 11px except the version pill and purely decorative marks. Manrope stays for display and section titles, DM Sans for UI text, DM Mono for labels and numeric data.

## Colour and tokens

Keep the existing palette and express it as tokens: `--bg`, `--surface`, `--surface-muted`, `--ink`, `--ink-soft`, `--muted`, `--faint`, `--line`, `--line-soft`, `--accent`, `--accent-strong`, `--accent-soft`, `--warn-bg`, `--warn`. All text that carries meaning meets WCAG AA contrast; `--faint` is reserved for non-essential decoration. Focus rings use the accent at 2px with a 2px offset.

## Accessibility

- Landmarks: `<header>`, `<nav aria-label="Peforma suites">`, `<main>`, `<footer>`.
- Skip link `Skip to converter` as the first focusable element.
- Active tool has `aria-current="page"`.
- Future suites are non-focusable spans with `aria-disabled="true"` and a visible `Soon` tag.
- Collapse control exposes `aria-expanded` and `aria-controls`; its label changes between collapse and expand.
- Mobile drawer uses `role="dialog"` and `aria-modal="true"`, moves focus to the close button, closes on Escape or backdrop click, and returns focus to the menu button.
- Keyboard order follows header, rail, content, footer. All controls keep visible focus states.
- `prefers-reduced-motion` disables the drawer and hover transitions.

## Implementation notes

- Keep all parsing, validation, export and download code unchanged.
- Add shell components in `src/main.jsx`: header, suite rail, footer, and a suite data constant. Reuse lucide icons already available in the dependency.
- Replace the single-line CSS with structured sections: tokens, base, shell, header, rail, content, existing components, footer, responsive, motion. Preserve existing class names where practical.
- No new packages and no routing.
- Update `README.md` only if the visible product-family story needs a line; format documentation stays as-is.

## Verification

- `npm run build` passes.
- Desktop screenshot at 1440×900 and mobile at 390×844, checked for overflow, alignment, and both rail states.
- Keyboard pass: skip link, rail collapse, drawer open/close, focus return.
- Version pill matches the root `VERSION`.
- One example grid is loaded and converted to confirm the untouched converter path still works.
- No new console errors; the known favicon 404 is unchanged.
