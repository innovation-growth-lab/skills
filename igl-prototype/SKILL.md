---
name: igl-prototype
description: Design and build an IGL tool prototype in a repo made from IGL's frontend-boilerplate, design first. Use when someone asks for a tool, an app, a prototype, a multi-step flow or a set of screens where what people enter is kept and come back to (projects, exercises, responses, check-ins), or brings a brief or a Chat artifact to turn into one. Agrees a design brief before building, then builds and screenshots one screen at a time. Not for something only to read or click through, where nothing entered is kept: that's the igl-artifact skill in Claude chat.
---

# Prototype an IGL tool

It works in a repo made from IGL's frontend-boilerplate
(`innovation-growth-lab/frontend-boilerplate`), which does the tech: pages,
IGL's components, hosting and screenshots. Its AGENTS.md has the rules. If
the current repo has no `src/routes.jsx` and `scripts/screenshots.js`, it
isn't one: suggest starting from a copy of the boilerplate (its README,
"Starting a project") before anything else.

The boilerplate does the tech. Your job is the design: what kind of product
this is, which screens it has, and what each one is for. A tool built
straight from a list of features comes out as a form on a page, so agree
the shape before building anything, then look at each screen as you go.

## 0. Check it's a tool

The line is what people enter, not how many screens there are. If nothing
they enter needs keeping (no projects, no saved answers), it's an
artifact, even across several views: suggest the igl-artifact skill in
Claude chat and stop. A tool starts where an input stops
being a way of viewing and becomes data people expect to find again.

## 1. Agree a design brief

Get an explicit yes on a brief before building anything. Read what
they've given you first, then ask only what it doesn't settle, as a short
quiz with AskUserQuestion: two to four multiple-choice questions a round,
each with your suggested answer first and marked "(Recommended)".
Usually two rounds.

**Round one, the product:**
- **Where it sits** between purely informational (IGL's Experimental Kit)
  and a tool someone does their core work in (the IRM).
- **Who uses it** and how often they come back.
- **What's kept:** the things people create (a project, an exercise, a
  response), and who creates each.

**Round two, the screens:**
- **The screens** and how you move between them.
- **The main task** on each.
- **First run and empty states:** what a newcomer sees, and where it
  leads them.
- **What's scaffolding** for the prototype rather than product.

Then write the brief back and wait for a yes:

```
Kind: where it sits between the Kit and the IRM, and why
Kept: project (name, stage, …), response (…)
Screens:
  /             Landing · what it is; start, or continue · editorial
  /projects     Projects · pick one or create one · empty state leads to create
  /projects/new Set-up · one column, three steps
  /project?id=  Project · its main action changes with its stage
  /respond?id=  Shared link · stripped back, one task
Navigation: top bar (Projects, About)
First run: …
Prototype controls: scenarios (first run, one project, several, mid-flow), copy and load the session, clear data
```

## 2. Start from a tool's shape, not a page's

The usual set, to cut down from rather than build up to:

- **A landing page**, which can use the informational editorial style.
- **A projects list**, with an empty state that leads to creating one.
- **A focused set-up flow** in a single column.
- **An object page** whose main action changes with its stage.
- **A stripped-back view** for anyone arriving from a shared link. With
  no backend, nothing really comes back from that link: build the
  respondent's view properly, and have their answers arrive through a
  simulation in the prototype controls, as the IRM does.

**Match navigation to the content.** A top bar (`NAV_LINKS` in
`src/config.js`) for a tool between the Kit and the IRM. No sidebar unless
there's enough to fill one.

**The main task gets the main space.** Supporting material (why, help,
examples) sits beside or below it, never in the wide column instead of
it. A flow someone fills in is one column.

**One primary action per screen** (the red `Button`), and it changes with
the stage: Create, then Invite, then Review.

**The copy speaks to the named user about their task.** "Your projects",
"Ask your team what they expect", not field labels arranged on a page.

## 3. Keep prototype controls in their own layer

Model them on the IRM's developer menu (repo
`innovation-growth-lab/irm`, checked out at `~/git/nesta/irm`:
`src/dev/DevMenu.jsx` and `src/dev/scenarios.js`). Copy the pattern into this tool rather than
making a shared component.

- **Opening it:** `?dev` on any URL, or triple-click an ALPHA badge beside
  the tool's name in the nav (add one in `src/components/Layout.jsx`).
  It closes the same way, or with Escape.
- **Labelled "Prototype controls"** for the people trying it.
- **It loads scenarios:** first run, a single project, several, mid-flow,
  or whichever states matter for this tool. `?scenario=<name>` loads one
  without opening the menu, for screenshots and for sending a colleague a
  particular state.
- **It copies the session as JSON, and loads one pasted in.**
- **It clears all data.**
- **It sits behind a `devMenu` flag** (the add-flag skill), on by default
  for prototypes.

Scenarios are JSON fixtures in `src/dev/scenarios/`, one per file, in the
same shape as the saved session, so a copied session can become a new
scenario. Keep dates relative ("updated 70 days ago") and convert them on
load, so "stale" still means stale months later.

**Scenario switchers, reset buttons and example-data notices never
appear in the product's own header, nav or pages.** They're a separate
channel from what the product says to its user.

## 4. Keep what people enter

- **One store object** for everything a person enters, saved to
  localStorage under a versioned key (`<tool>-v1`). The IRM's
  `src/store.jsx` is the model. Where someone is in the tool lives in the
  URL, not the store.
- **Read the store in an effect, never in render.** Pages are prerendered
  with no browser (AGENTS.md), so show a loading state until it's read.
- **Object pages are one route that reads `?id=`** (`/project?id=…`). That
  works on every host. `/projects/:id` only works on Vercel (AGENTS.md,
  Hosting).
- **Keep what people type out of `<title>` and the URL**, or turn
  analytics off. GA reads both (AGENTS.md, Analytics).

## 5. Build a screen at a time, and look at each one

In the brief's order, for each screen:

1. **Build it thinly.** The layout, the main task and real-feeling copy,
   from `src/components/ui/`. Add the route with the add-page skill.
2. **Give each state a screenshot.** Add an entry to `STATES` in
   `scripts/screenshots.js` for any state a plain load doesn't show,
   e.g. `'projects-several': {path: '/projects?scenario=several'}`. The
   script starts from empty storage, so a plain load is the first run.
3. **Screenshot it and look at the images.** The script shoots at 1280
   wide, a smaller laptop, which is what IGL's users mostly have:
   ```sh
   ONLY='projects' npm run screenshots -- http://localhost:5173/ screens/round-1
   ```
4. **Run the design checks below on what you see.** Fix it, then move on.

Keep going rather than waiting for approval, but let the person watch:
as screenshots come in, show one or two in your messages and point them
to the folder (`screens/round-1/`), so they can stop you if it's heading
the wrong way. Looking at it beats reading about it. Leave polish until
they've reacted to the screens as a set.

## 6. Check before handing over

Design checks, run on the screenshots:

- [ ] Every screen and key state has been screenshotted and looked at.
- [ ] The main task gets the main space; nothing secondary takes the wide
      column.
- [ ] Scenario and example-data controls appear only in the prototype
      controls.
- [ ] A first-run or empty state exists and leads somewhere.
- [ ] Each screen has one primary action, and it fits the stage.
- [ ] The copy reads as a tool for its named user, not as a form.

Technical checks: `npm run lint`, then `npm run build`, with a file in
`dist/` for every route. Then apply the rules in AGENTS.md that the
checks won't catch.

Then hand over:
- the screenshots
- the screens and what each is for
- how to open the prototype controls, and what's in them
- what you assumed
- what to react to next

Use the deploy skill only if they ask to share it.
