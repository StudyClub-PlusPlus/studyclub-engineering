/**
 * 프로토 화면명세(spec.ts) → PRD §2 화면명세.
 *
 * **설명 보기에 뜨는 것이 곧 기획서다.** 손으로 두 벌 쓰면 한쪽만 고쳐져 화면과 문서가 갈린다.
 * 그래서 화면 옆에 있는 `spec.ts` 하나를 원본으로 두고, 여기서 PRD 의 화면명세 절을 만들어 넣는다.
 *
 *   pnpm --filter playground export-specs          # 바뀐 PRD 를 고쳐 쓴다
 *   pnpm --filter playground export-specs --check  # 어긋난 곳만 알리고 고치지 않는다 (CI)
 *
 * 어느 PRD 로 갈지는 `spec.ts` 의 `prd` 필드가 정한다. 그 필드가 없는 화면은 건너뛴다 —
 * 아직 기획서가 없는 프로토가 있을 수 있다.
 */
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const REPO = path.resolve(ROOT, '../../..');
const APP = path.join(ROOT, 'src/app/(proto)');
const STORIES = path.join(REPO, '01-planning/stories');

/**
 * 자리 표시 — 화면마다 하나씩. `scope` 로 가른다.
 *
 *   <!-- spec:start template -->  … 여기에 들어간다 …  <!-- spec:end template -->
 *
 * 한 PRD 가 화면 둘을 담을 수 있어서(탭으로 갈린 지면) 이름을 붙인다. 캡처는 이 바깥에 두면
 * 생성할 때 지워지지 않는다.
 */
const mark = (kind, scope) => `<!-- spec:${kind} ${scope} -->`;

/** `spec.ts` 를 전부 찾는다. 화면마다 하나씩 있다. */
async function findSpecs(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await findSpecs(full)));
    else if (entry.name === 'spec.ts') found.push(full);
  }
  return found;
}

/** TS 를 그대로 읽을 수 없으니 한 파일로 묶어 ESM 으로 만든 뒤 import 한다. */
async function loadSpec(file, tmp) {
  const out = path.join(tmp, `${Buffer.from(file).toString('hex').slice(-24)}.mjs`);
  await build({
    entryPoints: [file],
    outfile: out,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
    // 타입만 쓰는 import 는 묶지 않는다 — 번들에 넣으면 React 까지 딸려 온다
    external: ['react', 'next/*', '@/proto/annotate'],
  });
  const mod = await import(pathToFileURL(out).href);
  return mod.SPEC;
}

/** ScreenSpec → 마크다운. PRD 의 다른 절과 같은 모양으로 적는다. */
function toMarkdown(spec) {
  const lines = [];
  if (spec.notes?.length) {
    for (const note of spec.notes) lines.push(`> ${note}`, '>');
    lines.pop();
    lines.push('');
  }
  for (const e of spec.entries) {
    const depth = (e.n.match(/-/g)?.length ?? 0) + 3;
    lines.push(`${'#'.repeat(Math.min(depth, 6))} ${e.n} — ${e.title}`, '');
    if (e.when) lines.push(`- **조건**: ${e.when}`);
    for (const [key, label] of [
      ['display', '내용'],
      ['behavior', '동작'],
      ['policy', '정책'],
      ['data', '데이터'],
    ]) {
      const v = e[key];
      if (!v?.length) continue;
      if (v.length === 1) lines.push(`- **${label}**: ${v[0]}`);
      else lines.push(`- **${label}**`, ...v.map((x) => `  - ${x}`));
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

const args = process.argv.slice(2);
const check = args.includes('--check');
const tmp = await mkdtemp(path.join(tmpdir(), 'specs-'));
let wrote = 0;
let stale = [];
let skipped = 0;

try {
  for (const file of await findSpecs(APP)) {
    let spec;
    try {
      spec = await loadSpec(file, tmp);
    } catch {
      continue; // 화면명세가 아닌 spec.ts 는 건너뛴다
    }
    if (!spec?.entries?.length) continue;
    if (!spec.prd) {
      skipped += 1;
      continue;
    }
    const prd = path.join(STORIES, spec.prd, 'PRD.md');
    if (!existsSync(prd)) {
      console.error(`✗ ${spec.prd} — PRD 가 없다 (${path.relative(REPO, file)})`);
      process.exitCode = 1;
      continue;
    }
    const scope = spec.scope ?? 'screen';
    const start = mark('start', scope);
    const end = mark('end', scope);
    const body = `${start}\n\n${toMarkdown(spec)}\n\n${end}`;
    const current = await readFile(prd, 'utf8');
    if (!current.includes(start)) {
      console.error(`✗ ${spec.prd} — PRD 에 ${start} 자리가 없다`);
      process.exitCode = 1;
      continue;
    }
    const next = current.replace(new RegExp(`${start}[\\s\\S]*?${end}`), () => body);
    if (next === current) continue;
    if (check) stale.push(spec.prd);
    else {
      await writeFile(prd, next);
      wrote += 1;
    }
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}

if (check) {
  if (stale.length) {
    console.error(`화면과 PRD 가 어긋났다: ${stale.join(', ')}`);
    console.error('고치려면: pnpm --filter playground export-specs');
    process.exit(1);
  }
  console.log(`화면명세와 PRD 가 같다 (prd 미지정 ${skipped}건은 건너뜀)`);
} else {
  console.log(`PRD ${wrote}건 갱신 (prd 미지정 ${skipped}건은 건너뜀)`);
}
