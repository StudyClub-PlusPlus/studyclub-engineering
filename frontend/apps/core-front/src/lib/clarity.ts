import { COMMON_PROPS, IS_PRODUCTION } from './amplitude';
import {
  analyticsAllowed,
  analyticsUserId,
  hasLocalAnalyticsOptOut,
  subscribeAnalytics,
} from './analytics-privacy-state';

type Clarity = ((method: string, ...args: unknown[]) => unknown) & { q?: unknown[][]; v?: string };
declare global {
  interface Window {
    clarity?: Clarity;
  }
}

const PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
let connected = false;
let loading = false;
let failed = false;
let sdk: Clarity | undefined;
let running = false;
let owner: string | null | undefined;
let identifying = false;

function allowed(): boolean {
  return (
    connected &&
    analyticsAllowed() &&
    !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl
  );
}

/** 계정 전환 시 이전 회원과 같은 Clarity 브라우저/세션으로 이어지지 않게 한다. */
function clearCookies(): void {
  const host = location.hostname.split('.');
  const domains = ['', ...host.map((_, index) => `; domain=${host.slice(index).join('.')}`)];
  try {
    for (const name of ['_clck', '_clsk']) {
      for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
    }
  } catch {
    // 쿠키 접근 자체가 차단된 브라우저에서도 다른 분석 도구의 중단을 방해하지 않는다.
  }
  try {
    sessionStorage.removeItem('_cltk');
  } catch {
    // 저장소 사용이 막혀 있어도 SDK 중단은 수행한다.
  }
}

function stop(): void {
  if (running && sdk) {
    running = false;
    // stop은 기존 버퍼를 마지막으로 전송할 수 있다. 신규 행동 수집을 종료하는 호출이다.
    sdk('stop');
  }
  // 로딩 중에는 ready 콜백을 보존한다. SDK가 도착하면 최신 상태로 즉시 중단한다.
  if (sdk && window.clarity?.q) window.clarity.q.length = 0;
  if (hasLocalAnalyticsOptOut()) clearCookies();
}

function identify(): void {
  if (!sdk || !running || !allowed()) return;
  const nextOwner = analyticsUserId();
  if (nextOwner !== null) {
    const result = sdk('identify', nextOwner);
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      identifying = true;
      void Promise.resolve(result).then(
        () => {
          identifying = false;
          if (!running) update();
        },
        () => {
          identifying = false;
          failed = true;
          stop();
        },
      );
    }
  }
  sdk('set', 'service', COMMON_PROPS.service);
  sdk('set', 'env', COMMON_PROPS.env);
  owner = nextOwner;
}

function update(): void {
  if (!allowed()) {
    stop();
    return;
  }
  if (failed) return;
  if (!sdk) {
    if (loading || !PROJECT_ID) return;
    loading = true;
    const stub: Clarity = (method, ...args) => {
      (stub.q ??= []).push([method, ...args]);
    };
    window.clarity = stub;
    // 공개 태그는 start를 큐 맨 앞에 둔다. 시작 직후 회원 명령보다 먼저 최신 허용 상태를 확인한다.
    stub(
      'metadata',
      () => {
        sdk = window.clarity;
        loading = false;
        running = true;
        if (!allowed()) stop();
        else identify();
      },
      false,
    );
    const script = document.createElement('script');
    script.id = 'clarity-init';
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${PROJECT_ID}`;
    script.onerror = () => {
      failed = true;
      loading = false;
      stop();
    };
    document.head.appendChild(script);
    return;
  }
  const nextOwner = analyticsUserId();
  if (owner !== undefined && owner !== nextOwner) {
    stop();
    clearCookies();
  }
  if (!running) {
    // identify의 비동기 해시가 끝나기 전에 다른 세션을 켜면 이전 ID가 새 세션에 기록될 수 있다.
    // SDK가 멈춘 상태에서 이전 호출을 마치게 한 뒤 최신 허용 상태로 재시작한다.
    if (identifying) return;
    if (window.clarity?.q) window.clarity.q.length = 0;
    // stop 뒤 window.clarity는 큐 함수가 되므로 저장한 SDK 호출 함수를 사용한다.
    running = true;
    sdk('start');
    identify();
    return;
  }
  if (owner !== nextOwner) identify();
}

/** AnalyticsPrivacy 한 곳에서 연결해 허용 만료·로그아웃·다른 탭의 중단도 반영한다. */
export function connectClarity(): () => void {
  if (!IS_PRODUCTION || !PROJECT_ID || typeof window === 'undefined') return () => {};
  connected = true;
  const unsubscribe = subscribeAnalytics(update);
  update();
  return () => {
    connected = false;
    unsubscribe();
    stop();
  };
}
