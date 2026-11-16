#!/usr/bin/env python3
"""Rebuild a live page as one Figma-importable SVG per state, read from the
browser's own layout, and check each SVG against the browser's screenshot.

  html_to_figma.py STATES.yaml [--page PATH_OR_URL] [--out DIR] [--only NAME ...]
                   [--width PX] [--scale N]

For each state it writes DIR/<state>/<state>.svg (the deliverable),
browser.png (the page), render.png (the SVG drawn by the same Chrome),
diff.png (red = only in the SVG, cyan = only in the page) and report.txt.
DIR/summary.md lists every state. Exit status 2 means no browser could start.
"""
import argparse, base64, html, json, mimetypes, os, re, sys, urllib.parse, urllib.request
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
SHARED = HERE.parent / "figma-svg"
sys.path.insert(0, str(SHARED))

import yaml
from PIL import Image
from diff import diff_png, mismatch

NO_BROWSER = """No browser is available, so html-to-figma can't read the page.
Run `bash scripts/setup.sh` to install Playwright (it uses Google Chrome if
installed, otherwise downloads Chromium). Where no browser can run, rebuild
the page from a screenshot with /screenshot-to-figma instead."""

ACTIONS = ("click", "fill", "select", "wait")


# ---- States file ----

def load_states(path, page_override=None):
    cfg = yaml.safe_load(Path(path).read_text())
    base = Path(path).resolve().parent
    page = page_override or cfg.get("page")
    if not page:
        sys.exit("No page: give `page:` in the states file or --page.")
    if re.match(r"^(https?|file):", page):
        url = page
    else:
        p = Path(os.path.expanduser(page))
        url = (p if p.is_absolute() else (Path.cwd() / p if page_override else base / p)).resolve().as_uri()
    states = cfg.get("states") or []
    names = set()
    for s in states:
        if not s.get("name"):
            sys.exit("Every state needs a name.")
        if s["name"] in names:
            sys.exit(f"Duplicate state name {s['name']!r}.")
        names.add(s["name"])
        for a in s.get("actions") or []:
            if not isinstance(a, dict) or len(a) != 1 or next(iter(a)) not in ACTIONS:
                sys.exit(f"State {s['name']!r}: each action is one of {', '.join(ACTIONS)}; got {a!r}.")
    return cfg, url, states


def run_action(page, a, timeout):
    kind, arg = next(iter(a.items()))
    if kind == "click":
        page.click(arg, timeout=timeout)
    elif kind == "wait":
        page.wait_for_selector(arg, state="visible", timeout=timeout)
    elif kind == "fill":
        page.fill(arg["selector"], str(arg["value"]), timeout=timeout)
    elif kind == "select":
        if "label" in arg:
            page.select_option(arg["selector"], label=str(arg["label"]), timeout=timeout)
        else:
            page.select_option(arg["selector"], value=str(arg["value"]), timeout=timeout)


FREEZE = "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }"


def settle(page):
    page.evaluate("document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))")


def prepare(page, url, state, cfg, width):
    page.goto(url + (state.get("hash") or ""), wait_until="load")
    settle(page)
    timeout = cfg.get("timeout_ms", 5000)
    for a in state.get("actions") or []:
        run_action(page, a, timeout)
        settle(page)
    css = FREEZE + "".join(f"{s} {{ display: none !important; }}" for s in (cfg.get("hide") or []) + (state.get("hide") or []))
    page.add_style_tag(content=css)
    page.evaluate("document.activeElement && document.activeElement !== document.body && document.activeElement.blur()")
    # Make the viewport the whole page, so fixed and sticky elements sit where a full-page capture shows them.
    # Start short, so a page shorter than the window isn't padded to the window's height.
    page.set_viewport_size({"width": width, "height": 200})
    settle(page)
    h = 0
    for _ in range(5):
        nh = page.evaluate("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)")
        if nh == h:
            break
        h = nh
        page.set_viewport_size({"width": width, "height": h})
        settle(page)
    page.evaluate("window.scrollTo(0, 0)")
    settle(page)


# ---- SVG writing ----

def num(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s


def attrs(pairs):
    out = []
    for k, v in pairs:
        if v is None or v is False:
            continue
        out.append(f'{k}="{html.escape(num(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else str(v), quote=True)}"')
    return (" " + " ".join(out)) if out else ""


def paint(n):
    return [("fill", n.get("fill") or "none"),
            ("fill-opacity", n["fo"] if n.get("fill") and n.get("fo", 1) < 1 else None),
            ("stroke", n.get("stroke")),
            ("stroke-opacity", n["so"] if n.get("stroke") and n.get("so", 1) < 1 else None),
            ("stroke-width", n.get("sw") if n.get("stroke") else None),
            ("stroke-dasharray", n.get("dash") if n.get("stroke") else None),
            ("stroke-linecap", n.get("cap") if n.get("stroke") else None),
            ("stroke-linejoin", n.get("join") if n.get("stroke") else None)]


STYLE_KEYS = ["ff", "fs", "fw", "it", "fill", "fo", "ls", "td"]


def style_attrs(st, base=None):
    def want(k):
        return base is None or st.get(k) != base.get(k)
    return [("font-family", st["ff"] if want("ff") else None),
            ("font-size", st["fs"] if want("fs") else None),
            ("font-weight", st["fw"] if want("fw") else None),
            ("font-style", ("italic" if st["it"] else "normal") if want("it") and (st["it"] or base) else None),
            ("fill", st["fill"] if want("fill") else None),
            ("fill-opacity", st["fo"] if want("fo") and (st["fo"] < 1 or base) else None),
            ("letter-spacing", st["ls"] if want("ls") and (st["ls"] or base) else None),
            ("text-decoration", (st["td"] or "none") if want("td") and (st["td"] or base) else None)]


class Writer:
    def __init__(self, keys):
        self.keys = keys          # add data-k attributes (verify render only)
        self.expect = {}          # k -> (name, text, box, kind)
        self.k = 0

    def key(self, name, box, text="", kind="box"):
        if not box:
            return None
        self.k += 1
        self.expect[self.k] = (name, text, box, kind)
        return self.k if self.keys else None

    def node(self, n, out, depth):
        pad = "  " * depth
        t = n["t"]
        nm = ("id", n.get("name"))
        if t == "g":
            out.append(f"{pad}<g{attrs([nm])}>")
            for c in n["own"] + n["kids"]:
                self.node(c, out, depth + 1)
            out.append(f"{pad}</g>")
        elif t == "rect":
            k = self.key(n["name"], n.get("box"))
            out.append(f"{pad}<rect{attrs([nm, ('x', n['x']), ('y', n['y']), ('width', n['w']), ('height', n['h']), ('rx', n.get('rx') or None)] + paint(n) + [('data-k', k)])}/>")
        elif t == "circle":
            out.append(f"{pad}<circle{attrs([nm, ('cx', n['cx']), ('cy', n['cy']), ('r', n['r'])] + paint(n))}/>")
        elif t == "ellipse":
            out.append(f"{pad}<ellipse{attrs([nm, ('cx', n['cx']), ('cy', n['cy']), ('rx', n['rx']), ('ry', n['ry'])] + paint(n))}/>")
        elif t == "line":
            out.append(f"{pad}<line{attrs([nm, ('x1', n['x1']), ('y1', n['y1']), ('x2', n['x2']), ('y2', n['y2'])] + paint(n))}/>")
        elif t == "poly":
            out.append(f"{pad}<{n['tag']}{attrs([nm, ('points', n['points'])] + paint(n))}/>")
        elif t == "path":
            out.append(f"{pad}<path{attrs([nm, ('d', n['d']), ('transform', n.get('transform'))] + paint(n))}/>")
        elif t == "image":
            k = self.key(n["name"], n.get("box"), kind="image")
            out.append(f"{pad}<image{attrs([nm, ('x', n['x']), ('y', n['y']), ('width', n['w']), ('height', n['h']), ('preserveAspectRatio', 'none'), ('xlink:href', n['src']), ('data-k', k)])}/>")
        elif t == "text":
            self.text(n, out, pad)

    def text(self, n, out, pad):
        lines = n["lines"]
        weight = Counter()
        for ln in lines:
            for r in ln["runs"]:
                weight[json.dumps({k: r["st"][k] for k in STYLE_KEYS}, sort_keys=True)] += len(r["s"])
        base = json.loads(weight.most_common(1)[0][0])
        head = [("id", n["name"])] + style_attrs(base) + [("text-anchor", n.get("anchor"))]
        esc = lambda s: html.escape(s, quote=False)
        if len(lines) == 1:
            ln = lines[0]
            k = self.key(n["name"], ln["box"], "".join(r["s"] for r in ln["runs"]), "text")
            body = "".join(esc(r["s"]) if all(r["st"][k] == base[k] for k in STYLE_KEYS) else f"<tspan{attrs(style_attrs(r['st'], base))}>{esc(r['s'])}</tspan>"
                           for r in ln["runs"])
            out.append(f"{pad}<text{attrs(head[:1] + [('x', ln['x']), ('y', ln['y'])] + head[1:] + [('data-k', k)])}>{body}</text>")
            return
        parts = []
        for ln in lines:
            k = self.key(n["name"], ln["box"], "".join(r["s"] for r in ln["runs"]), "text")
            for i, r in enumerate(ln["runs"]):
                pos = [("x", ln["x"]), ("y", ln["y"])] if i == 0 else []
                parts.append(f"<tspan{attrs(pos + style_attrs(r['st'], base) + [('data-k', k)])}>{esc(r['s'])}</tspan>")
        out.append(f"{pad}<text{attrs(head)}>{''.join(parts)}</text>")


def write_svg(tree, width, height, keys=False):
    w = Writer(keys)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{num(width)}" height="{num(height)}" viewBox="0 0 {num(width)} {num(height)}">']
    for c in tree["own"] + tree["kids"]:
        w.node(c, out, 1)
    out.append("</svg>")
    return "\n".join(out) + "\n", w.expect


def lint(svg):
    """Problems against the shared import rules (empty list when clean)."""
    import xml.etree.ElementTree as ET
    probs = []
    try:
        root = ET.fromstring(svg)
    except ET.ParseError as e:
        return [f"not well-formed XML: {e}"]
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        if tag in ("style", "use", "filter", "mask", "clipPath", "foreignObject", "script"):
            probs.append(f"<{tag}> element")
        for a in ("class", "style", "filter", "mask", "clip-path"):
            if a in el.attrib:
                probs.append(f"{a}= on <{tag}>")
        if any("var(" in v for v in el.attrib.values()):
            probs.append(f"CSS var() in an attribute on <{tag}>")
        if tag in ("g", "text") and not el.get("id"):
            probs.append(f"unnamed <{tag}>")
        if tag in ("text", "tspan") and el.text and "\n" in el.text:
            probs.append("literal newline in text")
    return sorted(set(probs))


# ---- Tree clean-up ----

def collapse(n, own_item=False):
    """Drop empty groups and fold groups that paint nothing and hold one layer."""
    if n["t"] != "g":
        return n
    kids = [k for k in (collapse(c) for c in n["kids"]) if k]
    own = n["own"]
    items = own + kids
    if not items:
        return None
    if len(items) == 1:
        only = dict(items[0])
        if own:                                   # a box with nothing in it: the box takes the element's name
            only["name"], only["auto"] = n["name"], n["auto"]
        elif not n["auto"] and only["t"] != "text" and only.get("auto", True):
            only["name"], only["auto"] = n["name"], False
        elif n.get("strong") and only["t"] == "text":
            only["name"], only["auto"] = n["name"], False
        return only
    return {**n, "own": own, "kids": kids}


def embed_images(n, base_url, log):
    if n["t"] == "g":
        for c in n["own"] + n["kids"]:
            embed_images(c, base_url, log)
        return
    if n["t"] != "image" or n["src"].startswith("data:"):
        return
    src = urllib.parse.urljoin(base_url, n["src"])
    try:
        if src.startswith("file:"):
            data = Path(urllib.request.url2pathname(urllib.parse.urlparse(src).path)).read_bytes()
        else:
            with urllib.request.urlopen(src, timeout=20) as r:
                data = r.read()
        mime = mimetypes.guess_type(urllib.parse.urlparse(src).path)[0] or "image/png"
        n["src"] = f"data:{mime};base64,{base64.b64encode(data).decode()}"
    except Exception as e:
        log.append({"kind": "skip", "msg": f"image {src} could not be read ({e}); left as a link", "where": n.get("name", "")})


# ---- Verify: render the SVG in the same Chrome and compare ----

HARNESS = """<!doctype html><html><head><meta charset="utf-8">{links}<style>{faces}
html, body {{ margin: 0; padding: 0; background: #fff; }} svg {{ display: block; }}</style></head><body>{svg}</body></html>"""

RENDERED_BOXES = """() => {
  const out = {};
  for (const el of document.querySelectorAll('[data-k]')) {
    const r = el.getBoundingClientRect();
    let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    if (el.tagName === 'rect' && el.getAttribute('stroke')) {
      const s = parseFloat(el.getAttribute('stroke-width') || '1') / 2;
      x0 -= s; y0 -= s; x1 += s; y1 += s;
    }
    const k = el.dataset.k, o = out[k];
    out[k] = o ? [Math.min(o[0], x0), Math.min(o[1], y0), Math.max(o[2], x1), Math.max(o[3], y1)] : [x0, y0, x1, y1];
  }
  return out;
}"""


def alias_faces(faces, aliases):
    """The SVG names fonts by their Figma names (Muli -> Mulish), but the page's
    @font-face rules use the CSS names. Copy each renamed face under its Figma
    name so the check renders the same files the page did."""
    out = list(faces)
    for css in faces:
        m = re.search(r"""font-family:\s*["']?([^"';]+?)["']?\s*;""", css)
        if m and m.group(1) in aliases:
            out.append(css[:m.start(1)] + aliases[m.group(1)] + css[m.end(1):])
    return [inline_font_urls(css) for css in out]


_font_cache = {}


def inline_font_urls(css):
    """The harness is a file:// page, so Chrome refuses web fonts served over
    http(s) without CORS headers. Embed them as data: URIs instead."""
    def sub(m):
        u = m.group(1)
        if not u.startswith(("http://", "https://")):
            return m.group(0)
        if u not in _font_cache:
            try:
                with urllib.request.urlopen(u, timeout=10) as r:
                    mime = r.headers.get_content_type()
                    if mime in ("application/octet-stream", "text/plain", "text/html"):
                        mime = mimetypes.guess_type(urllib.parse.urlparse(u).path)[0] or "font/ttf"
                    _font_cache[u] = f"data:{mime};base64," + base64.b64encode(r.read()).decode()
            except Exception:
                _font_cache[u] = u
        return f'url("{_font_cache[u]}")'
    return re.sub(r"""url\(["']?([^"')]+)["']?\)""", sub, css)


def render_svg(context, svg, fonts, size, png_path, tmp_dir, aliases=None):
    page = context.new_page()
    page.set_viewport_size({"width": int(round(size[0])), "height": int(round(size[1]))})
    harness = Path(tmp_dir) / ".render.html"
    links = "".join(f'<link rel="stylesheet" href="{html.escape(u)}">' for u in fonts.get("fontLinks", []))
    faces = alias_faces(fonts.get("fontCss", []), aliases or {})
    harness.write_text(HARNESS.format(links=links, faces="\n".join(faces), svg=svg))
    page.goto(harness.as_uri(), wait_until="load")
    settle(page)
    page.wait_for_timeout(150)
    settle(page)
    page.screenshot(path=str(png_path))
    boxes = page.evaluate(RENDERED_BOXES)
    page.close()
    harness.unlink()
    return {int(k): v for k, v in boxes.items()}


def compare(expect, got, pos_tol=1.0, width_tol=0.01):
    rows = []
    for k, (name, text, box, kind) in expect.items():
        ex, ey, ew, eh = box
        if k not in got:
            rows.append((name, text, None, None, None, "not drawn"))
            continue
        gx0, gy0, gx1, gy1 = got[k]
        dx, dy, dw = gx0 - ex, gy0 - ey, (gx1 - gx0) - ew
        rel = dw / ew if ew else 0
        bad = []
        if abs(dx) > pos_tol or abs(dy) > pos_tol:
            bad.append("position")
        if ew > 0 and abs(rel) > width_tol:
            bad.append("width")
        if bad:
            rows.append((name, text, dx, dy, rel, "+".join(bad)))
    return rows


# ---- Main ----

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("states")
    ap.add_argument("--page", help="page path or URL (overrides `page:` in the states file)")
    ap.add_argument("--out", help="output folder (default: `out:` in the states file, else ./html-to-figma-out)")
    ap.add_argument("--only", nargs="+", help="state names to run")
    ap.add_argument("--width", type=int, help="viewport width in CSS px (default 1147)")
    ap.add_argument("--scale", type=float, help="device scale factor for the screenshots (default 2)")
    a = ap.parse_args()

    cfg, url, states = load_states(a.states, a.page)
    width = a.width or cfg.get("width", 1147)
    scale = a.scale or cfg.get("scale", 2)
    out_dir = Path(os.path.expanduser(a.out or cfg.get("out") or "html-to-figma-out"))
    if not out_dir.is_absolute() and not a.out and cfg.get("out"):
        out_dir = Path(a.states).resolve().parent / out_dir
    if a.only:
        missing = set(a.only) - {s["name"] for s in states}
        if missing:
            sys.exit(f"No such state: {', '.join(sorted(missing))}")
        states = [s for s in states if s["name"] in a.only]
    aliases = {k: v for k, v in json.loads((SHARED / "figma-font-names.json").read_text()).items() if not k.startswith("_")}
    js = (HERE / "extract.js").read_text()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(NO_BROWSER, file=sys.stderr)
        sys.exit(2)

    summary = [f"# html-to-figma: {urllib.parse.unquote(url)}", "", f"Width {width} px, scale {scale}.", "",
               "| State | Size | Pixels off | Flagged layers | Import rules | SVG |", "|---|---|---|---|---|---|"]
    with sync_playwright() as p:
        browser = None
        for kw in ({"channel": "chrome"}, {}):
            try:
                browser = p.chromium.launch(args=["--allow-file-access-from-files"], **kw)
                break
            except Exception:
                continue
        if not browser:
            print(NO_BROWSER, file=sys.stderr)
            sys.exit(2)
        for st in states:
            name = st["name"]
            sdir = out_dir / name
            sdir.mkdir(parents=True, exist_ok=True)
            context = browser.new_context(viewport={"width": width, "height": 900}, device_scale_factor=scale)
            page = context.new_page()
            try:
                prepare(page, url, st, cfg, width)
            except Exception as e:
                print(f"[{name}] failed while preparing the state: {e}", file=sys.stderr)
                summary.append(f"| {name} | – | – | – | – | failed: {str(e).splitlines()[0]} |")
                context.close()
                continue
            page.screenshot(path=str(sdir / "browser.png"))
            res = page.evaluate(js, {"width": width, "scale": scale, "aliases": aliases})
            log = res["log"]
            tree = res["root"]
            embed_images(tree, page.url, log)
            # The body's layers sit straight in the frame.
            top = [x for b in tree["kids"] for x in b["own"] + b["kids"]]
            tree["kids"] = [k for k in (collapse(c) for c in top) if k]
            svg, _ = write_svg(tree, res["width"], res["height"])
            (sdir / f"{name}.svg").write_text(svg)
            problems = lint(svg)
            ksvg, expect = write_svg(tree, res["width"], res["height"], keys=True)
            got = render_svg(context, ksvg, res, (res["width"], res["height"]), sdir / "render.png", sdir, aliases)
            context.close()

            shot, rend = Image.open(sdir / "browser.png"), Image.open(sdir / "render.png")
            diff_png(rend, shot, sdir / "diff.png")
            share, regions = mismatch(rend, shot)
            rows = compare(expect, got)
            report = [f"State {name}: {url}{st.get('hash') or ''}",
                      f"Page {num(res['width'])} x {num(res['height'])} px; screenshots at {scale}x.",
                      f"Pixels that differ: {share:.2%}.",
                      "Import rules: " + ("OK." if not problems else "PROBLEMS: " + "; ".join(problems)), ""]
            if regions:
                report.append("Where the pixels differ most (CSS px, x0,y0-x1,y1, share of pixels):")
                for x0, y0, x1, y1, s in regions[:12]:
                    report.append(f"  {num(x0 / scale)},{num(y0 / scale)}-{num(x1 / scale)},{num(y1 / scale)}  {s:.0%}")
                report.append("")
            report.append(f"Layers checked: {len(expect)}. Flagged (position off > 1 px or width off > 1%): {len(rows)}.")
            for nm, text, dx, dy, rel, why in rows:
                label = f"{nm}" + (f" | {text[:50]}" if text and text != nm else "")
                if dx is None:
                    report.append(f"  {why:16} {label}")
                else:
                    report.append(f"  {why:16} dx {dx:+.2f} dy {dy:+.2f} width {rel:+.2%}  {label}")
            report.append("")
            report.append("Log (skipped or approximated):" if log else "Log: nothing skipped or approximated.")
            for e in log:
                report.append(f"  {e['kind']:7} {e['msg']}" + (f"  [{e['where']}]" if e["where"] else ""))
            (sdir / "report.txt").write_text("\n".join(report) + "\n")
            summary.append(f"| {name} | {num(res['width'])} x {num(res['height'])} | {share:.2%} | {len(rows)} of {len(expect)} | {'OK' if not problems else 'not met'} | {name}/{name}.svg |")
            print(f"[{name}] {share:.2%} pixels differ; {len(rows)} of {len(expect)} layers flagged; "
                  f"import rules {'OK' if not problems else 'NOT MET'} -> {sdir / (name + '.svg')}")
        browser.close()
    (out_dir / "summary.md").write_text("\n".join(summary) + "\n")
    print(f"Summary: {out_dir / 'summary.md'}")


if __name__ == "__main__":
    main()
