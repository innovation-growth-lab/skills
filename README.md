# Skills

Innovation Growth Lab's Claude skills, one folder each.

| Skill | Use it in | What it does |
| --- | --- | --- |
| [igl-artifact](igl-artifact/SKILL.md) | Claude chat | Designs reports, briefings, updates, digests and pieces with a few views to click through, as one page in the IGL look |
| [igl-prototype](igl-prototype/SKILL.md) | Claude Code | Designs and builds tool prototypes on IGL's [frontend-boilerplate](https://github.com/innovation-growth-lab/frontend-boilerplate): screens people use, where what they enter is kept |
| [screenshot-to-figma](screenshot-to-figma/SKILL.md) | Claude chat or Code | Rebuilds a screenshot as an SVG that imports into Figma with editable text and named layers |
| [html-to-figma](html-to-figma/SKILL.md) | Claude Code | The same from a page's HTML, read from a real browser, one SVG per screen |

**Artifact or prototype?** It depends on what people enter. If nothing
needs keeping, it's an artifact, even across several views. Once it has
to be kept (projects, saved answers, check-ins), it's a tool: use
igl-prototype.

## Adding a skill to Claude chat

1. Download the skill's zip from the
   [latest release](https://github.com/innovation-growth-lab/skills/releases/latest),
   for example `igl-artifact.zip`.
2. In Claude, open **Customize → Skills** and upload it. If you have an
   older version, remove it first.

Uploaded skills don't update themselves: repeat this when there's a new
release. Use the release zips rather than the folders here, which aren't
complete on their own (see Changing a skill).

## Adding a skill to Claude Code

**If you edit these skills**, clone this repo and link each skill into
your skills folder. Claude Code then uses the repo's copy directly, and
picks up edits straight away, even mid-session:

```sh
ln -s ~/git/nesta/skills/igl-prototype ~/.claude/skills/igl-prototype
```

**If you only use them**, install them as a plugin, and update it when
they change:

```sh
claude plugin marketplace add innovation-growth-lab/skills
claude plugin install igl@igl-skills
```

Use one or the other, or each skill appears twice.

## Changing a skill

Edit the files in its folder. Everything has one home:

- `_shared/figma-svg/` is used by both Figma skills, through a link in
  each.
- igl-artifact's colours, fonts and logos live in frontend-boilerplate
  (`src/index.css`, `src/assets/logos/`). The build adds them to the zip.

`node src/build.mjs` builds every skill as a release would, into `dist/`:
a folder and a zip each, with links replaced by real files and
igl-artifact's brand added. It fetches frontend-boilerplate from GitHub,
or uses a checkout with `BOILERPLATE=<path>`. To check igl-artifact's
look, build it and open `dist/igl-artifact/template.html` or a page in
`dist/igl-artifact/examples/`.

**Adding an example to igl-artifact.** The examples teach Claude more than
the rules do, so add pages that are exemplary:

1. Put the HTML in `igl-artifact/examples/`. Link `../igl.css` rather than
   carrying the stylesheet, use `<!--igl:mark-->` for the logo, and swap
   embedded fonts or images for links (a Google Fonts `<link>`,
   `../logos/…`), so the file stays short for Claude to read.
2. Add a section to `igl-artifact/examples/README.md`: what the page is
   and who it's for, **what makes it work** (the design decisions worth
   copying), and **what not to copy**.

## Releasing

Tag a version and push the tag:

```sh
git tag v1.0.0 && git push origin v1.0.0
```

A GitHub workflow (`.github/workflows/release.yml`) builds every skill,
with igl-artifact's brand from frontend-boilerplate's main branch at that
moment, and publishes the zips as a release. Release again after the brand
changes there.

## This repo is public

Nothing internal goes in it: no names, strategy or unpublished figures.
Keep internal pages you use as reference in `private/`, which git ignores;
the build refuses to package anything git ignores. To use an internal page
as an example, make a version with invented content, as
`igl-artifact/examples/strategy-update.html` is.
