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
  let resuming = false;
  let afterRestore: (() => void) | null = null;
  replace.call(history, { ...history.state, [key]: current }, '');
  history.pushState = function (state, unused, url) {
    push.call(this, { ...state, [key]: current + 1 }, unused, url);
    current++;
  };
  history.replaceState = function (state, unused, url) {
    replace.call(this, { ...state, [key]: current }, unused, url);
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
    if (typeof target !== 'number') return;
    const delta = target - current;
    if (blocker && !resuming && delta !== 0) {
      // Next가 화면을 교체하기 전에 원래 history 위치로 돌아간다.
      event.stopImmediatePropagation();
      restoring = true;
      afterRestore = () =>
        blocker?.(() => {
          resuming = true;
          history.go(delta);
        });
      history.go(-delta);
      return;
    }
    resuming = false;
    current = target;
  };
  window.addEventListener('popstate', onPopState, true);
  return () => {
    history.pushState = push;
    history.replaceState = replace;
    window.removeEventListener('popstate', onPopState, true);
  };
}
