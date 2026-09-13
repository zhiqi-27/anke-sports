# Anke Sports UI system

Implementation companion to `anke-sports 文档/Anke_Sports_品牌与界面规范.md`.

## Direction

- Product shape: desktop calendar workbench. The persistent application sidebar, calendar views and detail drawer are product navigation, not a marketing-page rail.
- Tone: modern-minimal and technical. Small functional headings, direct copy, visible data and no decorative hero treatment.
- Palette: fixed dark graphite surfaces with one acid-lime accent. Team and sport colours are data, not theme colours.
- Typography: the system UI stack is an explicit product allowance for dense Chinese/English application UI. Numeric calendar content uses tabular figures.
- Motion: only interaction feedback, state change, overlays and functional loading. No scroll reveals, parallax, bounce or ambient loops.

## Component rules

- Canvas → surface → raised surface communicates containment and elevation by lightness.
- Acid lime marks primary actions, active navigation, focus and compact status anchors; it must not become a large section background.
- Body text uses `--color-text`; supporting text uses `--color-text-muted`; `--color-text-subtle` is reserved for non-critical metadata at normal readable sizes.
- Buttons and fields share a 44 px minimum control height where they sit together. Focus rings appear instantly.
- The calendar may use dynamic `--team-color` and `--sport-color` values only for local identity marks; semantic text and surfaces remain token-driven.
- Platform subscription guidance is a compact list, not an equal-card feature grid.

## Page allowances

- Supported product viewport is desktop Web. The shell preserves its existing 760 px hard minimum; acceptance is performed at 1024, 1280 and 1440 px widths.
- The calendar can use denser spacing than management routes; both draw from the same spacing scale.
- No footer is added to the application shell because it would compete with the fixed-height workbench.
