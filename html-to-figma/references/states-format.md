# States file

A YAML file that names each screen to capture and scripts how to reach it, so a click-through is written once and rerun. `examples/checkin.states.yaml` is a full example.

```yaml
page: "~/Downloads/My page.html"   # path (relative to this file, or ~/absolute) or an http(s)/file URL
out: ~/Downloads/my-page-figma     # optional; --out overrides; default ./html-to-figma-out
width: 1147                        # viewport width in CSS px (default 1147)
scale: 2                           # deviceScaleFactor for the screenshots (default 2)
timeout_ms: 5000                   # per action (default 5000)
hide:                              # optional: selectors hidden in every state
  - .proto                         #   (dev panels, cookie banners: anything not in the design)

states:
  - name: checkin-goal-1           # required, unique; becomes the folder and file name
    hash: "#checkin"               # optional; appended to the page URL
    hide: [".toast"]               # optional: extra selectors hidden in this state only
    actions:                       # optional, run in order after the page loads
      - click: '[data-ci="start"]'
      - fill: { selector: '[name="progress"]', value: 60 }
      - select: { selector: '[name="months"]', value: "12" }  # or label: "12 months"
      - wait: '#progress-chart circle'                        # waits until visible
```

## Rules

- Every state starts from a fresh load of the page, so states never leak into each other. A state deep in a flow repeats the clicks that lead to it.
- Each action is a mapping with exactly one key: `click`, `fill`, `select` or `wait`. Selectors are Playwright selectors, so CSS works, as do `text=Continue` and `h3:has-text("Second goal")`.
- `fill` fires the page's `input` event, as typing would. `select` fires `change`.
- After the actions, animations and transitions are switched off, focus is removed (no focus rings or carets), the `hide` selectors are set to `display: none`, and the viewport grows to the page's full height. Sticky and fixed elements are then where a full-page capture shows them.
- A failing action stops that state only; the run carries on and `summary.md` records the failure.
