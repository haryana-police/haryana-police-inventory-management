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
  const __timer = setTimeout(() => __ctrl.abort(), 15000);
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
    const a = JSON.parse(localStorage.getItem(__prefix + "auth"));
    return a && a.token ? a.token : null;
  } catch { return null; }
}

// Fetch full state from the server into local cache.
async function __apiLoadAll() {
  const state = await __api("GET", "state");
  // state is a map: "hp_inventory.xxx" -> value
  Object.keys(state || {}).forEach(k => { __apiCache[k] = state[k]; });
  __apiReady = true;
}

// Debounced full-state write.
function __apiPersist() {
  clearTimeout(__apiSaveTimer);
  __apiSaveTimer = setTimeout(() => {
    __apiQueue = __apiQueue.then(() =>
      __api("POST", "state", { state: JSON.parse(JSON.stringify(__apiCache)) })
    ).then(res => {
      // Server returns the sanitised users (passwords hashed & stripped);
      // refresh the cache so no plaintext lingers in browser memory.
      if (res && Array.isArray(res.users)) {
        __apiCache[__prefix + "users"] = res.users;
      }
    }).catch(e => {
      console.error("save to server failed:", e);
      // RBAC: the server is the source of truth for inventory ownership.
      // If it rejected our save (401/403), resync the local cache with the
      // server's authoritative state so any rejected change is reverted
      // locally too, then re-render.
      if (e && (e.status === 403 || e.status === 401)) {
        __api("GET", "state").then(s => {
          Object.keys(s || {}).forEach(k => { __apiCache[k] = s[k]; });
          if (typeof window.__rbacResynced === "function") window.__rbacResynced(e);
          else if (typeof render === "function") { try { render(); } catch (e2) {} }
        }).catch(() => {});
      }
    });
  }, 400);
}

// ============================================================
// PUBLIC OVERRIDES - app.js delegates to these via globals
// ============================================================

window.__apiLoadFn = function(key) {
  const storeKey = __prefix + key;
  return __apiCache.hasOwnProperty(storeKey) ? __apiCache[storeKey] : null;
};

window.__apiSaveFn = function(key, data) {
  const storeKey = __prefix + key;
  __apiCache[storeKey] = data;
  if (__apiReady) { __apiPersist(); }
  else {
    __ensureReady().then(() => __apiPersist());
  }
};

// Live refresh: fetch latest state from the server into the local cache
// (no page reload needed). Called periodically by app.js.
window.__apiPoll = function() {
  if (__apiSaveTimer !== null) return Promise.resolve();
  return __api("GET", "state")
    .then(state => {
      Object.keys(state || {}).forEach(k => { __apiCache[k] = state[k]; });
    })
    .catch(e => console.error("poll failed:", e));
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