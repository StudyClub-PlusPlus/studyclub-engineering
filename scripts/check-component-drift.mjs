#!/usr/bin/env node
/**
 * 프로토타입과 실제 앱이 디자인 시스템에서 다시 갈라지는지 본다.
 *
 *   node scripts/check-component-drift.mjs            검사 (늘어난 것이 있으면 exit 1)
 *   node scripts/check-component-drift.mjs --report   프로토 ↔ 앱 같은 이름 파일의 차이 줄 수도 출력
 *   node scripts/check-component-drift.mjs --update   지금 상태를 기준선으로 저장
 *
 * 1. 그림자 부품 — @studyclub/ui 가 export 하는 부품과 같은 이름의 .tsx 가 앱·프로토에 있는가.
 *    부품은 packages/ui 에서만 고친다. 같은 이름 사본이 있으면 어느 쪽을 고쳐야 하는지 헷갈린다.
 * 2. 토큰 우회 — 토큰 대신 값을 직접 쓴 횟수. 세 가지를 따로 센다.
 *    - palette : Tailwind 기본 팔레트(bg-red-600, text-slate-500 …). tokens.css 가 정의한 이름(neutral·primary …)은 뺀다.
 *    - hex     : 색 코드를 직접 쓴 것(text-[#FCD34D], style 의 '#2D2F35' …).
 *    - fontPx  : 글자 크기를 직접 쓴 것(text-[13px] …). 콘텐츠 역할(type-body-sm · type-label-lg …)을 쓴다.
 *    레이아웃 폭·높이(w-[320px] …)는 정당한 경우가 많아 세지 않는다.
 *
 * 기존 것은 기준선(scripts/component-drift-baseline.json)에 적어 두고 **늘어날 때만** 실패한다.
 * 줄였으면 --update 로 기준선을 낮춘다.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');
const FE = path.join(REPO, 'frontend');
const BASELINE = path.join(import.meta.dirname, 'component-drift-baseline.json');
const args = new Set(process.argv.slice(2));

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const rel = (p) => path.relative(REPO, p).replaceAll('\\', '/');

function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', '.next', 'dist'].includes(e.name)) walk(full, test, out);
    } else if (test(e.name)) out.push(full);
  }
  return out;
}

const AREAS = {
  'core-front': path.join(FE, 'apps/core-front/src'),
  'back-office-front': path.join(FE, 'apps/back-office-front/src'),
  'playground/proto': path.join(FE, 'apps/playground/src/proto'),
  'packages/ui': path.join(FE, 'packages/ui/src'),
};
const isSource = (n) => n.endsWith('.tsx') && !n.endsWith('.stories.tsx') && !n.endsWith('.test.tsx');

// ── 1. 그림자 부품
const uiIndex = read(path.join(AREAS['packages/ui'], 'index.ts'));
const uiParts = new Set();
for (const m of uiIndex.matchAll(/^export \{([^}]+)\} from '\.\/(\w+)'/gm)) {
  for (const name of m[1].split(',').map((s) => s.trim())) if (/^[A-Z]/.test(name)) uiParts.add(name);
}

const shadows = [];
for (const [area, dir] of Object.entries(AREAS)) {
  if (area === 'packages/ui') continue;
  for (const f of walk(dir, isSource)) {
    if (uiParts.has(path.basename(f, '.tsx'))) shadows.push(rel(f));
  }
}
shadows.sort();

// ── 2. 토큰 우회
const tokenNames = new Set(
  [...read(path.join(FE, 'packages/design/tokens.css')).matchAll(/--color-([a-z]+)-\d+\s*:/g)].map((m) => m[1]),
);
const TW_PALETTE =
  'slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const paletteRe = new RegExp(
  `\\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|divide|decoration|accent|caret)-(${TW_PALETTE})-\\d{2,3}\\b`,
  'g',
);
const isCode = (n) => isSource(n) || (n.endsWith('.ts') && !n.endsWith('.d.ts') && !n.endsWith('.test.ts'));
const KINDS = {
  palette: {
    re: paletteRe,
    files: isSource,
    keep: (m) => !tokenNames.has(m[1]),
    fix: 'tokens.css 의 semantic 토큰(text-danger-fg, text-fg-muted …)을 쓴다',
  },
  hex: {
    re: /-\[#[0-9a-fA-F]{3,8}\]|['"`]#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?['"`]/g,
    files: isCode,
    keep: () => true,
    fix: '색 코드 대신 토큰(var(--color-…), text-warning-fg …)을 쓴다. 맞는 토큰이 없으면 tokens.css 에 먼저 추가한다',
  },
  fontPx: {
    re: /\btext-\[\d+(?:\.\d+)?px\]/g,
    files: isSource,
    keep: () => true,
    fix: '타입 스케일(text-xs · text-sm …)을 쓴다. 자주 쓰는 크기라면 스케일에 단계를 추가한다',
  },
};
const counts = {};
const hits = {};
for (const kind of Object.keys(KINDS)) {
  counts[kind] = {};
  hits[kind] = {};
}
for (const [area, dir] of Object.entries(AREAS)) {
  for (const [kind, { re, files, keep }] of Object.entries(KINDS)) {
    counts[kind][area] = 0;
    hits[kind][area] = [];
    for (const f of walk(dir, files)) {
      for (const m of read(f).matchAll(re)) {
        if (!keep(m)) continue;
        counts[kind][area]++;
        hits[kind][area].push(`${rel(f)}  ${m[0]}`);
      }
    }
  }
}

// ── --update
if (args.has('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify({ shadows, ...counts }, null, 2)}\n`);
  console.log(`기준선 저장: ${rel(BASELINE)} (그림자 ${shadows.length}개, ${JSON.stringify(counts)})`);
  process.exit(0);
}

const base = existsSync(BASELINE) ? JSON.parse(read(BASELINE)) : { shadows: [] };
const problems = [];
const notes = [];

const known = new Set(base.shadows);
for (const s of shadows) if (!known.has(s)) problems.push(`그림자 부품 추가됨: ${s} — @studyclub/ui 의 같은 부품을 import 한다`);
for (const s of base.shadows) if (!shadows.includes(s)) notes.push(`그림자 부품 사라짐: ${s} — --update 로 기준선에서 뺀다`);

for (const [kind, { fix }] of Object.entries(KINDS)) {
  for (const [area, n] of Object.entries(counts[kind])) {
    const was = base[kind]?.[area] ?? 0;
    if (n > was) {
      problems.push(`${area}: ${kind} ${was} → ${n}회 — ${fix}`);
      // 어디서 늘었는지는 기준선에 파일별로 남기지 않아 알 수 없다 — 파일별 횟수로 묶어 보여 준다
      const byFile = new Map();
      for (const h of hits[kind][area]) {
        const [file, value] = h.split('  ');
        byFile.set(file, [...(byFile.get(file) ?? []), value]);
      }
      for (const [file, values] of byFile) problems.push(`    ${file}  ×${values.length}  ${[...new Set(values)].join(' ')}`);
    } else if (n < was) notes.push(`${area}: ${kind} ${was} → ${n}회 — --update 로 기준선을 낮춘다`);
  }
}

// ── --report: 프로토 ↔ 앱 같은 이름 파일 차이
function changedLines(a, b) {
  const clean = (t) =>
    read(t)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('import ') && !l.startsWith('//'));
  const x = clean(a);
  const y = clean(b);
  let prev = new Uint16Array(y.length + 1);
  for (let i = 1; i <= x.length; i++) {
    const cur = new Uint16Array(y.length + 1);
    for (let j = 1; j <= y.length; j++) {
      cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  const lcs = prev[y.length];
  return x.length - lcs + (y.length - lcs);
}

if (args.has('--report')) {
  const pairs = [
    ['playground/src/proto/core/components', 'core-front/src/components'],
    ['playground/src/proto/console/components', 'back-office-front/src/components'],
  ];
  const rows = [];
  for (const [p, a] of pairs) {
    const pd = path.join(FE, 'apps', p);
    const ad = path.join(FE, 'apps', a);
    for (const f of walk(pd, isSource)) {
      const twin = path.join(ad, path.basename(f));
      if (existsSync(twin)) rows.push([changedLines(f, twin), `${p.split('/').at(-2)}/${path.basename(f)}`]);
    }
  }
  rows.sort((r, s) => s[0] - r[0]);
  console.log('프로토 ↔ 앱 같은 이름 파일 — 바뀐 줄 수 (import·주석·빈 줄 제외, 참고용)');
  for (const [n, name] of rows) console.log(`  ${String(n).padStart(5)}  ${name}`);
  console.log('');
}

console.log(`그림자 부품 ${shadows.length}개 (기준선 ${base.shadows.length})`);
for (const kind of Object.keys(KINDS)) console.log(`  ${kind.padEnd(7)} ${JSON.stringify(counts[kind])}`);
for (const n of notes) console.log(`  · ${n}`);
if (problems.length) {
  console.log('');
  for (const p of problems) console.log(`✗ ${p}`);
  process.exit(1);
}
console.log('✓ 기준선보다 늘어난 것 없음');
