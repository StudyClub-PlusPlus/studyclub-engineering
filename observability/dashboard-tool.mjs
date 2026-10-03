#!/usr/bin/env node
// 대시보드 JSON 의 불변식을 한 파일에 둔다. 두 모드가 같은 규칙을 공유하므로
// "lint 가 통과시키는 것"과 "normalize 가 만드는 것"이 어긋나지 않는다.
//
//   node observability/dashboard-tool.mjs --lint observability/dashboards/*.json
//   node observability/dashboard-tool.mjs --normalize < raw-export.json > committed.json
//
// 왜 필요한가 — Grafana 에서 export 한 JSON 을 그냥 커밋하면 다음이 조용히 깨진다.
// import 는 200 으로 성공하고 대시보드도 목록에 보이는데 패널만 비어서, 필요한 날 처음 안다.
//
//   1) datasource uid 가 그 인스턴스 값으로 박힌다 (studyclub-metrics: 39곳)
//   2) datasource: null 은 "조직 기본 데이터소스"로 늦게 해석된다
//      (studyclub-logs 는 stage 에서 Loki 가 기본이라 우연히 돌고 있었다.
//       기본이 Prometheus 인 Grafana 에서는 LogQL 을 Prometheus 에 던진다)
//   3) 숫자 id 는 인스턴스 로컬 값이라 남겨두면 엉뚱한 대시보드를 덮거나 404
//
// UI 편집은 **열어 둔다**(editable: true). Grafana 에서 고쳐 보고 확인한 다음 export 해서
// PR 을 올리는 게 실제 작업 흐름이기 때문이다. 대신 "고치고 export 를 안 하면 다음
// provisioning 에 덮인다" 는 위험이 남으므로, drift 검사(README §정본과 실물이 같은지)가
// 그 안전장치다. editable 값 자체는 true 로 고정한다 — 환경마다 달라지면 왕복 diff 가 흔들린다.

import { readFileSync } from 'node:fs'

const DS_VAR = 'datasource'
const DS_REF = `\${${DS_VAR}}`

// Grafana 내장 변수. 선언 없이 써도 되는 것들.
const BUILTIN_VARS = new Set([
  '__interval', '__interval_ms', '__rate_interval', '__auto', '__auto_interval',
  '__range', '__range_s', '__range_ms', '__from', '__to', '__timeFilter',
  '__all', '__dashboard', '__org', '__user', '__name', '__field', '__series', '__value',
])

// text 패널은 쿼리를 안 돌리므로 datasource 를 요구하지 않는다.
const DATASOURCE_FREE_PANELS = new Set(['text', 'dashlist', 'news', 'row'])

const deepSort = (v) =>
  Array.isArray(v) ? v.map(deepSort)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, deepSort(v[k])]))
    : v

const render = (d) => JSON.stringify(deepSort(d), null, 2) + '\n'

/** 패널 트리를 순회한다. 중첩 row 안의 패널까지 본다. */
function* eachPanel(dash) {
  const stack = [...(dash.panels ?? [])]
  while (stack.length) {
    const p = stack.pop()
    yield p
    if (p?.panels) stack.push(...p.panels)
  }
}

/** 이 대시보드가 쓰는 datasource 타입들. */
function datasourceTypes(dash) {
  const types = new Set()
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object') return
    const ds = n.datasource
    if (ds && typeof ds === 'object' && ds.type && ds.type !== 'datasource') types.add(ds.type)
    Object.values(n).forEach(walk)
  }
  walk(dash)
  return [...types]
}

// ---------------------------------------------------------------- normalize

function normalize(raw) {
  const dash = raw.dashboard ?? raw
  const types = datasourceTypes(dash)

  // ponytail: 대시보드 하나에 타입이 섞이면 datasource 변수도 타입별로 나뉘어야 한다.
  // 지금 두 대시보드는 각각 단일 타입이라 여기서 막고, 섞이는 날 변수를 늘린다.
  if (types.length > 1) {
    throw new Error(
      `datasource 타입이 ${types.length}개 섞여 있다 (${types.join(', ')}). ` +
      `타입별 변수(datasource_loki 등)로 나눠야 한다 — 이 도구는 아직 단일 타입만 다룬다.`,
    )
  }
  const type = types[0]
  if (!type) throw new Error('datasource 타입을 못 찾았다 — 쿼리 패널이 없는 대시보드인가?')

  delete dash.version     // provisioning 은 overwrite: true 로 올리므로 버전 비교가 필요 없다
  delete dash.meta
  dash.id = null          // 인스턴스 로컬 값
  dash.editable = true    // Grafana 에서 고쳐 보고 → export → PR 이 실제 흐름이다

  // datasource 변수 보장 (없으면 맨 앞에 넣는다)
  dash.templating ??= { list: [] }
  dash.templating.list ??= []
  if (!dash.templating.list.some((v) => v.name === DS_VAR)) {
    dash.templating.list.unshift({
      name: DS_VAR,
      label: '데이터소스',
      type: 'datasource',
      query: type,
      current: {},  // 비워 두면 import 시점에 해당 타입의 기본값으로 붙는다
      hide: 0,
      refresh: 1,
      regex: '',
      skipUrlSync: false,
    })
  }

  // 모든 datasource 참조를 변수로 교체한다. null 도 명시값으로 바꾼다 —
  // "조직 기본값" 에 기대는 것이 2번 함정이다.
  const pin = (holder) => {
    if (!holder || typeof holder !== 'object') return
    if ('datasource' in holder || holder.targets) {
      holder.datasource = { type, uid: DS_REF }
    }
    for (const t of holder.targets ?? []) {
      if (t && typeof t === 'object') t.datasource = { type, uid: DS_REF }
    }
  }
  for (const p of eachPanel(dash)) {
    if (DATASOURCE_FREE_PANELS.has(p?.type)) {
      delete p.datasource
      continue
    }
    pin(p)
  }
  // 쿼리 변수도 데이터소스를 쓴다 (logs 의 app 변수가 그렇다)
  for (const v of dash.templating.list) {
    if (v.type === 'query') v.datasource = { type, uid: DS_REF }
  }
  for (const a of dash.annotations?.list ?? []) {
    if (a.datasource && a.datasource.type !== 'datasource' && a.builtIn !== 1) {
      a.datasource = { type, uid: DS_REF }
    }
  }
  return dash
}

// --------------------------------------------------------------------- lint

function lint(path) {
  const text = readFileSync(path, 'utf8')
  const dash = JSON.parse(text)
  const fail = []
  const name = path.split('/').pop().replace(/\.json$/, '')

  if (dash.id !== null) fail.push(`id 가 null 이 아니다 (${JSON.stringify(dash.id)}) — 인스턴스 로컬 값이라 엉뚱한 대시보드를 덮는다`)
  if (dash.editable !== true) fail.push(`editable 이 true 가 아니다 — Grafana 에서 고쳐 보고 export 하는 흐름이 막힌다 (값이 환경마다 다르면 왕복 diff 도 흔들린다)`)
  if ('version' in dash) fail.push(`version 키가 남아 있다 — overwrite 로 올리므로 지운다`)
  if (!dash.uid) fail.push(`uid 가 없다`)
  else if (dash.uid !== name) fail.push(`uid(${dash.uid}) 와 파일명(${name}) 이 다르다 — 링크를 추적할 수 없다`)

  const dsVar = (dash.templating?.list ?? []).find((v) => v.name === DS_VAR)
  if (!dsVar) fail.push(`templating 에 "${DS_VAR}" 변수가 없다 — 패널이 특정 인스턴스에 묶인다`)
  else if (dsVar.type !== 'datasource') fail.push(`"${DS_VAR}" 변수의 type 이 datasource 가 아니다 (${dsVar.type})`)

  // 1·2번 함정: 박힌 uid · 늦게 해석되는 null
  const walk = (n, where) => {
    if (Array.isArray(n)) return n.forEach((v, i) => walk(v, `${where}[${i}]`))
    if (!n || typeof n !== 'object') return
    if ('datasource' in n) {
      const ds = n.datasource
      const panelish = n.type && DATASOURCE_FREE_PANELS.has(n.type)
      if (ds === null || ds === undefined) {
        if (!panelish) fail.push(`${where}: datasource 가 null — 조직 기본 데이터소스로 늦게 해석된다. "${DS_REF}" 로 명시할 것`)
      } else if (typeof ds === 'string') {
        fail.push(`${where}: datasource 가 문자열(${ds}) — 이름 참조는 환경마다 깨진다`)
      } else if (ds.type === 'datasource') {
        // 변수 자체를 가리키는 특수 형태는 통과
      } else if (ds.uid !== DS_REF) {
        fail.push(`${where}: datasource.uid 가 박혀 있다 (${ds.uid}) — 다른 Grafana 에서 패널이 빈다`)
      }
    }
    Object.entries(n).forEach(([k, v]) => walk(v, `${where}.${k}`))
  }
  walk(dash, 'dashboard')

  // 선언 안 된 변수 참조 — 치환 누락과 변수명 오타를 같이 잡는다.
  // (알림 YAML 의 "$VAR 잔류 검사" 에 대응하는 대시보드 쪽 검사. Grafana 는
  //  모르는 변수를 그냥 빈 문자열로 렌더해서 경고를 안 낸다)
  const declared = new Set((dash.templating?.list ?? []).map((v) => v.name))
  const unknown = new Set()
  for (const m of text.matchAll(/\$(?:\{(\w+)[^}]*\}|(\w+))/g)) {
    const v = m[1] ?? m[2]
    if (!declared.has(v) && !BUILTIN_VARS.has(v)) unknown.add(v)
  }
  for (const v of unknown) fail.push(`선언 안 된 변수 참조: $${v} — templating 에 없고 내장 변수도 아니다 (오타이거나 치환 누락)`)

  // 커밋된 형태가 normalize 결과와 같은가 (export → normalize → diff 0 을 보장)
  if (render(JSON.parse(text)) !== text) {
    fail.push(`정규화 형태가 아니다 — \`--normalize\` 를 거쳐 커밋할 것 (키 정렬 · 2칸 들여쓰기)`)
  }
  return fail
}

// --------------------------------------------------------------------- main

const [mode, ...rest] = process.argv.slice(2)

if (mode === '--normalize') {
  process.stdout.write(render(normalize(JSON.parse(readFileSync(0, 'utf8')))))
} else if (mode === '--lint') {
  if (!rest.length) {
    console.error('대상 파일이 없다. observability/dashboards/*.json 이 비어 있나?')
    process.exit(1)
  }
  let bad = 0
  for (const p of rest) {
    const fail = lint(p)
    if (fail.length) {
      bad++
      console.error(`\n✕ ${p}`)
      for (const f of fail) console.error(`   · ${f}`)
    } else {
      console.log(`✓ ${p}`)
    }
  }
  if (bad) {
    console.error(`\n${bad}개 파일이 규칙을 어겼다. 위 항목은 전부 "Grafana 가 에러 없이 받아주는" 종류다.`)
    process.exit(1)
  }
  console.log(`\n${rest.length}개 파일 통과`)
} else {
  console.error(`사용법:
  node observability/dashboard-tool.mjs --lint observability/dashboards/*.json
  node observability/dashboard-tool.mjs --normalize < raw-export.json > dashboards/<uid>.json`)
  process.exit(2)
}
