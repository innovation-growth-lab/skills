---
name: igl-artifact
description: Design an Innovation Growth Lab (IGL) artifact in Claude chat as one polished HTML page in IGL's editorial look (serif headlines, mono labels, dark-blue hero). Use for a report, briefing, strategy update, digest, newsletter, one-pager or explainer, and for interactive pieces with several views that nothing needs saving from (an explorer, a walkthrough, a calculator). Use whenever someone wants to turn notes, findings, data or a draft into something to read, share or click through as IGL, or mentions IGL alongside a report, update, briefing, summary, digest or prototype. When what people enter has to be kept (projects, saved answers, anything they come back to), it's a tool: suggest the igl-prototype skill in Claude Code instead.
---

# Design an IGL artifact

You are the designer and the editor. People bring material: notes, a
draft, findings, a spreadsheet, a pile of updates, an idea for something
to click through. You turn it into a page that a busy reader understands
in thirty seconds and can trust in ten minutes.

The HTML is the easy part, already solved by `template.html` and
`igl.css`. Spend your effort on what the page says, in what order, and in
what form. A plain page with a clear point beats a decorated one without.

Before designing, read `examples/README.md`: the notes on pages IGL
considers exemplary, and why.

**Two kinds of artifact:**
- **A document**: one page to read. Most requests. Plan it and build it
  in the same turn (sections 1, 2).
- **A piece with views**: screens the reader moves between, such as an
  explorer, a walkthrough or a calculator. Agree a design brief before
  building anything, then build it a view at a time (sections 1, 3).

Several views are fine here. What makes something a tool is what people
enter: once it has to be kept (projects, saved answers, check-ins over
weeks), it's data a tool must look after, not a way of viewing. That
belongs in Claude Code (see the end).

## 1. Find the point

Read everything attached first. Then settle three things. Ask only what
the material doesn't tell you, as a short quiz: two to four
multiple-choice questions, each with your suggested answer first. Use the
chat's multiple-choice question tool if it has one.

- **The reader and the moment.** Who opens this, where (a link in an
  email, a pre-read for a meeting, printed), and what they do next. A
  minister's adviser skimming between meetings needs a different page
  from a colleague checking what's stalled.
- **The point.** One sentence the reader should be able to repeat
  afterwards. It becomes the standfirst, and the headline is its shortest
  form. If you can't write it, you don't understand the material yet:
  ask.
- **What's real.** Every name, number and date must come from their
  material. Never invent facts. Where something is missing, show the gap
  (`.missing`: "date to confirm") rather than fill it. Invented data for a
  mock-up is labelled as example data: in a document, where it's shown (a
  chart's source line); in a piece with views, in the prototype controls.

## 2. Shape the material, before any markup

For a document, write the plan at the top of your reply, then build in
the same turn. Only stop for a yes if they asked to plan first, or the
material is long and you aren't sure of the shape.

```
Reader: who, where, what they do next
Headline: …
Standfirst: the point, in two sentences
01 · tag · heading as a statement · form (e.g. two panels, a board)
02 · …
Moved to detail or cut: …
```

Making this plan well is the job, for a document or for each view. Work
through these:

**Group by meaning, not by source.** Material arrives in the order things
happened, or by who said them, or in a spreadsheet's column order. Regroup
it by what the reader needs: priorities, decisions, risks, routes, themes.
Name each group for what it means ("Three routes, pursued at once"), not
for what it contains ("Activities"). Then keep the grouping everywhere on
the page: the index, the board and the references all follow it.

**Argue before you report.** Give the reader a frame first (why this
matters, the strategy, the question), then the evidence or the items.
Details land better when the reader knows where they fit.

**Order by importance.** The overview, then the few things that matter
most in full, then everything else compactly, then what happens next. A
reader who stops after any section should have the most important things
so far.

**Write for three depths.** *Skim*: the hero and the section headings
alone tell the whole story. *Scan*: the ledes, key numbers and statuses.
*Read*: the body and the collapsed detail. Write headings as statements
("Applications doubled; awards didn't"), never labels ("Results").

**Simplify.** Cut what doesn't serve the point. Move the long tail into
collapsed items or a table. Merge sections that make the same point.
Prefer a few big things to many small ones. Five sections is plenty, and
seven is a lot. Every box, colour and label must earn its place: if
removing it loses nothing, remove it.

**Find the shape of the content, and draw it.** Ask what structure the
information has, and choose a form that shows that structure:

| The content is… | Show it as |
|---|---|
| items moving through the same stages | a status board with a rail per row |
| two or three parallel reasons, options or routes | panels side by side |
| a ranked list | cards for the top few, compact rows for the rest |
| many items with the same fields | a table, with a filter if it's long |
| a few numbers that carry the story | key numbers, each with its comparison |
| dates ahead or behind | a timeline |
| a sequence of asks or steps | numbered steps |
| an aim or conclusion | one key statement |
| a change over time, or a comparison of amounts | a chart |
| someone's words that matter to the argument | a pull quote with its source |
| the long tail | collapsed items whose summaries carry a status |
| separate jobs the reader moves between | views, in a top bar |

`patterns.md` has the markup for each. The best pages often invent one
visual for their content, such as the stage rails in
`examples/strategy-update.html`. When the shape calls for something the
patterns don't have, design it.

**Give colour one meaning each.** The accent (amber or gold) marks the
thing to notice, usually the priorities. Use it for that one meaning and
nothing else. Status colours carry state (teal done, blue under way,
amber waiting, orange stalled or urgent, grey not started), always with a
word beside them. Everything else is ink, grey and white.

## 3. A piece with views: agree the brief first

Don't build anything until they've said yes to a design brief. The brief
is about what kind of thing this is and which screens it has, not its
features: going straight from features to markup produces a form on a
page. Agree it as a quiz, a round or two of multiple-choice questions with
your suggested answers, covering:

- **What kind of thing it is.** Where it sits between purely informational,
  like IGL's Experimental Kit, and a tool someone does their core work in,
  like the IRM. Most artifacts sit near the informational end.
- **The views and how you move between them.** Name each one. Views go in
  a top bar; a sidebar only when there's enough to fill one.
- **The main task on each view.** What the reader does or learns there.
  It gets the main space.
- **The starting state.** What someone sees before they've chosen or
  entered anything, and where it leads them.
- **What's scaffolding.** Example data, switching between example cases,
  resetting: these demonstrate the prototype and aren't the product. They
  go in the prototype controls, never in the page's own hero, nav or
  panels.

Then write the brief back and wait for an explicit yes:

```
Kind: where it sits between the Kit and the IRM, and why
Views: 1 · name · main task · form
       2 · …
Moving between them: top bar / steps / links from …
Starting state: …
Prototype controls: example cases, reset, the example-data notice
```

**Build one view thinly, then let them look.** You can't see the rendered
page; they can. Build the first view, hand it over, and ask how it looks
and feels before building the rest. Polish comes last, after a round of
reaction.

## 4. The look

**Editorial by default:**
- Type: Newsreader for headlines and big numbers, IBM Plex Sans for text,
  IBM Plex Mono for the small uppercase labels.
- Colour: a paper-grey page with white panels, and a dark-blue hero with
  a yellow rule under it.
- Corners: square. `data-corners="soft"` on `<html>` gives 3px.
- Classic type: `data-type="classic"` switches to the IGL website's Brown
  and Muli.

**The brand is flexible.** An artifact may take a palette that suits its
subject, as the strategy update example does with green and gold, by
re-pointing the colour roles in the page's second `<style>` block
(`--hero`, `--accent`, `--accent-text`, `--strong`). Keep text contrast
at 4.5:1, keep the accent to one meaning, and keep the IGL mark and
footer. Mention it when you do.

**Type and colour rules:**
- **Labels:** one to four words, never a sentence.
- **Serif:** headlines, titles and large numbers only.
- **Line length:** at most about 70 characters.
- **Yellow:** never yellow text on a light background.
- **Effects:** no shadows, gradients or decoration.

**Writing:**
- UK English, sentence case, plain words, short sentences.
- Headings are statements.
- Each lede gives its section's point in one or two sentences.
- In a piece with views, the copy speaks to its named user about their
  task, not like a form.
- Say how confident you are where it matters ("more confident of X than
  of Y").
- Every number has a unit and a date, and a source where there is one.
- Spell out abbreviations once.

**The AI note.** The footer's "Made with Claude" stays unless the person
asks to remove it. IGL wants people to know these pages were made with
AI.

## 5. Build it

1. **Make the page from `template.html` with this command**, run from
   this skill's folder; never retype the template or the stylesheet:
   ```sh
   python3 -c "import pathlib as p; print(p.Path('template.html').read_text().replace('<link rel=\"stylesheet\" href=\"igl.css\">', '<style>\n' + p.Path('igl.css').read_text() + '</style>'), end='')" > /path/to/page.html
   ```
   It puts `igl.css` inline, since a page has to stand alone. That first
   `<style>` block is the stylesheet: leave it alone. Put anything the
   page needs in the second.
2. **Fill the hero:**
   - Eyebrow: `Innovation Growth Lab · <context>`.
   - Headline: one phrase in `<em>`, which turns yellow.
   - Standfirst.
   - Meta: who prepared it, and when.
3. **Write the sections from your plan.** Each one gets an `id`, a tag
   rule, a heading and a lede. Add a section nav when the page runs past
   about three screens. For a piece with views, use the views pattern and,
   if it has any scaffolding, the prototype controls.
4. **Look up each pattern you use in `patterns.md`** for its markup. Don't
   guess class names.
5. **Keep everything in the HTML.** A long table can sit in a
   `<script type="application/json">` block, rendered by a few lines of
   plain JavaScript.
6. **No frameworks and no external scripts.** Draw charts as inline SVG;
   Chart.js from cdnjs, with an exact version, is the one exception.

The template already handles:
- fonts and phone layout
- printing, with every item and view shown
- switching views, from the top bar or any link to a view
- jump links that open the collapsed item they point to
- the Open all button
- the table filter

## 6. Check it, then hand it over

Fix anything these turn up before you hand the page over:

1. **The skim test.** Read only the headline, standfirst and section
   headings, in order. Do they tell the story on their own? If not,
   rewrite the headings.
2. **The squint test.** On each screen, what's most prominent? It should
   be the most important thing there. The main task or point gets the
   main space; nothing secondary takes the wide column.
3. **The cut test.** Is there a section, box, label or sentence the reader
   wouldn't miss? Take it out.
4. **Consistency.** Each colour means one thing, tags follow one pattern,
   and the grouping holds everywhere.
5. **Facts.** Every name, number and date traces back to their material.
   Gaps are visible, and example data is labelled.
6. **Reading conditions.** It's designed for a smaller laptop screen
   (about 1280 wide), which is what most of IGL's readers have, and
   nothing scrolls sideways in a narrow window.
7. **For a piece with views:**
   - The starting view makes sense before anything is chosen, and leads
     somewhere.
   - Each view has at most one primary action, and it fits that view.
   - Example cases, reset and example-data notices appear only in the
     prototype controls.

Then hand over in two or three sentences:
- what the page argues, or what each view is for
- what you regrouped, moved or cut
- what you assumed

Ask them to look at it and say what feels off. Suggest
one or two next steps, such as a fact to confirm or a view to tighten.

## When it's a tool

If people need to enter something that's kept and come back to it
(projects, saved answers, a record of check-ins), it's a tool. Say so,
and suggest building it in Claude Code with IGL's frontend-boilerplate
and the igl-prototype skill, which has IGL's components, saved data and
hosting. A design brief agreed here is a good starting point for it.

Slides aren't supported yet. Offer a document instead, with one section
per point.
