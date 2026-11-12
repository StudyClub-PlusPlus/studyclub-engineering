'use client';

import { useEffect, useRef, useState } from 'react';

import { COMBO_FLAG } from './PlusPlusCombo';

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
    if (ctxRef.current) return true;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    await ctx.resume().catch(() => {});
    if (ctx.state !== 'running') {
      // 사용자 동작 없이 왔으면 브라우저가 막는다 — 재생 버튼을 기다린다
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

  useEffect(() => {
    let combo = false;
    let off = false;
    try {
      combo = sessionStorage.getItem(COMBO_FLAG) === '1';
      sessionStorage.removeItem(COMBO_FLAG);
      off = localStorage.getItem(OFF_KEY) === '1';
    } catch {
      // 저장소가 막힌 브라우저(사생활 보호 모드)면 기억만 못 한다
    }
    if (combo && !off) void start();
    // start 는 매 렌더 새로 만들어지지만 처음 한 번만 시도하면 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    try {
      if (playing) localStorage.setItem(OFF_KEY, '1');
      else localStorage.removeItem(OFF_KEY);
    } catch {
      // 저장소가 막힌 브라우저(사생활 보호 모드)면 기억만 못 한다
    }
    if (playing) stop();
    else void start();
  };

  return (
    <div className='flex items-center gap-3 border-[3px] border-[#282A43] bg-[#FFF9EE] py-1.5 pr-2 pl-3.5'>
      <div className='flex h-6 w-[30px] items-end gap-[3px]' aria-hidden='true'>
        {[0, 0.2, 0.4, 0.1, 0.3].map((d) => (
          <div
            key={d}
            className='w-1 bg-[#3A4BB0]'
            style={playing ? { animation: `credits-eq 0.8s ${d}s infinite ease-in-out`, height: 12 } : { height: 4 }}
          />
        ))}
      </div>
      <div className='flex min-w-0 flex-col gap-0.5'>
        <div className='font-pixel text-[9px] text-[#3A4BB0]'>{playing ? 'NOW PLAYING' : 'PAUSED'}</div>
        <div className='text-[13px] font-medium'>스터디클럽 테마 · 8비트 오리지널</div>
      </div>
      <button
        type='button'
        onClick={toggle}
        aria-label={playing ? 'BGM 일시정지' : 'BGM 재생'}
        className='flex size-11 cursor-pointer items-center justify-center border-[3px] border-[#282A43] bg-[#FF805C] p-0 shadow-[3px_3px_0_#282A43] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
      >
        {playing ? (
          <svg width='18' height='18' viewBox='0 0 24 24' fill='#282A43' aria-hidden='true'>
            <rect x='5' y='4' width='5' height='16' />
            <rect x='14' y='4' width='5' height='16' />
          </svg>
        ) : (
          <svg width='18' height='18' viewBox='0 0 24 24' fill='#282A43' aria-hidden='true'>
            <path d='M6 4l14 8-14 8z' />
          </svg>
        )}
      </button>
    </div>
  );
}
