'use client';

import { useEffect, useRef, useState } from 'react';

// 직접 만든 8비트 루프 — 외부 음원이 아니라 WebAudio 로 그 자리에서 합성한다(저작권 문제 없음).
// 리드(사각파) + 베이스(삼각파), 140 BPM 8분음표 4마디.
const BPM = 140;
const STEP = 60 / BPM / 2;
const N = (semi: number) => 440 * 2 ** ((semi - 9) / 12); // 0 = C4
const LEAD = [
  0, 4, 7, 12, 11, 7, 4, 7, 2, 5, 9, 14, 12, 9, 5, 9, -1, 2, 7, 11, 9, 7, 5, 4, 0, 4, 7, 12, 16, 14, 12, -99,
];
const BASS = [-24, -24, -17, -17, -22, -22, -15, -15, -29, -29, -22, -22, -24, -24, -17, -24];
const OFF_KEY = 'sc-plusplus-bgm-off';
const VOLUME = 0.4;

function useChiptune() {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const stop = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    ctxRef.current?.close();
    ctxRef.current = null;
    setPlaying(false);
  };

  const start = async () => {
    // 이미 만든 컨텍스트가 있으면 실제로 소리가 나는지로 답한다 (재생 시도가 겹쳐도 성공으로 착각하지 않게)
    if (ctxRef.current) return ctxRef.current.state === 'running';
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    await ctx.resume().catch(() => {});
    if (ctx.state !== 'running') {
      // 사용자 동작 없이 왔으면 브라우저가 막는다 — 첫 동작(Bgm 의 리스너)에서 다시 시도한다
      ctx.close();
      ctxRef.current = null;
      return false;
    }
    const master = ctx.createGain();
    master.gain.value = VOLUME * 0.25;
    master.connect(ctx.destination);
    const note = (freq: number, at: number, len: number, type: OscillatorType, vol: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + len);
      o.connect(g).connect(master);
      o.start(at);
      o.stop(at + len);
    };
    let step = 0;
    let next = ctx.currentTime + 0.05;
    // ponytail: setInterval 룩어헤드 스케줄러 — 탭이 백그라운드면 끊길 수 있다, 필요하면 AudioWorklet 로
    const tick = () => {
      while (next < ctx.currentTime + 0.2) {
        const l = LEAD[step % LEAD.length];
        if (l > -50) note(N(l), next, STEP * 0.9, 'square', 0.5);
        if (step % 2 === 0) note(N(BASS[(step / 2) % BASS.length]), next, STEP * 1.8, 'triangle', 0.9);
        next += STEP;
        step++;
      }
    };
    tick();
    timerRef.current = window.setInterval(tick, 50);
    setPlaying(true);
    return true;
  };

  useEffect(() => stop, []);
  return { playing, start, stop };
}

export function Bgm() {
  const { playing, start, stop } = useChiptune();
  const [blocked, setBlocked] = useState(false);

  // 들어오면 바로 튼다. 브라우저가 소리 자동재생을 막으면 화면 어디든 첫 동작(누르기·키·스크롤)에서 튼다.
  // 직접 일시정지한 적이 있으면(OFF_KEY) 틀지 않는다.
  useEffect(() => {
    let off = false;
    try {
      off = localStorage.getItem(OFF_KEY) === '1';
    } catch {
      // 저장소가 막힌 브라우저(사생활 보호 모드)면 기억만 못 한다
    }
    if (off) return;
    const EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'] as const;
    const onFirst = () => {
      void start().then((ok) => {
        if (!ok) return;
        setBlocked(false);
        EVENTS.forEach((e) => window.removeEventListener(e, onFirst));
      });
    };
    void start().then((ok) => {
      if (ok) return;
      setBlocked(true);
      EVENTS.forEach((e) => window.addEventListener(e, onFirst, { passive: true }));
    });
    return () => EVENTS.forEach((e) => window.removeEventListener(e, onFirst));
    // start 는 매 렌더 새로 만들어지지만 처음 한 번만 걸면 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    try {
      if (playing) localStorage.setItem(OFF_KEY, '1');
      else localStorage.removeItem(OFF_KEY);
    } catch {
      // 저장소가 막힌 브라우저(사생활 보호 모드)면 기억만 못 한다
    }
    setBlocked(false);
    if (playing) stop();
    else void start();
  };

  return (
    <div className='flex items-center gap-3 border-[3px] border-[var(--color-ink)] bg-[var(--arcade-paper)] py-1.5 pr-2 pl-3.5'>
      <div className='flex h-6 w-[30px] items-end gap-[3px]' aria-hidden='true'>
        {[0, 0.2, 0.4, 0.1, 0.3].map((d) => (
          <div
            key={d}
            className='w-1 bg-[var(--arcade-blue-deep)]'
            style={playing ? { animation: `credits-eq 0.8s ${d}s infinite ease-in-out`, height: 12 } : { height: 4 }}
          />
        ))}
      </div>
      <div className='flex min-w-0 flex-col gap-0.5'>
        <div className='font-pixel text-[length:var(--arcade-fs-9)] text-[var(--arcade-blue-deep)]'>{playing ? 'NOW PLAYING' : 'PAUSED'}</div>
        <div className='text-[length:var(--arcade-fs-13)] font-medium'>
          {blocked ? '아무 곳이나 누르면 BGM 이 나와요' : '스터디클럽 테마 · 8비트 오리지널'}
        </div>
      </div>
      <button
        type='button'
        onClick={toggle}
        aria-label={playing ? 'BGM 일시정지' : 'BGM 재생'}
        className='flex size-11 cursor-pointer items-center justify-center border-[3px] border-[var(--color-ink)] bg-[var(--color-highlight)] p-0 shadow-[3px_3px_0_#282A43] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
      >
        {playing ? (
          <svg width='18' height='18' viewBox='0 0 24 24' fill='var(--color-ink)' aria-hidden='true'>
            <rect x='5' y='4' width='5' height='16' />
            <rect x='14' y='4' width='5' height='16' />
          </svg>
        ) : (
          <svg width='18' height='18' viewBox='0 0 24 24' fill='var(--color-ink)' aria-hidden='true'>
            <path d='M6 4l14 8-14 8z' />
          </svg>
        )}
      </button>
    </div>
  );
}
