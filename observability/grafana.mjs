// dashboard-tool.mjs 와 alerting-tool.mjs 가 같이 쓰는 것들.
//
// 왜 따로 뺐나 — 두 도구가 각자 fetch 래퍼를 들고 있으면, 한쪽에서 고친 함정(주소를
// 로그에 안 찍는다, provenance 를 끈다 같은)이 다른 쪽에 안 따라간다. 조용히 갈라진다.

/** 공개 레포라 주소·토큰은 환경변수로만 받는다. 둘 다 Actions Secret. */
export function grafana() {
  const url = (process.env.GRAFANA_URL ?? '').replace(/\/$/, '')
  const token = process.env.GRAFANA_TOKEN ?? ''
  if (!url || !token) {
    console.error('GRAFANA_URL · GRAFANA_TOKEN 이 필요하다 (값은 레포에 없다 — Actions Secret)')
    process.exit(1)
  }
  // 주소를 로그에 찍지 않는다. 공개 레포의 워크플로 로그는 누구나 본다.
  return async (path, init = {}) => {
    const res = await fetch(url + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // 이걸 안 보내면 API 로 올린 규칙·contact point 가 "provisioned" 로 잠겨
        // **UI 에서 수정도 삭제도 안 된다.** 대시보드와 같은 방침(보면서 고친다)을
        // 알림에도 적용하려면 반드시 필요하다. 대시보드 API 는 이 헤더를 무시한다.
        'X-Disable-Provenance': 'true',
        ...(init.headers ?? {}),
      },
    })
    const body = await res.text()
    if (!res.ok) {
      // 응답 본문에 토큰이 되돌아올 수 있으니 길이를 제한하고 그대로는 안 쓴다.
      throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${body.slice(0, 300)}`)
    }
    return body ? JSON.parse(body) : null
  }
}

/** 키를 정렬해 저장한다 — 다시 떠서 diff 할 때 순서 때문에 흔들리지 않게. */
export const deepSort = (v) =>
  Array.isArray(v) ? v.map(deepSort)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, deepSort(v[k])]))
    : v

export const render = (d) => JSON.stringify(deepSort(d), null, 2) + '\n'

/**
 * `${VAR}` 치환. 치환되지 않은 자리가 남으면 **실패시킨다** —
 * Grafana 는 `${DISCORD_BOT_TOKEN}` 같은 문자열을 그냥 받아서 저장하고,
 * 알림이 안 오기 시작할 때까지 아무 신호도 주지 않는다.
 */
export function substitute(text, { allow = [] } = {}) {
  const missing = new Set()
  const out = text.replace(/\$\{([A-Z0-9_]+)\}/g, (whole, name) => {
    const v = process.env[name]
    if (v === undefined || v === '') {
      missing.add(name)
      return whole
    }
    // JSON 문자열 안에 들어가므로 따옴표·역슬래시를 깨뜨리지 않게 이스케이프한다.
    return JSON.stringify(v).slice(1, -1)
  })
  const left = [...missing].filter((m) => !allow.includes(m))
  if (left.length) {
    console.error(`치환할 값이 없다: ${left.map((m) => '${' + m + '}').join(' · ')}`)
    console.error('환경변수(Actions Environment 시크릿)로 넣어야 한다. 값은 레포에 없다.')
    process.exit(1)
  }
  return out
}

/** 파일에 남은 `${VAR}` 자리 목록 (lint 가 선언 목록과 대조한다) */
export const placeholdersIn = (text) =>
  [...new Set([...text.matchAll(/\$\{([A-Z0-9_]+)\}/g)].map((m) => m[1]))].sort()
