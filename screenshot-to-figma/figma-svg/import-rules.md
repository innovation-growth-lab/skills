# Figma SVG import rules

Shared by `screenshot-to-figma` and `html-to-figma`. Both skills write one `.svg` that the user drags onto the Figma canvas or pastes as code. Figma's SVG import turns `<text>` into editable text layers, `<rect>` into rectangles, `<g id>` into named groups and embedded `<image>` into image fills, at no cost in Figma MCP or agent credits.

## Writing the SVG

- Set `width`, `height` and `viewBox` to the page size in CSS px.
- Use inline presentation attributes only: `fill`, `fill-opacity`, `stroke`, `stroke-width`, `font-family`, `font-size`, `font-weight` (numeric), `font-style`, `letter-spacing` (px) and `text-decoration`. Don't use `<style>` blocks, classes, filters, masks, clip paths or `<use>`.
- Give one `<text>` per text layer. Separate pieces on the same baseline, such as breadcrumb items and separators, can each get their own `<text>`.
- Write multi-line copy as one `<text>` with a positioned `<tspan x y>` per line, breaking the lines exactly where the page breaks them. In Figma it arrives as a group, named by the `<text>` id, with one text layer per line. That trade-off is accepted: don't put a paragraph on one line, use literal newlines, or plan Figma MCP calls to merge the lines.
- For a style change inside one line (a bold word, a link colour), use **unpositioned** `<tspan>`s inside the same `<text>`. They stay one layer.
- For centred text such as badge numbers, `text-anchor="middle"` with `x` at the centre is fine.
- Draw rules and hairlines as filled `<rect>`s (height 1 or 2), not `<line>`, so they land on whole pixels.
- Give stroked boxes half-pixel coordinates (`x="431.5"`) and match dashed borders with `stroke-dasharray`.
- Embed photos, illustrations and complex icons as base64 PNG (or the original data) in `<image>`. Draw simple shapes such as squares, dots and chevrons as vectors.
- Colours are hex. Where a colour has alpha, write the hex plus `fill-opacity` or `stroke-opacity`.

## Layer names and structure

- Everything with an `id` becomes a named layer, so name everything. Use plain names like `Chip Activities`, `Rule`, `Card`, `Page title`.
- Nest the groups to match the page structure: Header › Breadcrumb, Sidebar › section, Main › Section › heading/body/chips.
- Duplicate names are fine (Figma doesn't need them unique); several `Card` or `Rule` layers are normal.

## Fonts

Read `fonts.md` (next to this file) before writing any `font-family`. The aliases Figma needs are also in `figma-font-names.json`, which scripts read. In short: write `Mulish`, never `Muli`; write `Brown` with weight 400 or 700, never `Brown Regular`.

## Known import behaviour (tested in Figma)

- The root `<svg>` becomes a Frame, `<g id>` becomes a named group, and `<text id>` becomes a named text layer.
- `text-decoration="underline"` survives import.
- A `<text>` with positioned tspans (x+y, or x+dy) becomes a group named by its id, holding one text layer per line, each named by its content. Line positions are kept.
- Unpositioned tspans inside one `<text>` merge into a single text layer.
- Literal newlines are ignored, even with `xml:space="preserve"`, so the text runs on as one line.
- **Not yet checked:** dashed strokes, embedded `<image>` arriving as image fills, and positioned tspans followed by unpositioned style tspans on the same line. Record the result here once tested.
- **Everything arrives as groups, not frames.** To add auto-layout, select a group in Figma and press Shift+A. Don't try to imitate auto-layout in the SVG.

## Checking

Render in the same engine the source came from where possible. cairosvg is known to ignore `display="none"` on `<image>`, and its variable-font weight matching and hinting skewed text widths by 3–7% in the sandbox. `diff.py` (next to this file) holds the shared image diff: red where only the render has ink, cyan where only the reference does, grey where they match.
