import { AppShell } from '@console/components/AppShell';

/**
 * 운영 콘솔 셸.
 *
 * `data-app="console"` 는 밀도 오버라이드(라운딩·행높이·15px)의 스코프 앵커다.
 * 원본 앱은 이걸 <body> 에 달지만, 여기는 사용자 사이트 프로토와 한 문서를 쓰므로
 * body 에 달면 사용자 사이트까지 콘솔 밀도로 조여진다. 콘솔 구간에만 건다.
 */
export default function ConsoleProtoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app='console'>
      <AppShell>{children}</AppShell>
    </div>
  );
}
