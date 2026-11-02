// 이 기기의 웹 푸시 상태와 구독·해제 (specs/web-push/spec.md).
// 브라우저 API 를 부르는 곳은 여기뿐이다. 화면은 상태 값만 보고 그린다.
import { z } from 'zod';

import { emptyResponseSchema, http } from '@/lib/http';

const SW_URL = '/sw.js';
const SW_SCOPE = '/push/';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const configSchema = z.object({ enabled: z.boolean(), publicKey: z.string().nullable() });

/**
 * - `unsupported`: 이 브라우저는 웹 푸시가 없다 (카카오톡 안 브라우저 등)
 * - `needs-install`: iPhone·iPad 인데 홈 화면 앱으로 열지 않았다. 설치해야 받을 수 있다
 * - `off`: 서버가 웹 푸시를 꺼 두었다
 * - `denied`: 사용자가 알림을 차단했다. 브라우저 설정에서만 풀 수 있다
 * - `ready`: 받을 수 있다. 아직 켜지 않았다
 * - `on`: 이 기기에서 받는 중
 */
export type PushState = 'unsupported' | 'needs-install' | 'off' | 'denied' | 'ready' | 'on';

export function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 는 맥으로 자신을 소개한다 — 터치 지원으로 가른다
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  return registration ? registration.pushManager.getSubscription() : null;
}

let config: Promise<z.infer<typeof configSchema>> | null = null;
const fetchConfig = () => (config ??= http('/api/web-push/config', configSchema));

export async function readPushState(): Promise<PushState> {
  if (isIos() && !isStandalone()) return 'needs-install';
  if (!supported()) return 'unsupported';
  const { enabled } = await fetchConfig();
  if (!enabled) return 'off';
  if (Notification.permission === 'denied') return 'denied';
  return (await currentSubscription()) && Notification.permission === 'granted' ? 'on' : 'ready';
}

/** 반드시 버튼 클릭 안에서 부른다 — 브라우저(특히 iOS)는 사용자 동작 없이 권한을 묻지 못하게 한다. */
export async function turnOn(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'ready';
  const { publicKey } = await fetchConfig();
  if (!publicKey) return 'off';
  const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(publicKey),
    }));
  const json = subscription.toJSON();
  await http('/api/me/web-push-subscription', emptyResponseSchema, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  return 'on';
}

export async function turnOff(): Promise<PushState> {
  const subscription = await currentSubscription();
  if (subscription) {
    // 서버를 먼저 지운다 — 브라우저만 끊고 서버가 남으면 실패 기록만 쌓인다
    await http('/api/me/web-push-subscription', emptyResponseSchema, {
      method: 'DELETE',
      headers: JSON_HEADERS,
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  }
  return 'ready';
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
