# Skills

Innovation Growth Lab's Claude skills, versioned. Each one leans on design
thinking (information hierarchy, grouping, simplification) and leaves the
frontend tech to a template or to IGL's
[frontend-boilerplate](https://github.com/innovation-growth-lab/frontend-boilerplate).

| Skill | Where it runs | What it makes |
| --- | --- | --- |
| [`igl-artifact`](igl-artifact/README.md) | Claude chat | Reports, briefings, updates, digests, and pieces with a few views to click through, as one HTML page in the IGL look |
| [`igl-prototype`](plugins/igl/skills/igl-prototype/SKILL.md) | Claude Code | Tool prototypes on frontend-boilerplate: screens people use, with what they enter kept |

The line between them is what people enter. If nothing needs keeping, it's
an artifact, even across several views. Once it has to be kept (projects,
saved answers, check-ins), it's a tool.

## igl-artifact (Claude chat)

Built into a zip that people upload to Claude:

```sh
npm run build    # dist/igl-artifact.zip, plus dist/specimen.html
```

The build reads the IGL palette and logos from a frontend-boilerplate
checkout beside this repo (`../frontend-boilerplate`), or from
`BOILERPLATE=<path>`. Then in Claude, **Customize → Skills**, upload
`dist/igl-artifact.zip`, replacing any earlier version.
[`igl-artifact/README.md`](igl-artifact/README.md) covers how it works and
how to add an example.

## igl-prototype (Claude Code)

This repo is a Claude Code plugin marketplace, with one plugin, `igl`:

```sh
claude plugin marketplace add ~/git/nesta/skills    # or innovation-growth-lab/skills
claude plugin install igl@igl-skills
```

After changing a skill, `claude plugin marketplace update igl-skills` and
`claude plugin update igl@igl-skills` pick it up.

## This repo is public

Nothing internal goes in it: no names, strategy or unpublished figures.
Internal pages kept as reference while designing a skill go in `private/`,
which git ignores. The igl-artifact build refuses to package anything git
ignores. To use an internal page as an example, make a version with
invented content, as `igl-artifact/examples/strategy-update.html` is.
