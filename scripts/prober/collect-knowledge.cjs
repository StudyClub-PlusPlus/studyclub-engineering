#!/usr/bin/env node
// 레포의 위층(문서 · 개념 · 흐름)을 모아 Prober 에 올린다. specs/schema §위층
//   node collect.cjs                → 올린다 (env PROBER_API · PROBER_TOKEN · PROBER_PROJECT=<팀>/projects/<프로젝트>)
//   node collect.cjs --dry-run      → 저장하지 않고 "DB 구조에 없는 테이블" 경고만 본다 (로컬 검사)
//   node collect.cjs --print        → 보낼 body 만 찍는다 (네트워크 없음)
// PR 브랜치면 응답의 기준 대비 비교를 knowledge-comment.md 로 쓴다 (action.yml 이 PR 코멘트로)
// 읽는 것 (레포 루트 기준, env 로 바꿀 수 있다)
//   PROBER_DOCS     = specs/*/spec.md,docs/erd/*.md,docs/flows/*.md
//   <map>/concepts.json = { concepts: [{ name, summary?, tables[] }], relations: [{ from: 'TABLE.COLUMN', to, why? }] }
//   <map>/flows/*.json  = { name, trigger?, spec?, steps: [{ table? | external?, op?, event?, note? }] }
//   <map> = 옛 폴더 .strata 가 있으면 그것, 없으면 .prober/map (옛 폴더 지원은 한 분기 뒤 삭제)
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.env.REPO_ROOT || process.cwd();
const args = process.argv.slice(2);
const git = (...a) => {
  try {
    return execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

// a/별/b.md · a/별.md 정도만 — 별 하나가 디렉토리 한 칸 또는 파일 이름
function glob(pattern) {
  let paths = [''];
  for (const part of pattern.split('/')) {
    const next = [];
    for (const p of paths) {
      const dir = path.join(root, p);
      if (!part.includes('*')) {
        if (fs.existsSync(path.join(dir, part))) next.push(path.join(p, part));
        continue;
      }
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      const re = new RegExp('^' + part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
      for (const name of fs.readdirSync(dir).sort()) if (re.test(name)) next.push(path.join(p, name));
    }
    paths = next;
  }
  return paths.filter((p) => fs.statSync(path.join(root, p)).isFile());
}

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const patterns = (process.env.PROBER_DOCS || 'specs/*/spec.md,docs/erd/*.md,docs/flows/*.md').split(',').filter(Boolean);
const docs = [...new Set(patterns.flatMap(glob))].map((p) => ({ path: p, body: fs.readFileSync(path.join(root, p), 'utf8') }));
const map = fs.existsSync(path.join(root, '.strata')) ? '.strata' : '.prober/map';
const concepts = fs.existsSync(path.join(root, map, 'concepts.json')) ? readJson(`${map}/concepts.json`) : { concepts: [], relations: [] };
const flows = glob(`${map}/flows/*.json`).map((p) => {
  const f = readJson(p);
  if (!f.name || !Array.isArray(f.steps)) throw new Error(`${p}: { name, steps: [...] } 모양이 아니다`);
  return f;
});

// PR 이 고친 파일 — 액션은 gh pr diff 결과를 PROBER_CHANGED_FILE 로 준다. 로컬은 merge-base 로. 못 구하면 전부 비교
function changedPaths() {
  if (process.env.PROBER_CHANGED_FILE && fs.existsSync(process.env.PROBER_CHANGED_FILE))
    return fs.readFileSync(process.env.PROBER_CHANGED_FILE, 'utf8').split('\n').filter(Boolean);
  const base = process.env.BASE_BRANCH || 'main';
  const mb = git('merge-base', `origin/${base}`, 'HEAD');
  return mb ? git('diff', '--name-only', `${mb}...HEAD`).split('\n').filter(Boolean) : undefined;
}

const remote = git('remote', 'get-url', 'origin').match(/[:/]([^/:]+\/[^/]+?)(\.git)?$/)?.[1];
const body = {
  repo: process.env.GITHUB_REPOSITORY || remote,
  branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || git('branch', '--show-current'),
  baseBranch: process.env.BASE_BRANCH || 'main',
  sha: process.env.HEAD_SHA || process.env.GITHUB_SHA || git('rev-parse', 'HEAD'),
  ...(process.env.PR_NUMBER ? { pr: Number(process.env.PR_NUMBER) } : {}),
  concepts: concepts.concepts ?? [],
  relations: concepts.relations ?? [],
  flows,
  docs,
  ...(changedPaths() ? { changed: changedPaths() } : {}),
  ...(args.includes('--dry-run') ? { dryRun: true } : {}),
};

if (args.includes('--print')) {
  console.log(JSON.stringify({ ...body, docs: body.docs.map((d) => ({ path: d.path, bytes: d.body.length })) }, null, 2));
  process.exit(0);
}

(async () => {
  const api = (process.env.PROBER_API || 'https://api.prober.im').replace(/\/$/, '');
  const res = await fetch(`${api}/teams/${process.env.PROBER_PROJECT}/schema/knowledge`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.PROBER_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.log(`::error::Prober 가 ${res.status} 로 거절 — ${text.slice(0, 300)}`);
    process.exit(1);
  }
  const out = JSON.parse(text);
  for (const w of out.warnings) console.log(`::warning::${w}`);
  const c = out.counts;
  console.log(`${out.saved ? '올렸다' : '검사만 했다'} — 개념 ${c.concepts} · 선언 관계 ${c.relations} · 흐름 ${c.flows} · 문서 ${c.docs}(테이블과 이어짐 ${c.linkedDocs}) · 경고 ${out.warnings.length}`);
  // PR 이면 기준 브랜치와 견준 코멘트 본문이 온다 — 액션 다음 스텝이 PR 에 단다 (로컬 --dry-run 은 화면에)
  if (out.comment) {
    fs.writeFileSync('knowledge-comment.md', out.comment);
    if (args.includes('--dry-run')) console.log(`\n${out.comment}`);
  }
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Prober 위층 · ${body.repo}\n\n개념 ${c.concepts} · 흐름 ${c.flows} · 문서 ${c.docs} (테이블과 이어짐 ${c.linkedDocs})\n\n${out.warnings.map((w) => `- ⚠️ ${w}`).join('\n')}\n`);
})().catch((e) => {
  console.log(`::error::${e.message}`);
  process.exit(1);
});
