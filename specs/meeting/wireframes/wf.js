// 회차 설정 와이어프레임 공용 — 백오피스 셸과 월 달력을 그린다.
// 예시 데이터: 시스템 디자인 1기 · 목요일반 · 매주 목 20:00~22:00 · 10/1 부터 8회 · 오늘 10/20(화).
const WF = {
  pad: (n) => String(n).padStart(2, '0'),
  key: (y, m, d) => `${y}-${WF.pad(m)}-${WF.pad(d)}`,

  shell(tab = '회차') {
    const tabs = ['크루', '회차', '출석', '정보']
      .map((t) => `<span class="${t === tab ? 'on' : ''}">${t}${t === '회차' ? ' <span class="bdg new">신규</span>' : ''}</span>`)
      .join('');
    return `
      <div class="shell-top"><span class="crumb">스터디 운영 ›</span><h1>시스템 디자인 1기</h1>
        <span class="bdg lv" style="font-size:12px;padding:2px 8px">진행중</span></div>
      <div class="tabs">${tabs}</div>`;
  },

  toolbar(label = '2026년 10월', right = '') {
    return `
      <div class="toolbar">
        <span class="sel">반: 목요일반 ▾</span>
        <span class="btn ghost">◀</span><span class="month">${label}</span><span class="btn ghost">▶</span>
        <span class="btn">오늘</span>
        <span class="sp"></span>
        <span class="seg"><span class="on">달력</span><span>목록</span></span>
        ${right || '<span class="btn">선택</span><span class="btn pri">+ 반복 일정</span>'}
      </div>`;
  },

  // chips: { 'YYYY-MM-DD': [{ cls, text, badges: [['chg','변경']], id }] }
  cal(y, m, { today = '2026-10-20', chips = {}, cellClass = {} } = {}) {
    const first = new Date(Date.UTC(y, m - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7; // 월요일 시작
    const start = new Date(Date.UTC(y, m - 1, 1 - offset));
    const head = ['월', '화', '수', '목', '금', '토', '일'].map((d) => `<th>${d}</th>`).join('');
    let rows = '';
    for (let w = 0; w < 6; w++) {
      let cells = '';
      for (let i = 0; i < 7; i++) {
        const d = new Date(start.getTime() + (w * 7 + i) * 86400000);
        const k = WF.key(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        const out = d.getUTCMonth() !== m - 1;
        const cls = [out ? 'out' : '', k === today ? 'today' : '', cellClass[k] || ''].join(' ');
        const cs = (chips[k] || [])
          .map((c) => {
            const b = (c.badges || []).map(([t, l]) => `<span class="bdg ${t}">${l}</span>`).join('');
            return `<span class="chip ${c.cls || ''}" ${c.id ? `id="${c.id}"` : ''}>${c.text}${b}</span>`;
          })
          .join('');
        cells += `<td class="${cls}"><span class="dn">${d.getUTCDate()}</span>${cs}</td>`;
      }
      rows += `<tr>${cells}</tr>`;
      const next = new Date(start.getTime() + (w + 1) * 7 * 86400000);
      if (next.getUTCMonth() !== m - 1 && next > first) break;
    }
    return `<table class="cal"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  },

  // 기본 반복 일정 8회 — 오늘(10/20) 기준 상태
  base() {
    return {
      '2026-10-01': [{ cls: 'closed', text: '✓ 1회 20:00' }],
      '2026-10-08': [{ cls: 'closed', text: '✓ 2회 20:00' }],
      '2026-10-15': [{ cls: 'closed', text: '✓ 3회 20:00' }],
      '2026-10-22': [{ text: '<span class="ic">↻</span>4회 20:00', badges: [['lv', '휴가 1']], id: 'm4' }],
      '2026-10-29': [{ text: '<span class="ic">↻</span>5회 20:00', id: 'm5' }],
      '2026-10-31': [{ cls: 'single', text: '6회 14:00 특강', id: 'sp' }],
    };
  },

  side(extra = '') {
    return `
      <aside class="side">
        <h3>반복 일정</h3>
        <div class="card"><div class="t">↻ 매주 목 20:00~22:00</div>
          <div class="m">10/1 ~ 11/19 · 8회 · 남은 5회</div>
          <div class="acts"><span class="btn">수정</span><span class="btn">끝내기</span></div></div>
        <h3>단건 회차</h3>
        <div class="card"><div class="t">10/31(토) 14:00 특강</div><div class="m">반복 없음</div></div>
        <h3>반 설정</h3>
        <div class="note">시간대 <b>Asia/Seoul</b> · 출석 방식 <b>체크인</b><br/>크루 7명</div>
        ${extra}
      </aside>`;
  },

  legend() {
    return `<div class="legend">
      <span><span class="chip">↻ 예정</span></span>
      <span><span class="chip open">열림</span></span>
      <span><span class="chip closed">✓ 닫힘</span></span>
      <span><span class="chip">예외<span class="bdg chg">변경</span></span></span>
      <span><span class="chip ghost">원래 자리</span></span>
      <span><span class="chip canceled">휴강</span></span>
      <span><span class="chip single">단건</span></span>
      <span><span class="chip preview">미리보기</span></span>
      <span style="margin-left:auto">시각은 반 시간대(Asia/Seoul) 기준</span>
    </div>`;
  },
};
