(function () {
"use strict";
/* IMS Agent — floating assistant for IMS (2026.09.154) */
/* Wake word "Hello IMS" + click icon + text — all enter the same core pipeline. */
/* Tools drive the EXISTING IMS functions/forms — no parallel business logic. */

var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
var INACTIVITY_MS = 90000;
var AG = { booted: false, open: false, comm: false, state: "IDLE", pending: null, confirmed: false, history: [], recWant: null, rec: null, timer: null, voiceMode: false };

function el(id) { return document.getElementById(id); }
function q(s) { return document.querySelector(s); }
function qa(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
function fire(elx, ev) { if (elx) elx.dispatchEvent(new Event(ev, { bubbles: true })); }
function setVal(elx, v) { if (!elx) return false; elx.value = v; fire(elx, "change"); return true; }
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function lower(s) { return String(s || "").toLowerCase(); }

/* ---------- UI build ---------- */
function build() {
  if (el("imsAgentFab")) return;
  var fab = document.createElement("button");
  fab.id = "imsAgentFab";
  fab.type = "button";
  fab.title = "IMS Agent (voice + chat)";
  fab.setAttribute("aria-label", "Open IMS Agent");
  fab.innerHTML = '<span class="imsag-fab-ico">🤖</span><span class="imsag-fab-dot"></span>';
  document.body.appendChild(fab);
  var panel = document.createElement("div");
  panel.id = "imsAgentPanel";
  panel.className = "imsag-hidden";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "IMS Agent");
  var head = '<div class="imsag-head"><span class="imsag-dot" id="imsagDot"></span><div class="imsag-head-txt"><div class="imsag-title">IMS Agent</div><div class="imsag-state" id="imsagState">Idle</div></div><div class="imsag-head-btns"><button type="button" class="imsag-hbtn" id="imsagMin" title="Minimize">–</button><button type="button" class="imsag-hbtn" id="imsagClose" title="Close">✕</button></div></div>';
  var msgs = '<div class="imsag-msgs" id="imsagMsgs"></div>';
  var confirmBar = '<div class="imsag-confirm imsag-hidden" id="imsagConfirm"><button type="button" class="imsag-cbtn imsag-cyes" id="imsagYes">✔ Yes / हाँ</button><button type="button" class="imsag-cbtn imsag-cno" id="imsagNo">✖ No / नहीं</button></div>';
  var input = '<div class="imsag-inputrow"><button type="button" class="imsag-mic" id="imsagMic" title="Voice input">🎤</button><input type="text" id="imsagText" placeholder="Type or speak... (Hindi/English)" autocomplete="off"><button type="button" class="imsag-send" id="imsagSend" title="Send">➤</button></div>';
  panel.innerHTML = head + msgs + confirmBar + input;
  document.body.appendChild(panel);
  fab.addEventListener("click", togglePanel);
  el("imsagClose").addEventListener("click", function () { sleep(); hidePanel(); });
  el("imsagMin").addEventListener("click", function () { panel.classList.toggle("imsag-min"); });
  el("imsagSend").addEventListener("click", submitText);
  el("imsagText").addEventListener("keydown", function (e) { if (e.key === "Enter") submitText(); });
  var mic = el("imsagMic");
  if (!SR) { mic.disabled = true; mic.title = "Voice not supported in this browser"; mic.style.opacity = ".4"; }
  else mic.addEventListener("click", toggleMic);
  el("imsagYes").addEventListener("click", function () { answerConfirm(true); });
  el("imsagNo").addEventListener("click", function () { answerConfirm(false); });
}
function togglePanel() {
  var p = el("imsAgentPanel");
  if (!p) return;
  if (p.classList.contains("imsag-hidden")) openPanel(); else hidePanel();
}
function openPanel() {
  var p = el("imsAgentPanel"); if (!p) return;
  p.classList.remove("imsag-hidden");
  AG.open = true;
  if (!AG.comm) setState("IDLE");
  var t = el("imsagText"); if (t) t.focus();
}
function hidePanel() {
  var p = el("imsAgentPanel"); if (!p) return;
  p.classList.add("imsag-hidden");
  AG.open = false;
}
function setState(s) {
  AG.state = s;
  var d = el("imsagDot"), st = el("imsagState");
  if (d) d.setAttribute("data-state", s);
  if (st) {
    var map = { IDLE: "Idle — say \"Hello IMS\"", WAKE_DETECTED: "Wake detected", GREETING: "Hello!", LISTENING: "🎤 Listening...", TRANSCRIBING: "Transcribing...", THINKING: "◌ Understanding...", ASKING: "Waiting for your reply", WAITING_FOR_PERMISSION: "Permission needed", WAITING_FOR_CONFIRMATION: "Confirm? Yes / No", WORKING: "⚙ Working...", SPEAKING: "🔊 Speaking...", SUCCESS: "Done ✓", ERROR: "Error", SLEEPING: "Sleeping" };
    st.textContent = map[s] || s;
  }
}
function addMsg(who, text) {
  var box = el("imsagMsgs"); if (!box) return;
  var m = document.createElement("div");
  m.className = "imsag-msg imsag-" + who;
  m.textContent = text;
  box.appendChild(m);
  box.scrollTop = box.scrollHeight;
}
function showConfirm(show) {
  var c = el("imsagConfirm"); if (c) c.classList.toggle("imsag-hidden", !show);
}

/* ---------- voice: TTS + STT + wake word ---------- */
function pickVoice() {
  try {
    var vs = speechSynthesis.getVoices() || [];
    var hi = vs.filter(function (v) { return /hi[-_]IN/i.test(v.lang); })[0];
    var enIn = vs.filter(function (v) { return /en[-_]IN/i.test(v.lang); })[0];
    return hi || enIn || vs[0] || null;
  } catch (e) { return null; }
}
function speak(text, thenListen) {
  if (!text) { if (thenListen && AG.comm) setState("LISTENING"); return; }
  try {
    if (window.speechSynthesis) {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text).replace(/[✓✔✖⚙●◌]/g, ""));
      var v = pickVoice(); if (v) u.voice = v;
      u.lang = v ? v.lang : (/[\u0900-\u097F]/.test(text) ? "hi-IN" : "en-IN");
      u.rate = 1;
      u.onstart = function () { setState("SPEAKING"); };
      u.onend = function () { if (thenListen && AG.comm) startRec("comm"); else setState(AG.comm ? "LISTENING" : "IDLE"); };
      speechSynthesis.speak(u);
      return;
    }
  } catch (e) {}
  if (thenListen && AG.comm) startRec("comm");
}
function isWakePhrase(t) {
  return /\b(hello|hey|ok)\s*(i\.?m\.?s)\b/i.test(t) || /[\u0939\u0947\u0932\u094b][\u0020]?[\u0906\u0907].{0,3}\u090F\u092E\u090F\u0938/i.test(t) || /\u0939\u0947\u0932\u094d\u0932\u094b\s*\u0906\u0908\u090f\u092e\u090f\u0938/i.test(t);
}
function startRec(mode) {
  if (!SR) return;
  stopRec();
  AG.recWant = mode;
  tryRec(mode, 0);
}
function tryRec(mode, attempt) {
  if (AG.recWant !== mode || !SR) return;
  try {
    var r = new SR();
    AG.rec = r;
    r.lang = (/[\u0900-\u097F]/.test((AG.history.lastText || ""))) ? "hi-IN" : "en-IN";
    r.continuous = mode === "wake";
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = function (ev) {
      var fin = "", inter = "";
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var res = ev.results[i];
        if (res.isFinal) fin += res[0].transcript;
        else inter += res[0].transcript;
      }
      if (mode === "wake") {
        if (fin && isWakePhrase(fin)) { wake(); return; }
        if (inter && isWakePhrase(inter)) { wake(); return; }
      } else {
        setState("LISTENING");
        if (fin && fin.trim()) {
          var txt = fin.trim();
          if (AG.comm) { handleText(txt, "voice"); }
        }
      }
    };
    r.onerror = function (ev) {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") { AG.recWant = null; if (AG.open) addMsg("agent", "Mic permission nahi mili — text se baat karein."); }
    };
    r.onend = function () {
      if (AG.recWant === mode) { if (attempt < 50) setTimeout(function () { tryRec(mode, attempt + 1); }, 350); }
    };
    r.start();
  } catch (e) { if (attempt < 5) setTimeout(function () { tryRec(mode, attempt + 1); }, 800); }
}
function stopRec() {
  try { if (AG.rec) { AG.rec.onend = null; AG.rec.stop(); } } catch (e) {}
  AG.rec = null;
}
function toggleMic() {
  if (!SR) return;
  if (AG.comm && AG.recWant === "comm") { AG.recWant = null; stopRec(); setState("IDLE"); return; }
  if (!AG.comm) { AG.comm = true; resetTimer(); }
  startRec("comm");
}
function wake() {
  if (AG.comm) return;
  AG.comm = true;
  AG.recWant = null; stopRec();
  openPanel();
  setState("GREETING");
  var g = "Hello! I'm ready. How can I help you?";
  addMsg("agent", g);
  resetTimer();
  speak(g, true);
}
function sleep() {
  AG.comm = false;
  AG.confirmed = false;
  showConfirm(false);
  AG.recWant = null;
  stopRec();
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  if (AG.timer) { clearTimeout(AG.timer); AG.timer = null; }
  setState("SLEEPING");
  setTimeout(function () { if (!AG.comm) setState("IDLE"); }, 1500);
  if (SR && AG.booted) setTimeout(function () { if (!AG.comm) startRec("wake"); }, 1800);
}
function resetTimer() {
  if (AG.timer) clearTimeout(AG.timer);
  AG.timer = setTimeout(function () { if (AG.comm) { addMsg("agent", "Inactivity — going to sleep. 'Hello IMS' se dobara jagaiye."); sleep(); } }, INACTIVITY_MS);
}

/* ---------- context + pipeline ---------- */
function currentView() {
  var v = qa(".view").filter(function (x) { return !x.classList.contains("hidden"); })[0];
  if (!v) return { page: "", module: "" };
  var id = (v.id || "").replace(/^view-/, "");
  return { page: id, module: id };
}
function getToken() {
  try {
    var raw = localStorage.getItem("hp_inventory.auth") || sessionStorage.getItem("hp_inventory.auth");
    var a = raw ? JSON.parse(raw) : null;
    return a && a.token ? a.token : "";
  } catch (e) { return ""; }
}
function buildContext() {
  var v = currentView();
  var cu = (function () { try { return (typeof currentUser !== "undefined" && currentUser) ? currentUser : {}; } catch (e) { return {}; } })();
  return {
    page: v.page, module: v.module,
    pending: AG.pending ? { tool: AG.pending.tool, summary: AG.pending.summary, args: AG.pending.args, executeLine: AG.pending.executeLine } : null,
    pendingConfirmed: AG.confirmed,
    history: AG.history.slice(-6),
    userName: cu.name || cu.username || "", role: cu.role || "", districtName: (window.activeDistrictId || ""), locationName: (window.getVisibleLocationId ? (window.getVisibleLocationId() || "") : "")
  };
}
function submitText() {
  var t = el("imsagText");
  if (!t || !t.value.trim()) return;
  var v = t.value.trim();
  t.value = "";
  if (AG.comm) resetTimer();
  handleText(v, "text");
}
function answerConfirm(yes) { AG.confirmed = !!yes;
  showConfirm(false);
  if (AG.comm) resetTimer();
  handleText(yes ? "yes confirm" : "no cancel", "ui");
}
function handleText(text, source) {
  text = String(text || "").trim();
  if (!text) return;
  AG.history.push({ role: "user", text: text });
  addMsg("user", text);
  AG.history.lastText = text;
  if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) {} }
  setState("THINKING");
  var token = getToken();
  fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
    body: JSON.stringify({ message: text, context: buildContext() })
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (!d || d.ok === false) {
      setState("ERROR");
      var m = (d && d.reply) || (d && d.error === "Not authenticated" ? "Session expire — dobara login karein." : "Agent se baat nahi ho payi.");
      addMsg("agent", m);
      speak(m, true);
      return;
    }
    AG.history.push({ role: "agent", text: d.reply || "" });
    execPlan(d, source);
  }).catch(function (e) {
    setState("ERROR");
    var m = "Agent server error: " + e.message;
    addMsg("agent", m);
    speak(m, true);
  });
}

/* ---------- plan executor: drives EXISTING IMS functions ---------- */
function navigate(tab, subtab) {
  try {
    if (typeof switchTab === "function" && tab) switchTab(tab);
    if (tab === "inventory" && subtab) { var b = q('[data-invt="' + subtab + '"]'); if (b) b.click(); }
    if (tab === "consumables" && typeof __consShowTab === "function" && subtab) __consShowTab(subtab);
    return true;
  } catch (e) { return false; }
}
function findItems(word, cons) {
  var src = [];
  try { src = cons ? getConsItems() : getItems(); } catch (e) { src = []; }
  var w = lower(word);
  return src.filter(function (i) { return lower(i.name).indexOf(w) !== -1 || w.indexOf(lower(i.name)) !== -1; });
}
function findCat(word, cons) {
  var src = [];
  try { src = cons ? getConsCats() : getCategories(); } catch (e) { src = []; }
  var w = lower(word);
  var hit = src.filter(function (c) { return w && lower(c.name).indexOf(w) !== -1; });
  if (hit.length === 1) return hit[0];
  for (var i = 0; i < src.length; i++) { try { if (typeof getItems === "function" && getItems().some(function (it) { return it.categoryId === src[i].id && lower(it.name).indexOf(w) !== -1; })) return src[i]; } catch (e) {} }
  return null;
}
function fmtItems(list, withAvail) {
  return list.slice(0, 5).map(function (i) {
    var cat = "";
    try { var c = (getCategories() || []).filter(function (x) { return x.id === i.categoryId; })[0]; cat = c ? " (" + c.name + ")" : ""; } catch (e) {}
    var av = "";
    try { if (withAvail && typeof availableQty === "function") av = " — available " + availableQty(i); } catch (e) {}
    return "• " + i.name + cat + av;
  }).join("\n");
}
function toolResult(tool, args) {
  args = args || {};
  if (tool === "searchItems") {
    var w = lower(args.q || "");
    if (!w) return "Kya search karna hai?";
    var st = findItems(w, false), cs = findItems(w, true);
    var out = [];
    if (st.length) out.push("Stock items:\n" + fmtItems(st, true));
    if (cs.length) out.push("Consumables:\n" + fmtItems(cs, false));
    return out.length ? out.join("\n") : "\"" + w + "\" database me nahi mila.";
  }
  if (tool === "pendingDemands") {
    var ds = []; try { ds = getDemands() || []; } catch (e) {}
    var pd = ds.filter(function (d) { return (d.status || "pending") === "pending"; });
    if (!pd.length) return "Aapke district me koi pending demand nahi hai.";
    var lines = pd.slice(0, 5).map(function (d) {
      var its = (d.demandItems || []).map(function (x) { return x.itemName + " ×" + x.quantity; }).join(", ");
      return "• " + (d.demandId || d.id || "") + " — " + (its || "(items)") + " [" + (d.urgency || "normal") + "]";
    });
    return "Pending demands: " + pd.length + "\n" + lines.join("\n");
  }
  if (tool === "stockSummary") {
    var its = []; try { its = getItems() || []; } catch (e) {}
    var tot = 0, low = 0;
    its.forEach(function (i) { try { tot += (typeof availableQty === "function" ? availableQty(i) : (i.quantity || 0)); if ((i.minQty || 0) > 0 && availableQty(i) <= (i.minQty || 0)) low++; } catch (e) {} });
    var cons = []; try { cons = getConsItems() || []; } catch (e) {}
    var ctot = 0; cons.forEach(function (i) { try { ctot += (i.quantity || 0); } catch (e) {} });
    return "Inventory: " + its.length + " items, total available " + tot + (low ? (", " + low + " low-stock") : "") + ". Consumables: " + cons.length + " items, qty " + ctot + ".";
  }
  if (tool === "maintenanceList") {
    var ms = []; try { ms = getMaintenance() || []; } catch (e) {}
    var op = ms.filter(function (m) { return (m.status || "open") === "open"; });
    if (!op.length) return "Koi open maintenance request nahi hai.";
    return "Open maintenance: " + op.length + "\n" + op.slice(0, 5).map(function (m) { return "• " + (m.type || m.maintenanceType || "(type)") + " — " + (m.description || "").slice(0, 60); }).join("\n");
  }
  return "Ye abhi supported nahi hai.";
}
function openModalOk(sel) {
  var m = q(sel);
  return !!(m && !m.classList.contains("hidden"));
}
function fillCatItem(catSel, itemSel, chosen) {
  if (catSel && chosen) {
    var has = false;
    try { var co = Array.prototype.slice.call(catSel.options); for (var i = 0; i < co.length; i++) { if (co[i].value === chosen.categoryId) { has = true; break; } } } catch (e) {}
    if (!has) { var o1 = document.createElement("option"); o1.value = chosen.categoryId; o1.textContent = "Item category"; catSel.appendChild(o1); }
    try { catSel.disabled = false; } catch (e) {}
    setVal(catSel, chosen.categoryId);
  }
  if (itemSel && chosen) {
    var has2 = false;
    try { var io = Array.prototype.slice.call(itemSel.options); for (var j = 0; j < io.length; j++) { if (io[j].value === chosen.id) { has2 = true; break; } } } catch (e) {}
    if (!has2) { var o2 = document.createElement("option"); o2.value = chosen.id; o2.textContent = chosen.name; itemSel.appendChild(o2); }
    try { itemSel.disabled = false; } catch (e) {}
    setVal(itemSel, chosen.id);
  }
}

function prepare(tool, args) {
  args = args || {};
  var item = String(args.item || "").trim();
  var qty = parseInt(args.qty, 10) || 1;
  var qual = args.quality || "good";
  if (tool === "addStock") {
    try { openAddStockModal(); } catch (e) { return { ok: false, msg: "Add Stock nahi khula: " + e.message }; }
    if (!openModalOk("#addStockModal")) return { ok: false, msg: "Aapke paas stock add ki permission nahi hai (existing IMS rule)." };
    var row = q("#asRows .as-item-row");
    if (!row) return { ok: false, msg: "Row nahi mili." };
    var matches = item ? findItems(item, false) : [];
    if (item && !matches.length) return { ok: false, msg: "Item " + item + " inventory me nahi mila. Pehle Inventory me add karein, ya exact naam bolein." };
    if (matches.length > 1) {
      var mnames = matches.slice(0, 4).map(function (m2) { return m2.name; }).join(", ");
      return { ok: false, msg: "Kai items mile: " + mnames + ". Exact naam bolein." };
    }
    var chosen = matches[0] || null;
    fillCatItem(row.querySelector(".as-row-cat"), row.querySelector(".as-row-item"), chosen);
    var cat = chosen ? { id: chosen.categoryId, name: "" } : null;
    var qg = row.querySelector(".as-row-qty-good"), qp = row.querySelector(".as-row-qty-poor"), qd = row.querySelector(".as-row-qty-damaged");
    if (qual === "poor") { if (qp) qp.value = qty; }
    else if (qual === "damaged") { if (qd) qd.value = qty; }
    else { if (qg) qg.value = qty; }
    setVal(q("#asRemarks"), args.remarks || "ok");
    return { ok: true, summary: (chosen ? chosen.name : item) + " × " + qty + " (" + qual + ")" + (cat ? " — " + cat.name : ""), executeLine: "Stock add ho raha hai...", formId: "#addStockForm" };
  }
  if (tool === "demand") {
    try { openDemandModal(); } catch (e) { return { ok: false, msg: "Demand form nahi khula." }; }
    if (!openModalOk("#demandModal") && !openModalOk("#demandForm") && !q("#demandForm") === false) { /* pass */ }
    var stk = el("fdTypeStock"), cns = el("fdTypeCons");
    if (stk && !stk.checked) stk.click();
    var rows = qa("#fdItemsBody .fd-item-row");
    if (rows.length) {
      var r0 = rows[0];
      var dsel0 = r0.querySelector(".fd-row-cat");
      var dlist = item ? findItems(item, false) : [];
      var dchosen = dlist[0] || null;
      fillCatItem(dsel0, r0.querySelector(".fd-row-name"), dchosen);
      if (!dchosen && dsel0) setVal(dsel0, "");
      setVal(r0.querySelector(".fd-row-name"), item || "");
      setVal(r0.querySelector(".fd-row-qty"), String(qty));
    }
    setVal(el("fdReason"), "ok");
    return { ok: true, summary: "Demand: " + item + " × " + qty + (args.toLocation ? " → " + args.toLocation : ""), executeLine: "Demand submit ho rahi hai...", formId: "#demandForm" };
  }
  if (tool === "maintenance") {
    try { openMaintenanceModal(); } catch (e) { return { ok: false, msg: "Maintenance form nahi khula." }; }
    var desc = String(args.desc || "IMS Agent request").replace(/maintenance|request|raise|karo|banao|likho|karwao/gi, " ").replace(/\s+/g, " ").trim() || "IMS Agent request";
    setVal(el("maintDesc"), desc);
    return { ok: true, summary: "Maintenance: " + desc.slice(0, 60), executeLine: "Maintenance request bhej raha hoon...", formId: "#maintenanceForm" };
  }
  if (tool === "adjust") {
    var st2 = findItems(item, false);
    if (!st2.length) return { ok: false, msg: "Item \"" + item + "\" nahi mila." };
    try { openAdjustStock(st2[0].id); } catch (e) { return { ok: false, msg: "Adjust nahi khula: " + e.message }; }
    if (!openModalOk("#adjustModal")) return { ok: false, msg: "Aapke paas adjust ki permission nahi hai." };
    setVal(el("ajQty"), String(qty || 1));
    setVal(el("ajRemarks"), args.remarks || "ok");
    return { ok: true, summary: "Adjust " + st2[0].name + " — " + (args.type || "add") + " " + (qty || 1), executeLine: "Adjust lagoo ho raha hai..." };
  }
  if (tool === "consAdd") {
    try { openConsAdd(); } catch (e) { return { ok: false, msg: "Consumable add nahi khula." }; }
    if (!openModalOk("#consAddModal")) return { ok: false, msg: "Aapke paas consumables modify ki permission nahi hai." };
    var crow = q("#consRows .cons-item-row");
    if (!crow) return { ok: false, msg: "Row nahi mili." };
    var csel0 = crow.querySelector(".cons-row-cat");
    var clist = item ? findItems(item, true) : [];
    var cchosen = clist[0] || null;
    fillCatItem(csel0, crow.querySelector("select:nth-of-type(2)"), cchosen);
    var csel2 = crow.querySelector("select:nth-of-type(2)");
    var citem = item ? findItems(item, true) : [];
    if (csel2 && citem.length) setVal(csel2, citem[0].id);
    var cqty = crow.querySelector('input[type="number"]');
    if (cqty) cqty.value = String(qty);
    setVal(q("#consRemarks"), "ok");
    return { ok: true, summary: "Consumable: " + item + " × " + qty, executeLine: "Consumable add ho raha hai...", formId: "#consAddForm" };
  }
  if (tool === "issue") {
    try { openAllotModal(); } catch (e) { return { ok: false, msg: "Issue form nahi khula." }; }
    var ist = findItems(item, false);
    if (item && !ist.length) return { ok: false, msg: "Item \"" + item + "\" nahi mila." };
    var arow = q("#alItems .al-item-row") || q("#alItems .alloc-item-row");
    if (arow && ist.length) {
      var acs0 = arow.querySelector(".al-row-cats");
      var ais0 = arow.querySelector(".al-row-items");
      fillCatItem(acs0, ais0, ist[0] || null);
      var aq = arow.querySelector('.al-row-qty, input[type="number"]');
      if (aq) aq.value = String(qty);
    }
    return { ok: true, summary: "Issue form ready: " + (item || "(item)") + (ist.length ? " → " + ist[0].name : ""), executeLine: "Issue submit ho raha hai... (person details bhare hue hain?)", formId: "#allotForm" };
  }
  return { ok: false, msg: "Unknown tool." };
}
function execPlan(d, source) {
  var plan = d.plan || { kind: "respond" };
  var voice = source === "voice";
  var fin = function (text, st) {
    if (text) addMsg("agent", text);
    if (st) setState(st); else setState(AG.comm ? "LISTENING" : "IDLE");
    speak(text, source === "voice");
  };
  if (plan.kind === "respond" || !plan.kind) { fin(d.reply || ""); return; }
  if (plan.kind === "navigate") {
    var okN = navigate(plan.tab, plan.subtab);
    fin((okN ? "Khol diya: " : "Navigate fail: ") + (plan.tab || ""), okN ? "SUCCESS" : "ERROR");
    return;
  }
  if (plan.kind === "tool") {
    setState("WORKING");
    var outT = toolResult(plan.tool, plan.args);
    fin(outT, "SUCCESS");
    return;
  }
  if (plan.kind === "prepare" || plan.kind === "reprepare") {
    setState("WORKING");
    var pr = prepare(plan.tool, plan.args || {});
    if (!pr.ok) { fin(pr.msg, "ERROR"); return; }
    AG.pending = { tool: plan.tool, formId: pr.formId, summary: pr.summary, args: plan.args, executeLine: pr.executeLine };
    AG.confirmed = false;
    showConfirm(true);
    setState("WAITING_FOR_CONFIRMATION");
    var msg = d.reply || ("Prepare ho gaya:\n" + pr.summary + "\nConfirm karein? (Yes / No)");
    fin(msg);
    return;
  }
  if (plan.kind === "execute") {
    if (!AG.pending) { fin("Koi pending operation nahi hai.", "IDLE"); return; }
    setState("WORKING");
    var form = q(AG.pending.formId || "");
    if (!form) { fin("Form nahi mila — cancel.", "ERROR"); AG.pending = null; showConfirm(false); return; }
    var fid = form.id;
    var before = fid;
    try { form.dispatchEvent(new Event("submit", { cancelable: true })); } catch (e) { fin("Execute error: " + e.message, "ERROR"); return; }
    setTimeout(function () {
      var modal = form.closest(".modal-backdrop") || form.closest(".modal");
      var closed = !modal || modal.classList.contains("hidden");
      var toastEl = qa("[class*=toast]").filter(function (x) { return (x.textContent || "").trim(); })[0];
      var tmsg = toastEl ? toastEl.textContent.trim() : "";
      if (closed) {
        var okLine = "Ho gaya ✓ " + AG.pending.summary;
        addMsg("agent", okLine);
        setState("SUCCESS");
        speak(okLine, source === "voice");
        try { if (typeof __audit === "function") __audit("IMS Agent", "Executed " + AG.pending.tool + ": " + AG.pending.summary, { entity: "Agent" }); } catch (e) {}
      } else {
        fin(tmsg ? ("Nahi hua: " + tmsg) : "Form submit nahi hua — field check karein.", "ERROR");
      }
      AG.pending = null;
      AG.confirmed = false;
      showConfirm(false);
    }, 1400);
    return;
  }
  if (plan.kind === "cancel") {
    try { if (typeof closeModals === "function") closeModals(); } catch (e) {}
    AG.pending = null; AG.confirmed = false; showConfirm(false);
    fin(d.reply || "Cancel kar diya.", "IDLE");
    return;
  }
  fin(d.reply || "");
}

/* ---------- boot ---------- */
function bootCheck() {
  if (AG.booted) return; var __c = (function () { try { return (typeof currentUser !== "undefined" && currentUser) ? currentUser : null; } catch (e) { return null; } })(); if (!__c) return;
  AG.booted = true;
  build();
  addMsg("agent", "IMS Agent ready. 'Hello IMS' bolein (mic) ya niche type karein.");
  if (SR) startRec("wake");
}
var bootIv = setInterval(function () {
  try { bootCheck(); if (AG.booted) clearInterval(bootIv); } catch (e) {}
}, 2500);
bootCheck();
window.__imsAgent = { state: function () { return AG; }, handleText: handleText, wake: wake, sleep: sleep };
})();