import type { ReactNode } from 'react';

/**
 * 가로로 끝없이 흐르는 띠. 같은 목록을 두 번 이어 붙이고 절반만큼 움직여 이음매를 감춘다.
 * 마우스를 올리면 멈추고, 움직임 줄이기 설정이면 흐르지 않는다(globals.css `.marquee`).
 * 서버 컴포넌트 — JS 없이 CSS 애니메이션만 쓴다.
 */
export function Marquee({
  children,
  seconds = 40,
  reverse = false,
  label,
}: {
  children: ReactNode;
  /** 한 바퀴 시간. 항목이 많을수록 길게 */
  seconds?: number;
  reverse?: boolean;
  /** 스크린리더용 이름 — 복제본은 숨긴다 */
  label: string;
}) {
  return (
    <div className='marquee' role='region' aria-label={label}>
      <div
        className='marquee-track'
        style={{ animationDuration: `${seconds}s`, animationDirection: reverse ? 'reverse' : 'normal' }}
      >
        <div className='marquee-group'>{children}</div>
        <div className='marquee-group' aria-hidden='true'>
          {children}
        </div>
      </div>
    </div>
  );
}
