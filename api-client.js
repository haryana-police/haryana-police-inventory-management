// ============================================================
// Realtime push: when a websocket sidecar is reachable the app
// receives instant pushed events; if it's offline the app falls back
// to /api/rtstream long-poll automatically (see app.js __rt module).
var CONFIG = {
  useRemote: true,   // true = use the local server + JSON file database (fully local, no cloud)
  apiBase: "",       // relative base; __api() APPENDS "/api/..." to it
  wsUrl: "", // no external sidecar — realtime uses the local /api/rtstream long-poll
};

var __apiCache = {};
var __prefix = "hp_inventory.";
var __apiSaveTimer = null;
var __apiReady = false;

var __apiQueue = Promise.resolve();
var __bootPromise = Promise.resolve();

function __api(method, path, body) {
  const url = CONFIG.apiBase + "/api/" + path;
  const headers = { "Content-Type": "application/json" };
  const token = __authToken();
  if (token) headers["Authorization"] = "Bearer " + token;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const __ctrl = new AbortController();
  const __timeoutMs = (path && String(path).startsWith("grievances")) ? 120000 : 15000;
  const __timer = setTimeout(() => __ctrl.abort(), __timeoutMs);
  opts.signal = __ctrl.signal;
  return fetch(url, opts).finally(() => clearTimeout(__timer)).then(r => {
    if (!r.ok) {
      const err = new Error(method + " " + path + " -> " + r.status);
      err.status = r.status;
      return r.json().then(b => { err.body = b; throw err; }, () => { throw err; });
    }
    return r.json();
  });
}

function __authToken() {
  try {
    const key = __prefix + "auth";
    const a = JSON.parse(localStorage.getItem(key) || sessionStorage.getItem(key));
    return a && a.token ? a.token : null;
  } catch { return null; }
}

// Keep the last acknowledged snapshot separate from optimistic edits.
var __apiBase = {};
var __apiSaving = false;
var __apiLastWrite = Promise.resolve();
function __stateEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function __hasPendingState() {
  return Object.keys(__apiCache).some(key => !__stateEqual(__apiCache[key], __apiBase[key]));
}
async function __apiLoadAll() {
  const state = await __api("GET", "state");
  if (!__apiSaving && !__hasPendingState()) {
    __apiCache = state || {};
    __apiBase = JSON.parse(JSON.stringify(__apiCache));
  } else if (!__apiReady) {
    __apiCache = state || {};
    __apiBase = JSON.parse(JSON.stringify(__apiCache));
  }
  __apiReady = true;
  return state;
}
window.__apiLoadAll = __apiLoadAll;

async function __persistStateNow() {
  const snapshot = JSON.parse(JSON.stringify(__apiCache));
  const changedKeys = Object.keys(snapshot).filter(key => !__stateEqual(snapshot[key], __apiBase[key]));
  if (!changedKeys.length) return;
  const baseState = {};
  for (const key of changedKeys) baseState[key] = __apiBase[key] === undefined ? null : __apiBase[key];
  const requestId = globalThis.crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  __apiSaving = true;
  try {
    const payload = { state: snapshot, baseState, changedKeys, requestId };
    let result;
    try { result = await __api("POST", "state", payload); }
    catch (error) {
      if (error.status) throw error;
      // A lost response may follow a committed write. Reuse its receipt ID.
      result = await __api("POST", "state", payload);
    }
    __apiBase = snapshot;
    if (result && Array.isArray(result.users)) {
      const key = __prefix + "users";
      if (__stateEqual(__apiCache[key], snapshot[key])) __apiCache[key] = result.users;
      __apiBase[key] = JSON.parse(JSON.stringify(result.users));
    }
  } catch (error) {
    try {
      const state = await __api("GET", "state");
      __apiCache = state || {};
      __apiBase = JSON.parse(JSON.stringify(__apiCache));
      if (typeof window.__rbacResynced === "function") window.__rbacResynced(error);
    } catch (refreshError) {
      if (typeof window.__writeFailed === "function") window.__writeFailed(error);
    }
    throw error;
  } finally { __apiSaving = false; }
}
function __queuePersist() {
  __apiLastWrite = __apiQueue.catch(() => {}).then(__persistStateNow);
  __apiQueue = __apiLastWrite.catch(error => {
    console.error("save to server failed:", error);
    if (typeof toast === "function") toast(error.body?.error || "Save failed. Check the connection and refresh before retrying.", "error");
  });
  return __apiLastWrite;
}
function __apiPersist() {
  clearTimeout(__apiSaveTimer);
  __apiSaveTimer = setTimeout(() => {
    __apiSaveTimer = null;
    __queuePersist().catch(() => {});
  }, 400);
}
window.__apiFlush = async function() {
  if (!CONFIG.useRemote) return;
  await __ensureReady();
  clearTimeout(__apiSaveTimer);
  __apiSaveTimer = null;
  return __queuePersist();
};
window.__apiLoadFn = function(key) {
  const name = __prefix + key;
  return Object.prototype.hasOwnProperty.call(__apiCache, name) ? __apiCache[name] : null;
};
window.__apiSaveFn = function(key, data) {
  __apiCache[__prefix + key] = data;
  if (__apiReady) __apiPersist();
  else __ensureReady().then(__apiPersist);
};
window.__apiPoll = function() {
  if (__apiSaving || __apiSaveTimer !== null || __hasPendingState()) return Promise.resolve();
  return __apiLoadAll().catch(error => console.error("poll failed:", error));
};

function __ensureReady() {
  if (__apiReady) return Promise.resolve();
  return __apiLoadAll().catch(e => { console.error(e); __apiReady = true; });
}

// Bootstrap: load remote state before app.js runs its seed/init.
// Expose a ready promise so app.js can wait for remote data.
window.__apiReadyPromise = __bootPromise;
__bootPromise = (async function __boot() {
  if (CONFIG.useRemote) {
    try { await Promise.race([__apiLoadAll(), new Promise(res => setTimeout(res, 9000))]); } catch (e) { console.error("load from server failed:", e); }
  }
})();
