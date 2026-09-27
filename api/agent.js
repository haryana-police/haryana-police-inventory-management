/* IMS Agent — server-side intelligence layer (v1, 2026.09.154) */
/* Provider adapters: local (rule NLU). */
/* NEVER expose API keys to the browser. Auth + RBAC are authoritative. */
const crypto = require("crypto");

const TOKEN_KEY = "hp_inventory.sessions";

/* ---------- state access (same pattern as index.js/filedb) ---------- */
function __getState() {
  try {
    const g = global.__imsGetState;
    if (typeof g === "function") return g();
  } catch (e) {}
  return null;
}
let __filePool = null;
async function __stateAsync() {
  const s = __getState();
  if (s && Object.keys(s).length) return s;
  try {
    if (!__filePool) { const P = require("./_filepool"); __filePool = new P.Pool(); }
    const rr = await __filePool.query("SELECT data FROM app_state WHERE id=1");
    return rr.rows.length ? rr.rows[0].data : null;
  } catch (e) { return null; }
}

async function authFromRequest(req) {
  const header = req.headers["authorization"] || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return { user: null };
  const token = m[1].trim();
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const state = await __stateAsync();
  if (!state) return { user: null };
  const sessions = state[TOKEN_KEY] || {};
  const sess = sessions[hash];
  if (!sess) return { user: null };
  if (Date.now() > sess.expiresAt) return { user: null };
  const users = Array.isArray(state["hp_inventory.users"]) ? state["hp_inventory.users"] : [];
  const user = users.find(u => u && u.id === sess.userId);
  return { user: user || null };
}
function readBody(req) {
  if (req.readableEnded) return Promise.resolve({});
  return new Promise((resolve) => {
    let data = "";
    req.on("data", c => { data += c; if (data.length > 512000) req.destroy(); });
    const to = setTimeout(() => resolve({}), 2500);
    req.on('end', () => { clearTimeout(to); try { resolve(JSON.parse(data || "{}")); } catch (e) { resolve({}); } });
    req.on('error', () => { clearTimeout(to); resolve({}); });
  });
}
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

/* ---------- knowledge layer (app metadata, no data duplication) ---------- */
const KB = {
  modules: [
    { id: "dashboard", words: ["dashboard", "home", "summary"], tab: "dashboard" },
    { id: "inventory", words: ["inventory", "stock", "item stock", "stock history", "items"], tab: "inventory" },
    { id: "demands", words: ["demand", "demands", "mang", "mange", "raise demand"], tab: "demands" },
    { id: "allotments", words: ["issue", "issue items", "allot", "allotment", "allotments"], tab: "allotments" },
    { id: "distribution", words: ["distribute", "distribution", "distribute items"], tab: "distribution" },
    { id: "maintenance", words: ["maintenance", "repair", "maintain"], tab: "maintenance" },
    { id: "inspections", words: ["inspection", "inspections"], tab: "inspections" },
    { id: "consumables", words: ["consumable", "consumables", "consume", "consume items", "consume history"], tab: "consumables" },
    { id: "reports", words: ["report", "reports"], tab: "reports" }
  ],
  qualities: { good: ["good", "acha", "achhi", "theek"], poor: ["poor", "kharab", "bad", "purana"], damaged: ["damaged", "tuta", "broken", "kharaab"] },
  digits: { "ek": 1, "do": 2, "teen": 3, "char": 4, "paanch": 5, "das": 10, "bees": 20, "tees": 30 }
};
const ROLES_LOCKS = { devadmin: ["addStock", "adjust", "consAdd", "demandCreate", "issueCreate"] };

/* ---------- helpers ---------- */
function norm(s) { return String(s || "").toLowerCase().trim(); }
function hasAny(t, words) { return words.some(w => t.indexOf(w) !== -1); }
function parseQty(t) {
  let m = t.match(/(\d+)\s*(?:qty|quantity|piece|pcs|nos)?/);
  if (m) return parseInt(m[1], 10);
  for (const k of Object.keys(KB.digits)) { if (t.indexOf(k) !== -1) return KB.digits[k]; }
  return null;
}
function parseQuality(t) {
  for (const q of Object.keys(KB.qualities)) { if (hasAny(t, KB.qualities[q])) return q; }
  return null;
}
function stripItem(raw) {
  let s = norm(raw);
  s = s.replace(/\d+/g, " ");
  const junk = ["add", "karo", "kar do", "karado", "kardo", "daal", "daal do", "dalo", "stock", "me", "mein", "in", "into", "ki", "ka", "ke", "quantity", "qty", "no", "nos", "piece", "pieces", "pcs", "good", "quality", "poor", "damaged", "kharab", "acha", "achhi", "theek", "items", "item", "please", "plz", "do", "dena", "de do", "raise", "banao", "bana", "create", "new", "entry", "aj", "jodo", "jod do", "kitna", "kitne", "dikhao", "dikha", "show", "open", "kholo", "ka", "ki", "hai", "chaahiye", "chahiye", "mujhe", "mera", "mere", "unit", "ka stock"];
  junk.sort((a, b) => b.length - a.length);
  for (const j of junk) { s = s.replace(new RegExp("\\b" + j.replace(/[^a-z ]/g, "") + "\\b", "gi"), " "); }
  return s.replace(/\s+/g, " ").trim();
}

/* ---------- LocalProvider: deterministic NLU (no external key needed) ---------- */
function localInterpret(message, ctx) {
  const t = norm(message);
  const pend = ctx.pending || null;
  const out = { intent: "unknown", reply: "", plan: null, ask: null };
  if (!t) { out.reply = "Kripya kuch bolein ya likhein."; return out; }
  /* sleep / stop */
  if (hasAny(t, ["stop", "sleep", "so jao", "so jaao", "bas", "that is all", "thats all", "band karo", "bye", "ruko", "chup"])) {
    out.intent = "sleep"; out.state = "SLEEPING"; out.reply = "Theek hai, main so raha hoon. Jab zaroorat ho 'Hello IMS' bolein."; return out;
  }
  /* confirmation gating: pending op + yes/no */
  const yes = hasAny(t, ["yes", "haan", "ha", "confirm", "submit", "do it", "kar do", "ok", "okay", "sure", "please do", "jama karo", "sahi", "theek hai"]) && t.length <= 40;
  const no = hasAny(t, ["no", "nahi", "cancel", "radd", "mat karo", "dont", "do not", "chhod do", "chhod", "quit", "back"]) && t.length <= 40;
  if (pend && yes) { out.intent = "confirm_execute"; out.plan = { kind: "execute", tool: pend.tool }; out.reply = pend.executeLine || "Executing..."; return out; }
  if (pend && no) { out.intent = "cancel"; out.plan = { kind: "cancel" }; out.reply = "Theek hai, cancel kar diya."; return out; }
  if (!pend && no) { out.intent = "cancel"; out.plan = { kind: "cancel" }; out.reply = "Theek hai."; return out; }
  /* modify pending qty ("30 kar do", "make it 30") */
  if (pend) {
    const qm = t.match(/(?:make it|change it to|badha do|kar do|kardo|\u092c\u0928\u093e|[\u0915\u0930]*\s*)?(\d+)\s*(?:kar do|kardo|make it|\u0915\u0930)?/);
    if (qm && /make it|change|badha|ghata|kar do|kardo|\u0915\u0930\u0926\u094b|\u0915\u0930 \u0926\u094b/.test(t)) {
      const q = parseInt(qm[1], 10);
      out.intent = "reprepare";
      out.plan = { kind: "reprepare", tool: pend.tool, args: Object.assign({}, pend.args, { qty: q }) };
      out.reply = "Quantity " + q + " kar di. Ab confirm karein?";
      return out;
    }
  }
  /* greeting */
  if (/^(hello|hi|hey|namaste|namaskar|\u0939\u0947\u0932\u094d\u0932\u094b|\u0928\u092e\u0938\u094d\u0924\u0947)\b/.test(t) && t.length <= 24) {
    out.intent = "greet"; out.reply = "Namaste " + (ctx.userName || "") + "! Main IMS Agent hoon. Bataiye kya karna hai — jaise: '20 shirt stock me add karo' ya 'pending demands dikhao'.";
    return out;
  }
  /* help */
  if (hasAny(t, ["help", "madad", "kya kar sakte", "commands", "what can you"])) {
    out.intent = "help";
    out.reply = "Main ye kar sakta hoon: (1) Navigate — 'reports kholo'. (2) Stock add — 'uniform me 20 shirt add karo'. (3) Search — 'shirt dhundo'. (4) Pending demands — 'pending demands dikhao'. (5) Demand raise. (6) Maintenance request. (7) Consumable add. Bolein 'stop' to sleep.";
    return out;
  }
  /* pending demands view */
  if (hasAny(t, ["pending demand", "pending demands", "demand dikhao", "demands dikhao", "show demand", "meri demand", "demand list", "demand status"]) && !hasAny(t, ["raise", "banao", "karo", "create", "new"])) {
    out.intent = "view_demands"; out.plan = { kind: "tool", tool: "pendingDemands" }; out.reply = ""; return out;
  }
  /* maintenance list */
  if (hasAny(t, ["maintenance status", "maintenance list", "maintenance request dikhao", "maintenance dikhao"]) && !hasAny(t, ["raise", "karo", "banao", "create"])) {
    out.intent = "view_maintenance"; out.plan = { kind: "tool", tool: "maintenanceList" }; out.reply = ""; return out;
  }
  /* stock summary / search */
  if (hasAny(t, ["stock dikhao", "inventory dikhao", "kitna stock", "stock summary", "stock status", "mere unit ka stock", "total stock"])) {
    out.intent = "stock_summary"; out.plan = { kind: "tool", tool: "stockSummary" }; out.reply = ""; return out;
  }
  if (hasAny(t, ["search", "find", "dhundo", "dhoondo", "kahan hai", "check item", "item hai"])) {
    const q = stripItem(t.replace(/search|find|dhundo|dhoondo|kahan hai|check item|item hai|stock/gi, " "));
    out.intent = "search_item"; out.plan = { kind: "tool", tool: "searchItems", args: { q: q } }; out.reply = ""; return out;
  }
  /* maintenance request create */
  if (hasAny(t, ["maintenance", "repair", "repair request", "maintain"]) && hasAny(t, ["raise", "karo", "banao", "create", "request", "karwao", "likho"])) {
    out.intent = "prepare_maintenance";
    out.plan = { kind: "prepare", tool: "maintenance", args: { type: "", desc: message } };
    out.reply = "Maintenance form khol raha hoon. Type aur description bharna — phir confirm karein.";
    return out;
  }
  /* demand create */
  if (hasAny(t, ["demand", "demand raise", "mang", "maang"]) && hasAny(t, ["raise", "banao", "banaiye", "karo", "create", "likho", "dena", "chahiye", "mangwa"])) {
    const item = stripItem(t);
    const qty = parseQty(t) || 1;
    out.intent = "prepare_demand";
    out.plan = { kind: "prepare", tool: "demand", args: { item: item, qty: qty } };
    out.reply = "";
    return out;
  }
  /* consumable add */
  if (hasAny(t, ["consumable", "consume item", "consume add", "sanitary"]) && hasAny(t, ["add", "daal", "karo", "jodo"])) {
    const item = stripItem(t);
    const qty = parseQty(t) || 1;
    out.intent = "prepare_consadd";
    out.plan = { kind: "prepare", tool: "consAdd", args: { item: item, qty: qty } };
    out.reply = "";
    return out;
  }
  /* issue / allot prepare */
  if (hasAny(t, ["issue items", "issue karo", "allot", "allotment karo", "jari karo", "issue item"])) {
    const item = stripItem(t);
    const qty = parseQty(t) || 1;
    out.intent = "prepare_issue";
    out.plan = { kind: "prepare", tool: "issue", args: { item: item, qty: qty } };
    out.reply = "";
    return out;
  }
  /* adjust */
  if (hasAny(t, ["adjust", "kam karo", "ghatao", "reduce", "stock theek karo", "stock 30 kar do"])) {
    const item = stripItem(t);
    const qty = parseQty(t);
    out.intent = "prepare_adjust";
    out.plan = { kind: "prepare", tool: "adjust", args: { item: item, qty: qty } };
    out.reply = "";
    return out;
  }
  /* add stock (default numeric+item) */
  const q = parseQty(t);
  const item = stripItem(t);
  if (q && item && item.length > 1) {
    const qual = parseQuality(t) || "good";
    out.intent = "prepare_stock";
    out.plan = { kind: "prepare", tool: "addStock", args: { item: item, qty: q, quality: qual, remarks: "ok" } };
    out.reply = "";
    return out;
  }
  /* navigate */
  let mod = null;
  if (/open|kholo|dikha|show|go to|switch/.test(t) || t.split(" ").length <= 3) {
    for (const mo of KB.modules) { if (mo.words.some(w => t.indexOf(w) !== -1)) { mod = mo; break; } }
  }
  if (mod) {
    out.intent = "navigate";
    out.plan = { kind: "navigate", tab: mod.tab };
    out.reply = "Khol raha hoon: " + mod.id + ".";
    return out;
  }
  out.intent = "unknown";
  out.reply = "Samajh nahi aaya. Aap bol sakte hain: '20 shirt add karo', 'pending demands dikhao', 'reports kholo', ya 'help'.";
  return out;
}

function roleBlocked(tool, role) {
  const locks = ROLES_LOCKS[role] || [];
  return locks.indexOf(tool) !== -1;
}

/* ---------- GeminiProvider: Google Gemini runtime model (server-side only) ----------
   - Enabled when GEMINI_API_KEY is present; otherwise llmConfig() returns null and
     the deterministic LocalProvider (localInterpret) handles every request.
   - Model is env-driven: GEMINI_MODEL (default "gemini-flash-latest", Google's
     stable alias that always points at the current recommended Flash model).
   - GLM 5.3 Flash stays the DeepSeek Harness dev/coding model — unrelated here. */
const LLM_PLAN_KINDS = ["respond", "navigate", "tool", "prepare", "reprepare", "execute", "cancel"];
const LLM_TOOLS = {
  tool: ["pendingDemands", "maintenanceList", "stockSummary", "searchItems"],
  prepare: ["addStock", "demand", "consAdd", "issue", "adjust", "maintenance"],
  reprepare: ["addStock", "demand", "consAdd", "issue", "adjust", "maintenance"]
};
const LLM_TABS = ["dashboard", "inventory", "demands", "allotments", "distribution", "maintenance", "inspections", "consumables", "reports"];

function llmConfig() {
  const key = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim();
  if (!key) return null;
  if (typeof fetch !== "function") return null; /* needs Node 18+ runtime */
  return {
    name: "gemini",
    key: key,
    model: String(process.env.GEMINI_MODEL || "gemini-flash-latest").trim(),
    base: "https://generativelanguage.googleapis.com/v1beta/models/"
  };
}

function llmSystemPrompt(ctx) {
  return [
    "You are the IMS Agent inside an Inventory Management System web app. You understand English, Hindi and Hinglish; ALWAYS answer in friendly Hinglish (Roman script). Be brief (1-3 sentences).",
    "You convert the user's request into a JSON action plan for the app. You never invent data and never claim an action is done — the app UI executes it.",
    "Current user: name=" + (ctx.userName || "?") + ", role=" + (ctx.role || "?") + ".",
    "Pending operation awaiting confirmation: " + JSON.stringify(ctx.pending || null) + ". pendingConfirmed=" + !!ctx.pendingConfirmed + ".",
    "If a pending operation exists: yes/haan/confirm => kind execute (tool = pending tool); no/cancel => kind cancel; make-it-N => kind reprepare with args.qty=N.",
    "Output STRICT JSON only, no markdown fences, exactly this shape:",
    '{"intent":"<short intent id>","reply":"<Hinglish reply>","plan":{"kind":"respond|navigate|tool|prepare|reprepare|execute|cancel","tool":"<tool or empty string>","args":{},"tab":"<tab or empty string>"}}',
    'Allowed kind="tool" tools: ' + LLM_TOOLS.tool.join(", ") + ".",
    'Allowed kind="prepare"/"reprepare" tools: ' + LLM_TOOLS.prepare.join(", ") + ".",
    'Allowed kind="navigate" tabs: ' + LLM_TABS.join(", ") + ".",
    'For kind respond/cancel/execute: tool, args, tab must be empty strings/objects. args only for tool/prepare/reprepare, e.g. {"item":"shirt","qty":20,"quality":"good"} (quality: good|poor|damaged); maintenance uses {"type":"","desc":"..."}; searchItems uses {"q":"..."}; pendingDemands/maintenanceList/stockSummary take {}.',
    "Greeting (hello/hi/Hello IMS) => intent greet, kind respond, warm Hinglish reply listing a few things you can do.",
    "Help request => intent help, kind respond listing capabilities: navigate tabs, add stock, raise demand, issue items, consumable add, adjust stock, pending demands, maintenance list, stock summary, search item.",
    "Out-of-scope or unclear => kind respond and ask ONE short clarifying question. NEVER invent tools or tabs outside the lists."
  ].join("\n");
}

/* Coerce the model's JSON into the app plan contract; throw on garbage so the caller falls back to local NLU. */
function llmNormalize(obj) {
  if (!obj || typeof obj !== "object") throw new Error("llm: not an object");
  const out = { intent: String(obj.intent || "unknown").slice(0, 40), reply: String(obj.reply || "").slice(0, 1200), plan: null };
  const p = obj.plan && typeof obj.plan === "object" ? obj.plan : null;
  if (p) {
    const kind = String(p.kind || "respond");
    if (LLM_PLAN_KINDS.indexOf(kind) === -1) throw new Error("llm: bad kind " + kind);
    const plan = { kind: kind, tool: "", args: {}, tab: "" };
    const tool = String(p.tool || "").trim();
    if (tool) {
      const allowed = LLM_TOOLS[kind];
      if (!allowed || allowed.indexOf(tool) === -1) throw new Error("llm: bad tool " + tool);
      plan.tool = tool;
    }
    if (p.args && typeof p.args === "object" && !Array.isArray(p.args)) plan.args = p.args;
    const tab = String(p.tab || "").trim();
    if (tab) {
      if (kind !== "navigate" || LLM_TABS.indexOf(tab) === -1) throw new Error("llm: bad tab " + tab);
      plan.tab = tab;
    }
    out.plan = plan;
  }
  if (out.plan && (out.plan.kind === "tool" || out.plan.kind === "prepare" || out.plan.kind === "reprepare") && !out.plan.tool) throw new Error("llm: missing tool");
  return out;
}

function llmExtractJson(text) {
  let t = String(text || "").trim();
  t = t.replace(/^\u0060\u0060\u0060(?:json)?/i, "").replace(/\u0060\u0060\u0060$/, "").trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a === -1 || b === -1 || b <= a) throw new Error("llm: no JSON object");
  return JSON.parse(t.slice(a, b + 1));
}

async function llmInterpret(cfg, message, ctx) {
  const sys = llmSystemPrompt(ctx);
  const contents = [];
  const hist = Array.isArray(ctx.history) ? ctx.history.slice(-6) : [];
  for (const h of hist) {
    const role = h && h.role === "agent" ? "model" : "user";
    const txt = String((h && h.text) || "").slice(0, 500);
    if (txt) contents.push({ role: role, parts: [{ text: txt }] });
  }
  contents.push({ role: "user", parts: [{ text: String(message || "").slice(0, 2000) }] });
  const url = cfg.base + encodeURIComponent(cfg.model) + ":generateContent?key=" + encodeURIComponent(cfg.key);
  const ac = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ac ? setTimeout(function () { try { ac.abort(); } catch (e) {} }, 12000) : null;
  let res, data;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 800, responseMimeType: "application/json" }
      }),
      signal: ac ? ac.signal : undefined
    });
  } finally { if (timer) clearTimeout(timer); }
  if (!res.ok) throw new Error("llm: HTTP " + res.status);
  data = await res.json();
  const cand = data && data.candidates && data.candidates[0];
  const parts = cand && cand.content && cand.content.parts ? cand.content.parts : [];
  const text = parts.map(function (p) { return (p && p.text) || ""; }).join("");
}

module.exports.llmInterpret = llmInterpret;
module.exports.llmNormalize = llmNormalize;

async function handleAgent(req, res, preBody) {
  let body = (preBody && typeof preBody === "object" && Object.keys(preBody).length) ? preBody : await readBody(req);
  const { user } = await authFromRequest(req);
  if (!user) return sendJson(res, 401, { ok: false, error: "Not authenticated", reply: "Pehle login karein." });
  const message = String(body.message || "").slice(0, 2000);
  const ctx = body.context || {};
  const full = {
    userId: user.id, userName: user.name || user.username, role: user.role,
    districtId: user.districtId, locationId: user.locationId,
    page: ctx.page || "", module: ctx.module || "",
    pending: ctx.pending || null, pendingConfirmed: !!ctx.pendingConfirmed,
    history: Array.isArray(ctx.history) ? ctx.history : []
  };
  let result = null;
  let provider = "local";
  const cfg = llmConfig();
  if (cfg) {
    try { result = await llmInterpret(cfg, message, full); provider = cfg.name; } catch (e) { result = null; }
  }
  if (!result) { try { result = localInterpret(message, full); } catch (e) { result = { intent: "error", reply: "Agent error: " + e.message, plan: null }; } }
  /* normalize + gate */
  const plan = result.plan || null;
  if (plan && plan.kind === "execute" && !full.pendingConfirmed && result.intent !== "confirm_execute") {
    plan.kind = "respond"; result.reply = "Pehle details confirm karni hongi.";
  }
  if (plan && plan.kind === "prepare" && plan.tool && roleBlocked(plan.tool, user.role)) {
    plan.kind = "respond";
    result.reply = "Aapke role (developer admin) ko ye modification allowed nahi hai — existing IMS rule.";
  }
  return sendJson(res, 200, {
    ok: true,
    intent: result.intent || "unknown",
    reply: result.reply || "",
    say: result.say || result.reply || "",
    state: result.state || null,
    plan: plan,
    provider: provider
  });
}

module.exports = handleAgent;
module.exports.handleAgent = handleAgent;
module.exports.localInterpret = localInterpret;
module.exports.llmConfig = llmConfig;
module.exports.llmInterpret = llmInterpret;
module.exports.llmNormalize = llmNormalize;