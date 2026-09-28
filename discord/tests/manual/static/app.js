// Manual test page for the Discord service API.
//
// Every panel below is one endpoint from docs/discord-development-guide/api/.
// Nothing here knows how the endpoints work -- the page builds a request from
// the form and hands it to /api/call on the harness, which adds the headers
// and reports both sides of the exchange.

const STUDY = "1327394882193883136";
const ROLE = "1327394882193883140";
const USER_A = "327394882193883136";
const USER_B = "412938471293847123";

const DOCS = "docs/discord-development-guide/api";

// in: "path" | "query" | "body". type: "text" | "textarea" | "list".
const ENDPOINTS = [
  {
    id: "create-study",
    method: "POST",
    path: "/api/v1/studies",
    caller: "captain",
    expect: "201 · 400 401 403 404 409 502 503",
    fields: [
      { name: "studyName", in: "body", type: "text", value: "알고리즘 스터디", note: "1–96자" },
    ],
  },
  {
    id: "get-study-channels",
    method: "GET",
    path: "/api/v1/studies/{discordStudyId}/channels",
    caller: "captain · navigator",
    expect: "200 · 400 401 403 404 409 502 503",
    fields: [{ name: "discordStudyId", in: "path", type: "text", value: STUDY }],
  },
  {
    id: "assign-role",
    method: "POST",
    path: "/api/v1/roles/{discordRoleId}/users",
    caller: "captain",
    expect: "204 · 400 401 403 404 502 503",
    fields: [
      { name: "discordRoleId", in: "path", type: "text", value: ROLE },
      { name: "discordStudyId", in: "body", type: "text", value: STUDY, note: "로그용" },
      { name: "discordUserIds", in: "body", type: "list", value: `${USER_A}\n${USER_B}` },
    ],
  },
  {
    id: "remove-role",
    method: "DELETE",
    path: "/api/v1/roles/{discordRoleId}/users/{discordUserId}",
    caller: "captain",
    expect: "204 · 400 401 403 404 502 503",
    fields: [
      { name: "discordRoleId", in: "path", type: "text", value: ROLE },
      { name: "discordUserId", in: "path", type: "text", value: USER_A },
      { name: "discordStudyId", in: "query", type: "text", value: STUDY, note: "로그용" },
    ],
  },
  {
    id: "assign-navigator-role",
    method: "POST",
    path: "/api/v1/roles/navigator/users",
    caller: "captain",
    expect: "204 · 400 401 403 404 502 503",
    fields: [
      { name: "discordStudyId", in: "body", type: "text", value: STUDY, note: "로그용" },
      { name: "discordUserIds", in: "body", type: "list", value: USER_A },
    ],
  },
  {
    id: "remove-navigator-role",
    method: "DELETE",
    path: "/api/v1/roles/navigator/users/{discordUserId}",
    caller: "captain",
    expect: "204 · 400 401 403 404 502 503",
    fields: [
      { name: "discordUserId", in: "path", type: "text", value: USER_A },
      { name: "discordStudyId", in: "query", type: "text", value: STUDY, note: "로그용" },
    ],
  },
  {
    id: "send-message",
    method: "POST",
    path: "/api/v1/channels/{discordChannelId}/msg",
    caller: "captain · navigator",
    expect: "204 · 400 401 403 404 502 503",
    fields: [
      { name: "discordChannelId", in: "path", type: "text", value: STUDY },
      { name: "discordStudyId", in: "body", type: "text", value: STUDY, note: "채널 소속 검증" },
      {
        name: "msg",
        in: "body",
        type: "textarea",
        value: "이번 주 모임은 목요일 저녁 9시로 옮깁니다.",
        note: "멘션 줄 포함 2000자",
      },
      { name: "discordUserIds", in: "body", type: "list", value: USER_A, note: "최대 40명, 빈 값 허용" },
    ],
  },
  {
    id: "send-alert-message",
    method: "POST",
    path: "/api/v1/channels/alert/msg",
    caller: "captain · navigator",
    expect: "204 · 400 401 403 404 409 502 503",
    fields: [
      {
        name: "msg",
        in: "body",
        type: "textarea",
        value: "알고리즘 스터디 1기가 완료 처리되었습니다. 역할 정리가 필요합니다.",
        note: "1–1900자",
      },
    ],
  },
  {
    id: "send-announcement-message",
    method: "POST",
    path: "/api/v1/channels/announcement/msg",
    caller: "captain",
    expect: "204 · 400 401 403 404 409 502 503",
    fields: [
      {
        name: "msg",
        in: "body",
        type: "textarea",
        value: "알고리즘 스터디 2기 모집을 시작합니다. 신청은 이번 주 금요일까지입니다.",
        note: "1–1990자",
      },
    ],
  },
];

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

// ---------------------------------------------------------------- endpoints

function renderEndpoints() {
  const host = $("endpoints");
  for (const ep of ENDPOINTS) {
    const card = el("details", "card endpoint");
    const summary = el("summary");
    summary.append(el("span", `method ${ep.method.toLowerCase()}`, ep.method));
    summary.append(el("code", "path", ep.path));
    summary.append(el("span", "caller", ep.caller));
    card.append(summary);

    const meta = el("p", "note");
    meta.append(document.createTextNode(`expected: ${ep.expect} · `));
    meta.append(el("code", null, `${DOCS}/${ep.id}.md`));
    card.append(meta);

    const form = el("div", "fields");
    for (const f of ep.fields) {
      const label = el("label", "field");
      label.append(el("span", "fname", `${f.name} (${f.in})`));
      const input = f.type === "text" ? el("input") : el("textarea");
      if (f.type === "text") input.type = "text";
      if (f.type === "list") input.rows = 2;
      input.value = f.value;
      input.dataset.name = f.name;
      input.dataset.in = f.in;
      input.dataset.type = f.type;
      label.append(input);
      if (f.note) label.append(el("span", "fnote", f.note));
      form.append(label);
    }
    card.append(form);

    const row = el("div", "row");
    const send = el("button", null, "send");
    send.onclick = () => sendEndpoint(ep, form);
    row.append(send);
    card.append(row);
    host.append(card);
  }
}

function sendEndpoint(ep, form) {
  let path = ep.path;
  const query = {};
  const body = {};
  let hasBody = false;

  for (const input of form.querySelectorAll("input, textarea")) {
    const { name, in: where, type } = input.dataset;
    const raw = input.value;
    if (where === "path") {
      path = path.replace(`{${name}}`, encodeURIComponent(raw.trim()));
    } else if (where === "query") {
      query[name] = raw.trim();
    } else {
      // A list field sends an array; blank means [], which send-message allows.
      body[name] = type === "list" ? raw.split(/[\s,]+/).filter(Boolean) : raw;
      hasBody = true;
    }
  }

  return call({
    method: ep.method,
    path,
    query,
    body: hasBody ? body : null,
    label: ep.id,
  });
}

async function call({ method, path, query, body, label }) {
  const payload = {
    method,
    path,
    query: query || {},
    body: body ?? null,
    baseUrl: $("baseUrl").value.trim() || null,
    omitIdempotencyKey: $("omitIdempotencyKey").checked,
    badApiKey: $("badApiKey").checked,
    omitApiKey: $("omitApiKey").checked,
    omitUserId: $("omitUserId").checked,
    userIdOverride: $("userIdOverride").value.trim() || null,
  };
  const result = await post("/api/call", payload);
  logExchange(label, result);
}

// --------------------------------------------------------------------- log

function statusClass(status) {
  if (status === undefined || status === null) return "err";
  if (status < 300) return "ok";
  if (status < 500) return "warn";
  return "err";
}

function logExchange(label, result) {
  const entry = el("div", "entry");
  const status = result.response ? result.response.status : null;
  const head = el("div", `head ${statusClass(status)}`);
  head.append(el("strong", null, label));
  head.append(el("span", "code", result.error ? "ERR" : String(status)));
  if (result.response) head.append(el("span", "ms", `${result.response.elapsedMs} ms`));
  head.append(el("span", "ts", new Date().toLocaleTimeString()));
  entry.append(head);

  const dump = { request: result.request };
  if (result.error) dump.error = result.error;
  if (result.response) dump.response = result.response;
  entry.append(el("pre", "out", JSON.stringify(dump, null, 2)));

  const log = $("log");
  log.prepend(entry);
}

// ------------------------------------------------------------------- OAuth

function show(id, value) {
  $(id).textContent = value === undefined || value === null ? "—" : JSON.stringify(value, null, 2);
}

async function refreshSession(session) {
  const s = session || (await (await fetch("/api/config")).json()).session;
  show("legAuthorize", s.authorize);
  show("legCallback", s.callback);
  show("legToken", s.token);
  show("legMe", s.me);
  if ($("revealTokens").checked && s.hasAccessToken) {
    const tokens = await (await fetch("/api/oauth/tokens")).json();
    $("legToken").textContent += `\n\n// revealed\n${JSON.stringify(tokens, null, 2)}`;
  }
  const status = $("status");
  status.textContent = s.discordUserId
    ? `logged in · ${s.username || "?"} · ${s.discordUserId}`
    : "not logged in";
  status.className = `status ${s.discordUserId ? "ok" : "warn"}`;
  $("userIdOverride").placeholder = s.discordUserId || "(no OAuth session)";
}

async function buildAuthorizeUrl() {
  return post("/api/oauth/authorize-url", {
    scope: $("scope").value.trim(),
    prompt: $("prompt").value,
  });
}

// ------------------------------------------------- production one-button login
//
// Mirrors the popup pattern the repo already uses for Google
// (docs/frontend-development-guide/auth-flow.md): open a popup, wait for the
// callback to postMessage back, then ask the server who is logged in. The
// code and the tokens never pass through here.

function renderProfile(user) {
  const box = $("profile");
  box.innerHTML = "";
  box.hidden = !user;
  $("btnLogout").hidden = !user;
  if (!user) return;

  if (user.avatarUrl) {
    const img = el("img");
    img.src = user.avatarUrl;
    img.alt = "";
    box.append(img);
  } else {
    box.append(el("div", "noavatar", "?"));
  }
  const who = el("div", "who");
  who.append(el("span", "name", user.globalName || user.username || "(no name)"));
  who.append(el("span", "uid", user.id));
  box.append(who);
}

async function loadProfile() {
  const reveal = $("revealAuthTokens").checked ? "?reveal=1" : "";
  const { user, debug } = await (await fetch(`/api/auth/user${reveal}`)).json();
  renderProfile(user);
  $("authDebug").hidden = !debug;
  $("authTrace").textContent = debug ? JSON.stringify(debug, null, 2) : "—";
  return user;
}

function startDiscordAuth() {
  $("authError").textContent = "";
  const popup = window.open(
    "/auth/discord/start",
    "discord-auth",
    "width=500,height=760,menubar=no,toolbar=no"
  );
  if (!popup) $("authError").textContent = "popup blocked";
}

// Only messages from this harness are trusted -- the callback pins the same
// origin when it posts, so anything else is some other page talking.
window.addEventListener("message", async (event) => {
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || data.source !== "studyclub-discord-auth") return;
  // The trace is loaded either way -- a failed login is the case it is for.
  if (!data.ok) $("authError").textContent = data.error || "login failed";
  await loadProfile();
  await refreshSession();
});

// ------------------------------------------------------------------- start

async function init() {
  renderEndpoints();

  const cfg = await (await fetch("/api/config")).json();
  $("baseUrl").value = cfg.apiBase;
  if (!cfg.clientId) {
    $("legAuthorize").textContent = "DISCORD_CLIENT_ID is not set in the root .env";
  }
  if (!cfg.hasApiKey) {
    $("status").title = "DISCORD_API_KEY is not set: X-API-Key goes out empty";
  }
  await refreshSession(cfg.session);

  $("btnAuthorizeUrl").onclick = async () => show("legAuthorize", await buildAuthorizeUrl());
  $("btnAuthorize").onclick = async () => {
    const res = await buildAuthorizeUrl();
    show("legAuthorize", res);
    if (res.url) window.location.href = res.url;
  };
  $("btnToken").onclick = async () => {
    const res = await post("/api/oauth/token", { code: $("codeOverride").value.trim() || null });
    show("legToken", res.leg || res);
    if (res.session) await refreshSession(res.session);
  };
  $("btnRefresh").onclick = async () => {
    const res = await post("/api/oauth/refresh", {});
    show("legToken", res.leg || res);
    if (res.session) await refreshSession(res.session);
  };
  $("btnMe").onclick = async () => {
    const res = await post("/api/oauth/me", {});
    show("legMe", res.leg || res);
    if (res.session) await refreshSession(res.session);
  };
  $("btnReset").onclick = async () => {
    await refreshSession((await post("/api/oauth/reset", {})).session);
    await loadProfile();
  };
  $("btnDiscordAuth").onclick = startDiscordAuth;
  $("btnLogout").onclick = async () => {
    await post("/api/auth/logout", {});
    $("authError").textContent = "";
    await loadProfile();
    await refreshSession();
  };
  $("revealAuthTokens").onchange = loadProfile;
  await loadProfile();
  $("revealTokens").onchange = () => refreshSession();
  $("btnClearLog").onclick = () => ($("log").innerHTML = "");
}

init();
