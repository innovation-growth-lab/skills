# Examples

Pages IGL considers exemplary. Read these notes before designing: they say
what each page does well, which is the part worth copying. Open a page only
when you need to see how something was built. Copy the thinking and the
patterns, never the content.

## strategy-update.html: a strategy update

*Embedding experimentation in Kestria's innovation policy.* A long internal
note on a year of advocacy, for colleagues and funders who need to know
where things stand and what's coming: ten engagements across three
strategies. The structure and design decisions come from a real IGL
strategy update. The content is invented, because the original is
confidential: Kestria, its institutions, people and figures don't exist.

What makes it work:

- **It argues before it reports.** It opens with *why* ("The bet": two
  reasons that compound), then *how* (three routes), and only then *what*
  (the engagements). The reader has a frame before the details arrive, so
  each detail lands somewhere.
- **It regroups the material by meaning.** The engagements arrived as a
  list of conversations. The page sorts them under three named routes
  (Legislate it, Build it, Normalise it) and keeps that grouping
  everywhere: the index, the board and the item references (R1.2, R2.3)
  all use it.
- **Three depths of reading.** The headings alone tell the story ("Why we
  are concentrating on the national programme", "Three routes, pursued at
  once", "Where most of the effort goes"). The ledes give the argument.
  The detail sits in collapsed items with a status in each summary, so the
  closed list is itself an overview.
- **Priority is one colour.** Gold marks the two priorities in the index,
  the board and the priority panels, and nothing else. Orange means
  stalled. The reader learns both in seconds.
- **It draws the shape of the content.** Every engagement moves through the
  same four stages, so the board shows a rail per row, with the stages
  defined in plain words above it. That visual was invented for the
  original's content, and it's the most useful thing on the page.
- **It's honest about confidence.** "We are more confident of the mandate
  and the units than of the protected funding." "Not yet started, for lack
  of capacity on our side." Hedges are explicit, which makes the claims
  credible.
- **It ends with what to watch.** A timeline of the next six months, each
  entry saying why it matters.
- **It has its own palette.** Deep green and gold rather than IGL dark blue
  and yellow, re-pointed in the page's second `<style>` block, because the
  subject has its own colours. Same structure and type.

It links `../igl.css` to stay short to read; a real page has the
stylesheet inline (SKILL.md, Build it).

What not to copy: it's long. A shorter subject needs fewer sections, not
the same ones with less in them.

## funding-digest.html: a weekly digest

*Funding opportunities, this week.* The funding tracker's weekly email: a
ranked list of new calls for a team deciding what to apply for.

What makes it work:

- **The hero is the news.** Four counts (top picks, new, updated, closing
  soon) and one sentence explain the week before any item appears.
- **Ranked, then compressed.** The top picks get full cards: funder, title,
  a large score, a one-line summary, *why it fits*, and the facts needed to
  act (value, deadline, type). Everything below the top tier drops to
  compact rows, and the overflow says how many more there are and where.
- **Sections are numbered and counted.** "01 · 21 items" in the tag rule
  tells the reader how much is coming before they scroll.
- **Colour carries meaning only.** The score's colour is its tier (teal
  high, amber middle); orange appears only on deadlines under two weeks.
- **It tells you how to read it.** A dark panel at the end explains what the
  scores mean and where the thresholds are.

What not to copy: it's an email, so the markup is tables and inline styles.
Use the kit's `.entry`, `.rows` and `.stats` instead. One opportunity
appears twice; that's a data bug, not a design choice.
