# Skills

Innovation Growth Lab's Claude skills. Each folder here is one skill,
ready to use as it is: nothing to build.

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

1. Download this repo: **Code → Download ZIP** on GitHub, then open the
   zip.
2. Compress the skill's folder on its own (on a Mac, right-click it →
   **Compress**). You get, say, `igl-artifact.zip`.
3. In Claude, open **Customize → Skills** and upload that zip. If you
   have an older version, remove it first.

Uploaded skills don't update themselves: repeat this when a skill changes.

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

## Changing a skill

Edit the files in its folder: there's one copy of each. Two things are
duplicated on purpose, because each folder has to work on its own when
uploaded:

- `figma-svg/` is the same in both Figma skills. Change both.
- igl-artifact's colours (at the top of `igl.css`) and `logos/` come from
  frontend-boilerplate's `src/index.css` and `src/assets/logos/`. If the
  brand changes there, change them here.

To check igl-artifact's look, open `igl-artifact/template.html` or a page
in `igl-artifact/examples/` in a browser.

**Adding an example to igl-artifact.** The examples teach Claude more than
the rules do, so add pages that are exemplary:

1. Put the HTML in `igl-artifact/examples/`. Link `../igl.css` rather than
   carrying the stylesheet, and swap embedded fonts or images for links
   (a Google Fonts `<link>`, `../logos/…`), so the file stays short for
   Claude to read.
2. Add a section to `igl-artifact/examples/README.md`: what the page is
   and who it's for, **what makes it work** (the design decisions worth
   copying), and **what not to copy**.

## This repo is public

Nothing internal goes in it: no names, strategy or unpublished figures.
Keep internal pages you use as reference in `private/`, which git ignores.
To use one as an example, make a version with invented content, as
`igl-artifact/examples/strategy-update.html` is.
