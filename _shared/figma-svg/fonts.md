# Fonts

Shared by `screenshot-to-figma` and `html-to-figma`. The renames below (Muli → Mulish, Brown Regular → Brown) are also in `figma-font-names.json`, which html-to-figma's extractor reads; change both together.

## IGL / Nesta stack (confirmed from the font files)

| Use | SVG `font-family` | Weights available | Source |
|---|---|---|---|
| Display: page titles, section headings, numbers in badges | `Brown` | 400, 700 | Commercial (Lineto). Installed on Kevin's Mac; not bundled here |
| UI and body | `Mulish` | 200–1000 (variable) | Google Fonts, free |
| Alternative headings | `Newsreader` | 200–800 (variable, optical size axis) | Google Fonts, free |
| Alternative body | `IBM Plex Sans` | 100–700 | Google Fonts, free |
| Monospace | `IBM Plex Mono` | 100–700 | Google Fonts, free |

- **Write `Mulish`, never `Muli`.** Muli is the old name of the same typeface. Older sites, including some IGL pages, still serve Muli; it looks the same, but the design should name Mulish.
- **Brown's files disagree internally.** The Regular file's legacy family is "Brown Regular" and the Bold file's is "Brown"; both have typographic family "Brown", which is what macOS and Figma show. Always write `font-family="Brown"` with `font-weight` 400 or 700, never "Brown Regular".
- **Browser Figma** ships every Google Fonts family, so Mulish, Newsreader and IBM Plex work there without being installed. Brown needs the Figma desktop app or the font installer, since it's a local font.
- **Local previews** (Finder, Quick Look, a browser) only render installed fonts. If Mulish doesn't preview, it isn't installed on that machine; it will still import correctly into Figma. Free download: fonts.google.com/specimen/Mulish.

## Telling them apart in a screenshot

- **Brown:** geometric; round single-storey "a"; "t" with a short angled cut; the numeral "1" has no foot. Usually on large headings, and on numbers inside badges even when the label next to them is Mulish.
- **Mulish:** minimal geometric sans; slightly narrower; numeral "1" has a flag and no foot. Usually on breadcrumbs, labels, links, body copy and chips.
- **Newsreader:** a serif, so it's easy to spot.
- **IBM Plex Sans:** grotesque with angled terminals; "t" has a slanted top cut.

## Weight hints

Measure a vertical stem in pixels, then divide by the font size:

- Brown Regular is about 0.10 of the font size; Bold is about 0.14.
- Mulish at body sizes: Regular stems are 1–2 px at 15–18 px; SemiBold and Bold read clearly heavier, so judge them by eye against a zoom crop.

## Unknown fonts

1. Ask the user for the font files (best: exact names, and real glyphs for the checks) or for an inventory from macOS:
   `system_profiler SPFontsDataType -json > fonts.json`
2. Run `screenshot-to-figma/scripts/font_names.py` on whichever they send. Use the family column exactly as printed, and only weights that exist.
3. Commercial fonts the user uploads are for this session's checks only. Don't copy them into the skill or outputs.
4. Without the real font, still build the SVG, but treat width checks as unreliable and say so.
