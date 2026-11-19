// In-page extractor for html-to-figma. html_to_figma.py passes this file to
// page.evaluate() and gets back a layer tree in CSS px, plus a log of what was
// skipped or approximated. It reads layout only: the DOM is restored after.
//
// Node shapes (all coordinates in page px, scroll at 0):
//   {t:'g', name, auto, own:[...], kids:[...]}        own = the element's own paint
//   {t:'rect', name, x, y, w, h, rx, fill, fo, stroke, so, sw, dash, box}
//   {t:'text', name, auto, lines:[{x, y, box, runs:[{s, st}]}], anchor}
//   {t:'image', name, x, y, w, h, src, box}
//   {t:'line'|'circle'|'ellipse'|'path'|'poly', ...geometry, ...paint}
// st = {ff, fw, fs, it, fill, fo, ls, td}. box = [x, y, w, h] the browser drew,
// used by the verify step.
async (opts) => {
  const LOG = [];
  const ALIASES = opts.aliases || {};
  const r2 = (v) => Math.round(v * 100) / 100;

  const describe = (el) => {
    if (!el || el.nodeType !== 1) return '';
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.classList.length) s += '.' + [...el.classList].slice(0, 2).join('.');
    return s;
  };
  const seen = new Set();
  const log = (kind, msg, el) => {
    const key = kind + msg + describe(el);
    if (seen.has(key)) return;
    seen.add(key);
    LOG.push({ kind, msg, where: describe(el) });
  };

  // ---- Colour: any computed colour -> {hex, a} ----
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const colCache = new Map();
  function colour(v) {
    if (!v || v === 'none' || v === 'transparent' || v.startsWith('url(')) return null;
    if (colCache.has(v)) return colCache.get(v);
    let r, g, b, a, m;
    if ((m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/))) {
      [r, g, b] = [+m[1], +m[2], +m[3]];
      a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
    } else if ((m = v.match(/^color\(srgb\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/))) {
      [r, g, b] = [m[1] * 255, m[2] * 255, m[3] * 255];
      a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
    } else {
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = '#000';
      cx.fillStyle = v;
      cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      [r, g, b, a] = [d[0], d[1], d[2], d[3] / 255];
    }
    const hex = '#' + [r, g, b].map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('');
    const out = a < 0.004 ? null : { hex, a: Math.round(a * 1000) / 1000 };
    colCache.set(v, out);
    return out;
  }

  // ---- Fonts: CSS family list -> the face actually used -> Figma name ----
  const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif',
    'ui-sans-serif', 'ui-monospace', 'ui-rounded', '-apple-system', 'blinkmacsystemfont', 'math', 'emoji', 'fangsong']);
  const unq = (s) => s.trim().replace(/^["']|["']$/g, '');
  const families = (list) => list.match(/("[^"]*"|'[^']*'|[^,]+)/g).map(unq).filter(Boolean);
  const facesBy = new Map();
  for (const f of document.fonts) {
    const k = unq(f.family).toLowerCase();
    if (!facesBy.has(k)) facesBy.set(k, []);
    facesBy.get(k).push(f);
  }
  const parseW = (w) => {
    const map = { normal: 400, bold: 700 };
    const parts = String(w).split(/\s+/).map((x) => map[x] || +x);
    return [parts[0], parts[1] ?? parts[0]];
  };
  function matchWeight(want, ranges) {
    for (const [lo, hi] of ranges) if (want >= lo && want <= hi) return want;
    const below = ranges.filter((r) => r[1] < want).map((r) => r[1]);
    const above = ranges.filter((r) => r[0] > want).map((r) => r[0]);
    if (want >= 400 && want <= 500) {
      const upTo500 = above.filter((w) => w <= 500);
      if (upTo500.length) return Math.min(...upTo500);
      if (below.length) return Math.max(...below);
      return Math.min(...above);
    }
    if (want < 400) return below.length ? Math.max(...below) : Math.min(...above);
    return above.length ? Math.min(...above) : Math.max(...below);
  }
  const localCache = new Map();
  function installed(fam) {
    if (localCache.has(fam)) return localCache.get(fam);
    const probe = 'mmmmmmmmmmlli WQ@#0123';
    let yes = false;
    for (const base of ['monospace', 'serif', 'sans-serif']) {
      cx.font = `72px ${base}`;
      const w0 = cx.measureText(probe).width;
      cx.font = `72px "${fam}", ${base}`;
      if (cx.measureText(probe).width !== w0) { yes = true; break; }
    }
    localCache.set(fam, yes);
    return yes;
  }
  const famCache = new Map();
  function resolveFont(list, weight, italic) {
    const key = `${list}|${weight}|${italic}`;
    if (famCache.has(key)) return famCache.get(key);
    let out = null;
    for (const fam of families(list)) {
      const lower = fam.toLowerCase();
      if (GENERIC.has(lower)) {
        out = { css: fam, figma: fam, weight, source: 'generic' };
        log('font', `"${list}" fell back to the generic ${fam}; pick a real family in Figma`);
        break;
      }
      const fs = (facesBy.get(lower) || []).filter((f) => f.status !== 'error');
      if (fs.length) {
        let pool = fs.filter((f) => (f.style !== 'normal') === italic);
        if (!pool.length) { pool = fs; if (italic) log('font', `${fam} has no italic face; the browser slants it`); }
        const w = matchWeight(weight, pool.map((f) => parseW(f.weight)));
        if (w !== weight) log('font', `${fam} ${weight} is not loaded; the browser uses ${w}${weight >= 600 && w < 600 ? ' (synthetic bold)' : ''}`);
        out = { css: fam, figma: ALIASES[fam] || fam, weight: w, source: 'webfont' };
        break;
      }
      if (installed(fam)) { out = { css: fam, figma: ALIASES[fam] || fam, weight, source: 'local' }; break; }
    }
    if (!out) out = { css: 'sans-serif', figma: 'sans-serif', weight, source: 'generic' };
    if (out.figma !== out.css) log('font', `${out.css} written as ${out.figma} (Figma name)`);
    famCache.set(key, out);
    return out;
  }

  // Baseline probe: the distance from the top of a text run's box to its
  // baseline depends only on the font, so measure it once per font.
  const probeHost = document.createElement('div');
  probeHost.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;white-space:nowrap';
  document.body.appendChild(probeHost);
  const FONT_PROPS = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch',
    'font-variation-settings', 'font-optical-sizing', 'font-feature-settings', 'font-kerning'];
  const metricCache = new Map();
  function metrics(cs) {
    const key = FONT_PROPS.map((p) => cs.getPropertyValue(p)).join('|');
    if (metricCache.has(key)) return metricCache.get(key);
    const s = document.createElement('span');
    for (const p of FONT_PROPS) s.style.setProperty(p, cs.getPropertyValue(p));
    s.textContent = 'Hxg';
    const mark = document.createElement('span');
    mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    s.appendChild(mark);
    probeHost.appendChild(s);
    const rg = document.createRange();
    rg.setStart(s.firstChild, 0);
    rg.setEnd(s.firstChild, 1);
    const tr = rg.getBoundingClientRect();
    const m = { asc: mark.getBoundingClientRect().bottom - tr.top, h: tr.height };
    s.remove();
    metricCache.set(key, m);
    return m;
  }

  const csCache = new Map();
  const css = (el) => {
    let c = csCache.get(el);
    if (!c) { c = getComputedStyle(el); csCache.set(el, c); }
    return c;
  };

  function textStyle(cs, decoEl, opacity) {
    const italic = cs.fontStyle !== 'normal';
    const f = resolveFont(cs.fontFamily, parseInt(cs.fontWeight, 10), italic);
    const c = colour(cs.color) || { hex: '#000000', a: 0 };
    const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
    const td = decorations(decoEl);
    if (td.includes('underline') && cs.textUnderlineOffset !== 'auto') log('approx', `text-underline-offset ${cs.textUnderlineOffset} not carried over; SVG underlines sit at the font's default position`);
    return { ff: f.figma, css: f.css, fw: f.weight, fs: parseFloat(cs.fontSize), it: italic,
      fill: c.hex, fo: r2(c.a * opacity), ls: r2(ls), td };
  }
  // text-decoration is propagated, not inherited: look up the ancestors.
  function decorations(el) {
    const out = new Set();
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = css(e);
      for (const d of cs.textDecorationLine.split(' ')) if (d === 'underline' || d === 'line-through') out.add(d);
      if (/inline-|table|^flex|^grid/.test(cs.display) && e !== el && cs.display !== 'inline') break;
      if (cs.position === 'absolute' || cs.position === 'fixed' || cs.float !== 'none') break;
    }
    return [...out].join(' ');
  }
  const transform = (s, tt) => tt === 'uppercase' ? s.toUpperCase()
    : tt === 'lowercase' ? s.toLowerCase()
    : tt === 'capitalize' ? s.replace(/(^|[\s(“"‘'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : s;

  // ---- Naming ----
  const TAGS = { h1: 'Heading', h2: 'Heading', h3: 'Heading', h4: 'Heading', h5: 'Heading', h6: 'Heading',
    p: 'Paragraph', a: 'Link', button: 'Button', input: 'Input', select: 'Select', textarea: 'Textarea',
    label: 'Field', li: 'Item', ul: 'List', ol: 'List', nav: 'Nav', header: 'Header', footer: 'Footer',
    main: 'Main', section: 'Section', article: 'Article', img: 'Image', svg: 'Graphic', figure: 'Figure',
    figcaption: 'Caption', dl: 'Definitions', dt: 'Term', dd: 'Definition', code: 'Code', table: 'Table',
    tr: 'Row', td: 'Cell', th: 'Header cell', details: 'Details', summary: 'Summary', b: 'Bold', strong: 'Bold' };
  const human = (s) => { s = s.replace(/[-_]+/g, ' ').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };
  const clip = (s, n = 48) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  function nameOf(el) {
    if (el.dataset && el.dataset.h2fPseudo) {
      const host = el.parentElement;
      return { name: `${nameOf(host).name} ${el.dataset.h2fPseudo.replace('::', '')}`, auto: false, strong: false };
    }
    // data-layer, aria-label and id are "strong": they name a text layer too.
    const explicit = el.dataset?.layer || el.getAttribute('aria-label') || el.id;
    if (explicit) return { name: clip(explicit), auto: false, strong: true };
    for (const c of el.classList || []) if (!/^(is|has|js|u)-/.test(c)) return { name: human(c), auto: false, strong: false };
    return { name: TAGS[el.tagName.toLowerCase()] || human(el.tagName.toLowerCase()), auto: true, strong: false };
  }
  const words = (s) => clip(s.trim().split(/\s+/).slice(0, 6).join(' '), 40);

  // ---- ::before / ::after: turn each into a real element for the walk ----
  function contentText(content, el) {
    let out = '', m;
    const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|counter\(([^)]*)\)|attr\(([^)]*)\)|(open-quote|close-quote)|url\([^)]*\)/g;
    while ((m = re.exec(content))) {
      if (m[1] != null || m[2] != null) out += (m[1] ?? m[2]).replace(/\\(.)/g, '$1');
      else if (m[3] != null) {
        const sib = [...el.parentElement.children].filter((e) => e.tagName === el.tagName);
        out += String(sib.indexOf(el) + 1);
        log('approx', `counter(${m[3]}) taken as the element's position among its siblings`, el);
      } else if (m[4] != null) out += el.getAttribute(m[4].trim()) || '';
      else if (m[5]) out += m[5] === 'open-quote' ? '“' : '”';
      else log('skip', 'url() in content is not drawn', el);
    }
    return out;
  }
  const made = [];
  const hideSheet = document.createElement('style');
  hideSheet.textContent = '[data-h2f-no-before]::before{content:none!important}[data-h2f-no-after]::after{content:none!important}';
  document.head.appendChild(hideSheet);
  for (const el of document.body.querySelectorAll('*')) {
    if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml' || el === probeHost) continue;
    for (const which of ['::before', '::after']) {
      const ps = getComputedStyle(el, which);
      if (!ps.content || ps.content === 'none' || ps.content === 'normal' || ps.display === 'none') continue;
      const span = document.createElement('h2f-pseudo');
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (p !== 'content') span.style.setProperty(p, ps.getPropertyValue(p));
      }
      span.textContent = contentText(ps.content, el);
      span.dataset.h2fPseudo = which;
      el.setAttribute(which === '::before' ? 'data-h2f-no-before' : 'data-h2f-no-after', '');
      if (which === '::before') el.prepend(span); else el.append(span);
      made.push(span);
    }
  }
  csCache.clear();

  // ---- Geometry helpers ----
  const sx = window.scrollX, sy = window.scrollY;
  const R = (r) => ({ x: r.left + sx, y: r.top + sy, w: r.width, h: r.height });
  const meet = (a, b) => {
    if (!b) return a;
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    const w = Math.min(a.x + a.w, b.x + b.w) - x, h = Math.min(a.y + a.h, b.y + b.h) - y;
    return w > 0 && h > 0 ? { x, y, w, h } : null;
  };

  function radius(cs, b) {
    const v = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map((k) => {
      const s = cs[k].split(' ')[0];
      return s.endsWith('%') ? parseFloat(s) / 100 * Math.min(b.w, b.h) : parseFloat(s) || 0;
    });
    if (v.every((x) => x === 0)) return 0;
    if (!v.every((x) => x === v[0])) return null;
    return Math.min(v[0], b.w / 2, b.h / 2);
  }

  // The element's own background and borders, as rects.
  // Chrome snaps box edges to device pixels; SVG doesn't, so snap here.
  const snap = (v) => Math.round(v * opts.scale) / opts.scale;
  const snapBox = (b) => {
    const x = snap(b.x), y = snap(b.y);
    return { x, y, w: snap(b.x + b.w) - x, h: snap(b.y + b.h) - y };
  };
  function boxPaint(el, cs, b, ctx) {
    b = snapBox(b);
    const out = [];
    const op = ctx.opacity;
    const bg = colour(cs.backgroundColor);
    let rx = radius(cs, b);
    if (rx === null) { log('approx', 'unequal corner radii drawn square', el); rx = 0; }
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map((s) => {
      const st = cs[`border${s}Style`];
      const w = st === 'none' || st === 'hidden' ? 0 : parseFloat(cs[`border${s}Width`]);
      return { s, w, c: colour(cs[`border${s}Color`]), st };
    });
    const live = sides.filter((d) => d.w > 0 && d.c);
    const same = (a, d) => a.w === d.w && a.st === d.st && a.c.hex === d.c.hex && a.c.a === d.c.a;
    // A border shared by all four sides (or by three, with the fourth drawn over it) is one stroked rect.
    let strokeSide = null;
    if (live.length === 4) {
      const common = live.find((d) => live.filter((e) => same(d, e)).length >= 3);
      if (common) strokeSide = common;
    }
    const dash = (d) => d.st === 'dashed' ? `${r2(d.w * 3)} ${r2(d.w * 3)}` : d.st === 'dotted' ? `${d.w} ${d.w}` : null;
    if (strokeSide) {
      const w = strokeSide.w;
      out.push({ t: 'rect', name: 'Box', x: b.x + w / 2, y: b.y + w / 2, w: b.w - w, h: b.h - w, rx: rx ? Math.max(0, rx - w / 2) : 0,
        fill: bg && bg.hex, fo: bg ? r2(bg.a * op) : 1, stroke: strokeSide.c.hex, so: r2(strokeSide.c.a * op), sw: w,
        dash: dash(strokeSide), box: [b.x, b.y, b.w, b.h] });
      if (['double', 'groove', 'ridge', 'inset', 'outset'].includes(strokeSide.st)) log('approx', `${strokeSide.st} border drawn solid`, el);
    } else if (bg) {
      out.push({ t: 'rect', name: 'Background', x: b.x, y: b.y, w: b.w, h: b.h, rx, fill: bg.hex, fo: r2(bg.a * op), box: [b.x, b.y, b.w, b.h] });
    }
    for (const d of live) {
      if (strokeSide && same(strokeSide, d)) continue;
      const r = d.s === 'Top' ? [b.x, b.y, b.w, d.w] : d.s === 'Bottom' ? [b.x, b.y + b.h - d.w, b.w, d.w]
        : d.s === 'Left' ? [b.x, b.y, d.w, b.h] : [b.x + b.w - d.w, b.y, d.w, b.h];
      out.push({ t: 'rect', name: `Border ${d.s.toLowerCase()}`, x: r[0], y: r[1], w: r[2], h: r[3], fill: d.c.hex, fo: r2(d.c.a * op), box: r });
      if (d.st !== 'solid') log('approx', `${d.st} single-side border drawn solid`, el);
    }
    if (cs.boxShadow && cs.boxShadow !== 'none') {
      // Chrome computes each shadow as "<colour> <x> <y> <blur> <spread> [inset]". A shadow with no offset or
      // blur and a positive spread (Tailwind's ring-*) is a hard outline: draw it as a stroke outside the box.
      // Fully transparent shadows (Tailwind's unused ring and shadow slots) paint nothing; others are skipped.
      const shadows = cs.boxShadow.split(/,(?![^(]*\))/).map((s) => s.trim());
      const skipped = [];
      const rings = [];
      for (const s of shadows) {
        const m = s.match(/^((?:rgba?|color)\([^)]*\)|#[\da-f]+|\w+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+(-?[\d.]+)px(\s+inset)?$/i);
        const c = m ? colour(m[1]) : null;
        if (m && (!c || c.a === 0)) continue;
        if (m && !m[6] && +m[2] === 0 && +m[3] === 0 && +m[4] === 0 && +m[5] > 0) rings.push({ c, w: +m[5] });
        else skipped.push(s);
      }
      // Later shadows are drawn underneath earlier ones, and all of them under the box.
      for (const g of rings) {
        out.unshift({ t: 'rect', name: 'Ring', x: b.x - g.w / 2, y: b.y - g.w / 2, w: b.w + g.w, h: b.h + g.w,
          rx: rx ? rx + g.w / 2 : 0, fill: null, stroke: g.c.hex, so: r2(g.c.a * op), sw: g.w,
          box: [b.x - g.w, b.y - g.w, b.w + 2 * g.w, b.h + 2 * g.w] });
      }
      if (skipped.length) log('skip', `box-shadow skipped: ${skipped.join(', ')}`, el);
    }
    if (cs.backgroundImage && cs.backgroundImage !== 'none') {
      const m = cs.backgroundImage.match(/^url\("?(.*?)"?\)$/);
      if (m) out.push({ t: 'image', name: 'Background image', x: b.x, y: b.y, w: b.w, h: b.h, src: m[1], box: [b.x, b.y, b.w, b.h] });
      else log('skip', `background-image skipped: ${clip(cs.backgroundImage, 60)}`, el);
      if (m && cs.backgroundSize !== 'auto' && cs.backgroundSize !== '100% 100%') log('approx', `background image stretched to the box (background-size ${cs.backgroundSize})`, el);
    }
    if (cs.filter !== 'none' || cs.backdropFilter !== 'none') log('skip', `filter skipped: ${cs.filter !== 'none' ? cs.filter : cs.backdropFilter}`, el);
    if (ctx.clip) {
      return out.filter((n) => {
        const m = meet({ x: n.x, y: n.y, w: n.w, h: n.h }, ctx.clip);
        if (!m) return false;
        if (m.w < n.w - 0.5 || m.h < n.h - 0.5) { Object.assign(n, m); n.box = [m.x, m.y, m.w, m.h]; }
        return true;
      });
    }
    return out;
  }

  // ---- Text ----
  const ATOMIC = new Set(['img', 'svg', 'input', 'select', 'textarea', 'button', 'video', 'canvas', 'iframe', 'object', 'picture', 'audio', 'meter', 'progress']);
  const isFlowInline = (el) => el.nodeType === 1 && css(el).display === 'inline' && !ATOMIC.has(el.tagName.toLowerCase());

  // Text nodes of a container and its plain inline descendants, in order.
  function textNodes(container, out = []) {
    for (const n of container.childNodes) {
      if (n.nodeType === 3) out.push(n);
      else if (n.nodeType === 1 && n.tagName === 'BR') out.push(n);
      else if (n.nodeType === 1 && isFlowInline(n) && css(n).display !== 'none') textNodes(n, out);
    }
    return out;
  }

  // Split text into lines from per-character client rects.
  function lines(container, nodes, ctx, cs0) {
    const chars = [];
    const rg = document.createRange();
    // text-overflow: ellipsis keeps the characters that fit before the ellipsis.
    let limit = null, truncated = false;
    if (cs0.textOverflow === 'ellipsis' && cs0.overflowX !== 'visible' && container.scrollWidth > container.clientWidth) {
      cx.font = `${cs0.fontStyle} ${cs0.fontWeight} ${cs0.fontSize} ${cs0.fontFamily}`;
      const b = R(container.getBoundingClientRect());
      limit = b.x + b.w - parseFloat(cs0.borderRightWidth) - parseFloat(cs0.paddingRight) - cx.measureText('…').width;
    }
    for (const n of nodes) {
      if (n.nodeType === 1) { chars.push({ br: true }); continue; }
      const pe = n.parentElement, cs = css(pe);
      if (cs.visibility !== 'visible') continue;
      const d = n.data;
      for (let i = 0; i < d.length;) {
        const cp = d.codePointAt(i), len = cp > 0xffff ? 2 : 1;
        rg.setStart(n, i); rg.setEnd(n, i + len);
        const rs = rg.getClientRects();
        const ch = d.slice(i, i + len);
        i += len;
        if (!rs.length) continue;
        const r = rs[rs.length - 1];
        if (r.width === 0 && /\s/.test(ch)) continue;
        if (limit !== null && r.right + sx > limit + 0.01) { truncated = true; continue; }
        if (ctx.clip) {
          const mx = r.left + sx + r.width / 2, my = r.top + sy + r.height / 2;
          if (mx < ctx.clip.x || mx > ctx.clip.x + ctx.clip.w || my < ctx.clip.y || my > ctx.clip.y + ctx.clip.h) { ctx.clipped = true; continue; }
        }
        chars.push({ ch: /[\n\t\r]/.test(ch) && cs.whiteSpace.startsWith('pre') === false ? ' ' : ch, r, pe, cs });
      }
    }
    const out = [];
    let cur = null;
    for (const c of chars) {
      if (c.br) { cur = null; continue; }
      if (!cur || (c.r.left < cur.right - 1 && c.r.top > cur.top + cur.h * 0.5) || c.r.top > cur.top + cur.h * 1.2) {
        cur = { chars: [], top: c.r.top, h: c.r.height, right: -1e9 };
        out.push(cur);
      }
      cur.chars.push(c);
      cur.right = c.r.right;
    }
    const res = [];
    for (const ln of out) {
      let cs_ = ln.chars;
      while (cs_.length && /^\s$/.test(cs_[0].ch)) cs_ = cs_.slice(1);
      const last = ln === out[out.length - 1];
      if (!(truncated && last)) while (cs_.length && /^\s$/.test(cs_[cs_.length - 1].ch)) cs_ = cs_.slice(0, -1);
      if (!cs_.length) continue;
      // Runs of one style.
      const runs = [];
      for (const c of cs_) {
        const st = textStyle(c.cs, c.pe, ctx.opacity);
        const key = JSON.stringify(st) + c.cs.textTransform;
        const last = runs[runs.length - 1];
        if (last && last.key === key) last.chars.push(c);
        else runs.push({ key, st, tt: c.cs.textTransform, chars: [c], cs: c.cs });
      }
      const first = cs_[0], lastc = cs_[cs_.length - 1];
      const m = metrics(first.cs);
      const y = first.r.top + sy + m.asc;
      for (const rn of runs.slice(1)) {
        const yb = rn.chars[0].r.top + sy + metrics(rn.cs).asc;
        if (Math.abs(yb - y) > 0.75) log('approx', `inline run "${words(rn.chars.map((c) => c.ch).join(''))}" sits ${r2(yb - y)}px off the line's baseline; drawn on it`, container);
      }
      const top = Math.min(...cs_.map((c) => c.r.top)) + sy;
      const bottom = Math.max(...cs_.map((c) => c.r.bottom)) + sy;
      let text = runs.map((rn) => ({ s: transform(rn.chars.map((c) => c.ch).join(''), rn.tt), st: rn.st }));
      let right = lastc.r.right + sx;
      if (truncated && last) {
        const lr = text[text.length - 1];
        lr.s += '…';
        cx.font = `${lr.st.it ? 'italic ' : ''}${lr.st.fw} ${lr.st.fs}px "${lr.st.css}"`;
        right += cx.measureText('…').width;
      }
      res.push({ x: first.r.left + sx, y, runs: text, box: [first.r.left + sx, top, right - (first.r.left + sx), bottom - top] });
    }
    return res;
  }

  function textNode(container, nodes, ctx, name) {
    ctx.clipped = false;
    const ls = lines(container, nodes, ctx, css(container));
    if (!ls.length) return null;
    const all = ls.map((l) => l.runs.map((r) => r.s).join('')).join(' ');
    return { t: 'text', name: name || words(all), auto: !name, lines: ls };
  }

  // ---- Form controls ----
  // inset: extra start offset Chrome adds inside some controls (select, date fields).
  function inputText(el, cs, b, value, colourValue, ctx, inset = 0, layer = 'Value') {
    const bl = parseFloat(cs.borderLeftWidth), br = parseFloat(cs.borderRightWidth);
    const bt = parseFloat(cs.borderTopWidth), bb = parseFloat(cs.borderBottomWidth);
    const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight);
    const pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
    const st = textStyle(cs, el, ctx.opacity);
    if (colourValue) { const c = colour(colourValue); if (c) { st.fill = c.hex; st.fo = r2(c.a * ctx.opacity); } }
    const m = metrics(cs);
    const lh = cs.lineHeight === 'normal' ? m.h : parseFloat(cs.lineHeight);
    const ch = b.h - bt - bb - pt - pb;
    const lineTop = b.y + bt + pt + (ch - lh) / 2;
    const y = lineTop + (lh - m.h) / 2 + m.asc;
    let s = transform(value, cs.textTransform);
    cx.font = `${st.it ? 'italic ' : ''}${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    cx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    const left = b.x + bl + pl + inset, inner = b.w - bl - br - pl - pr - inset;
    let w = cx.measureText(s).width;
    if (w > inner + 0.5) {
      // The field shows the start of the value and clips the rest; keep the characters that fit whole.
      log('approx', `value "${words(s)}" is wider than the field; cut to the characters that fit`, el);
      while (s.length > 1 && w > inner + 0.5) { s = s.slice(0, -1); w = cx.measureText(s).width; }
      s = s.replace(/\s+$/, '');
      w = cx.measureText(s).width;
    }
    cx.letterSpacing = '0px';
    let x = left;
    if (cs.textAlign === 'center') x = left + (inner - w) / 2;
    else if (cs.textAlign === 'right' || cs.textAlign === 'end') x = left + inner - w;
    return { t: 'text', name: layer, auto: false,
      lines: [{ x, y, runs: [{ s, st }], box: [x, y - m.asc, w, m.h] }] };
  }

  function control(el, cs, b, ctx) {
    const tag = el.tagName.toLowerCase(), type = (el.type || '').toLowerCase();
    const out = [];
    const acc = colour(cs.accentColor === 'auto' ? '#0075ff' : cs.accentColor) || { hex: '#0075ff', a: 1 };
    if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
      const s = Math.min(b.w, b.h), x = b.x + (b.w - s) / 2, y = b.y + (b.h - s) / 2;
      const on = el.checked;
      if (type === 'checkbox') {
        out.push({ t: 'rect', name: 'Box', x: x + 0.5, y: y + 0.5, w: s - 1, h: s - 1, rx: 2, fill: on ? acc.hex : '#ffffff', fo: 1, stroke: on ? acc.hex : '#767676', so: 1, sw: 1 });
        if (on) out.push({ t: 'path', name: 'Check', d: `M${r2(x + s * 0.22)} ${r2(y + s * 0.52)} L${r2(x + s * 0.42)} ${r2(y + s * 0.72)} L${r2(x + s * 0.78)} ${r2(y + s * 0.3)}`, stroke: '#ffffff', sw: r2(s * 0.14), fill: null });
      } else {
        out.push({ t: 'circle', name: 'Ring', cx: x + s / 2, cy: y + s / 2, r: s / 2 - 0.5, fill: '#ffffff', stroke: on ? acc.hex : '#767676', sw: 1 });
        if (on) out.push({ t: 'circle', name: 'Dot', cx: x + s / 2, cy: y + s / 2, r: s * 0.27, fill: acc.hex });
      }
      return out;
    }
    if (tag === 'input' && type === 'range') {
      const min = +el.min || 0, max = el.max === '' ? 100 : +el.max, v = +el.value;
      const f = max > min ? (v - min) / (max - min) : 0, cy = b.y + b.h / 2, r = 8;
      out.push({ t: 'rect', name: 'Track', x: b.x, y: cy - 2, w: b.w, h: 4, rx: 2, fill: '#efefef', stroke: '#b2b2b2', sw: 0.5 });
      out.push({ t: 'rect', name: 'Fill', x: b.x, y: cy - 2, w: (b.w - 2 * r) * f + r, h: 4, rx: 2, fill: acc.hex });
      out.push({ t: 'circle', name: 'Thumb', cx: b.x + r + (b.w - 2 * r) * f, cy, r, fill: acc.hex });
      return out;
    }
    out.push(...boxPaint(el, cs, b, ctx));
    if (tag === 'select') {
      const opt = el.options[el.selectedIndex];
      // Offsets measured against Chrome 157 on macOS: the option text starts 4px in,
      // and the chevron is centred 6.25px inside the right border.
      if (opt && opt.text) out.push(inputText(el, cs, b, opt.text, null, ctx, 4, 'Selected option'));
      if (cs.appearance !== 'none') {
        const c = colour(cs.color) || { hex: '#000000', a: 1 };
        const ax = b.x + b.w - parseFloat(cs.borderRightWidth) - 6.25;
        const ay = b.y + b.h / 2 - 0.5;
        out.push({ t: 'path', name: 'Chevron', d: `M${r2(ax - 3.5)} ${r2(ay - 1.75)} L${r2(ax)} ${r2(ay + 1.75)} L${r2(ax + 3.5)} ${r2(ay - 1.75)}`,
          stroke: c.hex, so: c.a, sw: 2, fill: null, cap: 'round', join: 'round' });
      }
      return out;
    }
    if (tag === 'textarea') {
      const value = el.value || el.placeholder;
      if (value) {
        const m = document.createElement('div');
        for (const p of [...FONT_PROPS, 'letter-spacing', 'line-height', 'text-transform', 'text-align', 'text-indent', 'tab-size',
          'word-break', 'overflow-wrap', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
          'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'box-sizing'])
          m.style.setProperty(p, cs.getPropertyValue(p));
        Object.assign(m.style, { position: 'absolute', left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, whiteSpace: 'pre-wrap',
          borderStyle: 'solid', borderColor: 'transparent', margin: '0', visibility: 'visible',
          color: el.value ? cs.color : getComputedStyle(el, '::placeholder').color });
        m.textContent = value;
        document.body.appendChild(m);
        const tn = textNode(m, textNodes(m), { ...ctx, clip: null }, el.value ? 'Value' : 'Placeholder');
        m.remove();
        if (tn) out.push(tn);
      }
      if (cs.resize !== 'none') {
        const gx = b.x + b.w - parseFloat(cs.borderRightWidth) - 2, gy = b.y + b.h - parseFloat(cs.borderBottomWidth) - 1.5;
        out.push({ t: 'g', name: 'Resize grip', auto: false, own: [], kids: [
          { t: 'path', name: 'Grip line 1', d: `M${r2(gx - 7)} ${r2(gy)} L${r2(gx)} ${r2(gy - 7)}`, stroke: '#767676', sw: 1, fill: null },
          { t: 'path', name: 'Grip line 2', d: `M${r2(gx - 3)} ${r2(gy)} L${r2(gx)} ${r2(gy - 3)}`, stroke: '#767676', sw: 1, fill: null }] });
      }
      return out;
    }
    if (tag === 'input') {
      let value = el.value, col = null;
      if (type === 'password') value = '•'.repeat(value.length);
      if (!value && el.placeholder) { value = el.placeholder; col = getComputedStyle(el, '::placeholder').color; }
      if (!value && ['month', 'date', 'time', 'datetime-local', 'week'].includes(type)) log('skip', `empty ${type} field: the browser's placeholder pattern is not drawn`, el);
      if (['month', 'date', 'week'].includes(type) && el.value) log('approx', `${type} value written as the browser shows it may differ: "${el.value}"`, el);
      if (value && ['month'].includes(type) && el.value) {
        const [yy, mm] = el.value.split('-').map(Number);
        value = new Date(yy, mm - 1, 1).toLocaleDateString(document.documentElement.lang || undefined, { month: 'long', year: 'numeric' });
      }
      const dateLike = ['month', 'date', 'week', 'time', 'datetime-local'].includes(type);
      if (value) out.push(inputText(el, cs, b, value, col, ctx, dateLike ? 1 : 0, col ? 'Placeholder' : 'Value'));
      if (dateLike) {
        // Chrome's calendar button: a small calendar 4px inside the content box's right edge.
        log('approx', `${type} field: segments drawn as plain text (Chrome spaces them about 2px wider)`, el);
        const c = colour(cs.color) || { hex: '#000000', a: 1 };
        const cr = b.x + b.w - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight) - 4, cy = b.y + b.h / 2;
        out.push({ t: 'g', name: 'Calendar button', auto: false, own: [], kids: [
          { t: 'rect', name: 'Calendar', x: cr - 10.75, y: cy - 5.25, w: 10.5, h: 10.5, rx: 1, fill: null, stroke: c.hex, so: c.a, sw: 1.5 },
          { t: 'rect', name: 'Calendar top', x: cr - 11.5, y: cy - 6, w: 12, h: 3, fill: c.hex, fo: c.a }] });
      }
      if (type === 'number') log('skip', 'number field: spin buttons (shown on hover) are not drawn', el);
    }
    return out;
  }

  // ---- Inline SVG: copy with the browser's own geometry and paint baked in ----
  function scalePath(d, a, dd, e, f) {
    const toks = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) || [];
    const N = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
    let out = '', i = 0, cmd = null;
    const num = () => parseFloat(toks[i++]);
    // One segment per pass, each written with its own command letter, so the
    // implicit linetos after a moveto keep their own absolute/relative sense.
    while (i < toks.length) {
      if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
      else if (cmd === null) break;
      // A path's opening moveto is absolute even when written 'm' (SVG spec);
      // the pairs that follow it are still relative linetos.
      let c = cmd;
      if (out === '' && c === 'm') c = 'M';
      const lc = c.toLowerCase(), abs = c !== lc, n = N[lc];
      out += c;
      if (lc === 'm') cmd = cmd === 'M' ? 'L' : 'l';
      if (!n) { out += ' '; continue; }
      const v = [];
      for (let k = 0; k < n; k++) v.push(num());
      const X = (x) => (abs ? x * a + e : x * a), Y = (y) => (abs ? y * dd + f : y * dd);
      let w;
      if (lc === 'h') w = [X(v[0])];
      else if (lc === 'v') w = [Y(v[0])];
      else if (lc === 'a') w = [v[0] * a, v[1] * dd, v[2], v[3], v[4], X(v[5]), Y(v[6])];
      else w = v.map((x, k) => (k % 2 ? Y(x) : X(x)));
      out += w.map((x) => r2(x)).join(' ') + ' ';
    }
    return out.trim();
  }

  function svgPaint(cs, s, op) {
    const fill = colour(cs.fill), stroke = colour(cs.stroke);
    if (cs.fill.startsWith('url(') || cs.stroke.startsWith('url(')) log('skip', 'SVG gradient or pattern paint drawn as none');
    const o = parseFloat(cs.opacity) * op;
    const sw = parseFloat(cs.strokeWidth) * s;
    return {
      fill: fill && fill.hex, fo: fill ? r2(fill.a * parseFloat(cs.fillOpacity) * o) : 1,
      stroke: stroke && sw > 0 ? stroke.hex : null, so: stroke ? r2(stroke.a * parseFloat(cs.strokeOpacity) * o) : 1, sw: r2(sw),
      dash: cs.strokeDasharray !== 'none' ? cs.strokeDasharray.split(/[\s,]+/).map((v) => r2(parseFloat(v) * s)).join(' ') : null,
      cap: cs.strokeLinecap !== 'butt' ? cs.strokeLinecap : null, join: cs.strokeLinejoin !== 'miter' ? cs.strokeLinejoin : null,
    };
  }

  function inlineSvg(svg, ctx) {
    const kids = [];
    const visit = (el, into) => {
      for (const c of el.children) {
        const tag = c.tagName.toLowerCase();
        if (['defs', 'title', 'desc', 'style', 'script', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'pattern', 'symbol', 'marker', 'filter', 'metadata'].includes(tag)) continue;
        const cs = getComputedStyle(c);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (c.getAttribute('clip-path') || cs.clipPath !== 'none' || cs.mask !== 'none' || cs.filter !== 'none') log('skip', 'clip-path, mask or filter inside SVG ignored', svg);
        const m = c.getScreenCTM();
        if (tag === 'g' || tag === 'a' || tag === 'svg') {
          const g = { t: 'g', name: c.id || c.dataset?.layer || tag, auto: !c.id, own: [], kids: [] };
          visit(c, g.kids);
          into.push(g);
          continue;
        }
        if (!m) continue;
        const rot = Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6;
        const A = m.a, D = m.d, E = m.e + sx, F = m.f + sy, S = Math.sqrt(Math.abs(A * D));
        const P = (x, y) => [x * A + E, y * D + F];
        const p = svgPaint(cs, S, ctx.opacity);
        const bb = c.getBoundingClientRect();
        const box = [bb.left + sx, bb.top + sy, bb.width, bb.height];
        const nm = c.id || c.getAttribute('aria-label') || null;
        if (rot && tag !== 'text') {
          log('approx', 'rotated SVG shape copied as a path with its own transform', svg);
        }
        const num = (k) => c[k].baseVal.value;
        if (tag === 'rect') {
          const [x, y] = P(num('x'), num('y'));
          into.push({ t: 'rect', name: nm || 'Rect', x, y, w: num('width') * A, h: num('height') * D, rx: (c.rx.baseVal.value || 0) * S, ...p });
        } else if (tag === 'circle' || tag === 'ellipse') {
          const [x, y] = P(num('cx'), num('cy'));
          const rx = tag === 'circle' ? num('r') * A : num('rx') * A, ry = tag === 'circle' ? num('r') * D : num('ry') * D;
          if (Math.abs(rx - ry) < 0.01) into.push({ t: 'circle', name: nm || 'Circle', cx: x, cy: y, r: rx, ...p });
          else into.push({ t: 'ellipse', name: nm || 'Ellipse', cx: x, cy: y, rx, ry, ...p });
        } else if (tag === 'line') {
          const [x1, y1] = P(num('x1'), num('y1')), [x2, y2] = P(num('x2'), num('y2'));
          // Axis-aligned lines with butt caps are filled rects, like rules elsewhere.
          if (p.stroke && !p.dash && !p.cap && (Math.abs(y1 - y2) < 0.01 || Math.abs(x1 - x2) < 0.01)) {
            const hz = Math.abs(y1 - y2) < 0.01;
            into.push({ t: 'rect', name: nm || 'Line', x: hz ? Math.min(x1, x2) : x1 - p.sw / 2, y: hz ? y1 - p.sw / 2 : Math.min(y1, y2),
              w: hz ? Math.abs(x2 - x1) : p.sw, h: hz ? p.sw : Math.abs(y2 - y1), fill: p.stroke, fo: p.so });
          } else into.push({ t: 'line', name: nm || 'Line', x1, y1, x2, y2, ...p });
        } else if (tag === 'polyline' || tag === 'polygon') {
          const pts = [...c.points].map((q) => P(q.x, q.y).map(r2).join(',')).join(' ');
          into.push({ t: 'poly', tag, name: nm || human(tag), points: pts, ...p });
        } else if (tag === 'path') {
          if (rot) into.push({ t: 'path', name: nm || 'Path', d: c.getAttribute('d'), transform: `matrix(${[m.a, m.b, m.c, m.d, E, F].map(r2).join(' ')})`, ...p });
          else into.push({ t: 'path', name: nm || 'Path', d: scalePath(c.getAttribute('d') || '', A, D, E, F), ...p });
        } else if (tag === 'text') {
          const s = c.textContent.replace(/\s+/g, ' ').trim();
          if (!s) continue;
          if (c.querySelector('tspan[x],tspan[y],tspan[dy]')) log('approx', 'positioned tspans inside SVG text flattened to one line', svg);
          const italic = cs.fontStyle !== 'normal';
          const f = resolveFont(cs.fontFamily, parseInt(cs.fontWeight, 10), italic);
          const fill = colour(cs.fill) || { hex: '#000000', a: 1 };
          const x0 = c.x.baseVal.length ? c.x.baseVal[0].value : 0, y0 = c.y.baseVal.length ? c.y.baseVal[0].value : 0;
          const dx = c.dx.baseVal.length ? c.dx.baseVal[0].value : 0, dy = c.dy.baseVal.length ? c.dy.baseVal[0].value : 0;
          const [x, y] = P(x0 + dx, y0 + dy);
          const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
          if (cs.dominantBaseline !== 'auto' && cs.dominantBaseline !== 'alphabetic') log('approx', `dominant-baseline ${cs.dominantBaseline} not carried over`, svg);
          into.push({ t: 'text', name: nm || words(s), auto: !nm, anchor: cs.textAnchor !== 'start' ? cs.textAnchor : null,
            lines: [{ x, y, box, runs: [{ s: transform(s, cs.textTransform), st: { ff: f.figma, css: f.css, fw: f.weight, fs: r2(parseFloat(cs.fontSize) * S), it: italic,
              fill: fill.hex, fo: r2(fill.a * parseFloat(cs.fillOpacity) * parseFloat(cs.opacity) * ctx.opacity), ls: r2(ls * S), td: '' } }] }] });
        } else if (tag === 'image') {
          const [x, y] = P(num('x'), num('y'));
          into.push({ t: 'image', name: nm || 'Image', x, y, w: num('width') * A, h: num('height') * D, src: c.href.baseVal, box });
        } else if (tag === 'use') {
          log('skip', '<use> inside SVG is not copied', svg);
        } else if (tag === 'foreignobject') {
          log('skip', 'foreignObject inside SVG is not copied', svg);
        }
      }
    };
    visit(svg, kids);
    return kids;
  }

  // An <img> with object-fit other than fill, redrawn as the browser shows it (cropped for cover, letterboxed
  // for contain), so the SVG's image fills its box without stretching. Returns a PNG data URL, or null if the
  // image isn't loaded or is cross-origin (the canvas would be tainted).
  function fitImage(el, cs, b) {
    const nw = el.naturalWidth, nh = el.naturalHeight;
    if (!el.complete || !nw || !nh || !b.w || !b.h) return null;
    const fit = cs.objectFit;
    let s = fit === 'cover' ? Math.max(b.w / nw, b.h / nh)
      : fit === 'contain' ? Math.min(b.w / nw, b.h / nh)
      : fit === 'none' ? 1
      : fit === 'scale-down' ? Math.min(1, b.w / nw, b.h / nh) : null;
    if (s === null) return null;
    const dw = nw * s, dh = nh * s;
    const pos = cs.objectPosition.split(/\s+/);
    const at = (v, free) => v && v.endsWith('%') ? free * parseFloat(v) / 100 : v ? parseFloat(v) : free / 2;
    const dx = at(pos[0], b.w - dw), dy = at(pos[1], b.h - dh);
    // Keep the image's own detail, at least the capture's scale and at most 4 image pixels per CSS px.
    const k = Math.max(opts.scale, Math.min(1 / s, 4));
    const c = document.createElement('canvas');
    c.width = Math.round(b.w * k);
    c.height = Math.round(b.h * k);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(el, dx * k, dy * k, dw * k, dh * k);
    try { return c.toDataURL('image/png'); } catch (e) { return null; }
  }

  // ---- The walk ----
  const SKIP = new Set(['script', 'style', 'template', 'head', 'meta', 'link', 'noscript', 'title', 'base']);
  function walk(el, ctx) {
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag) || el === probeHost || el === hideSheet) return null;
    const cs = css(el);
    const { name, auto, strong } = nameOf(el);
    const node = { t: 'g', name, auto, strong, own: [], kids: [] };
    if (cs.display === 'contents') {
      for (const c of el.children) { const k = walk(c, ctx); if (k) node.kids.push(k); }
      return node;
    }
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return null;
    const b = R(el.getBoundingClientRect());
    // Visually hidden (sr-only) content.
    if ((cs.position === 'absolute' || cs.position === 'fixed') && b.w <= 1 && b.h <= 1 && cs.overflow !== 'visible') return null;
    if (/rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(cs.clip)) return null;
    const c2 = { ...ctx, opacity: ctx.opacity * parseFloat(cs.opacity) };
    if (cs.mixBlendMode !== 'normal') log('skip', `mix-blend-mode ${cs.mixBlendMode} ignored`, el);
    if (cs.transform !== 'none' && !/^matrix\(1, 0, 0, 1,/.test(cs.transform)) log('approx', `transform ${cs.transform} drawn as its bounding box`, el);

    if (tag === 'svg') {
      node.own.push(...boxPaint(el, cs, b, c2));
      node.kids.push(...inlineSvg(el, c2));
      node.name = el.dataset.layer || el.id || (el.getAttribute('aria-label') && clip(el.getAttribute('aria-label'), 40)) || (el.classList[0] ? human(el.classList[0]) : 'Graphic');
      return node;
    }
    if (tag === 'img' || tag === 'canvas' || tag === 'video') {
      node.own.push(...boxPaint(el, cs, b, c2));
      let src = tag === 'img' ? el.currentSrc || el.src : null;
      if (tag === 'canvas') try { src = el.toDataURL('image/png'); } catch (e) { log('skip', 'canvas is tainted and cannot be copied', el); }
      if (tag === 'video') log('skip', 'video is not copied', el);
      if (tag === 'img' && src && cs.objectFit !== 'fill') {
        const fitted = fitImage(el, cs, b);
        if (fitted) src = fitted;
        else log('approx', `object-fit ${cs.objectFit} drawn stretched (image could not be copied to a canvas)`, el);
      }
      if (src) node.kids.push({ t: 'image', name: el.alt || name, x: b.x, y: b.y, w: b.w, h: b.h, src, box: [b.x, b.y, b.w, b.h] });
      return node;
    }
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      node.own.push(...control(el, cs, b, c2));
      return node;
    }

    node.own.push(...boxPaint(el, cs, b, c2));
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const bl = parseFloat(cs.borderLeftWidth), bt = parseFloat(cs.borderTopWidth);
      const pad = { x: b.x + bl, y: b.y + bt, w: b.w - bl - parseFloat(cs.borderRightWidth), h: b.h - bt - parseFloat(cs.borderBottomWidth) };
      c2.clip = meet(pad, ctx.clip) || { x: 0, y: 0, w: 0, h: 0 };
    }
    if (/^(list-item)/.test(cs.display) && cs.listStyleType !== 'none') log('skip', `list marker (${cs.listStyleType}) not drawn`, el);

    // Text of this box and its plain inline descendants, then child boxes.
    const block = cs.display !== 'inline';
    const handle = (parent) => {
      for (const c of parent.children) {
        if (isFlowInline(c)) {
          // Inline element: its text is already in the container's lines; draw its own boxes and atomic children.
          const ics = css(c);
          if (ics.display === 'none' || !c.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
          const cn = nameOf(c);
          const g = { t: 'g', name: cn.name, auto: cn.auto, own: [], kids: [] };
          const rects = [...c.getClientRects()].map(R);
          for (const r of rects) g.own.push(...boxPaint(c, ics, r, c2));
          if (rects.length > 1 && g.own.length) log('approx', 'inline box split over lines drawn as one rect per line', c);
          handle(c);
          if (g.own.length) node.kids.push(g);
        } else {
          const k = walk(c, c2);
          if (k) node.kids.push(k);
        }
      }
    };
    if (block) {
      const tn = textNodes(el);
      if (tn.some((n) => n.nodeType === 3 && n.data.trim())) {
        const t = textNode(el, tn, c2, null);
        if (t) node.kids.push(t);
      }
    }
    handle(el);
    // Paint order: text drawn after inline backgrounds.
    node.kids.sort((a, z) => (a.t === 'text') - (z.t === 'text'));
    return node;
  }

  // Page background (the canvas takes html's background, else body's).
  const W = opts.width;
  const H = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  let pageBg = colour(css(document.documentElement).backgroundColor) || colour(css(document.body).backgroundColor) || { hex: '#ffffff', a: 1 };
  const root = { t: 'g', name: 'Page', auto: false, own: [{ t: 'rect', name: 'Background', x: 0, y: 0, w: W, h: H, fill: pageBg.hex, fo: pageBg.a }], kids: [] };
  const body = walk(document.body, { opacity: 1, clip: null });
  if (body) {
    // The body's own background is the canvas background already.
    body.own = body.own.filter((n) => !(n.name === 'Background' && n.fill === pageBg.hex));
    root.kids.push(body);
  }

  // Restore the page.
  for (const s of made) {
    const host = s.parentElement;
    host.removeAttribute(s.dataset.h2fPseudo === '::before' ? 'data-h2f-no-before' : 'data-h2f-no-after');
    s.remove();
  }
  hideSheet.remove();
  probeHost.remove();

  // Fonts the verify render needs: the page's stylesheet links and any @font-face rules it can read.
  const fontCss = [];
  const links = [...document.querySelectorAll('link[rel~="stylesheet"]')].map((l) => l.href);
  for (const sh of document.styleSheets) {
    let rules;
    try { rules = sh.cssRules; } catch (e) { continue; }
    for (const r of rules) {
      if (r.type === CSSRule.FONT_FACE_RULE) {
        fontCss.push(r.cssText.replace(/url\(["']?([^"')]+)["']?\)/g, (m, u) => `url("${new URL(u, sh.href || location.href).href}")`));
      }
    }
  }
  return { width: W, height: H, root, log: LOG, fontLinks: links, fontCss };
}
