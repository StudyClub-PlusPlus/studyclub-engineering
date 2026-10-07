#!/usr/bin/env node
// 알림 설정(규칙·수신처·라우팅·템플릿)의 불변식을 한 파일에 둔다.
// 대시보드는 dashboard-tool.mjs, 공용 플럼빙은 grafana.mjs.
//
//   node observability/alerting-tool.mjs --lint                  (오프라인)
//   node observability/alerting-tool.mjs --capture               (네트워크: Grafana → 레포)
//   node observability/alerting-tool.mjs --drift                 (네트워크)
//   node observability/alerting-tool.mjs --push                  (네트워크)
//
// 대시보드와 갈리는 점 세 가지
//
//   1) **`${VAR}` 치환을 쓴다.** 대시보드 JSON 에서는 Grafana 자체 변수 문법(`$var`)과
//      충돌해서 못 쓰지만, 알림에는 그 문법이 없다. 그래서 환경차 값을 placeholder 로
//      비우고 CI 가 채운다. 치환이 안 된 자리가 남으면 **실패시킨다** — Grafana 는
//      `${DISCORD_BOT_TOKEN}` 이라는 문자열을 그냥 저장하고, 알림이 안 오기 시작할
//      때까지 아무 신호도 주지 않는다.
//
//   2) **봇 토큰은 Grafana 에서 되읽을 수 없다.** `authorization_credentials` 는
//      `[REDACTED]` 로 내려온다(2026-10-03 실측). 그래서 capture 는 토큰을 가져오지
//      못하고, 레포에는 placeholder 만 남는다. 복원하려면 토큰을 **따로 공급**해야 한다.
//
//   3) **자동 삭제를 넣는다.** 대시보드는 안 넣었다(사람이 만든 사본을 지울 위험).
//      규칙은 반대다 — 레포에서 지운 규칙이 Grafana 에 남으면 `NoData` 로 영구히 떠서
//      **쓰이지 않는 경고가 진짜 경고를 묻는다.** 지울 대상이 "레포에 없는 규칙" 이고,
//      규칙에는 사본 문화가 없다.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { grafana, render, substitute, placeholdersIn } from './grafana.mjs'

const DIR = 'observability/alerting'
const FILES = {
  rules: `${DIR}/rules.json`,
  contactPoints: `${DIR}/contact-points.json`,
  policies: `${DIR}/policies.json`,
  templates: `${DIR}/templates.json`,
}

// 치환으로 채워지는 값들. lint 가 이 목록 밖의 placeholder 를 거부한다.
const DECLARED = ['GRAFANA_URL', 'GRAFANA_ENV', 'DS_PROMETHEUS_UID', 'DS_LOKI_UID', 'DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID']

// 인스턴스마다 달라지는 값. 커밋하면 다른 Grafana 에서 엉뚱한 걸 덮는다.
const INSTANCE_LOCAL = ['id', 'orgID', 'updated', 'provenance']

const SEVERITIES = new Set(['critical', 'warning', 'info'])
const TOKEN_REF = '${DISCORD_BOT_TOKEN}'
const CHANNEL_REF = '${DISCORD_CHANNEL_ID}'
// 알림 메시지에 찍히는 환경 이름. 템플릿이 `.Vars.env` 로 읽는다.
// 레포에 "stage" 로 박혀 있었다 — 그대로 prod 에 올리면 **운영 알림이 stage 라고
// 찍힌다.** 값은 브랜치에서 도출하므로(워크플로) 시크릿이 아니다.
const ENV_REF = '${GRAFANA_ENV}'

const read = (p) => JSON.parse(readFileSync(p, 'utf8'))

/**
 * Grafana provisioning API 는 **비어 있을 때 `[]` 가 아니라 `null`** 을 준다.
 * stage 에는 전부 값이 있어서 안 드러났고, **아무것도 없는 prod 에 처음 올리는 날**
 * `.map()` 에서 터졌다(2026-10-03). 빈 환경이 아니면 영원히 안 보이는 버그다.
 */
const asList = (v) => (Array.isArray(v) ? v : [])
const strip = (o) => { for (const k of INSTANCE_LOCAL) delete o[k]; return o }

/**
 * 목록을 `uid`(없으면 `name`) 순으로 고정한다.
 *
 * Grafana 가 주는 순서는 안정적이지 않다 — 규칙을 지우고 다시 만들면 그룹 끝으로
 * 밀린다. 그대로 비교하면 **내용이 같은데 drift 가 떴다고 한다**(2026-10-03 복구
 * 실측에서 실제로 그랬다). 그리고 상시 시끄러운 검사는 결국 무시된다 —
 * 그러면 이 검사를 둔 이유가 사라진다.
 *
 * 규칙 그룹 안의 순서는 평가 순서지만, 이 11개는 서로 독립이라 의미가 없다.
 */
const sortById = (list) =>
  [...list].sort((a, b) => String(a.uid ?? a.name ?? '').localeCompare(String(b.uid ?? b.name ?? '')))

// ------------------------------------------------------------------ capture

/** uid → 타입. 규칙이 datasourceUid 를 박고 있어서 placeholder 로 바꾸려면 필요하다. */
async function datasourceVars(api) {
  const list = await api('/api/datasources')
  const map = new Map()
  for (const d of list) map.set(d.uid, `\${DS_${d.type.toUpperCase()}_UID}`)
  return map
}

function placeholderize(node, { dsVars, base }) {
  if (Array.isArray(node)) return node.map((n) => placeholderize(n, { dsVars, base }))
  if (node && typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) {
      // `datasourceUid`(쿼리 레벨)와 `datasource: {type, uid}`(model 레벨)에 **같은 uid 가
      // 두 번** 들어 있다. 2026-10-03 에 앞쪽만 치환했다가 model 쪽 10곳이 그대로 남았다 —
      // lint 도 같은 키만 봐서 통과시켰다. 둘 다 본다.
      if (k === 'datasourceUid' && typeof v === 'string' && dsVars.has(v)) out[k] = dsVars.get(v)
      else if (k === 'uid' && typeof v === 'string' && dsVars.has(v)) out[k] = dsVars.get(v)
      else if (k === 'authorization_credentials') out[k] = TOKEN_REF
      else if (k === 'env' && typeof v === 'string') out[k] = ENV_REF
      else out[k] = placeholderize(v, { dsVars, base })
    }
    return out
  }
  if (typeof node === 'string') {
    let s = node
    if (base) s = s.split(base).join('${GRAFANA_URL}')        // 내부 호스트 → placeholder
    s = s.replace(/\/channels\/\d{15,}\//g, `/channels/${CHANNEL_REF}/`)
    return s
  }
  return node
}

/**
 * Grafana 가 설치 때 만들어 두는 기본 수신처는 **우리 것이 아니다.** 레포가 그걸
 * 들고 있으면 push 가 같은 이름의 수신처를 하나 더 만든다 (2026-10-03 실제로
 * `email receiver` 가 중복 생성됐다 — 수신처가 2개에서 3개가 됐다).
 *
 * 구분 신호는 **`uid` 가 빈 값**인 것. 내장 기본은 provisioning 으로 만들어진 게
 * 아니라서 uid 가 없다. 이름으로 가리지 않는다 — 이름은 바뀔 수 있다.
 */
function ownContactPoints(list) {
  list = asList(list)
  const builtin = list.filter((c) => !c.uid)
  if (builtin.length) {
    console.log(`내장 수신처 ${builtin.length}개는 레포가 관리하지 않는다: ${builtin.map((c) => c.name).join(' · ')}`)
  }
  return list.filter((c) => c.uid)
}

async function capture() {
  const api = grafana()
  const dsVars = await datasourceVars(api)
  const base = (process.env.GRAFANA_URL ?? '').replace(/\/$/, '')

  const got = {
    rules: asList(await api('/api/v1/provisioning/alert-rules')),
    contactPoints: ownContactPoints(asList(await api('/api/v1/provisioning/contact-points'))),
    policies: (await api('/api/v1/provisioning/policies')) ?? {},
    templates: asList(await api('/api/v1/provisioning/templates')),
  }
  const shaped = {
    rules: sortById(got.rules.map((r) => placeholderize(strip({ ...r }), { dsVars, base }))),
    contactPoints: sortById(got.contactPoints.map((c) => placeholderize(strip({ ...c }), { dsVars, base }))),
    policies: placeholderize(strip({ ...got.policies }), { dsVars, base }),
    templates: sortById(got.templates.map((t) => placeholderize(strip({ ...t }), { dsVars, base }))),
  }
  for (const [key, path] of Object.entries(FILES)) {
    writeFileSync(path, render(shaped[key]))
    console.log(`→ ${path}`)
  }
  console.log(`\n규칙 ${shaped.rules.length}개 · 수신처 ${shaped.contactPoints.length}개 · 템플릿 ${shaped.templates.length}개`)
  console.log('봇 토큰은 가져올 수 없다 (Grafana 가 [REDACTED] 로 내려준다) — placeholder 로 뒀다.')
}

// --------------------------------------------------------------------- lint

function lint() {
  const fail = []
  for (const [key, path] of Object.entries(FILES)) {
    if (!existsSync(path)) fail.push(`${path} 이 없다 — \`--capture\` 로 만든다`)
  }
  if (fail.length) return fail

  const texts = Object.fromEntries(Object.entries(FILES).map(([k, p]) => [k, readFileSync(p, 'utf8')]))
  const rules = read(FILES.rules)
  const cps = read(FILES.contactPoints)
  const policies = read(FILES.policies)
  const templates = read(FILES.templates)

  // 0) 선언 안 된 placeholder — 오타를 잡는다 (CI 가 치환 못 하면 그대로 저장된다)
  for (const [k, text] of Object.entries(texts)) {
    for (const v of placeholdersIn(text)) {
      if (!DECLARED.includes(v)) fail.push(`${k}: 선언 안 된 placeholder \${${v}} — DECLARED 목록에 없다`)
    }
  }

  // 1) 정규화 형태인가 (capture 출력과 커밋본이 같아야 왕복 diff 가 성립한다)
  for (const [k, text] of Object.entries(texts)) {
    if (render(JSON.parse(text)) !== text) fail.push(`${k}: 정규화 형태가 아니다 — \`--capture\` 를 거쳐 커밋할 것`)
  }

  // 2) 인스턴스 로컬 필드가 남았나
  const scanLocal = (o, where) => {
    for (const k of INSTANCE_LOCAL) {
      if (o && typeof o === 'object' && k in o) fail.push(`${where}: ${k} 가 남아 있다 — 인스턴스 로컬 값이다`)
    }
  }
  rules.forEach((r, i) => scanLocal(r, `rules[${i}] ${r.title ?? ''}`))
  cps.forEach((c, i) => scanLocal(c, `contact-points[${i}] ${c.name ?? ''}`))
  scanLocal(policies, 'policies')

  // 3) 규칙 — 조용히 죽는 조합을 막는다
  const uids = new Set()
  for (const r of rules) {
    const w = `rules "${r.title}"`
    if (!r.uid) fail.push(`${w}: uid 가 없다 — 멱등 반영이 안 된다`)
    else if (uids.has(r.uid)) fail.push(`${w}: uid 중복 (${r.uid})`)
    else uids.add(r.uid)
    if (!r.folderUID) fail.push(`${w}: folderUID 가 없다`)
    // 이 둘이 비면 Grafana 가 기본값을 쓰는데, 그 기본값이 "데이터 없으면 조용히" 다
    if (!r.noDataState) fail.push(`${w}: noDataState 누락 — 데이터가 끊겼을 때 어떻게 할지 안 정해졌다`)
    if (!r.execErrState) fail.push(`${w}: execErrState 누락 — 쿼리가 터졌을 때 어떻게 할지 안 정해졌다`)
    const sev = (r.labels ?? {}).severity
    if (!sev) fail.push(`${w}: labels.severity 누락`)
    else if (sev !== sev.toLowerCase()) fail.push(`${w}: severity "${sev}" 가 대문자 — 템플릿·라우팅이 소문자로 비교한다`)
    else if (!SEVERITIES.has(sev)) fail.push(`${w}: severity "${sev}" 는 아는 값이 아니다 (${[...SEVERITIES].join('·')})`)

    for (const [i, q] of (r.data ?? []).entries()) {
      const ds = q.datasourceUid
      if (!ds) fail.push(`${w} data[${i}]: datasourceUid 가 없다`)
      // 쿼리 레벨뿐 아니라 `model.datasource.uid` 에도 같은 uid 가 들어 있다.
      // 한 군데만 보면 나머지가 박힌 채로 통과한다 (2026-10-03 실제로 10곳이 남았다).
      const pinned = []
      const scan = (n, path) => {
        if (Array.isArray(n)) return n.forEach((v, j) => scan(v, `${path}[${j}]`))
        if (!n || typeof n !== 'object') return
        for (const [k, v] of Object.entries(n)) {
          const isDsUid = k === 'datasourceUid' || (k === 'uid' && 'type' in n && !('title' in n))
          if (isDsUid && typeof v === 'string' && v !== '__expr__' && !v.startsWith('${')) {
            pinned.push(`${path}.${k}=${v}`)
          }
          scan(v, `${path}.${k}`)
        }
      }
      scan(q, `data[${i}]`)
      for (const pin of pinned) {
        fail.push(`${w} ${pin} — 데이터소스 uid 가 박혀 있다. 다른 Grafana 에서 쿼리가 안 돈다`)
      }
      // `or vector(0)` 은 **0 과 NoData 를 구분해야 하는 규칙**에서만 필요하다.
      // 판정 기준은 "임계값이 0 인데 데이터 공백을 Alerting 으로 다루는가" —
      // 그런 규칙은 "사건 0건" 과 "수집 끊김" 을 갈라야 하므로 빈 결과를 0 으로 만들어야 한다.
      // 반대로 `gt[5]` + noDataState OK 같은 규칙은 시계열이 없는 것이 곧 정상이라
      // `or vector(0)` 이 필요 없다 (2026-10-03 실측: 11개 중 그런 규칙이 6개다).
      const expr = q.model?.expr
      const zeroThreshold = (q.model?.conditions ?? []).some(
        (c) => ['gt', 'gte'].includes(c.evaluator?.type) && (c.evaluator?.params ?? []).every((v) => v === 0),
      )
      if (zeroThreshold && r.noDataState === 'Alerting' && typeof expr === 'string' && !expr.includes('or vector(0)')) {
        fail.push(`${w} data[${i}]: 임계값 0 + noDataState Alerting 인데 \`or vector(0)\` 이 없다 — "사건 0건" 과 "수집 끊김" 이 구분되지 않는다`)
      }
    }
    // 내부 호스트가 placeholder 없이 박혔나
    for (const [k, v] of Object.entries(r.annotations ?? {})) {
      if (typeof v === 'string') {
        for (const m of v.matchAll(/https?:\/\/([^\s"'$)]+)/g)) {
          if (!m[0].includes('${') && !/^discord\.com/.test(m[1])) {
            fail.push(`${w} annotations.${k}: 절대 URL 이 박혀 있다 (${m[0].slice(0, 40)}) — \${GRAFANA_URL} 로 뺄 것`)
          }
        }
      }
    }
  }

  // 4) 수신처 — 토큰·채널이 placeholder 인가 (공개 레포의 핵심 검사)
  const names = new Set(cps.map((c) => c.name))
  for (const c of cps) {
    const s = c.settings ?? {}
    if ('authorization_credentials' in s && s.authorization_credentials !== TOKEN_REF) {
      fail.push(`contact-points "${c.name}": authorization_credentials 가 ${TOKEN_REF} 가 아니다 — 공개 레포에 자격증명이 올라간다`)
    }
    const envVar = s.payload?.vars?.env
    if (envVar !== undefined && envVar !== ENV_REF) {
      fail.push(`contact-points "${c.name}": payload.vars.env 가 ${ENV_REF} 가 아니다 (${envVar}) — 환경 이름이 박히면 운영 알림이 다른 환경 이름으로 찍힌다`)
    }
    if (typeof s.url === 'string') {
      if (/\d{15,}/.test(s.url)) fail.push(`contact-points "${c.name}": url 에 긴 숫자 id 가 박혀 있다 — ${CHANNEL_REF} 로 뺄 것`)
      if (s.url.includes('discord.com') && !s.url.includes(CHANNEL_REF)) {
        fail.push(`contact-points "${c.name}": discord url 에 ${CHANNEL_REF} 가 없다`)
      }
    }
  }

  // 5) 수신처 존재 검사는 **오프라인에서 못 한다.** 정책의 `receiver` 는 alertmanager 의
  //    receiver **그룹** 이름이고, provisioning contact-points API 가 주는 이름은 그 안의
  //    integration 이름이다 — 층위가 다르다. 2026-10-03 실측:
  //      alertmanager receivers        = ['grafana-default-email', 'discord-studyclub']
  //      provisioning contact-points   = ['discord-studyclub', 'email receiver']
  //    이 둘로 대조하면 `grafana-default-email` 이 영구 오탐으로 뜬다(실제로 떴다).
  //    권위 있는 목록은 서버에만 있으므로 `--drift` 가 본다 (checkReceivers).

  // 6) 템플릿이 참조되는데 없나
  const tplNames = new Set(templates.map((t) => t.name))
  for (const c of cps) {
    const body = JSON.stringify(c.settings ?? {})
    for (const m of body.matchAll(/template\s+\\?"([^"\\]+)\\?"/g)) {
      const want = m[1]
      // 템플릿 정의 이름과 참조 이름이 다를 수 있어 느슨하게 본다 (한쪽이라도 걸치면 통과)
      if (![...tplNames].some((n) => want.includes(n) || n.includes(want.split('.')[0]))) {
        fail.push(`contact-points "${c.name}": 템플릿 "${want}" 가 templates.json 에 없다 — 메시지가 빈 본문으로 나간다`)
      }
    }
  }
  return fail
}

// ------------------------------------------------------------------ network

async function live(api) {
  const dsVars = await datasourceVars(api)
  const base = (process.env.GRAFANA_URL ?? '').replace(/\/$/, '')
  const shape = (v) => placeholderize(strip(structuredClone(v)), { dsVars, base })
  return {
    rules: sortById(asList(await api('/api/v1/provisioning/alert-rules')).map(shape)),
    contactPoints: sortById(ownContactPoints(asList(await api('/api/v1/provisioning/contact-points'))).map(shape)),
    policies: shape((await api('/api/v1/provisioning/policies')) ?? {}),
    templates: sortById(asList(await api('/api/v1/provisioning/templates')).map(shape)),
  }
}

/**
 * 정책이 가리키는 수신처가 실제로 있나. **서버에서만 판정된다** (위 lint 5) 참고).
 * 없는 수신처를 가리키면 규칙은 발화하는데 알림만 안 간다 — 가장 조용한 실패다.
 */
async function checkReceivers(api) {
  const cfg = await api('/api/alertmanager/grafana/config/api/v1/alerts')
  const have = new Set(asList(cfg?.alertmanager_config?.receivers).map((r) => r.name))
  const bad = []
  const walk = (node, where) => {
    if (!node || typeof node !== 'object') return
    if (node.receiver && !have.has(node.receiver)) bad.push(`${where} → "${node.receiver}"`)
    for (const [i, r] of (node.routes ?? []).entries()) walk(r, `${where}.routes[${i}]`)
  }
  walk(JSON.parse(readFileSync(FILES.policies, 'utf8')), 'policies')
  for (const r of read(FILES.rules)) {
    const rcv = r.notification_settings?.receiver
    if (rcv && !have.has(rcv)) bad.push(`rule ${r.uid} → "${rcv}"`)
  }
  if (bad.length) {
    console.log(`\n✕ 없는 수신처를 가리킨다 (규칙은 발화하는데 알림이 안 간다):`)
    for (const b of bad) console.log(`   · ${b}`)
    console.log(`   서버의 수신처: ${[...have].join(' · ')}`)
  } else {
    console.log(`✓ 수신처 ${have.size}개 모두 실재 (${[...have].join(' · ')})`)
  }
  return bad.length
}

async function drift() {
  const api = grafana()
  const now = await live(api)
  let differs = 0
  for (const [key, path] of Object.entries(FILES)) {
    const same = render(now[key]) === readFileSync(path, 'utf8')
    console.log(same ? `✓ ${key} — 같다` : `✕ ${key} — 다르다`)
    if (!same) differs++
  }
  differs += await checkReceivers(api)

  // 레포에 없는 규칙 — 여기는 지운다(아래 push). 먼저 보여 준다.
  const repoUids = new Set(read(FILES.rules).map((r) => r.uid))
  const extra = now.rules.filter((r) => !repoUids.has(r.uid))
  if (extra.length) {
    console.log(`\n레포에 없는 규칙 ${extra.length}개 (--push 가 지운다):`)
    for (const r of extra) console.log(`   · ${r.uid}  ${r.title}`)
  }
  return differs
}

async function push() {
  const api = grafana()
  const body = (key) => JSON.parse(substitute(readFileSync(FILES[key], 'utf8')))

  // 순서가 중요하다 — 수신처·템플릿이 먼저 있어야 라우팅과 규칙이 걸린다.
  for (const c of body('contactPoints')) {
    // uid 로 찾는다. 이름으로 찾으면 내장 기본(uid 없음)과 헷갈려 중복을 만든다.
    const existing = asList(await api('/api/v1/provisioning/contact-points')).find((x) => x.uid && (x.uid === c.uid || x.name === c.name))
    if (existing?.uid) {
      await api(`/api/v1/provisioning/contact-points/${existing.uid}`, { method: 'PUT', body: JSON.stringify({ ...c, uid: existing.uid }) })
      console.log(`→ contact-point ${c.name} (갱신)`)
    } else {
      await api('/api/v1/provisioning/contact-points', { method: 'POST', body: JSON.stringify(c) })
      console.log(`→ contact-point ${c.name} (신규)`)
    }
  }
  for (const t of body('templates')) {
    await api(`/api/v1/provisioning/templates/${encodeURIComponent(t.name)}`, {
      method: 'PUT',
      body: JSON.stringify({ name: t.name, template: t.template }),
    })
    console.log(`→ template ${t.name}`)
  }
  await api('/api/v1/provisioning/policies', { method: 'PUT', body: JSON.stringify(body('policies')) })
  console.log('→ notification policy')

  const rules = body('rules')
  for (const r of rules) {
    try {
      await api(`/api/v1/provisioning/alert-rules/${r.uid}`, { method: 'PUT', body: JSON.stringify(r) })
      console.log(`→ rule ${r.uid} (갱신)`)
    } catch (e) {
      if (!/→ 404/.test(String(e))) throw e
      await api('/api/v1/provisioning/alert-rules', { method: 'POST', body: JSON.stringify(r) })
      console.log(`→ rule ${r.uid} (신규)`)
    }
  }

  // 레포에서 지운 규칙을 Grafana 에서도 지운다. 남겨 두면 NoData 로 영구히 떠서
  // 쓰이지 않는 경고가 쌓이고, 쌓이면 진짜 경고가 안 읽힌다.
  const keep = new Set(rules.map((r) => r.uid))
  for (const r of asList(await api('/api/v1/provisioning/alert-rules'))) {
    if (!keep.has(r.uid)) {
      await api(`/api/v1/provisioning/alert-rules/${r.uid}`, { method: 'DELETE' })
      console.log(`✕ rule ${r.uid} 삭제 (레포에 없다)`)
    }
  }
}

// --------------------------------------------------------------------- main

const mode = process.argv[2]

if (mode === '--capture') {
  await capture()
} else if (mode === '--lint') {
  const fail = lint()
  if (fail.length) {
    console.error('✕ 알림 설정 검사 실패')
    for (const f of fail) console.error(`   · ${f}`)
    console.error(`\n${fail.length}건. 위 항목은 전부 "Grafana 가 에러 없이 받아주는" 종류다.`)
    process.exit(1)
  }
  console.log('✓ 알림 설정 통과')
} else if (mode === '--drift') {
  const n = await drift()
  if (n) {
    console.log(`\n${n}개가 어긋났다. 덮기 전에 봐야 한다.`)
    process.exit(3)   // 3 = drift (설정 오류 1 과 구분)
  }
  console.log('\n정본과 실물이 같다')
} else if (mode === '--push') {
  await push()
} else {
  console.error(`사용법:
  --lint       파일 검사 (네트워크 없음)
  --capture    Grafana → 레포 (placeholder 로 바꿔서 저장)
  --drift      정본과 Grafana 실물 비교
  --push       정본을 Grafana 에 반영 (치환 + 레포에 없는 규칙 삭제)`)
  process.exit(2)
}
