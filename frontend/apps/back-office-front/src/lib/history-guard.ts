type Blocker = (resume: () => void) => void;

let blocker: Blocker | null = null;

export function blockHistoryNavigation(next: Blocker) {
  blocker = next;
  return () => {
    if (blocker === next) blocker = null;
  };
}

export function trackHistoryNavigation() {
  const key = 'studyclubHistoryIndex';
  const history = window.history;
  const push = history.pushState;
  const replace = history.replaceState;
  let current = history.state?.[key] ?? 0;
  let restoring = false;
  // 「변경 취소 후 이동」으로 보내는 목적지. popstate 가 안 와도 다음 이동을 막지 못하게 되지 않도록 불리언 대신 위치로 기억한다.
  let resumeTarget: number | null = null;
  let afterRestore: (() => void) | null = null;
  replace.call(history, { ...history.state, [key]: current }, '');
  history.pushState = function (state, unused, url) {
    push.call(this, { ...state, [key]: current + 1 }, unused, url);
    current++;
  };
  history.replaceState = function (state, unused, url) {
    replace.call(this, { ...state, [key]: current }, unused, url);
  };
  // 키 없는 항목은 pushState 를 거치지 않은 해시 이동으로 새로 생긴 것이다. 생기자마자 다음 번호를 붙여 둬야
  // 나중에 그 항목으로 돌아올 때 위치를 셀 수 있다.
  const stampNewEntry = () => {
    if (typeof history.state?.[key] === 'number') return;
    current++;
    replace.call(history, { ...history.state, [key]: current }, '');
  };
  const onPopState = (event: PopStateEvent) => {
    const target = event.state?.[key];
    if (restoring) {
      event.stopImmediatePropagation();
      restoring = false;
      afterRestore?.();
      afterRestore = null;
      return;
    }
    if (typeof target !== 'number') {
      stampNewEntry();
      return;
    }
    const delta = target - current;
    const resuming = resumeTarget === target;
    resumeTarget = null;
    if (blocker && !resuming && delta !== 0) {
      // Next가 화면을 교체하기 전에 원래 history 위치로 돌아간다.
      event.stopImmediatePropagation();
      restoring = true;
      afterRestore = () =>
        blocker?.(() => {
          resumeTarget = target;
          history.go(delta);
        });
      history.go(-delta);
      return;
    }
    current = target;
  };
  // bfcache 로 돌아오면 이전에 보내던 목적지는 의미가 없다.
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) resumeTarget = null;
  };
  window.addEventListener('popstate', onPopState, true);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('hashchange', stampNewEntry);
  return () => {
    history.pushState = push;
    history.replaceState = replace;
    window.removeEventListener('popstate', onPopState, true);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('hashchange', stampNewEntry);
  };
}
