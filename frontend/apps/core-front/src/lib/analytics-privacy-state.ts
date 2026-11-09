export const ANALYTICS_OPTOUT_KEY = 'sc_analytics_opt_out';
const GA_STORAGE = 'sc_analytics_ga_client';
const listeners = new Set<() => void>();
let allowed = false;
let optOutStorageFailed = false;
let userId: string | null = null;
let clientId: string | undefined;
let expiresAt = 0;
let googleTagLoaded = false;

export function markGoogleTagLoaded(): void {
  googleTagLoaded = true;
}

let timer: ReturnType<typeof setTimeout> | undefined;

function notify() {
  for (const listener of listeners) listener();
}
export function hasLocalAnalyticsOptOut(): boolean {
  if (optOutStorageFailed) return true;
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ANALYTICS_OPTOUT_KEY) === '1';
  } catch {
    return true;
  }
}
export function analyticsAllowed(): boolean {
  return allowed && Date.now() < expiresAt && !hasLocalAnalyticsOptOut();
}
export function analyticsUserId(): string | null {
  return userId;
}
export function analyticsClientId(): string | undefined {
  return clientId;
}
export function subscribeAnalytics(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function suspendAnalytics(): void {
  allowed = false;
  expiresAt = 0;
  clearTimeout(timer);
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (typeof window !== 'undefined' && measurementId) {
    (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = true;
  }
  if (typeof window !== 'undefined' && !googleTagLoaded) {
    // 외부 스크립트 로딩 전의 이전 계정 명령이 다음 허용 시 전송되지 않게 한다.
    const layer = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
    if (layer) layer.splice(0);
  }
  notify();
}
export function optOutAnalyticsLocally(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ANALYTICS_OPTOUT_KEY, '1');
      localStorage.removeItem('sc_first_touch');
    } catch {
      optOutStorageFailed = true;
    }
  }
  suspendAnalytics();
}
export function allowAnalytics(id: string | null, gaClientId?: string, checkedAt = Date.now()): void {
  if (hasLocalAnalyticsOptOut() || Date.now() >= checkedAt + 45_000) {
    suspendAnalytics();
    return;
  }
  userId = id;
  clientId = gaClientId;
  allowed = true;
  expiresAt = checkedAt + 45_000;
  clearTimeout(timer);
  timer = setTimeout(suspendAnalytics, Math.max(0, expiresAt - Date.now()));
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (measurementId) (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = false;
  notify();
}
/** 계정 전환 때 GA client_id를 회전시켜 다른 회원의 삭제 범위와 섞이지 않게 한다. */
export function ownedGaClientId(owner: string | null): string {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(GA_STORAGE) ?? 'null');
    if (
      saved &&
      typeof saved === 'object' &&
      'owner' in saved &&
      'id' in saved &&
      saved.owner === owner &&
      typeof saved.id === 'string' &&
      /^\d{1,20}\.\d{1,20}$/.test(saved.id)
    )
      return saved.id;
  } catch {
    /* 새 ID */
  }
  const words = crypto.getRandomValues(new Uint32Array(2));
  const id = `${words[0]}.${words[1]}`;
  localStorage.setItem(GA_STORAGE, JSON.stringify({ owner, id }));
  return id;
}

/** 로그인 직후 허용 조회를 기다린다. 계정 전환·거부·시간 초과 시 폐기하며 디스크에는 저장하지 않는다. */
export function afterAnalyticsReady(isCurrent: () => boolean, send: () => void): void {
  let finished = false;
  let unsubscribe = () => {};
  const cancel = () => {
    finished = true;
    clearTimeout(timeout);
    unsubscribe();
  };
  const timeout = setTimeout(cancel, 30_000);
  const check = () => {
    if (finished) return;
    if (!isCurrent() || hasLocalAnalyticsOptOut()) {
      cancel();
      return;
    }
    if (analyticsAllowed()) {
      cancel();
      // 허용 알림과 같은 호출 안에서 SDK optOut을 해제한 뒤 실행한다.
      queueMicrotask(() => {
        if (isCurrent() && analyticsAllowed()) send();
      });
    }
  };
  unsubscribe = subscribeAnalytics(check);
  check();
}
