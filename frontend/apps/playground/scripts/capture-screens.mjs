/**
 * 프로토 화면 캡처 → Story 폴더 → PR 본문.
 *
 * 프로토 PR 은 리뷰어가 playground 를 띄우지 않고도 화면을 보게 캡처를 싣는다. 캡처는 손으로 찍지 않는다 —
 * 같은 목록으로 다시 찍을 수 있어야 화면이 바뀐 뒤에도 그림이 따라온다.
 *
 *   pnpm --filter playground capture-screens <목록.json>           # 찍어서 저장
 *   pnpm --filter playground capture-screens <목록.json> --md      # 찍고 PR 본문용 마크다운도 출력
 *   pnpm --filter playground capture-screens <목록.json> --md-only # 다시 찍지 않고 마크다운만
 *   … --only a,b                                                  # 이름이 a·b 인 것만 다시 찍기
 *
 * 목록(JSON, 레포 루트 기준 경로) — 보통 `01-planning/stories/{story}/screens/shots.json`:
 *   {
 *     "shots": [
 *       {
 *         "story": "crew-write-meeting-retro",      // 저장 위치 01-planning/stories/{story}/screens/
 *         "name": "retro-tab",                       // 파일 이름 {name}.png
 *         "title": "회고 탭 — 작성자별",               // PR 본문 캡션
 *         "path": "/proto/core/ko/my/joined/18/schedule/retro",
 *         "viewport": "desktop",                     // desktop(1280×900) · mobile(390×844)
 *         "fullPage": false,                         // 기본 false — 첫 화면만
 *         "click": ["문항별"],                        // 찍기 전에 누를 버튼·링크의 글자 (순서대로)
 *         "scrollTo": "[data-anno=\"retros:3\"]",     // 찍기 전에 이 요소를 화면 가운데로
 *         "scrollLeft": { "selector": "...", "px": 600 }, // 가로 스크롤 상자를 민다
 *         "annotate": false                          // true 면 번호 주석을 켜고 찍는다
 *       }
 *     ]
 *   }
 *
 * 로그인: 사용자 사이트·콘솔 모두 예시 계정(example.com)을 브라우저 저장소에 넣고 들어간다. PUBLIC 레포라
 * 캡처에 실제 이름·메일이 찍히면 안 된다 — 목 데이터와 예시 계정만 쓴다.
 *
 * 서버: `--base` (기본 http://localhost:4702) 가 응답하지 않으면 `next dev` 를 띄우고 끝나면 내린다.
 * 브라우저: 설치된 Chrome 을 쓴다 (`CAPTURE_CHROME` 으로 실행 파일 경로를 바꿀 수 있다).
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(import.meta.dirname, '..');
const REPO = path.resolve(ROOT, '../../..');

const args = process.argv.slice(2);
const manifestArg = args.find((a) => !a.startsWith('--'));
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

if (!manifestArg) {
  console.error('사용: pnpm --filter playground capture-screens <목록.json> [--md | --md-only] [--base URL]');
  process.exit(1);
}

const manifestPath = path.resolve(REPO, manifestArg);
const only = opt('only', '').split(',').filter(Boolean);
const { shots: allShots } = JSON.parse(readFileSync(manifestPath, 'utf8'));
const shots = only.length ? allShots.filter((s) => only.includes(s.name)) : allShots;
const BASE = opt('base', 'http://localhost:4702');
const VIEWPORTS = { desktop: { width: 1280, height: 900 }, mobile: { width: 390, height: 844 } };

const outOf = (shot) => path.join(REPO, '01-planning/stories', shot.story, 'screens', `${shot.name}.png`);

/* ── 서버 ─────────────────────────────────────────────────────────────── */

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Windows 는 shell 로 띄운 pnpm 아래 node 까지 함께 내려야 포트가 풀린다. */
function stop(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // 이미 내려갔다
    }
  } else child.kill();
}

async function ensureServer() {
  if (await reachable(BASE)) return null;
  const port = new URL(BASE).port || '4702';
  console.log(`${BASE} 가 응답하지 않아 next dev 를 띄웁니다…`);
  const child = spawn('pnpm', ['exec', 'next', 'dev', '--webpack', '-p', port], {
    cwd: ROOT,
    shell: process.platform === 'win32',
    stdio: 'ignore',
  });
  for (let i = 0; i < 120; i++) {
    if (await reachable(BASE)) return child;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  stop(child);
  throw new Error(`${BASE} 가 2분 안에 뜨지 않았습니다`);
}

/* ── 찍기 ─────────────────────────────────────────────────────────────── */

const SESSION = {
  sc_user: {
    id: -1001,
    email: 'crew@example.com',
    nickname: '홍길동',
    picture: null,
    role: 'MEMBER',
    onboardingCompletedAt: '2026-01-01T00:00:00Z',
  },
  bo_user: { id: -2001, email: 'captain@example.com', nickname: '캡틴', picture: null, role: 'ADMIN' },
};

/** 화면 위에 뜨는 개발 · 검토 도구(Next 개발 도구, MSW 설정, 주석 켜기 단추)는 숨긴다 — 서비스 화면이 아니고 내용을 가린다. */
const HIDE_DEV_UI = `nextjs-portal, [data-nextjs-toast], [data-next-badge-root],
  button[title="MSW 설정"], button[title="설명 켜기/끄기 (A)"], button[title^="이 화면은 아직 설명이"] { display: none !important; }`;
/** 붙는 헤더 높이만큼 덜 내린다 — 맨 위로 올린 요소가 헤더에 가리지 않게. */
const STICKY_OFFSET = 88;

async function capture(browser, shot) {
  const viewport = VIEWPORTS[shot.viewport ?? 'desktop'];
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });
  await context.addInitScript((session) => {
    for (const [k, v] of Object.entries(session)) {
      if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v));
    }
  }, SESSION);
  const page = await context.newPage();
  await page.goto(new URL(shot.path, BASE).href, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.addStyleTag({ content: HIDE_DEV_UI });
  await page.waitForTimeout(1_500);

  for (const text of shot.click ?? []) {
    const target = page
      .getByRole('button', { name: text, exact: true })
      .or(page.getByRole('link', { name: text, exact: true }))
      .or(page.getByRole('radio', { name: text, exact: true }))
      .or(page.getByRole('tab', { name: text, exact: true }));
    await target.first().click({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
  }
  if (shot.scrollTo) {
    // 요소를 화면 맨 위(붙는 헤더 아래)로 올린다 — 이미 보이는 요소여도 그 아래 내용이 보이게.
    await page
      .locator(shot.scrollTo)
      .first()
      .evaluate(
        (el, offset) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset),
        STICKY_OFFSET,
      );
  }
  if (shot.scrollLeft) {
    await page
      .locator(shot.scrollLeft.selector)
      .first()
      .evaluate((el, px) => (el.scrollLeft = px), shot.scrollLeft.px);
  }
  if (shot.annotate) {
    await page.keyboard.press('a');
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(400);

  // 개발 도구 말풍선은 숨기지만, 오류 창이 떠 있으면 찍지 않고 실패시킨다 — 깨진 화면이 캡처로 올라가면 안 된다.
  const devError = await page.evaluate(() => {
    const text = document.querySelector('nextjs-portal')?.shadowRoot?.textContent ?? '';
    const m = text.match(/(Runtime Error|Build Error|Unhandled Runtime Error|Console Error)[^]{0,120}/);
    return m ? m[0] : null;
  });
  if (devError) throw new Error(`Next 오류 창: ${devError}`);

  const out = outOf(shot);
  mkdirSync(path.dirname(out), { recursive: true });
  if (shot.fullPage) {
    // fullPage 캡처는 붙는 헤더를 이어 붙인 자리마다 다시 찍는다 — 창을 문서 높이로 늘려 한 번에 찍는다.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: viewport.width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: out, animations: 'disabled' });
  await context.close();
  console.log(`  ✓ ${path.relative(REPO, out)}`);
}

/* ── PR 본문 ──────────────────────────────────────────────────────────── */

function markdown(list = allShots) {
  const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
  const remote = git('remote', 'get-url', 'origin')
    .replace(/\.git$/, '')
    .replace(/^git@github\.com:/, 'https://github.com/');
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  const lines = ['## 화면', ''];
  let story = null;
  for (const shot of list) {
    if (shot.story !== story) {
      story = shot.story;
      lines.push(`### ${story}`, '');
    }
    const rel = path.relative(REPO, outOf(shot)).split(path.sep).join('/');
    // 브랜치 기준 주소 — 머지 뒤 브랜치를 지우면 이미지가 깨지므로, 머지 전 리뷰용이다. 머지 뒤에는 PRD 의 상대 경로가 남는다.
    lines.push(
      `**${shot.title ?? shot.name}**`,
      '',
      `![${shot.title ?? shot.name}](${remote}/blob/${branch}/${encodeURI(rel)}?raw=true)`,
      '',
    );
  }
  return lines.join('\n');
}

/* ── 실행 ─────────────────────────────────────────────────────────────── */

if (!flag('md-only')) {
  const server = await ensureServer();
  const executablePath = process.env.CAPTURE_CHROME;
  const browser = await chromium.launch(executablePath ? { executablePath } : { channel: 'chrome' });
  let failed = 0;
  try {
    console.log(`캡처 ${shots.length}장 — ${BASE}`);
    for (const shot of shots) {
      try {
        await capture(browser, shot);
      } catch (e) {
        failed++;
        console.error(`  ✗ ${shot.story}/${shot.name}: ${e.message.split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
    stop(server);
  }
  if (failed) {
    console.error(`실패 ${failed}장 — 조용히 건너뛰지 않는다. 목록을 고치고 다시 찍는다`);
    process.exit(1);
  }
}

if (flag('md') || flag('md-only')) {
  const missing = allShots.filter((s) => !existsSync(outOf(s)));
  if (missing.length) {
    console.error(`캡처가 없는 항목: ${missing.map((s) => s.name).join(', ')}`);
    process.exit(1);
  }
  console.log('\n' + markdown());
}
