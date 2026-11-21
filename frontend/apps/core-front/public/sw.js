// 웹 푸시 수신 전용 서비스 워커 (specs/web-push/spec.md).
// 범위(scope)를 /push/ 로 좁혀 등록한다 — 개발 모드의 MSW 워커(scope /)와 겹치지 않고, 페이지 요청은 가로채지 않는다.
// 푸시는 범위와 상관없이 이 워커로 온다.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'StudyClub', {
      body: data.body || '',
      icon: '/icon.png',
      badge: '/icon.png',
      data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/' },
    }),
  );
});

// 알림을 누르면 이미 열린 창이 있으면 그 창을, 없으면 새 창을 연다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin) && 'focus' in w);
      if (open) return open.navigate(url).then((w) => (w || open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
