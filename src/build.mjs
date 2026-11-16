// Builds every skill into dist/<name>/ and dist/<name>.zip, ready to upload
// to Claude chat. A release runs this and publishes the zips
// (.github/workflows/release.yml); run it yourself to try a build:
//
//   node src/build.mjs
//
// What it adds to the skill folders in this repo:
// - Links become real files (the Figma skills' figma-svg/), since an
//   uploaded skill has to stand alone.
// - igl-artifact gets the IGL palette, fonts and logos from
//   frontend-boilerplate, so the brand has one home. BOILERPLATE=<path> uses
//   a checkout; otherwise it's cloned from GitHub.

import {execFileSync} from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, join, resolve} from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'dist');
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, {encoding: 'utf8', ...opts}).trim();

// A skill is a top-level folder with a SKILL.md.
const skills = readdirSync(ROOT, {withFileTypes: true})
  .filter((d) => d.isDirectory() && !/^[._]/.test(d.name))
  .map((d) => d.name)
  .filter((name) => existsSync(join(ROOT, name, 'SKILL.md')));

// This repo is public and the zips get passed around, so nothing git ignores
// goes in them (bar Python's caches and macOS's folder files, left out below).
const JUNK = /(^|\/)(__pycache__|\.DS_Store)(\/|$)/;
const ignored = run(
  'git',
  ['ls-files', '--others', '--ignored', '--exclude-standard', ...skills],
  {cwd: ROOT},
)
  .split('\n')
  .filter((f) => f && !JUNK.test(f));
if (ignored.length) {
  throw new Error(
    `Git ignores these, so they can't go in a skill. Move them to private/:\n${ignored.join('\n')}`,
  );
}

// frontend-boilerplate, for igl-artifact's brand.
let boilerplate = process.env.BOILERPLATE && resolve(process.env.BOILERPLATE);
if (!boilerplate) {
  boilerplate = join(mkdtempSync(join(tmpdir(), 'igl-skills-')), 'boilerplate');
  run('git', [
    'clone',
    '--quiet',
    '--depth=1',
    'https://github.com/innovation-growth-lab/frontend-boilerplate.git',
    boilerplate,
  ]);
}
const fromBoilerplate = (path) => {
  const file = join(boilerplate, path);
  if (!existsSync(file)) throw new Error(`No ${path} in ${boilerplate}`);
  return readFileSync(file, 'utf8');
};
const boilerplateCommit = run('git', ['rev-parse', '--short', 'HEAD'], {
  cwd: boilerplate,
});

rmSync(OUT, {recursive: true, force: true});
mkdirSync(OUT);

for (const name of skills) {
  cpSync(join(ROOT, name), join(OUT, name), {
    recursive: true,
    dereference: true,
    filter: (src) => !JUNK.test(src),
  });
}
if (skills.includes('igl-artifact')) addBrand(join(OUT, 'igl-artifact'));

// Claude's upload wants a zip with the skill's folder at its top.
for (const name of skills) {
  run('zip', ['-rqX', `${name}.zip`, name], {cwd: OUT});
}

console.log(`Built ${skills.length} skills in dist/: ${skills.join(', ')}
  Brand from frontend-boilerplate ${boilerplateCommit}`);

// --- igl-artifact's brand --------------------------------------------------

function addBrand(dir) {
  // The palette and the two IGL font stacks from the Tailwind theme, renamed
  // since the skill switches between them and its editorial fonts. Not the
  // colours aliased to shadcn's roles.
  const FONTS = {
    '--font-display': '--font-classic-display',
    '--font-sans': '--font-classic-body',
  };
  const tokens = declarations(
    block(fromBoilerplate('src/index.css'), '@theme static'),
  )
    .filter(([, value]) => value !== 'initial' && !value.startsWith('var('))
    .flatMap(([name, value]) => {
      if (FONTS[name]) return [[FONTS[name], value]];
      return name.startsWith('--color-') ? [[name, value]] : [];
    });
  for (const required of [
    '--color-dark-blue',
    '--color-yellow-80',
    '--font-classic-display',
  ]) {
    if (!tokens.some(([name]) => name === required)) {
      throw new Error(`frontend-boilerplate no longer defines ${required}`);
    }
  }
  fill(
    join(dir, 'igl.css'),
    /\/\* IGL_PALETTE:[\s\S]*?\*\/\n/,
    `/* The IGL palette and fonts, from frontend-boilerplate's src/index.css
   (${boilerplateCommit}). */
:root {
${tokens.map(([n, v]) => `  ${n}: ${v};`).join('\n')}
}
`,
  );

  // The logo files, and the mark inline wherever a page asks for it.
  mkdirSync(join(dir, 'logos'));
  for (const logo of [
    'igl-mark.svg',
    'igl-logo-horizontal.svg',
    'igl-logo-primary-reversed.svg',
    'igl-logo-secondary-reversed.svg',
  ]) {
    writeFileSync(
      join(dir, 'logos', logo),
      fromBoilerplate(`src/assets/logos/${logo}`),
    );
  }
  const mark = inlineMark(fromBoilerplate('src/assets/logos/igl-mark.svg'));
  const pages = [
    'template.html',
    'patterns.md',
    ...readdirSync(join(dir, 'examples'))
      .filter((f) => f.endsWith('.html'))
      .map((f) => join('examples', f)),
  ];
  for (const page of pages) {
    const path = join(dir, page);
    const text = readFileSync(path, 'utf8');
    if (text.includes('<!--igl:mark-->')) {
      writeFileSync(path, text.replaceAll('<!--igl:mark-->', () => mark));
    }
  }
}

// Replace the one match of pattern in a file, or fail.
function fill(path, pattern, text) {
  const before = readFileSync(path, 'utf8');
  if (!pattern.test(before)) {
    throw new Error(`No ${pattern} in ${basename(path)}`);
  }
  writeFileSync(path, before.replace(pattern, () => text));
}

// The body of the first `<selector> { … }` block in css, by brace matching.
function block(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No "${selector} {" in src/index.css`);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) {
      return css.slice(css.indexOf('{', start) + 1, i);
    }
  }
  throw new Error(`Unclosed "${selector}" block in src/index.css`);
}

// `--name: value;` declarations, with comments dropped.
function declarations(body) {
  return [
    ...body
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g),
  ].map(([, name, value]) => [name, value.trim()]);
}

// The IGL mark as inline SVG: no title or ids, sized by CSS (so the <svg>
// itself loses its width and height; its shapes keep theirs).
function inlineMark(svg) {
  return svg
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/\s(id|data-name)="[^"]*"/g, '')
    .replace(/<svg[^>]*>/, (tag) =>
      tag
        .replace(/\s(width|height)="[\d.]+"/g, '')
        .replace(
          '<svg ',
          '<svg class="logo" role="img" aria-label="Innovation Growth Lab" ',
        ),
    )
    .replace(/<\/path>|<\/rect>|<\/polygon>/g, '')
    .replace(/<(path|rect|polygon)([^>]*?)>/g, '<$1$2/>')
    .replace(/<\/?g>/g, '')
    .replace(/\n\s*/g, '');
}
