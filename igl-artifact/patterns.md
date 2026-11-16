# Patterns

The building blocks in `igl.css`, each with when to use it and its markup.
Pick a pattern for what it shows, not how it looks: every one here exists
to show some shape of information (a ranking, a sequence, a status, a
choice). If none fits the shape of yours, design one in the page's second
`<style>` block from the same roles (`var(--strong)`, `var(--accent)` …).

## Frame

### Hero

Every document opens with one. The eyebrow says where it's from, the
headline says what it's about with one phrase in `<em>`, the standfirst
gives the point. Meta for who and when; it's what makes a document
trustworthy later.

```html
<header class="hero">
  <div class="wrap">
    <div class="eyebrow"><span>Innovation Growth Lab · Kestria engagement</span><!-- the IGL mark: copy the <svg class="logo"> from template.html --></div>
    <h1>Embedding experimentation in <em>Kestria's</em> innovation policy</h1>
    <p class="standfirst">One concentrated effort: making experimentation a normal part of how Kestria designs and funds its innovation policy, nationally and in its fourteen regions.</p>
    <div class="hero-meta">
      <div>Prepared by<b>Mira Halden</b></div>
      <div>Position at<b>September 2026</b></div>
    </div>
  </div>
</header>
```

### Hero with numbers

For a digest or an update where the counts are the news. Four numbers at
most; each is a count the reader cares about, labelled in their words. One
action at most, in yellow.

```html
<header class="hero">
  <div class="wrap wrap-narrow">
    <div class="eyebrow"><span>Weekly digest · 5 Oct 2026</span><!-- the IGL mark: copy the <svg class="logo"> from template.html --></div>
    <h1>Funding opportunities, <em>this week</em></h1>
    <p class="standfirst">207 new and 33 updated opportunities were collected this week. 21 scored 70 or more against our criteria.</p>
    <div class="actions"><a class="btn" href="#top-picks">See the top picks →</a></div>
    <div class="stats">
      <div><span class="stat-value">21</span><span class="stat-label">Top picks</span></div>
      <div><span class="stat-value">207</span><span class="stat-label">New</span></div>
      <div><span class="stat-value">33</span><span class="stat-label">Updated</span></div>
      <div><span class="stat-value">3</span><span class="stat-label">Closing soon</span></div>
    </div>
  </div>
</header>
```

### Section nav

Sticky links to the sections, for anything longer than three screens. Each
link names the section in two or three words.

```html
<nav class="toc" aria-label="Sections">
  <div class="wrap">
    <a href="#why">Why the programme</a>
    <a href="#routes">Three routes</a>
    <a href="#board">Where things stand</a>
    <a href="#watch">Next six months</a>
  </div>
</nav>
```

### Section opening

Every section: a tag rule (what kind of section: "The bet", "01 · 21
items"), a heading that states the point, and a lede that argues it in
one or two sentences. Read the headings alone in order: they should tell
the story.

```html
<section class="section" id="why">
  <p class="rule">The bet</p>
  <h2>Why we are concentrating on the national programme</h2>
  <p class="lede">Two reasons, and they compound. The first is the size of the budget. The second, larger one, is that the national programme writes the rules that fourteen regional agencies copy.</p>
</section>
```

### Views

For a piece with several views: a dark bar with its name and the views,
in place of the hero. Each view is a `.view` with an `id`; all but the
first start `hidden`. Any link to a view, or to something inside one,
shows it. The views are the jobs the reader moves between, in the order
they'd do them, named in a word or two. Start each view with a heading
that says what it's for, not a hero.

```html
<header class="appbar">
  <div class="wrap">
    <a class="appbar-name" href="#start"><!-- the IGL mark: copy the <svg class="logo"> from template.html --><span>Expectations check</span></a>
    <nav aria-label="Views">
      <a href="#start">Start</a>
      <a href="#compare">Compare</a>
      <a href="#results">Results</a>
    </nav>
  </div>
</header>
<main>
  <div class="wrap">
    <div class="view" id="start">
      <section class="section">
        <h2>See whether your team expects the same things</h2>
        <p class="lede">Pick an example team to see how their expectations line up.</p>
      </section>
    </div>
    <div class="view" id="compare" hidden>…</div>
    <div class="view" id="results" hidden>…</div>
  </div>
</main>
```

### Prototype controls

Scaffolding for trying a prototype out: switching between example cases,
resetting, and the notice that the data is invented. It floats in a
corner, dashed and grey, apart from the design. These never go in the
page's own bar, hero or panels. A page with no scaffolding has none.

```html
<details class="proto">
  <summary>Prototype controls</summary>
  <div class="proto-body">
    <p>Not part of the design. Everything here is example data.</p>
    <button type="button" data-case="aligned">Example: a team that agrees</button>
    <button type="button" data-case="split">Example: a split team</button>
    <button type="button" data-case="reset">Start again</button>
  </div>
</details>
```

### Footer

Where it's from, when, and that it was made with Claude.

```html
<footer class="footer">
  <p>Innovation Growth Lab · Nesta and the Barcelona School of Economics · September 2026</p>
  <p class="ai-note">Made with Claude</p>
</footer>
```

## Grouping

### Panels side by side

Two or three parallel points that are equally weighted: reasons, options,
routes. `.cols-2`, `.cols-3`, or `.cols` to fit as many as there's room
for. Number them in the label if the order matters.

```html
<div class="cols-2">
  <div class="panel">
    <span class="label">One · Direct spend</span>
    <p>Kestria is about to commit €6 billion to its next Innovation Programme. The rules written now hold for five years.</p>
  </div>
  <div class="panel">
    <span class="label">Two · Leverage</span>
    <p>The regional agencies reuse the national rules, so a change made once spreads at no extra cost.</p>
  </div>
</div>
```

### Cards with a top rule

Named options or routes, each with a short name the reader will remember.
The top rule groups them visually; the h3 is the name.

```html
<div class="cols-3">
  <div class="panel panel-top">
    <span class="label label-mute">Route one</span>
    <h3>Legislate it</h3>
    <p class="small">Write an experimentation mandate into the Innovation Bill. Legislation outlasts the people who championed it.</p>
  </div>
  <div class="panel panel-top">
    <span class="label label-mute">Route two</span>
    <h3>Build it</h3>
    <p class="small">Help institutions stand the capability up. Almost none of this needs legislation.</p>
  </div>
  <div class="panel panel-top">
    <span class="label label-mute">Route three</span>
    <h3>Normalise it</h3>
    <p class="small">Change what officials believe is permissible.</p>
  </div>
</div>
```

### Key statement

The aim, the ask or the conclusion, said once and big, with what sits
under it. Use one per document.

```html
<div class="panel panel-left">
  <span class="label">Primary aim</span>
  <p class="statement">Making policy experimentation routine in Kestria's science, innovation and productivity policy.</p>
  <span class="label label-strong" style="margin-top: 22px">Secondary aims</span>
  <dl class="defs">
    <dt>Diversification</dt><dd>More kinds of funder and research organisation.</dd>
    <dt>Agility</dt><dd>More agility to take up novel policy ideas.</dd>
  </dl>
</div>
```

### Dark panel

A diagnosis, a warning or the one idea that frames everything else. It
interrupts the page on purpose, so once per document at most.

```html
<div class="panel-dark">
  <h3>The problem, stated plainly</h3>
  <p>An official who believes a pilot with an uncertain result will be written up as waste will not run one, <b>whatever the law says</b>.</p>
</div>
```

### A box inside a panel

A related thread that belongs to the panel but isn't its main line.

```html
<div class="panel-tint">
  <span class="label label-strong">The upper house, a defensive effort</span>
  <p>It rarely amends technical provisions. The realistic ask is that its members don't remove ours, not that they champion them.</p>
</div>
```

### Priority panel

The few things that get most of the effort, in full. The accent top rule
marks them as the priorities; use it for nothing else.

```html
<div class="panel panel-lg is-accent" id="parliament">
  <span class="label">Priority one · route one</span>
  <h3>Innovation Bill amendments in Parliament</h3>
  <p class="lede">The science spokespeople of both main parties have confirmed they will carry our amendments into committee stage.</p>
  <h4>What happens next</h4>
  <p>Committee stage concludes in October; third reading is expected in December.</p>
</div>
```

### Grouped index

An overview of many items under a few groups, linking to each. The few
that matter most are `.is-priority`. Say what the marks mean in a note.

```html
<div class="index">
  <div>
    <span class="label label-strong">Route one · Legislate it</span>
    <ul>
      <li class="is-priority"><a href="#parliament">Innovation Bill amendments</a></li>
      <li><a href="#regional-act">Regional Growth Act</a></li>
    </ul>
  </div>
  <div>
    <span class="label label-strong">Route two · Build it</span>
    <ul>
      <li class="is-priority"><a href="#council">Research Council experimentation unit</a></li>
      <li><a href="#review">Government operating review</a></li>
    </ul>
  </div>
</div>
<p class="note">The two marked in gold are the top priorities. Select any to jump to it.</p>
```

## Lists

### Numbered asks or steps

A short sequence where each item has a bold name and a sentence or two.
`.is-hard` marks the one that's hardest to get.

```html
<ol class="steps">
  <li><b>An experimentation mandate.</b> A framework for experimentation in how the programme's money is awarded.</li>
  <li><b>Dedicated experimentation units</b> at the Research Council and Innovation Kestria.</li>
  <li class="is-hard"><b>Protected funding.</b> No less than 2% of each programme for testing and learning. The hardest ask.</li>
</ol>
```

### Plain list

```html
<ul class="list">
  <li>We have met the Research Council chief executive's office and two directors.</li>
  <li>We have agreed to advise on the design of the unit.</li>
</ul>
```

### People and organisations

Who's involved, compactly: bold name, then role.

```html
<div class="chips">
  <span><b>Ana Vellin</b> Chair, Science and Industry Committee</span>
  <span><b>Jonas Erke</b> Opposition science spokesperson</span>
  <span>Committee clerks and two members' offices</span>
</div>
```

### Document links

```html
<p><a class="doclink" href="#"><b>Innovation Bill amendments</b> PDF</a><a class="doclink" href="#"><b>Opinion piece</b> Web</a></p>
```

## Status

### Status pills

State in a word. The colours: good (done, committed), active (under way),
warn (at risk, waiting), bad (stalled, urgent), plain (not started). Same
word, same colour, everywhere on the page.

```html
<p><span class="pill pill-good">Committed</span> <span class="pill pill-active">Engaged</span> <span class="pill pill-warn">Waiting</span> <span class="pill pill-bad">Stalled</span> <span class="pill">To start</span></p>
```

### Status board

Many items moving through the same stages. Each row: name and where it
sits, a rail showing the stage, and one line on where it stands. Explain
the stages above it. Rows link to their detail. One `<i>` per stage; the
current one is `.now`. `.is-stalled` on a rail that's stuck.

```html
<p class="note">Each runs along the same four stages. <b>Scoping</b>: finding the people and the ask. <b>Engaged</b>: the ask is on the table. <b>Committed</b>: they've agreed to carry it. <b>Landed</b>: it's in a law, a budget line or a unit.</p>
<div class="board">
  <div class="board-head" aria-hidden="true">
    <span></span>
    <span class="board-stages"><span>Scoping</span><span>Engaged</span><span>Committed</span><span>Landed</span></span>
    <span></span>
  </div>
  <div class="board-group">Route one · <b>Legislate it</b></div>
  <a class="board-row is-priority" href="#parliament">
    <span class="board-name">Innovation Bill amendments<small>Parliament · <b>Priority</b></small></span>
    <span class="rail" role="img" aria-label="Committed, stage 3 of 4"><i></i><i></i><i class="now"></i><i></i></span>
    <span class="board-status">Both main parties' spokespeople will carry our amendments into committee.</span>
  </a>
  <div class="board-group">Route two · <b>Build it</b></div>
  <a class="board-row" href="#agency">
    <span class="board-name">A unit at Innovation Kestria<small>National innovation agency</small></span>
    <span class="rail is-stalled" role="img" aria-label="Stalled at engaged, stage 2 of 4"><i></i><i class="now"></i><i></i><i></i></span>
    <span class="board-status">Interest from the leadership, but a hiring freeze is blocking it.</span>
  </a>
  <a class="board-row" href="#treasury">
    <span class="board-name">Evaluation rules<small>Treasury</small></span>
    <span class="rail" role="img" aria-label="Scoping, stage 1 of 4"><i class="now"></i><i></i><i></i><i></i></span>
    <span class="board-status">An internal champion identified; no outcomes expected soon.</span>
  </a>
</div>
```

## Ranked items

### Item card

The top few of a ranked list, in full: source, name, score, a summary, why
it's here, and the facts to act on. `.is-high` / `.is-mid` colour the tier.
Five cards is plenty; the rest go in compact rows.

```html
<article class="entry is-high">
  <div class="entry-head">
    <div>
      <span class="label label-mute">European Foundation for the Improvement of Living and Working Conditions</span>
      <h3><a href="#">Pilot survey on company use and productivity impact of AI</a></h3>
    </div>
    <div class="score"><b>85</b><span>Score</span></div>
  </div>
  <p>A mixed-mode company survey in five EU countries on workplace AI use and its effects on productivity, wages and job quality.</p>
  <div class="why"><span class="label">Why it fits</span>A cross-national survey on AI and productivity, close to IGL's work on evidence for innovation policy.</div>
  <dl class="facts">
    <div><dt>Value</dt><dd>€740,000</dd></div>
    <div class="is-urgent"><dt>Deadline</dt><dd>12 Nov 2026 · 7 days left</dd></div>
    <div><dt>Type</dt><dd>Contract notice</dd></div>
  </dl>
</article>
```

### Compact rows

The rest of a ranked list: score, name, one line of facts. Say how many
more there are and where they live.

```html
<ul class="rows">
  <li class="is-high"><span class="score"><b>78</b></span><div><a href="#">Evaluation consultancy services</a><p>Movexum · <span class="is-urgent">27 Oct · 3 days left</span></p></div></li>
  <li class="is-mid"><span class="score"><b>64</b></span><div><a href="#">Innovation voucher pilot</a><p>Enterprise Ireland · 14 Jan 2027</p></div></li>
</ul>
<p class="more">+ 12 more opportunities <a href="#">in the tracker</a></p>
```

### Nothing this time

Say an empty section plainly rather than hiding it, when its absence is
news.

```html
<div class="empty">Nothing new scored high enough this week.</div>
```

## Numbers

### Key numbers

Three or four numbers that carry the story, each labelled in the reader's
words. A number without a comparison means little: say against what in
the label or the lede.

```html
<div class="stats">
  <div><span class="stat-value">€6bn</span><span class="stat-label">Next innovation programme</span></div>
  <div><span class="stat-value">14</span><span class="stat-label">Regional agencies that copy its rules</span></div>
  <div><span class="stat-value">5 yrs</span><span class="stat-label">How long the rules hold</span></div>
</div>
```

## Quotes

### Pull quote

One sentence worth the reader's attention, from someone who matters to the
argument.

```html
<figure class="pull">
  <p>I have sent your piece to half the committee. It says plainly what many of us have thought for years.</p>
  <cite>Former science minister, by email</cite>
</figure>
```

### Quote in the text

```html
<blockquote><p>Officials are told the practice is not explicitly prohibited, but not explicitly permitted either.</p><cite>Head of unit, Ministry of Enterprise</cite></blockquote>
```

## Detail

### Collapsed items

The long tail: everything the reader might want but doesn't need first.
Each summary carries a reference, the name and its status, so the closed
list is itself an overview. The template's script opens an item when
something links to it, opens all for printing, and makes the Open all
button work.

```html
<div class="tools"><button class="btn-quiet" type="button" data-open-all>Open all</button></div>
<details class="item" id="agency">
  <summary><span class="item-ref">R2.4</span><span class="item-title">A unit at Innovation Kestria</span><span class="pill pill-bad">Stalled</span></summary>
  <div class="item-body">
    <h4>Where it stands</h4>
    <p>The leadership is interested, but a hiring freeze is blocking it.</p>
    <h4>Our read</h4>
    <p>Unlikely to move unless a law compels it.</p>
  </div>
</details>
<details class="item" id="treasury">
  <summary><span class="item-ref">R2.5</span><span class="item-title">Evaluation rules at the Treasury</span><span class="pill">Scoping</span></summary>
  <div class="item-body"><p>An internal champion identified.</p></div>
</details>
```

## Time

### Timeline

What happens next, or what happened. The date column can be loose ("After
the summer"); each entry says what it is and why it matters.

```html
<ol class="timeline">
  <li><span class="when">October</span><div><b>Committee stage concludes</b><p>Our amendments are either in the committee's text or they are not.</p></div></li>
  <li><span class="when">November</span><div><b>Research Council board decides</b><p>The clearest early test of whether route two works.</p></div></li>
</ol>
```

## Data

### Chart

Inline SVG in a figure: a title that states the finding, a legend for two
or more series, direct labels where they fit, and the source. Series take
`--chart-1` to `--chart-5` in order. One axis per chart. Make the viewBox
about as wide as the figure (960 in a full-width one), so text and lines
draw at their real size. Offer the numbers as a table if anyone will want
them.

```html
<figure class="figure">
  <figcaption><b>Applications have doubled since 2019 while awards stayed flat</b><span class="small muted">A grant programme, per year</span></figcaption>
  <ul class="legend"><li style="--swatch: var(--chart-1)">Applications</li><li style="--swatch: var(--chart-2)">Awards</li></ul>
  <svg viewBox="0 0 960 240" role="img" aria-label="Applications rose from 3,200 in 2019 to 6,400 in 2025; awards stayed near 400.">
    <line x1="0" y1="210" x2="960" y2="210" stroke="var(--line)"/>
    <polyline fill="none" stroke="var(--chart-1)" stroke-width="2" points="20,150 170,138 320,118 470,100 620,76 770,56 920,34"/>
    <polyline fill="none" stroke="var(--chart-2)" stroke-width="2" points="20,196 170,196 320,195 470,196 620,195 770,196 920,195"/>
    <text x="20" y="232">2019</text><text x="920" y="232" text-anchor="end">2025</text>
    <text x="920" y="22" text-anchor="end">6,400</text>
    <text x="920" y="184" text-anchor="end">410</text>
  </svg>
  <p class="source">Source: illustrative example data</p>
</figure>
```

### Table

Many items with the same fields. The first column names the row; numbers
right-aligned in `.num`. A filter when there are more than about twenty
rows: `data-filter` names the table's id.

```html
<input class="filter" type="search" placeholder="Filter the table" aria-label="Filter the table" data-filter="awards">
<div class="table-wrap">
  <table class="table" id="awards">
    <thead><tr><th>Programme</th><th>Country</th><th class="num">Awards</th></tr></thead>
    <tbody>
      <tr><td>Innovation vouchers</td><td>Ireland</td><td class="num">412</td></tr>
      <tr><td>Growth coaching</td><td>Denmark</td><td class="num">96</td></tr>
    </tbody>
  </table>
</div>
```

### Something to confirm

Where the material is missing a fact, show the gap rather than fill it.

```html
<p>Third reading is expected by <span class="missing">date to confirm</span>.</p>
```
