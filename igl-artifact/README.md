# igl-artifact

A Claude skill for designing IGL artifacts in an ordinary Claude chat:
reports, briefings, strategy updates, digests and one-pagers, and pieces
with a few views to click through (an explorer, a walkthrough, a
calculator). Someone brings their material (notes, a draft, findings, a
spreadsheet) and Claude works as designer and editor. It finds the point,
regroups the material by meaning, picks a form that fits each part, and
builds one polished HTML page in the IGL look that they can share, print
and keep refining in the chat.

The skill is mostly design method:
- find the point and the reader
- group, order and cut the material
- draw the shape of the content
- for a piece with views, agree a design brief before building, and build
  one view for them to react to first
- check that the headings alone tell the story

The HTML is handled by a template, so Claude's effort goes on the thinking.

Several views are fine. Once what people enter has to be kept (projects,
saved answers, check-ins), it's a tool: those are built with this
boilerplate in Claude Code, using the `igl-prototype` skill
(`plugins/igl/` in this repo).

## Installing it (for colleagues)

1. Download `igl-artifact.zip`.
2. In Claude, open **Customize → Skills** and upload it. (Skills need code
   execution, which is on by default; if the option is missing, turn on
   "Code execution and file creation" in Settings.)
3. In a new chat, attach your material and say what it's for, e.g.
   *"Turn these notes into an IGL update on the pilot for our
   funders"*.

## What's in it

- `igl-artifact/SKILL.md`: the method Claude follows: find the point, shape
  the material, agree a brief for a piece with views, the look, build,
  check.
- `igl-artifact/patterns.md`: the building blocks (hero, panels, status
  board, item cards, timeline, chart, table …), each with when to use it
  and its markup.
- `igl-artifact/examples/`: pages IGL considers exemplary, with notes on what
  makes each work (`examples/README.md`). Claude reads the notes before
  designing.
- `igl-artifact/kit.css` and `template.html`: the stylesheet and the page
  every document starts from.

`npm run build` at the top of this repo builds them into `dist/`:
- `igl-artifact.zip`, the file to share
- the unpacked skill
- `specimen.html`, every snippet in `patterns.md` rendered, with
  `?type=classic`, `?corners=soft` and `?palette=custom` (the strategy update's green and gold) to try the switches

The palette and logos come from a frontend-boilerplate checkout beside this
repo (`../frontend-boilerplate`, or set `BOILERPLATE=<path>`), so rebuild
after the brand changes there.

## Adding an example

The examples teach Claude more than the rules do, so add pages that are
exemplary as you make them:

1. Put the HTML in `igl-artifact/examples/`. Swap embedded fonts or
   images for links first (a Google Fonts `<link>`, `../logos/…`): they
   bloat the file Claude has to read.
2. Add a section to `examples/README.md`:
   - what the page is and who it's for
   - **what makes it work**: the design decisions worth copying
   - **what not to copy**
3. `npm run build` and share the new zip.

This repo is public, and the zip gets passed around, so nothing internal
goes in `examples/`: no names, strategy or unpublished figures. To use an
internal page as an example, keep the original in `private/` at the top of this repo (it's
gitignored, so it's only on your machine) and make a version with invented
content and the same structure and design, as `strategy-update.html` is.
The build refuses to package any file in the skill that git ignores.

## The look

Two switches on `<html>`, or as classes on part of a page:

- **Type**: `data-type="editorial"` (default: Newsreader headlines, IBM
  Plex Sans text, IBM Plex Mono labels, from the funding tracker's weekly
  email) or `"classic"` (Brown and Muli, as on the IGL website; Brown can't
  be embedded, so it shows as Century Gothic).
- **Corners**: `data-corners="square"` (default) or `"soft"` (3px).

Components use colour roles (`--hero`, `--accent`, `--strong`, status
colours) rather than palette names. A document can take its own palette
by re-pointing them, as the strategy update example does with green and gold. The
extended set from the email (navy, paper, amber, teal, orange) has darker
`-text` versions that pass contrast for small text. The chart order
(`--chart-1` to `-5`: blue, red, teal, amber, light blue) passes the
dataviz skill's colour-blindness checks.

Every page carries "Made with Claude" in its footer unless someone asks to
remove it.

## Changing it

1. Edit `igl-artifact/` (or the boilerplate's `src/index.css` for the
   brand colours).
2. Run `npm run build`, then open `dist/specimen.html` and check each
   look with the URL switches. Check a phone width too.
3. Share the new `dist/igl-artifact.zip`. Uploaded skills don't update
   themselves: people replace theirs with the new file.

What a Chat artifact can load was checked in November 2026: Google Fonts
and scripts from cdnjs both work. If a page comes out unstyled, that's the
first thing to recheck.
