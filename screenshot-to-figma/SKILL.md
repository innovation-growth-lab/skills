---
name: screenshot-to-figma
description: Rebuild a UI screenshot as a Figma-ready SVG whose text imports as editable text layers and whose groups arrive as named layers, measured from the pixels and checked against the original. Use when there's no source, only a screenshot or image of the screen; when the HTML source or a URL is available and a browser can run, use html-to-figma instead. Use whenever someone wants to rework, edit, recreate or iterate on UI from a screenshot in Figma, wants a screenshot made "editable", asks for something importable or pasteable into Figma, or wants to avoid spending Figma MCP or Figma agent credits on rebuilding a screen. Also use for IGL/Nesta pages (Brown, Mulish, Newsreader, IBM Plex) even when Figma isn't named but the goal is an editable copy of a screen.
---

# Screenshot to Figma SVG

Figma's SVG import turns `<text>` into editable text layers, `<rect>` into rectangles, `<g id>` into named groups and embedded `<image>` into image fills. That costs nothing against Figma MCP or agent limits. The output is one `.svg` the user drags onto the canvas or pastes as code.

The aim is close fidelity, not pixel-perfection: positions within 1–2 px and text widths within 2%. Everything is measured from the screenshot rather than guessed.

**If the page's HTML source or a URL is available and a browser can run, use `html-to-figma` instead.** It reads exact layout from the browser and is much faster. This skill is for when there's only a picture.

The import rules, layer conventions and font names are in `figma-svg/`, an identical copy of html-to-figma's (change both):

- `import-rules.md`: what Figma's importer accepts and how it maps elements to layers;
- `fonts.md`: the IGL/Nesta font stack, Figma family names and glyph tells.

## 1. Set up

```bash
bash scripts/setup.sh [any font files the user uploaded]
```

This installs the renderer and fontTools, plus the free fonts (Mulish, Newsreader, IBM Plex Sans and Mono) as static Regular, Medium, SemiBold and Bold files; the variable fonts are cut into those instances. cairosvg can only ask for normal or bold, so the Medium and SemiBold files get a family of their own ("Mulish SemiBold"), which `check_text_fit.py` uses for 500 and 600 text. Other weights such as Light aren't installed: the check prints a `note:` and measures them as Regular or Bold. Newsreader's optical size is fixed at 16pt, while browsers usually match it to the font size, so widths of large Newsreader headings may be slightly off.

Brown is commercial, so it's only present if the user uploads it this session. Without it, Brown text still gets positioned correctly but width checks on it are unreliable, so tell the user.

## 2. Resolve fonts before writing any SVG

A wrong family name makes text fall back silently in previews and show as a missing font in Figma.

- **IGL/Nesta designs:** read `figma-svg/fonts.md`. The usual pairing is Brown for display text and Mulish for everything else. Write `Mulish`, not `Muli`, even if the live site serves Muli.
- **Unknown fonts:** ask for the font files or a `fonts.json` inventory, then run `scripts/font_names.py`. Use the printed family name and only weights that exist.
- **Deciding which font goes where:** use the glyph tells in `fonts.md`. Badge numbers are often the display face even when the label next to them is not.

## 3. Measure

Check the image size first. A retina capture is twice the CSS size (for example 2698 px wide for a 1349 px page). Work in CSS px by dividing every measurement by 2, and pass `--scale 2` to the check scripts.

`scripts/measure.py` covers the routine measurements:

- `palette` gives the main colours. Use exact sampled hex values, never approximate ones.
- `darkest X0,Y0,X1,Y1` inside a text box gives the text colour, since antialiasing lightens the edges.
- `edges --row Y` and `edges --col X` give exact rectangle, rule and badge edges, and reveal dash patterns.
- `rows X0 X1 Y0 Y1` gives text lines, with top, bottom, baseline estimate and x extents, for a column strip. Keep a strip to one column of the layout, so the sidebar and main content are measured separately.

Derive the type settings from those measurements:

- **Baseline:** this is the SVG `y`. It sits one pixel below the last full row of the non-descending letters.
- **Font size:** cap height divided by the font's cap ratio. That's about 0.70 for Brown and 0.71 for Mulish.
- **Line height:** the step between consecutive baselines.
- **Letter-spacing:** small uppercase labels usually have some. Start at 0.5–1 and let the check in step 5 correct it.

## 4. Write the SVG

Follow `figma-svg/import-rules.md` exactly. On top of those rules, for a screenshot:

- If an element is cut off at the bottom edge, complete it and extend the canvas, then tell the user you did.
- Break multi-line copy exactly where the screenshot breaks it.
- Crop photos, illustrations and complex icons from the screenshot with PIL and embed them as base64 PNG in `<image>`.

## 5. Check against the screenshot

Run both checks and fix what they flag before delivering:

```bash
python3 scripts/check_text_fit.py design.svg screenshot.png [--scale 2]
python3 scripts/overlay.py design.svg screenshot.png [--scale 2] --zoom X0,Y0,X1,Y1
```

- **`check_text_fit.py`** renders each text line on its own, without images, to find it, then compares its start position with the screenshot. It compares the width too, using the unhinted width worked out from the font file, because cairo's hinted widths skew by 3–7%. Lines that mix fonts, or whose font isn't in `~/.fonts`, are compared with the render's width instead and marked `(render)`; `--hinted` does that for every line. Follow its suggestions, which are a font-size for mixed case and a letter-spacing for uppercase. A width that's off by more than 5% usually means the wrong font or weight, not the wrong size.
- **Short strings** such as single digits and separators can't be judged by width. Look at a `--zoom` crop of them instead; this is how a badge number set in the wrong typeface gets caught.
- **`diff.png`** shows red where only the render has ink and cyan where only the screenshot does. Rectangles and rules should vanish into grey. It renders the SVG as written, so 500 text shows as Regular and 600 as Bold there; judge weights with `check_text_fit.py`.

Look at the images with the view tool rather than trusting the numbers alone.

## 6. Deliver

Save the file to `/mnt/user-data/outputs/<page-name>.svg` and present it. Keep the message short and cover these points:

- the fonts and weights used, and anything you assumed;
- anything you completed or invented, such as a cut-off element or a placeholder icon;
- how to import: drag the file onto the canvas, or open it, copy the code and paste;
- that each multi-line paragraph arrives as one text layer per line.
