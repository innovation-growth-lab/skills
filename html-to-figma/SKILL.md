---
name: html-to-figma
description: Rebuild a web page or app screen as Figma-ready SVGs, one per state, whose text imports as editable text layers and whose groups arrive as named layers, read straight from a real browser's layout and checked against the browser's own screenshot. Use when the page's HTML source, a local file or a URL is available and a browser (Playwright with Chrome or Chromium) can run, including single-page apps whose screens are reached by hashes or clicks. Use whenever someone wants such a page in Figma to rework or iterate on, wants it "editable" or importable, or wants to avoid spending Figma MCP or Figma agent credits on rebuilding screens. When there's only a screenshot and no source, or no browser can run, use screenshot-to-figma instead.
---

# HTML to Figma SVG

Figma's SVG import turns `<text>` into editable text layers and `<g id>` into named groups, at no cost in Figma MCP credits. This skill writes those SVGs from the browser's own layout instead of measuring pixels. Boxes, borders, baselines, fonts and colours come from computed style, Range rects and `document.fonts`, so nothing is estimated.

The import rules, layer conventions and font names are in `figma-svg/`, shared with screenshot-to-figma. Read `import-rules.md` before changing what the extractor writes. `fonts.md` (and `figma-font-names.json`, which the extractor reads) map loaded families to Figma names, for example Muli to Mulish.

**No browser?** If `scripts/setup.sh` can't start Chrome or Chromium (exit status 2), say so and use /screenshot-to-figma on a screenshot of the page instead.

## 1. Set up

```bash
PY=$(bash scripts/setup.sh)
```

This creates a venv at `~/.cache/html-to-figma/venv` with Playwright, PyYAML, numpy and Pillow. It drives the installed Google Chrome, or downloads Chromium if Chrome isn't there. The page's own web fonts load in the browser, so nothing else needs installing. Local-only fonts such as Brown must be installed on the machine.

## 2. Write a states file

One YAML file lists the screens: a name, an optional URL hash, and the clicks, fills, selects and waits that reach each one. See `references/states-format.md`; `examples/peat.states.yaml` covers every PEAT view and a scripted survey. Hide anything that isn't part of the design (dev panels, cookie banners) with `hide:`.

To find selectors, read the page source: the render functions show the `data-*` hooks buttons use. Prefer those to text or position.

## 3. Run

```bash
$PY scripts/html_to_figma.py my.states.yaml [--only state ...] [--width 1147] [--out DIR]
```

For each state it:

1. loads the page fresh at the given width (default 1147, the layout width of the hand-made PEAT captures), runs the actions, waits for fonts, freezes animations, drops focus and grows the viewport to the full scroll height;
2. screenshots it at `scale` (default 2) as `browser.png`;
3. runs `scripts/extract.js` in the page, which walks visible elements (`checkVisibility()`), so inactive `.view`s are skipped, and builds the layer tree;
4. writes `<state>.svg`;
5. renders that SVG in the same Chrome, with the page's font stylesheets, as `render.png`, and diffs the two (`diff.png`: red = only in the SVG, cyan = only in the page);
6. writes `report.txt` and adds a row to `summary.md`.

## 4. Read the report, then look

`report.txt` gives:

- **Pixels that differ** and the regions where they cluster. Around 1% is normal: it's mostly sub-pixel glyph drift along long lines.
- **Import rules:** a static check for `<style>`, classes, filters, masks, clip paths, `<use>`, `var()`, unnamed groups and literal newlines.
- **Flagged layers:** every text line, box and image whose rendered position is more than 1 px off or whose width is more than 1% off what the browser drew. A flagged line usually means a glyph fell back to another font (arrows such as → often do).
- **Log:** everything skipped or approximated, such as shadows, gradients, filters, list markers, spin buttons and `text-underline-offset`.

Open `diff.png` (or crop it) for each state before delivering. Fix the extractor, not the SVG, so reruns stay right.

## What the extractor does

- **Boxes:** the background is a filled rect. A border shared by all four sides (or three, with the odd side drawn over it) is one stroked rect on half-pixel coordinates. Other borders are filled rects per side. `border-radius` becomes `rx`. Edges snap to device pixels as Chrome's do. Shadows are skipped and logged.
- **Text:** each block's text, including its inline children, is split into lines from per-character client rects. Baselines come from a probe per font (an inline-block marker's bottom against the text's box top). One `<text>` per block holds one positioned `<tspan x y>` per line, and inline style changes (bold, links) are unpositioned tspans. `text-transform` is applied to the string. Weights are numeric and letter-spacing is in px. Colours are hex, plus `fill-opacity` where there's alpha. Underlines are carried over. `text-overflow: ellipsis` is reproduced.
- **Fonts:** each family list resolves to the face the browser actually uses: the first family with a loaded `@font-face`, or installed locally. The weight is matched with CSS rules against the loaded faces, so 500 on a font with only 400 and 600 is written as 400. The family is then renamed to its Figma name.
- **Inline SVG** (charts, logos): copied shape by shape with the browser's transform matrix baked into the coordinates, so the output has no transforms. Computed fill, stroke, opacity and text styles are written as attributes. Axis-aligned lines become filled rects.
- **Images:** embedded as base64 (`<img>`, CSS `url()` backgrounds and SVG `<image>`).
- **Form controls:** the box, then the value, or the placeholder in its colour. Over-long values are cut to the characters that fit. Selects get the selected option and a chevron. Textareas wrap like the page and get a resize grip. Checkboxes, radios, range tracks and the calendar button on date fields are simple vectors.
- **`::before` / `::after`:** turned into real elements with the pseudo's computed style and resolved `content` for the walk, then removed. They become layers named after their host plus "before" or "after".
- **Layer names:** `data-layer`, then `aria-label`, then `id`, then the first readable class, then the tag. Text layers are named by their first words unless their element has a `data-layer`, `aria-label` or `id`. Wrappers that paint nothing and hold one layer are folded into it.

## Deliver

Point the user to the output folder and `summary.md`. Keep the message short and cover:

- which states were written, and any flagged layers or log lines worth knowing about;
- how to import: drag each `.svg` onto the canvas, or open it, copy the code and paste;
- that multi-line paragraphs arrive as one text layer per line, and everything arrives as groups (Shift+A adds auto-layout).
