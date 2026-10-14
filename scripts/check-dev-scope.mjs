#!/usr/bin/env node
/**
 * 기획 문서의 「개발 범위」가 코드와 어긋났는지 본다. 고치지 않고 알리기만 한다.
 *
 *   node scripts/check-dev-scope.mjs
 *
 * 1. 스펙 엔드포인트 표의 상태 칸이 정해진 값으로 시작하는가
 *    (docs/backend-development-guide/spec-driven-development.md 「엔드포인트 상태」)
 * 2. 스펙 상태와 백엔드 컨트롤러가 맞는가 — 구현완료인데 컨트롤러가 없다 / 스펙 단계인데 컨트롤러가 있다
 * 3. 모든 Story PRD 에 `### 개발 범위` 가 있는가
 * 4. PRD 의 개발 범위 BE 줄이 스펙 상태와 같은 값을 적었는가
 * 5. PRD API 표의 경로가 어느 스펙에도 없으면, 개발 범위에 「스펙 없음」이 적혀 있는가
 *
 * 컨트롤러는 `@RequestMapping` + `@XxxMapping` 문자열만 읽는다 — 상수로 만든 경로는 놓친다.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');
const STATUSES = ['스펙작성중', '스펙확정', '구현중', '구현완료', '변경예정', '폐기'];
const METHODS = /^(GET|POST|PUT|PATCH|DELETE)$/;

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const norm = (p) => p.replace(/`/g, '').split('?')[0].trim().replace(/\{[^}]+\}/g, '{}').replace(/\/$/, '');
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());

function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== 'build') walk(full, test, out);
    } else if (test(e.name)) out.push(full);
  }
  return out;
}

// ── 백엔드 컨트롤러
const backend = new Set();
for (const f of walk(path.join(REPO, 'backend'), (n) => n.endsWith('Controller.java'))) {
  const t = read(f);
  const base = t.match(/@RequestMapping\(\s*(?:(?:value|path)\s*=\s*)?"([^"]*)"/)?.[1] ?? '';
  for (const m of t.matchAll(/@(Get|Post|Put|Patch|Delete)Mapping(?:\(\s*(?:(?:value|path)\s*=\s*)?"([^"]*)")?/g)) {
    backend.add(`${m[1].toUpperCase()} ${norm(base + (m[2] ?? ''))}`);
  }
}

// ── 스펙 엔드포인트 표 (상태 칸이 있는 표만)
const spec = new Map(); // "GET /api/x/{}" → { status, file }
const problems = [];
for (const f of walk(path.join(REPO, 'specs'), (n) => n === 'spec.md')) {
  const rel = path.relative(REPO, f).replaceAll('\\', '/');
  let statusCol = -1;
  for (const line of read(f).split('\n')) {
    if (!line.startsWith('|')) {
      statusCol = -1;
      continue;
    }
    const c = cells(line);
    if (/^Method$/i.test(c[0]) && /^Path$/i.test(c[1])) {
      statusCol = c.indexOf('상태');
      continue;
    }
    if (statusCol < 0 || !METHODS.test(c[0]) || !c[1]?.replace(/`/g, '').startsWith('/')) continue;
    const key = `${c[0]} ${norm(c[1])}`;
    const status = c[statusCol] ?? '';
    const word = STATUSES.find((s) => status.startsWith(s));
    if (!word) problems.push(`[상태 값] ${rel}: ${key} — 「${status}」`);
    spec.set(key, { status: word ?? status, file: rel });
    const built = backend.has(key);
    if (word === '구현완료' && !built) problems.push(`[스펙↔코드] ${rel}: ${key} 는 구현완료인데 컨트롤러가 없다`);
    if ((word === '스펙작성중' || word === '스펙확정') && built)
      problems.push(`[스펙↔코드] ${rel}: ${key} 는 ${word}인데 컨트롤러가 있다 — 상태가 늦다`);
  }
}

// ── Story PRD
const storiesDir = path.join(REPO, '01-planning/stories');
for (const name of readdirSync(storiesDir)) {
  const f = path.join(storiesDir, name, 'PRD.md');
  if (!existsSync(f)) continue;
  const t = read(f);
  const scope = t.match(/### 개발 범위\n([\s\S]*?)(?=\n### |\n## )/)?.[1];
  if (!scope) {
    problems.push(`[개발 범위 없음] ${name}`);
    continue;
  }
  // 4. BE 줄 — 경로가 하나뿐인 줄만 대조한다 (여러 경로를 묶은 줄은 사람이 본다)
  for (const line of scope.split('\n').filter((l) => l.startsWith('| BE |'))) {
    const [, target, now] = cells(line);
    const paths = [...target.matchAll(/`(GET|POST|PUT|PATCH|DELETE) (\/[^`]+)`/g)];
    if (paths.length !== 1) continue;
    const s = spec.get(`${paths[0][1]} ${norm(paths[0][2])}`);
    if (s && !now.startsWith(s.status)) problems.push(`[PRD↔스펙] ${name}: ${paths[0][0]} — PRD 「${now.split(' ')[0]}」 · 스펙 「${s.status}」`);
  }
  // 5. API 표의 경로
  const api = t.match(/### API[^\n]*\n([\s\S]*?)(?=\n### |\n## |$)/)?.[1] ?? '';
  for (const line of api.split('\n').filter((l) => l.startsWith('|'))) {
    const c = cells(line);
    const p = c[1]?.match(/\/[^`\s]+/)?.[0];
    if (!p) continue;
    for (const m of c[0].match(/GET|POST|PUT|PATCH|DELETE/g) ?? []) {
      const key = `${m} ${norm(p)}`;
      if (!spec.has(key) && !backend.has(key) && !scope.includes('스펙 없음'))
        problems.push(`[스펙 없음] ${name}: ${key} — 스펙에도 코드에도 없는데 개발 범위에 표시가 없다`);
    }
  }
}

if (problems.length === 0) {
  console.log(`개발 범위와 스펙 상태가 코드와 맞다 (스펙 엔드포인트 ${spec.size} · 컨트롤러 ${backend.size})`);
} else {
  console.log(problems.join('\n'));
  console.log(`\n${problems.length}건`);
  process.exitCode = 1;
}
