#!/usr/bin/env node
// AGENT.md §개발 규칙 · /prototype 규약의 경고 — PR 을 실패시키지 않고 ::warning:: 만 단다. playground 는 프로토타입이라 테스트 대상에서 뺀다.
//   1) 로직 파일이 바뀌었는데 테스트 파일이 하나도 없다 (규칙 2)
//   2) 추가된 줄의 주석에 버그 번호(bug-<번호>)가 있다 (규칙 1)
//   3) playground 프로토 화면이 바뀌었는데 화면 캡처(01-planning/stories/*/screens/*.png)가 없다 (/prototype §3)
// 사용: node scripts/check-dev-rules.mjs <base> [head]   (기본 head = HEAD, 비교는 base...head)
import { execFileSync } from 'node:child_process';

const [base, head = 'HEAD'] = process.argv.slice(2);
if (!base) {
  console.error('사용: node scripts/check-dev-rules.mjs <base> [head]');
  process.exit(0);
}
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 });

const isTest = (f) => /\/src\/test\//.test(f) || /\.test\.[cm]?[jt]sx?$/.test(f) || /(^|\/)e2e\//.test(f);
const isLogic = (f) =>
  !isTest(f) &&
  !/\.(stories\.[jt]sx?|md|mdx)$/.test(f) &&
  (/^backend\/.*\/src\/main\//.test(f) || (/^frontend\/apps\/[^/]+\/src\//.test(f) && !/^frontend\/apps\/playground\//.test(f)));

const files = git('diff', '--name-only', '--diff-filter=AMR', `${base}...${head}`).split('\n').filter(Boolean);
const logic = files.filter(isLogic);
const tests = files.filter(isTest);
let warned = 0;

if (logic.length > 0 && tests.length === 0) {
  warned++;
  console.log(
    `::warning title=테스트 없는 로직 변경::로직 파일 ${logic.length}개가 바뀌었는데 테스트 파일이 없습니다 (AGENT.md §개발 규칙 2). 테스트가 필요 없는 변경이면 PR 본문에 이유를 적어 주세요. 예: ${logic.slice(0, 3).join(', ')}`,
  );
}

const protoScreens = files.filter((f) => /^frontend\/apps\/playground\/src\/(app\/\(proto\)|proto)\/.*\.tsx$/.test(f));
const captures = files.filter((f) => /^01-planning\/stories\/[^/]+\/screens\/[^/]+\.png$/.test(f));
if (protoScreens.length > 0 && captures.length === 0) {
  warned++;
  console.log(
    `::warning title=프로토 화면 캡처 없음::playground 프로토 화면 ${protoScreens.length}개가 바뀌었는데 화면 캡처가 없습니다 (/prototype §3). \`pnpm --filter playground capture-screens <shots.json> --md\` 로 찍어 01-planning/stories/{story}/screens/ 에 넣고 PR 본문 「화면」 절에 붙여 주세요. 화면 모양이 그대로인 변경이면 본문에 이유를 적어 주세요.`,
  );
}

const COMMENT_BUG = /(\/\/|\/\*|^\s*\*|#|<!--|\{\/\*).*\bbug-\d+/i;
let file = null;
let line = 0;
for (const l of git('diff', '-U0', '--diff-filter=AMR', `${base}...${head}`).split('\n')) {
  if (l.startsWith('+++ ')) {
    file = l.startsWith('+++ b/') ? l.slice(6) : null;
    continue;
  }
  const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
  if (h) {
    line = Number(h[1]);
    continue;
  }
  if (!file || /\.(md|mdx)$/.test(file)) continue;
  if (l.startsWith('+')) {
    if (COMMENT_BUG.test(l.slice(1))) {
      warned++;
      console.log(`::warning file=${file},line=${line},title=주석에 버그 번호::버그 번호·작업 이력은 주석에 쓰지 않습니다 (AGENT.md §개발 규칙 1). PR · 커밋 메시지에 남겨 주세요.`);
    }
    line++;
  }
}

console.log(warned ? `경고 ${warned}건 (실패시키지 않음)` : '경고 없음');
