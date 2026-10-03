/* ============================================================
   ITEM PROFILE / ITEM 360° VIEW — Haryana Police Inventory
   2026.09.79 — unified, computed view over EXISTING records.
   Loads after app.js; uses only existing globals + state stores.
   ============================================================ */
"use strict";
(function () {
  var VERSION = "2026.09.199";
  var VIEW_ID = "view-itemprofile";
  var state = {
    itemId: null, item: null, districtId: null,
    txs: [], view: [], page: 0, pageSize: 25,
    sortKey: "ts", sortDir: -1,
    q: "", fType: "", fCond: "", fFrom: "", fTo: "", fUnit: "",
    built: false, photos: [], kind: "stock", prevTab: null
  };
  window.__ipVersion = VERSION;

  /* ---------- helpers ---------- */
  function esc(s) { return window.esc ? window.esc(s) : String(s == null ? "" : s); }
  function fmtN(n) { return (Number(n) || 0).toLocaleString("en-IN"); }
  function fmtDT(ts) {
    if (!ts) return "\u2014";
    var d = new Date(ts);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) + " " +
      d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }
  function fmtD(ts) { return ts ? new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "\u2014"; }
  function fmtT(ts) { if (!ts) return "\u2014"; return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); }
  function locName(districtId, locId) {
    if (!locId) return "";
    var l = (window.getAllLocations ? (getAllLocations()[districtId] || []) : []).find(function (x) { return x.id === locId; });
    return l ? l.name : locId;
  }
  function catName(id) {
    var c = (getCategories() || []).find(function (x) { return x.id === id; });
    return c ? c.name : "";
  }
  function distName(id) {
    var d = (getDistricts() || []).find(function (x) { return x.id === id; });
    return d ? d.name : (id || "");
  }
  function user() { try { return (typeof currentUser !== "undefined" && currentUser) || null; } catch (e) { return null; } }
  function canManagePhotos(item) {
    var u = user();
    if (!u || u.role === "devadmin") return false;
    if (state.kind === "cons") return true;
    if (u.role === "admin") return true;
    return !!window.itemOwnedByCurrentUser && itemOwnedByCurrentUser(item);
  }
  function visibleLocFilter() {
    try { return window.getVisibleLocationId ? getVisibleLocationId() : null; } catch (e) { return null; }
  }

  /* ---------- item lookup anywhere (stock & consumables across districts) ---------- */
  function findItemAnywhere(id) {
    if (!id) return null;
    var districts = (window.getDistricts ? getDistricts() : []) || [];
    for (var i = 0; i < districts.length; i++) {
      var it = (window.getItemsForDistrict ? getItemsForDistrict(districts[i].id) : []).find(function (x) { return x && x.id === id; });
      if (it) return { item: it, districtId: districts[i].id, kind: "stock" };
    }
    var all = (window.getAllItems ? getAllItems() : (loadData("items") || {}));
    for (var d in all) {
      var arr = all[d] || [];
      for (var j = 0; j < arr.length; j++) {
        if (arr[j] && arr[j].id === id) return { item: arr[j], districtId: d, kind: "stock" };
      }
    }
    return null;
  }

  function findConsItemAnywhere(id) {
    if (!id) return null;
    var map = loadData("consumable_items") || {};
    var ids = [activeDistrictId].concat(Object.keys(map));
    var seen = {};
    for (var i = 0; i < ids.length; i++) {
      var d = ids[i];
      if (!d || seen[d]) continue;
      seen[d] = 1;
      var arr = map[d] || [];
      for (var j = 0; j < arr.length; j++) {
        if (arr[j] && arr[j].id === id) return { item: arr[j], districtId: d, kind: "cons" };
      }
    }
    return null;
  }

  function findItemOrConsByName(name, hint) {
    if (!name) return null;
    if (hint && hint.id) {
      var byId = findItemAnywhere(hint.id) || findConsItemAnywhere(hint.id);
      if (byId) return byId;
    }
    var raw = String(name).trim();
    var clean = raw.toLowerCase();
    var enPart = (window.nameEnHi ? (window.nameEnHi(raw) || {}).en : "").trim().toLowerCase();
    var hiPart = (window.nameEnHi ? (window.nameEnHi(raw) || {}).hi : "").trim().toLowerCase();

    function match(item) {
      if (!item || !item.name) return false;
      var iname = String(item.name).trim();
      var iclean = iname.toLowerCase();
      if (iclean === clean) return true;
      var iEn = (window.nameEnHi ? (window.nameEnHi(iname) || {}).en : "").trim().toLowerCase();
      var iHi = (window.nameEnHi ? (window.nameEnHi(iname) || {}).hi : "").trim().toLowerCase();
      if (enPart && iEn && (enPart === iEn || iclean === enPart || iEn === clean)) return true;
      if (hiPart && iHi && (hiPart === iHi || iclean === hiPart || iHi === clean)) return true;
      if (clean.length >= 3 && (iclean.indexOf(clean) === 0 || clean.indexOf(iclean) === 0)) return true;
      if (enPart && enPart.length >= 3 && iEn && (iEn.indexOf(enPart) === 0 || enPart.indexOf(iEn) === 0)) return true;
      return false;
    }

    // 1. Current district stock items (all locations first, then active location)
    var stockCur = (window.getAllDistrictItems ? getAllDistrictItems() : [])
      .concat(window.getItems ? getItems() : []);
    for (var s = 0; s < stockCur.length; s++) {
      if (match(stockCur[s])) return { item: stockCur[s], districtId: activeDistrictId, kind: "stock" };
    }

    // 2. Current district consumable items
    var consCur = window.getConsItems ? getConsItems() : [];
    for (var c = 0; c < consCur.length; c++) {
      if (match(consCur[c])) return { item: consCur[c], districtId: activeDistrictId, kind: "cons" };
    }

    // 3. Hinted district
    if (hint && hint.districtId && hint.districtId !== activeDistrictId) {
      var dStock = window.getItemsForDistrict ? getItemsForDistrict(hint.districtId) : [];
      for (var ds = 0; ds < dStock.length; ds++) {
        if (match(dStock[ds])) return { item: dStock[ds], districtId: hint.districtId, kind: "stock" };
      }
      var cMap = loadData("consumable_items") || {};
      var dCons = cMap[hint.districtId] || [];
      for (var dc = 0; dc < dCons.length; dc++) {
        if (match(dCons[dc])) return { item: dCons[dc], districtId: hint.districtId, kind: "cons" };
      }
    }

    // 4. All districts in stock items
    var allItems = (window.getAllItems ? getAllItems() : (loadData("items") || {}));
    for (var dist in allItems) {
      var arr = allItems[dist] || [];
      for (var a = 0; a < arr.length; a++) {
        if (match(arr[a])) return { item: arr[a], districtId: dist, kind: "stock" };
      }
    }

    // 5. All districts in consumable items
    var allCons = loadData("consumable_items") || {};
    for (var cdist in allCons) {
      var carr = allCons[cdist] || [];
      for (var ca = 0; ca < carr.length; ca++) {
        if (match(carr[ca])) return { item: carr[ca], districtId: cdist, kind: "cons" };
      }
    }
    return null;
  }

  /* Bilingual item name for table cells: English on line 1, Hindi on line 2.
     nameCell() is defined in app.js; fall back to a plain escape if it is absent. */
  function nameCellHtml(name) {
    if (window.nameCell) return window.nameCell(name);
    return esc(name);
  }

  /* ---------- clickable item-name links (used across app tables & dialogs) ---------- */
  window.__ipLink = function (obj, hint) {
    try {
      if (!obj) return "";
      var id = (obj && obj.id) || (hint && hint.id) || "";
      var nm = (obj && (obj.name || obj.itemName)) || (typeof obj === "string" ? obj : "");
      if (!id && nm) {
        var found = findItemOrConsByName(nm, hint);
        if (found && found.item) { id = found.item.id; }
      }
      var escNm = nameCellHtml(nm);
      var attrs = 'class="ip-item-link" title="Open Item Profile"';
      if (id) attrs += ' data-ip-id="' + esc(id) + '"';
      if (nm) attrs += ' data-ip-name="' + esc(nm) + '"';
      if (hint && hint.districtId) attrs += ' data-ip-dist="' + esc(hint.districtId) + '"';
      return '<a href="javascript:void(0)" ' + attrs + '>' + escNm + '</a>';
    } catch (e) {
      return esc((obj && (obj.name || obj.itemName)) || String(obj || ""));
    }
  };

  window.__ipLinkByName = function (name, hint) {
    return window.__ipLink({ name: name }, hint);
  };

  /* ---------- transaction derivation ---------- */
  function fp(type, qty, date, time, person) { return [type, Math.abs(qty || 0), date || "", time || "", person || ""].join("|"); }
  function tsOf(date, time, at) {
    if (at) return at;
    try { return date ? new Date(date + "T" + (time || "00:00") + ":00").getTime() : 0; } catch (e) { return 0; }
  }
  function T(o) {
    return {
      ts: o.ts || 0, type: o.type, raw: o.raw || o.type, ref: o.ref || "", from: o.from || "\u2014", to: o.to || "\u2014",
      qty: o.qty || 0, cond: o.cond || "", by: o.by || "", remarks: o.remarks || "",
      derived: !!o.derived, info: !!o.info, ids: o.ids || {}, balance: 0
    };
  }
  function itemCode(item) {
    if (!item) return "";
    if (item.code || item.sku) return item.code || item.sku;
    return "ITM-" + String(item.id || "").slice(-6).toUpperCase();
  }
  function demandCond(d, itemName) {
    var its = d.demandItems || d.items || [];
    var it = its.find(function (x) { return x.itemName === itemName; });
    return it && it.condition !== "any" ? (it.condition || "") : "";
  }

  function deriveTxs(item, districtId) {
    var txs = [], seen = {};
    var name = (item.name || "").toLowerCase();
    var visLoc = visibleLocFilter();
    var homeLoc = locName(districtId, item.locationId);

    /* 1) Allotment records (first-class: issue, returns, losses, recoveries, cancels) */
    (window.getAllotments ? getAllotments() : []).forEach(function (a) {
      if (a.itemId !== item.id) {
        if ((a.itemName || "").toLowerCase() !== name || a.districtId !== districtId) return;
      }
      if (visLoc && a.locationId && a.locationId !== visLoc && item.locationId !== visLoc) return;
      var n = Number(a.qtyAllotted) || 0;
      if (!seen[fp("ALLOTMENT", n, a.date, a.time, a.name)]) {
        seen[fp("ALLOTMENT", n, a.date, a.time, a.name)] = 1;
        txs.push(T({ ts: tsOf(a.date, a.time, a.createdAt), raw: "ALLOTMENT", type: "ISSUED", qty: -n, cond: "Good",
          ref: a.beltNo || a.issueId || a.id, from: homeLoc, to: a.name + (a.posting ? " (" + a.posting + ")" : ""),
          by: a.createdBy || "", remarks: a.remarks || ("Issued " + n + " " + (item.unit || "pcs") + " to " + a.name),
          ids: { allotmentId: a.id, issueId: a.issueId || "" } }));
      }
      (a.returns || []).forEach(function (r) {
        if (r.condition === "cancelled") return;
        var isDmg = r.condition === "damaged", isLost = r.condition === "lost";
        var raw = isDmg ? "DAMAGE" : isLost ? "LOSS" : "RETURN";
        if (seen[fp(raw, r.qty, r.date, r.time, a.name)]) return;
        seen[fp(raw, r.qty, r.date, r.time, a.name)] = 1;
        txs.push(T({ ts: tsOf(r.date, r.time, r.at), raw: raw,
          type: isDmg ? "RETURNED (Scrap)" : isLost ? "Lost (reported)" : "RETURNED",
          qty: isLost ? 0 : r.qty, cond: isDmg ? "Scrap" : isLost ? "Lost" : (r.condition === "poor" ? "Damaged" : "Good"),
          ref: a.beltNo || a.id, from: a.name + (a.posting ? " (" + a.posting + ")" : ""), to: homeLoc,
          by: r.receivedBy || "", remarks: r.remarks || "", ids: { allotmentId: a.id } }));
      });
      (a.losses || []).forEach(function (l) {
        if (seen[fp("LOSS", l.qty, l.date, l.time, a.name)]) return;
        seen[fp("LOSS", l.qty, l.date, l.time, a.name)] = 1;
        txs.push(T({ ts: tsOf(l.date, l.time, l.at), raw: "LOSS", type: "Lost", qty: 0, cond: "Lost",
          ref: a.beltNo || a.id, from: a.name + (a.posting ? " (" + a.posting + ")" : ""), to: "Lost",
          by: l.by || "", remarks: l.reason || "", ids: { allotmentId: a.id, lossId: l.id || "" } }));
      });
      (a.recoveries || []).forEach(function (rc) {
        if (seen[fp("RECOVERED", rc.qty, rc.date, rc.time, a.name)]) return;
        seen[fp("RECOVERED", rc.qty, rc.date, rc.time, a.name)] = 1;
        txs.push(T({ ts: tsOf(rc.date, rc.time, rc.at), raw: "RECOVERED", type: "RECOVERED", qty: rc.qty, cond: "Good",
          ref: a.beltNo || a.id, from: "Lost", to: homeLoc, by: rc.by || "",
          remarks: "Recovered" + (rc.mode ? " via " + rc.mode : "") + (rc.remarks ? " \u2014 " + rc.remarks : ""), ids: { allotmentId: a.id } }));
      });
      if (a.status === "CANCELLED") {
        var rem = Math.max(0, (a.qtyAllotted || 0) - (a.qtyReturned || 0) - (a.qtyLost || 0) + (a.qtyRecovered || 0));
        if (!rem) rem = (a.returns || []).filter(function (r) { return r.condition === "cancelled"; }).reduce(function (s, r) { return s + (r.qty || 0); }, 0);
        if (!seen[fp("CANCELLED", rem, a.date, a.time, a.name)]) {
          seen[fp("CANCELLED", rem, a.date, a.time, a.name)] = 1;
          txs.push(T({ ts: tsOf(a.date, a.time, a.updatedAt || a.createdAt), raw: "CANCELLED", type: "ISSUE CANCELLED", qty: rem, cond: "Good",
            ref: a.beltNo || a.id, from: a.name, to: homeLoc, by: (a.statusNote || "").replace("Cancelled by ", ""),
            remarks: a.statusNote || "Issue cancelled, stock restored", ids: { allotmentId: a.id } }));
        }
      }
    });

    /* 2) item.history events (stock adjustments + anything records miss) */
    (item.history || []).forEach(function (h) {
      var n = Math.abs(Number(h.qty) || 0);
      var f = fp(h.type, n, h.date, h.time, h.person);
      if (seen[f]) return;
      seen[f] = 1;
      var map = {
        ALLOTMENT: { type: "ISSUED", qty: Number(h.qty) || 0, cond: "Good" },
        RETURN: { type: "RETURNED", qty: n, cond: "Good" },
        DAMAGE: { type: "DAMAGED", qty: -n, cond: "Scrap" },
        LOSS: { type: "Lost", qty: -n, cond: "Lost" },
        RECOVERED: { type: "RECOVERED", qty: n, cond: "Good" },
        STOCK_IN: { type: "STOCK ADDED", qty: n, cond: "Good" },
        WRITEOFF: { type: "WRITE-OFF", qty: -n, cond: "Scrap" },
        ADJUST: { type: "STOCK ADJUSTMENT", qty: Number(h.qty) || 0, cond: "" },
        CANCELLED: { type: "ISSUE CANCELLED", qty: n, cond: "Good" },
        ITEM_DELETED: { type: "DELETED ITEM", qty: 0, cond: "Deleted" }
      }[h.type] || { type: h.type, qty: Number(h.qty) || 0, cond: "" };
      txs.push(T({ ts: tsOf(h.date, h.time, h.at), raw: h.type, type: map.type, qty: map.qty, cond: map.cond,
        ref: h.ref || "", from: (h.type === "ALLOTMENT" || h.type === "RETURN" || h.type === "DAMAGE" || h.type === "LOSS") ? homeLoc : (h.type === "RECOVERED" ? "Lost" : "\u2014"),
        to: h.person || homeLoc || "\u2014", by: h.user || "", remarks: h.remarks || "" }));
    });

    /* 3) Demands (destination stock changes + review info) */
    (getDistricts() || []).forEach(function (ds) {
      (loadData("demands_" + ds.id) || []).forEach(function (d) {
        if (d.demandToDistrict !== districtId) return;
        (d.processing || []).forEach(function (p) {
          if ((p.item || "").toLowerCase() !== name) return;
          var q = Number(p.qty) || 0;
          if (p.action === "complete" || p.action === "partial") {
            txs.push(T({ ts: p.at, raw: "DEMAND", type: "DEMAND SUPPLIED", qty: -q, cond: demandCond(d, p.item) || "Good",
              ref: d.demandNo || d.id, from: locName(districtId, d.demandToLocation) || homeLoc,
              to: (d.requestedBy || "") + (d.requestedFromDistrict ? " (" + distName(d.requestedFromDistrict) + ")" : ""),
              by: p.by || "", remarks: (p.remark || "") + (p.action === "partial" ? " (partial supply)" : ""), ids: { demandId: d.id } }));
          } else if (p.action === "review_reject") {
            txs.push(T({ ts: p.at, raw: "DEMAND_REVIEW", type: "DEMAND REVIEW REJECTED", qty: 0, info: true,
              ref: d.demandNo || d.id, from: d.requestedBy || "", to: locName(districtId, d.demandToLocation) || homeLoc,
              by: p.by || "", remarks: p.remark || "Supply rejected by requester", ids: { demandId: d.id } }));
          }
        });
      });
    });

    /* 4) Distributions (stock transfers between units/districts) */
    (getDistricts() || []).forEach(function (ds) {
      (loadData("distributions_" + ds.id) || []).forEach(function (dd) {
        if (dd.status !== "completed") return;
        (dd.items || []).forEach(function (it) {
          var q = Number(it.qty) || 0;
          var nm = (it.itemName || "").toLowerCase();
          var isSrc = nm === name && dd.fromDistrictId === districtId &&
            (!dd.fromLocationId || !item.locationId || dd.fromLocationId === item.locationId);
          var isDst = (it.toItemId && it.toItemId === item.id) ||
            (nm === name && dd.toDistrictId === districtId && (!dd.toLocationId || !item.locationId || dd.toLocationId === item.locationId));
          var ts = dd.approvedAt || dd.updatedAt || dd.createdAt;
          var fromL = locName(dd.fromDistrictId, dd.fromLocationId) || distName(dd.fromDistrictId);
          var toL = locName(dd.toDistrictId, dd.toLocationId) || distName(dd.toDistrictId);
          if (isSrc && isDst) {
            txs.push(T({ ts: ts, raw: "DIST_OUT", type: "DISTRIBUTED", qty: -q, cond: it.condition || "Good",
              ref: dd.distNo || dd.id, from: fromL, to: toL, by: dd.approvedBy || "", remarks: dd.approveRemark || "Stock transferred out and back in (same unit)", ids: { distributionId: dd.id } }));
            txs.push(T({ ts: ts + 1, raw: "DIST_IN", type: "DISTRIBUTED (IN)", qty: q, cond: it.condition || "Good",
              ref: dd.distNo || dd.id, from: fromL, to: toL, by: dd.approvedBy || "", remarks: "Stock received via distribution", ids: { distributionId: dd.id } }));
          } else if (isSrc) {
            txs.push(T({ ts: ts, raw: "DIST_OUT", type: "DISTRIBUTED", qty: -q, cond: it.condition || "Good",
              ref: dd.distNo || dd.id, from: fromL, to: toL, by: dd.approvedBy || "", remarks: dd.approveRemark || "Stock transferred out", ids: { distributionId: dd.id } }));
          } else if (isDst) {
            txs.push(T({ ts: ts, raw: "DIST_IN", type: "DISTRIBUTED (IN)", qty: q, cond: it.condition || "Good",
              ref: dd.distNo || dd.id, from: fromL, to: toL, by: dd.approvedBy || "", remarks: dd.approveRemark || "Stock received via distribution", ids: { distributionId: dd.id } }));
          }
        });
      });
    });

    /* order, opening balance, running balance, reconciliation */
    txs.sort(function (a, b) { return (a.ts - b.ts) || String(a.raw).localeCompare(String(b.raw)); });
    var sum = txs.reduce(function (s, t) { return s + (t.info ? 0 : t.qty); }, 0);
    var target = Math.round((item.quantity || 0) - (item.allotted || 0) - (item.lostReturned || 0));
    var opening = target - sum;
    var earliest = txs.length ? txs[0].ts : (item.createdAt || Date.now());
    if (opening !== 0) {
      txs.unshift(T({ ts: (item.createdAt && item.createdAt <= earliest ? item.createdAt : earliest) - 1, raw: "OPENING",
        type: "STOCK ADDED (Opening)", qty: opening, cond: "Good", from: "\u2014", to: homeLoc, derived: true,
        remarks: "Opening balance derived from the current stock record" }));
    }
    if (item.createdAt) {
      txs.unshift(T({ ts: item.createdAt - 2, raw: "CREATED", type: "ITEM CREATED", qty: 0, info: true,
        ref: itemCode(item), from: "\u2014", to: homeLoc, derived: true, remarks: "Item record created" }));
    }
    var bal = 0;
    txs.forEach(function (t) { if (!t.info) bal += t.qty; t.balance = bal; });
    if (bal !== target) {
      var syncTs = Math.max(item.updatedAt || 0, (txs[txs.length - 1] || { ts: Date.now() }).ts + 1);
      txs.push(T({ ts: syncTs, raw: "SYNC", type: "SYSTEM SYNC", qty: target - bal, derived: true,
        remarks: "Auto-reconciled to the current stock record (quantity " + (item.quantity || 0) + ", issued " + (item.allotted || 0) + ", lost " + (item.lostReturned || 0) + ")" }));
      txs[txs.length - 1].balance = target;
    }
    return txs;
  }

  /* ---------- photos ---------- */
  function photosMap() { return loadData("itemPhotos") || {}; }
  function loadPhotos(itemId) { return photosMap()[itemId] || []; }
  function profilePhoto(itemId) {
    var list = loadPhotos(itemId);
    return list.find(function (p) { return p.isProfile; }) || (list.length ? list[list.length - 1] : null);
  }
  function validateAndCompress(file) {
    return new Promise(function (resolve, reject) {
      var okTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/bmp", "image/avif"];
      if (okTypes.indexOf(file.type) === -1) return reject("Invalid file type. Please use JPG, PNG, WEBP, GIF, BMP or AVIF. (HEIC is not supported \u2014 convert to JPG first.)");
      if (file.size > 8 * 1024 * 1024) return reject("File too large. Maximum size is 8 MB.");
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          try {
            var MAX = 900, w = img.width, h = img.height, scale = Math.min(1, MAX / Math.max(w, h));
            var c = document.createElement("canvas");
            c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            resolve({ data: c.toDataURL("image/jpeg", 0.72), name: file.name || "photo.jpg", size: file.size });
          } catch (e) { reject("Could not process this image. Try another file."); }
        };
        img.onerror = function () { reject("This image could not be decoded by the browser. Please use JPG, PNG or WEBP."); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject("Could not read the selected file."); };
      reader.readAsDataURL(file);
    });
  }
  window.__ipUploadPhoto = function (file) {
    var item = state.item;
    if (!item) return Promise.reject("No item selected");
    if (!canManagePhotos(item)) return Promise.reject("You do not have permission to upload photos for this item.");
    return validateAndCompress(file).then(function (img) {
      var map = photosMap();
      var list = map[item.id] || (map[item.id] = []);
      list.forEach(function (p) { p.isProfile = false; });
      var rec = { id: (window.uid ? uid() : Date.now().toString(36)), data: img.data, name: img.name, size: img.size,
        uploadedBy: user() ? (user().name || user().username) : "", uploadedAt: Date.now(), isProfile: true };
      list.push(rec);
      saveData("itemPhotos", map);
      try { __audit("Item Photo Uploaded", img.name + " for " + item.name, { entity: "Item" }); } catch (e) {}
      return rec;
    });
  };

  /* ---------- skeleton ---------- */
  function buildSkeleton() {
    var view = document.getElementById(VIEW_ID);
    if (!view) return;
    view.innerHTML =
      '<div class="ip-wrap">' +
        '<div class="ip-topbar"><div style="flex:1;min-width:260px">' +
          '<div class="ip-breadcrumb"><a data-ip-nav="back">&larr; Back</a><span>&rsaquo;</span><a data-ip-nav="close">Inventory</a><span>&rsaquo;</span><span>Items</span><span>&rsaquo;</span><b id="ipCrumbName">\u2014</b></div>' +
          '<div class="ip-title-row"><h1 class="ip-title" id="ipTitle">\u2014</h1><span id="ipStatusBadge"></span></div>' +
          '<div class="ip-dates-line" id="ipDatesLine">' +
            '<span class="ip-date-badge"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Date of Added: <b id="ipDateAdded">\u2014</b></span>' +
            '<span class="ip-date-badge"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Date of Latest Update: <b id="ipDateUpdated">\u2014</b></span>' +
          '</div>' +
          '<div class="ip-meta" id="ipMeta"></div>' +
          '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap" id="ipTopActions"></div>' +
        '</div>' +
        '<div class="ip-photo-card">' +
          '<div class="ip-photo-frame" id="ipPhotoFrame"></div>' +
          '<div class="ip-photo-actions">' +
            '<button type="button" class="btn btn-primary" id="ipUploadBtn">Upload Photo</button>' +
            '<button type="button" class="btn btn-outline" id="ipCameraBtn">&#128247; Camera</button>' +
            '<input type="file" id="ipPhotoInput" accept="image/*" hidden>' +
            '<div id="ipUploadProgress" class="hidden" style="font-size:.72rem;color:var(--muted)">Processing\u2026</div>' +
          '</div>' +
        '</div></div>' +
        '<div id="ipBody"></div>' +
      '</div>';
    state.built = true;
    bindSkeletonEvents();
  }
  function bindSkeletonEvents() {
    var view = document.getElementById(VIEW_ID);
    if (!view || view.dataset.ipBound) return;
    view.dataset.ipBound = "1";
    view.addEventListener("click", function (e) {
      if (!e.target || !e.target.closest) return;
      var nav = e.target.closest("[data-ip-nav]");
      if (nav) { e.preventDefault(); closeProfile(); return; }
      if (e.target.id === "ipUploadBtn") { var i = document.getElementById("ipPhotoInput"); if (i) i.click(); return; }
      if (e.target.id === "ipCameraBtn") { openIpCamera(); return; }
      var gal = e.target.closest("[data-gal-act]");
      if (gal) { handleGalleryAction(gal.dataset.galAct, gal.dataset.galId); return; }
      var zoom = e.target.closest("[data-gal-view]");
      if (zoom) { lightbox(zoom.getAttribute("src")); return; }
      var th = e.target.closest(".ip-tx-table th[data-sk]");
      if (th) { sortBy(th.dataset.sk); return; }
      var row = e.target.closest(".ip-tx-table tbody tr[data-tx]");
      if (row) { openTxDetails(Number(row.dataset.tx)); return; }
      var pg = e.target.closest("[data-ipp]");
      if (pg && !pg.disabled) { state.page += pg.dataset.pp === "prev" ? -1 : 1; renderTable(); return; }
      if (e.target.id === "ipGalUpload") { var i2 = document.getElementById("ipPhotoInput"); if (i2) i2.click(); return; }
      if (e.target.id === "ipGalCamera") { openIpCamera(); return; }
    });
    var inp = document.getElementById("ipPhotoInput");
    if (inp) inp.addEventListener("change", function () {
      if (!inp.files || !inp.files[0]) return;
      var prog = document.getElementById("ipUploadProgress");
      if (prog) prog.classList.remove("hidden");
      window.__ipUploadPhoto(inp.files[0]).then(function () {
        if (prog) prog.classList.add("hidden");
        toast("Photo uploaded and set as profile photo.", "success");
        inp.value = "";
        renderAll();
      }).catch(function (msg) {
        if (prog) prog.classList.add("hidden");
        toast(typeof msg === "string" ? msg : "Photo upload failed.", "error");
        inp.value = "";
      });
    });
  }

  /* ---------- navigation ---------- */
  /* ---------- consumable item support ---------- */
  function consCode(item) {
    if (!item) return "";
    return "CNS-" + String(item.id || "").slice(-6).toUpperCase();
  }
  function findConsItemAnywhere(id) {
    var map = loadData("consumable_items") || {};
    var ids = [activeDistrictId].concat(Object.keys(map));
    var seen = {};
    for (var i = 0; i < ids.length; i++) {
      var d = ids[i];
      if (!d || seen[d]) continue;
      seen[d] = 1;
      var arr = map[d] || [];
      var it = null;
      for (var j = 0; j < arr.length; j++) { if (arr[j].id === id) { it = arr[j]; break; } }
      if (it) return { item: it, districtId: d };
    }
    return null;
  }
  function deriveConsTxs(item, districtId) {
    var txs = [];
    var txns = (loadData("consumable_txns") || {})[districtId] || [];
    txns.filter(function (t) { return t && t.itemId === item.id; }).forEach(function (t) {
      var q = Math.max(0, Math.floor(Number(t.qty) || 0));
      var ts = tsOf(t.date, t.time, t.createdAt);
      if (t.type === "ADD") {
        txs.push(T({ ts: ts, raw: "ADD", type: "STOCK ADDED", qty: q, cond: "Added", ref: "CNS",
          from: "District Stock", to: "In Stock", by: t.byName || "", remarks: t.remarks || "Stock added", ids: { txnId: t.id } }));
      } else if (t.type === "DISTRIBUTION_REQUEST") {
        var ap = null, rj = null;
        for (var i = 0; i < txns.length; i++) {
          if (txns[i].requestId !== t.id) continue;
          if (txns[i].type === "DISTRIBUTION_APPROVED" && !ap) ap = txns[i];
          if (txns[i].type === "DISTRIBUTION_REJECTED" && !rj) rj = txns[i];
        }
        var st = ap ? "Complete" : rj ? "Rejected" : "Pending";
        var type = ap ? "DISTRIBUTED" : rj ? "DISTRIBUTION REJECTED" : "DISTRIBUTION PENDING";
        var remarks = t.remarks || "";
        if (ap) remarks = (remarks ? remarks + " — " : "") + "Approved by " + (ap.byName || "");
        if (rj) remarks = (remarks ? remarks + " — " : "") + "Rejected" + (rj.byName ? " by " + rj.byName : "") + (rj.reason ? ": " + rj.reason : "");
        txs.push(T({ ts: ts, raw: "DISTRIBUTION", type: type, qty: ap ? -q : 0, cond: st,
          ref: t.toType === "unit" ? "UNIT" : "STAFF", from: t.byName || "District Stock",
          to: (t.toName || "") + (t.toType ? " (" + t.toType.toUpperCase() + ")" : ""), by: t.byName || "", remarks: remarks, ids: { txnId: t.id } }));
      } else if (t.type === "LOSS") {
        txs.push(T({ ts: ts, raw: "LOSS", type: "MARKED LOST", qty: -q, cond: "Lost", ref: "",
          from: "In Stock", to: "Lost", by: t.byName || "", remarks: t.remarks || "Marked lost", ids: { txnId: t.id } }));
      } else if (t.type === "DELETED") {
        txs.push(T({ ts: ts, raw: "DELETED", type: "DELETED ITEM", qty: 0, cond: "Deleted", ref: "",
          from: "In Stock", to: "Deleted", by: t.byName || "", remarks: t.remarks || "Deleted Item", ids: { txnId: t.id } }));
      }
    });
    txs.sort(function (a, b) { return a.ts - b.ts; });
    var run = 0;
    txs.forEach(function (t) { run += t.qty; t.balance = run; });
    return txs;
  }
  function getCurrentActiveTab() {
    if (window.currentTab && window.currentTab !== "itemprofile") return window.currentTab;
    var link = document.querySelector(".sidebar-link.active[data-tab]");
    if (link && link.dataset.tab && link.dataset.tab !== "itemprofile") return link.dataset.tab;
    var views = document.querySelectorAll(".view:not(.hidden)");
    for (var i = 0; i < views.length; i++) {
      var vid = views[i].id || "";
      if (vid.indexOf("view-") === 0 && vid !== "view-itemprofile" && vid !== "view-login") {
        return vid.substring(5);
      }
    }
    return "";
  }

  function tabTitle(tab) {
    var map = {
      demands: "Demands",
      distribution: "Distributions",
      inventory: "Inventory",
      consumables: "Consumables",
      dashboard: "Dashboard",
      allotments: "Allotments",
      inspections: "Inspections",
      shramdaan: "Shramdaan",
      maintenance: "Maintenance",
      documents: "Documents",
      reports: "Reports"
    };
    return map[tab] || (tab ? tab.charAt(0).toUpperCase() + tab.slice(1) : "Inventory");
  }

  function closeProfile() {
    var kind = state.kind;
    state.itemId = null; state.item = null; state.kind = "stock";
    if (location.hash.indexOf("#items/") === 0) history.replaceState(null, "", location.pathname + location.search);
    var prev = state.prevTab || (kind === "cons" ? "consumables" : "inventory");
    state.prevTab = null;
    if (window.switchTab) switchTab(prev);
  }
  window.openItemProfile = function (itemId, opts) {
    if (!user()) { toast("Please login first.", "error"); return; }
    opts = opts || {};
    if (!state.prevTab) {
      state.prevTab = getCurrentActiveTab() || (state.kind === "cons" ? "consumables" : "inventory");
    }
    if (typeof closeModals === "function") {
      try { closeModals(); } catch (e) {}
    }
    document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(function (m) {
      try { m.classList.add("hidden"); } catch (e) {}
    });
    document.querySelectorAll(".ip-modal, #ppTxModal, #ipTxModal").forEach(function (m) {
      try { m.remove(); } catch (e) {}
    });

    var cons = findConsItemAnywhere(itemId);
    if (cons) {
      state.kind = "cons"; state.itemId = itemId; state.item = cons.item; state.districtId = cons.districtId || activeDistrictId;
      state.page = 0; state.q = ""; state.fType = ""; state.fCond = ""; state.fFrom = ""; state.fTo = ""; state.fUnit = "";
      state.sortKey = "ts"; state.sortDir = -1;
      var wantC = "#items/" + itemId;
      if (location.hash !== wantC) location.hash = wantC;
      if (window.switchTab) switchTab("itemprofile");
      renderAll();
      return;
    }
    state.kind = "stock";
    var found = findItemAnywhere(itemId);
    if (!found) {
      var searchName = (opts && opts.name) || itemId;
      var byName = findItemOrConsByName(searchName, opts);
      if (byName && byName.item && byName.item.id) {
        return window.openItemProfile(byName.item.id, opts);
      }
      return renderError("notfound");
    }
    var item = found.item;
    state.itemId = item.id; state.item = item; state.districtId = found.districtId || activeDistrictId;
    state.page = 0; state.q = ""; state.fType = ""; state.fCond = ""; state.fFrom = ""; state.fTo = ""; state.fUnit = "";
    state.sortKey = "ts"; state.sortDir = -1;
    var want = "#items/" + item.id;
    if (location.hash !== want) location.hash = want;
    if (window.switchTab) switchTab("itemprofile");
    renderAll();
  };
  window.openItemProfileByName = function (name, opts) {
    if (!name) return;
    opts = opts || {};
    if (!state.prevTab) {
      state.prevTab = getCurrentActiveTab() || "inventory";
    }
    if (typeof closeModals === "function") {
      try { closeModals(); } catch (e) {}
    }
    document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(function (m) {
      try { m.classList.add("hidden"); } catch (e) {}
    });
    var found = findItemOrConsByName(name, opts);
    if (found && found.item && found.item.id) {
      window.openItemProfile(found.item.id, opts);
    } else {
      toast("No inventory record found for: " + name, "warning");
    }
  };
  function renderError(kind) {
    state.itemId = null; state.item = null; state.built = false;
    var view = document.getElementById(VIEW_ID);
    if (!view) return;
    if (window.switchTab) switchTab("itemprofile");
    var msg = kind === "unauthorized"
      ? "You do not have permission to view this item."
      : "The item you are looking for does not exist or you do not have permission to access it.";
    view.innerHTML = '<div class="ip-wrap"><div class="ip-error-view">' +
      '<div class="big">&#128269;</div><h2>Item Not Found</h2>' +
      '<p style="color:var(--muted)">' + esc(msg) + "</p>" +
      '<button type="button" class="btn btn-primary" data-ip-nav="close">Back to ' + esc(tabTitle(state.prevTab)) + '</button></div></div>';
    view.onclick = function (e) { if (e.target.closest('[data-ip-nav="close"]')) closeProfile(); };
  }

  /* ---------- render ---------- */
  function renderAll() {
    var item = state.item;
    if (!item) return;
    if (!state.built) buildSkeleton();
    var view = document.getElementById(VIEW_ID);
    if (!view) return;
    view.classList.remove("hidden");
    state.txs = state.kind === "cons" ? deriveConsTxs(item, state.districtId) : deriveTxs(item, state.districtId);
    fillHeader(item);
    var crumb = view.querySelector('.ip-breadcrumb a[data-ip-nav="close"]');
    if (crumb) crumb.textContent = tabTitle(state.prevTab || (state.kind === "cons" ? "consumables" : "inventory"));
    fillBody(item);
    applyFilters();
  }
  function fillHeader(item) {
    if (state.kind === "cons") return fillHeaderCons(item);
    $("#ipCrumbName").textContent = item.name || "";
    $("#ipTitle").textContent = item.name || "";
    var st = item.isDeleted ? { cls: "status-out", label: "Deleted" } : (window.allocStatusOfItem ? allocStatusOfItem(item) : { cls: "status-ok", label: "Available" });
    $("#ipStatusBadge").innerHTML = '<span class="status-badge ' + st.cls + '">' + esc(st.label) + "</span>";
    var dAdded = item.createdAt ? fmtD(item.createdAt) : "\u2014";
    var latestTs = Math.max(item.updatedAt || 0, (state.txs && state.txs[0] ? state.txs[0].ts : 0)) || item.createdAt;
    var dUpdated = latestTs ? fmtDT(latestTs) : dAdded;
    var elAdded = $("#ipDateAdded"); if (elAdded) elAdded.textContent = dAdded;
    var elUpdated = $("#ipDateUpdated"); if (elUpdated) elUpdated.textContent = dUpdated;
    $("#ipMeta").innerHTML = [
      ["Item Code", itemCode(item)], ["Category", catName(item.categoryId) || "\u2014"], ["Unit", item.unit || "pcs"],
      ["Location", locName(state.districtId, item.locationId) || "\u2014"], ["District", distName(state.districtId)],
      ["Min Stock", String(item.minStock || 0)]
    ].map(function (m) { return '<span class="ip-chip">' + esc(m[0]) + ": <b>" + esc(m[1]) + "</b></span>"; }).join("");
    var upBtn = document.getElementById("ipUploadBtn");
    if (upBtn) upBtn.style.display = canManagePhotos(item) ? "" : "none";
    var acts = $("#ipTopActions");
    if (acts) acts.innerHTML = item.isDeleted ? "" :
      ((window.canEditItem && canEditItem(item) ? '<button type="button" class="btn btn-outline" id="ipEditBtn">Edit Item</button>' : "") +
      '<button type="button" class="btn btn-outline" id="ipAdjustBtn">Adjust Stock</button>');
    var eb = document.getElementById("ipEditBtn");
    if (eb) eb.addEventListener("click", function () { window.openItemModal && openItemModal(item); });
    var ab = document.getElementById("ipAdjustBtn");
    if (ab) ab.addEventListener("click", function () { window.openAdjustStock && openAdjustStock(item.id); });
    var ph = profilePhoto(item.id);
    $("#ipPhotoFrame").innerHTML = ph ? '<img src="' + ph.data + '" alt="Item photo">' : '<div class="ip-no-photo">No Photo</div>';
  }
  function consStatusCls(s) {
    if (s === "Available") return "status-ok";
    if (s === "Lost" || s === "Distributed") return "status-out";
    return "status-low";
  }
  function fillHeaderCons(item) {
    var q = __consQty(item.id);
    $("#ipCrumbName").textContent = item.name || "";
    $("#ipTitle").textContent = item.name || "";
    $("#ipStatusBadge").innerHTML = item.isDeleted ? '<span class="status-badge status-out">Deleted</span>' : ('<span class="status-badge ' + consStatusCls(q.status) + '">' + esc(q.status || "") + "</span>");
    var dAddedCons = item.createdAt ? fmtD(item.createdAt) : "\u2014";
    var latestTsCons = Math.max(item.updatedAt || 0, (state.txs && state.txs[0] ? state.txs[0].ts : 0)) || item.createdAt;
    var dUpdatedCons = latestTsCons ? fmtDT(latestTsCons) : dAddedCons;
    var elAddedCons = $("#ipDateAdded"); if (elAddedCons) elAddedCons.textContent = dAddedCons;
    var elUpdatedCons = $("#ipDateUpdated"); if (elUpdatedCons) elUpdatedCons.textContent = dUpdatedCons;
    $("#ipMeta").innerHTML = [
      ["Item Code", consCode(item)],
      ["Category", window.__consItemCat ? __consItemCat(item.categoryId) : (catName(item.categoryId) || "—")],
      ["District", distName(state.districtId)]
    ].map(function (m) { return '<span class="ip-chip">' + esc(m[0]) + ": <b>" + esc(m[1]) + "</b></span>"; }).join("");
    var upBtn = document.getElementById("ipUploadBtn");
    if (upBtn) upBtn.style.display = canManagePhotos(item) ? "" : "none";
    var camBtn = document.getElementById("ipCameraBtn");
    if (camBtn) camBtn.style.display = canManagePhotos(item) ? "" : "none";
    var acts = $("#ipTopActions");
    if (acts) acts.innerHTML = "";
    var ph = profilePhoto(item.id);
    $("#ipPhotoFrame").innerHTML = ph ? '<img src="' + ph.data + '" alt="Item photo">' : '<div class="ip-no-photo">No Photo</div>';
  }
  function fillBody(item) {
    if (state.kind === "cons") return fillBodyCons(item);
    var cc = item.conditionCounts || { good: 0, poor: 0, damaged: 0 };
    var av = window.availableQty ? availableQty(item) : Math.max(0, (item.quantity || 0) - (item.allotted || 0) - (item.damagedReturned || 0) - (item.lostReturned || 0));
    var returned = state.txs.filter(function (t) { return t.type === "RETURNED" || t.type === "RETURNED (Scrap)"; }).reduce(function (s, t) { return s + Math.max(0, t.qty); }, 0);
    var recovered = state.txs.filter(function (t) { return t.type === "RECOVERED"; }).reduce(function (s, t) { return s + t.qty; }, 0);
    var cardsRow1 = [
      ["TOTAL", item.quantity || 0, "ip-blue"], ["AVAILABLE", av, "ip-green"],
      ["ISSUED", item.allotted || 0, "ip-amber"], ["RETURNED", returned, ""],
      ["LOST", item.lostReturned || 0, "ip-red"]
    ];
    var cardsRow2 = [
      ["SCRAP", (cc.damaged || 0) + (item.damagedReturned || 0), "ip-red"],
      ["GOOD", cc.good || 0, "ip-green"], ["DAMAGED", cc.poor || 0, "ip-amber"], ["RECOVERED", recovered, ""]
    ];
    var statCard = function (c) {
      return '<div class="ip-stat ' + c[2] + '"><div class="ip-num">' + fmtN(c[1]) + '</div><div class="ip-lbl">' + c[0] + "</div></div>";
    };
    $("#ipBody").innerHTML =
      '<div class="ip-cards ip-row5">' + cardsRow1.map(statCard).join("") + "</div>" +
      '<div class="ip-cards ip-row4">' + cardsRow2.map(statCard).join("") + "</div>" +
      
      '<div class="ip-section"><h3>Complete Transaction History</h3>' + toolbarHtml() + '<div id="ipSummary" class="ip-cards" style="margin:10px 0"></div>' +
      '<div class="ip-table-wrap"><table class="ip-tx-table" data-sortable="false"><thead><tr>' +
        th("ts", "Date &amp; Time") + th("type", "Transaction Type") + th("ref", "Reference") + th("from", "From") + th("to", "To") +
        th("qty", "Quantity") + th("cond", "Condition") + th("balance", "Balance") + th("by", "Performed By") + th("remarks", "Remarks") +
      "</tr></thead><tbody id=\"ipTxBody\"></tbody></table></div>" +
      '<div class="ip-pager" id="ipPager"></div></div>' +
      '<div class="ip-section"><h3>Item Activity Timeline</h3><div id="ipTimeline"></div></div>' +
      '<div class="ip-section"><h3>Uploaded Photos</h3><div id="ipGallery"></div></div>';
    bindToolbar();
  }
  function infoRows(item) {
    var cc = item.conditionCounts || {};
    var rows = [
      ["Item Name", item.name], ["Item Code", itemCode(item)], ["Category", catName(item.categoryId)],
      ["Unit", item.unit || "pcs"], ["Current Condition", (cc.good || 0) + " Good / " + (cc.poor || 0) + " Damaged / " + (cc.damaged || 0) + " Scrap"],
      ["Date Added", item.createdAt ? fmtD(item.createdAt) : ""], ["Last Updated", item.updatedAt ? fmtDT(item.updatedAt) : ""],
      ["Location", locName(state.districtId, item.locationId) || "\u2014"], ["Min Stock", String(item.minStock || 0)]
    ];
    return rows.filter(function (r) { return r[1] !== undefined && r[1] !== null && r[1] !== ""; }).map(function (r) {
      return '<div class="ip-info-row"><span class="k">' + esc(r[0]) + '</span><span class="v">' + esc(String(r[1])) + "</span></div>";
    });
  }
  function fillBodyCons(item) {
    var q = __consQty(item.id);
    var statCard = function (c) {
      return '<div class="ip-stat ' + c[2] + '"><div class="ip-num">' + fmtN(c[1]) + '</div><div class="ip-lbl">' + c[0] + "</div></div>";
    };
    var cards = [
      ["TOTAL (RECEIVED+ADDED)", q.total, "ip-blue"], ["AVAILABLE (IN STOCK NOW)", q.available, "ip-green"],
      ["DISTRIBUTED", q.distributed, "ip-amber"], ["LOST", q.lost, "ip-red"], ["PENDING", q.pending, ""]
    ];
    $("#ipBody").innerHTML =
      '<div class="ip-cards ip-row5">' + cards.map(statCard).join("") + "</div>" +
      
      '<div class="ip-section"><h3>Complete Transaction History</h3>' + toolbarHtml() + '<div id="ipSummary" class="ip-cards" style="margin:10px 0"></div>' +
      '<div class="ip-table-wrap"><table class="ip-tx-table" data-sortable="false"><thead><tr>' +
        th("ts", "Date &amp; Time") + th("type", "Transaction Type") + th("ref", "Reference") + th("from", "From") + th("to", "To") +
        th("qty", "Quantity") + th("cond", "Status") + th("balance", "Balance") + th("by", "Performed By") + th("remarks", "Remarks") +
      "</tr></thead><tbody id=\"ipTxBody\"></tbody></table></div>" +
      '<div class="ip-pager" id="ipPager"></div></div>' +
      '<div class="ip-section"><h3>Item Activity Timeline</h3><div id="ipTimeline"></div></div>' +
      '<div class="ip-section"><h3>Uploaded Photos</h3><div id="ipGallery"></div></div>';
    bindToolbar();
  }
  function infoRowsCons(item) {
    var q = __consQty(item.id);
    var rows = [
      ["Item Name", item.name], ["Item Code", consCode(item)],
      ["Category", window.__consItemCat ? __consItemCat(item.categoryId) : (catName(item.categoryId) || "")],
      ["Condition", item.condition || "Good"],
      ["Total Quantity (Received+Added)", fmtN(q.total)], ["Available (In Stock Now)", fmtN(q.available)],
      ["Distributed", fmtN(q.distributed)], ["Lost", fmtN(q.lost)], ["Pending", fmtN(q.pending)], ["Status", q.status],
      ["Date Added", item.createdAt ? fmtD(item.createdAt) : ""], ["Remarks", item.remarks || ""]
    ];
    return rows.filter(function (r) { return r[1] !== undefined && r[1] !== null && r[1] !== ""; }).map(function (r) {
      return '<div class="ip-info-row"><span class="k">' + esc(r[0]) + '</span><span class="v">' + esc(String(r[1])) + "</span></div>";
    });
  }
  function th(key, label) { return '<th data-sk="' + key + '">' + label + ' <span class="sort-arrow" data-ar="' + key + '"></span></th>'; }
  function toolbarHtml() {
    if (state.kind === "cons") {
      var cts = ["STOCK ADDED", "DISTRIBUTED", "DISTRIBUTION PENDING", "DISTRIBUTION REJECTED", "MARKED LOST"];
      return '<div class="ip-toolbar">' +
        '<input type="text" id="ipSearch" placeholder="Search type, unit, person, remarks, quantity..." style="min-width:230px;flex:1">' +
        '<select id="ipFType"><option value="">All Types</option>' + cts.map(function (t) { return '<option value="' + t + '">' + t + "</option>"; }).join("") + "</select>" +
        '<select id="ipFCond"><option value="">All Status</option><option>Added</option><option>Complete</option><option>Pending</option><option>Rejected</option><option>Lost</option></select>' +
        '<input type="date" id="ipFFrom" title="From date"><input type="date" id="ipFTo" title="To date">' +
        '<input type="text" id="ipFUnit" placeholder="User / Unit" style="width:130px">' +
        '<select id="ipPageSize"><option>25</option><option>50</option><option>100</option></select>' +
        '<div class="stat-export-dd"><button type="button" class="btn btn-outline" id="ipExportBtn">Export / Download <span class="ee-caret">&#9662;</span></button>' +
        '<div class="stat-export-menu hidden" id="ipExportMenu">' +
          '<button data-ipx="csv">Export CSV (filtered)</button>' +
          '<button data-ipx="excel">Export Excel (filtered)</button>' +
          '<button data-ipx="pdf">Export PDF (filtered)</button>' +
          '<button data-ipx="print">Print (filtered)</button>' +
          '<button data-ipx="all">Download Complete History (CSV)</button>' +
        "</div></div>" +
        '<span class="ip-count-note" id="ipCount"></span></div>';
    }
    var types = ["ISSUED", "STOCK ADDED", "STOCK ADJUSTMENT", "RETURNED", "Lost", "DAMAGED", "RECOVERED", "WRITE-OFF", "DISTRIBUTED", "DISTRIBUTED (IN)", "DEMAND SUPPLIED", "ISSUE CANCELLED", "SYSTEM SYNC"];
    return '<div class="ip-toolbar">' +
      '<input type="text" id="ipSearch" placeholder="Search type, ref, unit, person, remarks, quantity..." style="min-width:230px;flex:1">' +
      '<select id="ipFType"><option value="">All Types</option>' + types.map(function (t) { return '<option value="' + t + '">' + t + "</option>"; }).join("") + "</select>" +
      '<select id="ipFCond"><option value="">All Conditions</option><option>Good</option><option>Damaged</option><option>Scrap</option><option>Lost</option></select>' +
      '<input type="date" id="ipFFrom" title="From date"><input type="date" id="ipFTo" title="To date">' +
      '<input type="text" id="ipFUnit" placeholder="User / Unit" style="width:130px">' +
      '<select id="ipPageSize"><option>25</option><option>50</option><option>100</option></select>' +
      '<div class="stat-export-dd"><button type="button" class="btn btn-outline" id="ipExportBtn">Export / Download <span class="ee-caret">&#9662;</span></button>' +
      '<div class="stat-export-menu hidden" id="ipExportMenu">' +
        '<button data-ipx="csv">Export CSV (filtered)</button>' +
        '<button data-ipx="excel">Export Excel (filtered)</button>' +
        '<button data-ipx="pdf">Export PDF (filtered)</button>' +
        '<button data-ipx="print">Print (filtered)</button>' +
        '<button data-ipx="all">Download Complete History (CSV)</button>' +
      "</div></div>" +
      '<span class="ip-count-note" id="ipCount"></span></div>';
  }
  var toolbarDocBound = false;
  function bindToolbar() {
    ["ipSearch", "ipFType", "ipFCond", "ipFFrom", "ipFTo", "ipFUnit"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.dataset.ipBound) return;
      el.dataset.ipBound = "1";
      el.addEventListener(el.tagName === "SELECT" || el.type === "date" ? "change" : "input", function () {
        state.q = ($("#ipSearch").value || "").toLowerCase();
        state.fType = $("#ipFType").value; state.fCond = $("#ipFCond").value;
        state.fFrom = $("#ipFFrom").value; state.fTo = $("#ipFTo").value;
        state.fUnit = ($("#ipFUnit").value || "").toLowerCase();
        state.page = 0; applyFilters();
      });
    });
    var ps = document.getElementById("ipPageSize");
    if (ps && !ps.dataset.ipBound) {
      ps.dataset.ipBound = "1";
      ps.addEventListener("change", function () { state.pageSize = Number(ps.value) || 25; state.page = 0; renderTable(); });
    }
    if (!toolbarDocBound) {
      toolbarDocBound = true;
      document.addEventListener("click", function (e) {
        if (!e.target.closest("#ipExportMenu") && !e.target.closest("#ipExportBtn")) {
          var m = document.getElementById("ipExportMenu");
          if (m) m.classList.add("hidden");
        }
      });
    }
    var eb = document.getElementById("ipExportBtn");
    if (eb && !eb.dataset.ipBound) {
      eb.dataset.ipBound = "1";
      eb.addEventListener("click", function (e) { e.stopPropagation(); $("#ipExportMenu").classList.toggle("hidden"); });
    }
    var menu = document.getElementById("ipExportMenu");
    if (menu && !menu.dataset.ipBound) {
      menu.dataset.ipBound = "1";
      menu.addEventListener("click", function (e) {
        var b = e.target.closest("[data-ipx]");
        if (!b) return;
        $("#ipExportMenu").classList.add("hidden");
        doExport(b.dataset.ipx);
      });
    }
  }

  /* ---------- filter / sort / page ---------- */
  function applyFilters() {
    var t = state.txs;
    if (state.fType) t = t.filter(function (x) { return x.type === state.fType || x.type.indexOf(state.fType) === 0; });
    if (state.fCond) t = t.filter(function (x) { return (x.cond || "").toLowerCase() === state.fCond.toLowerCase(); });
    if (state.fFrom) { var f = new Date(state.fFrom + "T00:00:00").getTime(); t = t.filter(function (x) { return x.ts >= f; }); }
    if (state.fTo) { var to = new Date(state.fTo + "T00:00:00").getTime() + 86400000; t = t.filter(function (x) { return x.ts < to; }); }
    if (state.fUnit) t = t.filter(function (x) { return ((x.from || "") + " " + (x.to || "") + " " + (x.by || "")).toLowerCase().indexOf(state.fUnit) !== -1; });
    if (state.q) {
      var q = state.q;
      t = t.filter(function (x) {
        return [x.type, x.ref, x.from, x.to, x.by, x.remarks, x.cond, String(Math.abs(x.qty)), fmtDT(x.ts),
          x.ids.allotmentId || "", x.ids.demandId || "", x.ids.distributionId || ""].join(" ").toLowerCase().indexOf(q) !== -1;
      });
    }
    var dir = state.sortDir, k = state.sortKey;
    t = t.slice().sort(function (a, b) {
      var va = a[k], vb = b[k];
      if (k === "qty") { va = Math.abs(a.qty); vb = Math.abs(b.qty); }
      if (typeof va === "string" || typeof vb === "string") return String(va || "").localeCompare(String(vb || "")) * dir;
      return ((va || 0) - (vb || 0)) * dir;
    });
    state.view = t;
    renderTable(); renderSummary(); renderTimeline(); renderGallery();
  }
  function sortBy(key) {
    if (state.sortKey === key) state.sortDir = -state.sortDir;
    else { state.sortKey = key; state.sortDir = key === "ts" ? -1 : 1; }
    applyFilters();
  }
  function renderTable() {
    var body = $("#ipTxBody");
    if (!body) return;
    document.querySelectorAll("#view-itemprofile .sort-arrow").forEach(function (s) {
      s.textContent = s.dataset.ar === state.sortKey ? (state.sortDir > 0 ? "\u25B2" : "\u25BC") : "";
    });
    var rows = state.view;
    var pages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    if (state.page >= pages) state.page = pages - 1;
    var start = state.page * state.pageSize;
    var page = rows.slice(start, start + state.pageSize);
    var note = $("#ipCount");
    if (note) note.textContent = rows.length + " transaction" + (rows.length === 1 ? "" : "s");
    var filtered = state.q || state.fType || state.fCond || state.fFrom || state.fTo || state.fUnit;
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="10"><div class="ip-empty"><div class="big">&#128203;</div>' +
        (filtered ? "No transactions match your search/filter." :
          "No transaction history found.<br>Transactions related to this item will appear here automatically.") + "</div></td></tr>";
    } else {
      body.innerHTML = page.map(function (t) {
        var idx = state.txs.indexOf(t);
        var cls = t.info ? "ip-tb-info" : t.qty > 0 ? "ip-tb-added" : t.qty < 0 ? "ip-tb-out" : "ip-tb-info";
        var qCls = t.qty > 0 ? "ip-qty-pos" : t.qty < 0 ? "ip-qty-neg" : "ip-qty-zero";
        var qTxt = t.info ? "\u2014" : (t.qty > 0 ? "+" : "") + fmtN(t.qty);
        return '<tr data-tx="' + idx + '">' +
          '<td style="white-space:nowrap"><div>' + fmtD(t.ts) + '</div><div style="font-size:.72rem;color:var(--muted)">' + fmtT(t.ts) + "</div></td>" +
          '<td class="ip-type"><span class="ip-typebadge ' + cls + '">' + esc(t.type) + "</span>" + (t.derived ? '<span class="ip-derived" title="Computed from current records">derived</span>' : "") + "</td>" +
          "<td>" + esc(t.ref || "\u2014") + "</td><td>" + esc(t.from) + "</td><td>" + esc(t.to) + "</td>" +
          '<td class="' + qCls + '">' + qTxt + "</td><td>" + esc(t.cond || "\u2014") + "</td>" +
          '<td class="qty-strong">' + fmtN(t.balance) + "</td><td>" + esc(t.by || "\u2014") + "</td>" +
          '<td style="max-width:220px">' + esc(t.remarks || "\u2014") + "</td></tr>";
      }).join("");
    }
    var p = $("#ipPager");
    if (p) p.innerHTML = rows.length
      ? '<button type="button" class="btn btn-outline" data-ipp="prev" data-pp="prev" ' + (state.page === 0 ? "disabled" : "") + '>&larr; Prev</button>' +
        '<span>Showing ' + (start + 1) + "\u2013" + Math.min(start + state.pageSize, rows.length) + " of " + rows.length + " \u00b7 Page " + (state.page + 1) + "/" + pages + "</span>" +
        '<button type="button" class="btn btn-outline" data-ipp="next" data-pp="next" ' + (state.page >= pages - 1 ? "disabled" : "") + ">Next &rarr;</button>" +
        '<select id="ipPageSize2"><option' + (state.pageSize === 25 ? " selected" : "") + ">25</option><option" + (state.pageSize === 50 ? " selected" : "") + ">50</option><option" + (state.pageSize === 100 ? " selected" : "") + ">100</option></select>"
      : "";
    var ps2 = document.getElementById("ipPageSize2");
    if (ps2) ps2.addEventListener("change", function () { state.pageSize = Number(ps2.value) || 25; state.page = 0; renderTable(); });
  }
  function renderSummary() {
    var box = $("#ipSummary");
    if (!box) return;
    var counts = {};
    state.txs.forEach(function (t) { if (!t.info) { var k = t.type.split(" (")[0]; counts[k] = (counts[k] || 0) + Math.abs(t.qty); } });
    var order = ["STOCK ADDED", "ISSUED", "RETURNED", "DISTRIBUTED", "DISTRIBUTION PENDING", "DISTRIBUTION REJECTED", "MARKED LOST", "DEMAND SUPPLIED", "RECOVERED", "Lost", "DAMAGED", "STOCK ADJUSTMENT", "WRITE-OFF"];
    var items = order.filter(function (k) { return counts[k]; }).map(function (k) { return [k, counts[k]]; });
    box.innerHTML = '<div class="ip-stat ip-blue"><div class="ip-num">' + state.txs.filter(function (t) { return !t.info; }).length + '</div><div class="ip-lbl">Total Transactions</div></div>' +
      items.map(function (c) { return '<div class="ip-stat"><div class="ip-num">' + fmtN(c[1]) + '</div><div class="ip-lbl">' + esc(c[0]) + "</div></div>"; }).join("");
  }
  function renderTimeline() {
    var box = $("#ipTimeline");
    if (!box) return;
    var rows = state.view.slice(0, 60);
    if (!rows.length) { box.innerHTML = '<div class="ip-empty">No activity to show yet.</div>'; return; }
    var html = '<div class="ip-timeline">', lastDay = "";
    rows.forEach(function (t) {
      var d = new Date(t.ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      if (d !== lastDay) { html += '<div class="ip-tl-date">' + d + "</div>"; lastDay = d; }
      var time = new Date(t.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      html += '<div class="ip-tl-item ' + (t.qty > 0 ? "ip-pos" : t.qty < 0 ? "ip-neg" : "") + '"><span class="t">' + time + "</span><b>" + esc(t.type) + "</b>" +
        (t.qty && !t.info ? ' <span style="color:var(--muted)">' + (t.qty > 0 ? "+" : "") + fmtN(t.qty) + " " + esc((state.item && state.item.unit) || "units") + (t.qty < 0 && t.to ? " \u2192 " + esc(t.to) : t.qty > 0 && t.from && t.from !== "\u2014" ? " \u2190 " + esc(t.from) : "") + "</span>" : "") +
        (t.remarks ? '<span class="sub">' + esc(t.remarks) + "</span>" : "") + "</div>";
    });
    if (state.view.length > 60) html += '<div class="ip-tl-date">\u2026 and ' + (state.view.length - 60) + " more (see table)</div>";
    box.innerHTML = html + "</div>";
  }
  function renderGallery() {
    var box = $("#ipGallery");
    if (!box) return;
    var list = loadPhotos(state.itemId);
    var manage = canManagePhotos(state.item);
    if (!list.length) {
      box.innerHTML = '<div class="ip-empty"><div class="big">&#128247;</div>No photos uploaded.<br>' +
        (manage ? '<div style="margin-top:8px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
          '<button type="button" class="btn btn-primary" id="ipGalUpload">Upload Photo</button>' +
          '<button type="button" class="btn btn-outline" id="ipGalCamera">&#128247; Camera</button></div>' : "") + "</div>";
      return;
    }
    box.innerHTML = (manage ? '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">' +
        '<button type="button" class="btn btn-primary" id="ipGalUpload">Upload Photo</button>' +
        '<button type="button" class="btn btn-outline" id="ipGalCamera">&#128247; Camera</button></div>' : "") +
      '<div class="ip-gallery">' + list.slice().reverse().map(function (p) {
        var dtDisplay = "";
        if (p.sourceDetails && (p.sourceDetails.date || p.sourceDetails.time)) {
          dtDisplay = (p.sourceDetails.date ? fmtD(p.sourceDetails.date) : "") + (p.sourceDetails.time ? " " + p.sourceDetails.time : "");
        } else if (p.date || p.time) {
          dtDisplay = (p.date ? fmtD(p.date) : "") + (p.time ? " " + p.time : "");
        } else if (p.uploadedAt) {
          dtDisplay = fmtDT(p.uploadedAt);
        } else {
          dtDisplay = "\u2014";
        }
        return '<div class="ip-gal-item">' + (p.isProfile ? '<span class="ip-gal-badge">Profile</span>' : "") +
          '<span class="ip-gal-stamp">&#128197; ' + esc(dtDisplay) + '</span>' +
          '<img src="' + p.data + '" data-gal-view alt="photo">' +
          '<div class="ip-gal-meta"><b>' + esc(p.name || "photo") + '</b><br><span style="font-size:.78rem;color:var(--text-muted,#64748b)">&#128197; ' + esc(dtDisplay) + '</span><br><span style="font-size:.74rem;color:var(--text-muted,#64748b)">by ' + esc(p.uploadedBy || "\u2014") + '</span></div>' +
          (manage ? '<div class="ip-gal-actions">' +
            (p.isProfile ? "" : '<button type="button" class="btn btn-outline" data-gal-act="profile" data-gal-id="' + p.id + '">Set Profile</button>') +
            '<button type="button" class="btn btn-outline act-dd-del" data-gal-act="del" data-gal-id="' + p.id + '">Delete</button></div>' : "") +
          "</div>";
      }).join("") + "</div>";
  }
  function handleGalleryAction(act, photoId) {
    var map = photosMap(), list = map[state.itemId] || [];
    if (act === "profile") {
      list.forEach(function (p) { p.isProfile = p.id === photoId; });
      saveData("itemPhotos", map);
      toast("Profile photo updated.", "success"); renderAll(); return;
    }
    if (act === "del") {
      if (!confirm("Delete this photo? This cannot be undone.")) return;
      map[state.itemId] = list.filter(function (p) { return p.id !== photoId; });
      saveData("itemPhotos", map);
      try { __audit("Item Photo Deleted", photoId + " for " + state.item.name, { entity: "Item" }); } catch (e) {}
      toast("Photo deleted.", "success"); renderAll();
    }
  }
  function lightbox(src) {
    var lb = document.getElementById("ipLightbox");
    if (!lb) {
      lb = document.createElement("div"); lb.id = "ipLightbox";
      document.body.appendChild(lb);
      lb.addEventListener("click", function () { lb.remove(); });
    }
    lb.innerHTML = '<img src="' + src + '">';
  }

  /* ---------- camera capture ---------- */
  function openIpCamera(onFile) {
    var old = document.getElementById("ipCameraModal");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast("Camera not supported here. Use Upload Photo instead.", "error"); return; }
    var overlay = document.createElement("div");
    overlay.id = "ipCameraModal";
    overlay.innerHTML =
      '<div class="ip-cam-backdrop"></div>' +
      '<div class="ip-cam-box">' +
        '<div class="ip-cam-head"><b>&#128247; Camera</b><button type="button" class="btn btn-outline" id="ipCamCancel">Close</button></div>' +
        '<video id="ipCamVideo" autoplay playsinline muted></video>' +
        '<div class="ip-cam-actions"><button type="button" class="btn btn-primary" id="ipCamCapture">Capture Photo</button></div>' +
      "</div>";
    document.body.appendChild(overlay);
    var video = overlay.querySelector("#ipCamVideo");
    var stream = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false }).then(function (s) {
      stream = s;
      video.srcObject = s;
    }).catch(function () {
      closeIpCamera();
      toast("Camera permission denied or unavailable. Use Upload Photo instead.", "error");
    });
    overlay.querySelector("#ipCamCancel").addEventListener("click", closeIpCamera);
    overlay.querySelector(".ip-cam-backdrop").addEventListener("click", closeIpCamera);
    overlay.querySelector("#ipCamCapture").addEventListener("click", function () {
      try {
        var w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) { toast("Camera is not ready yet. Try again.", "error"); return; }
        var c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(video, 0, 0, w, h);
        var b64 = c.toDataURL("image/jpeg", 0.85);
        var bin = atob(b64.split(",")[1]);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        var file = new File([arr], "camera-" + new Date().toISOString().replace(/[:.]/g, "-") + ".jpg", { type: "image/jpeg" });
        closeIpCamera();
        if (typeof onFile === "function") { onFile(file); return; }
        var prog = document.getElementById("ipUploadProgress");
        if (prog) prog.classList.remove("hidden");
        window.__ipUploadPhoto(file).then(function () {
          if (prog) prog.classList.add("hidden");
          toast("Photo captured and set as profile photo.", "success");
          renderAll();
        }).catch(function (msg) {
          if (prog) prog.classList.add("hidden");
          toast(typeof msg === "string" ? msg : "Photo upload failed.", "error");
        });
      } catch (err) { toast("Capture failed. Try again.", "error"); }
    });
  }
  window.__ipOpenCamera = function (onFile) { openIpCamera(onFile); };
  window.__ipRefresh = function () {
    if (state.itemId) {
      var it = (window.getItems ? getItems() : []).find(function (x) { return x.id === state.itemId; }) ||
               (window.getConsItems ? getConsItems() : []).find(function (x) { return x.id === state.itemId; }) ||
               state.item;
      if (it) {
        state.item = it;
        renderAll();
      }
    }
  };
  function closeIpCamera() {
    var overlay = document.getElementById("ipCameraModal");
    var video = overlay ? overlay.querySelector("#ipCamVideo") : null;
    try { var s = video && video.srcObject; if (s && s.getTracks) s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  /* ---------- transaction details modal ---------- */
  function openTxDetails(idx) {
    var t = state.txs[idx];
    if (!t) return;
    var item = state.item;
    var prev = t.info ? null : t.balance - t.qty;
    function row(k, v) { return v ? '<div class="ip-info-row"><span class="k">' + k + '</span><span class="v">' + esc(String(v)) + "</span></div>" : ""; }
    var modal = document.createElement("div");
    modal.className = "ip-modal"; modal.id = "ipTxModal";
    modal.innerHTML = '<div class="ip-modal-box"><h3>' + esc(t.type) + "</h3>" +
      '<div class="ip-sub">' + esc(item.name) + " \u00b7 " + fmtDT(t.ts) + (t.derived ? " \u00b7 derived from current records" : "") + "</div>" +
      row("Transaction ID", "TX-" + t.ts + "-" + (t.raw || "")) +
      row("Transaction Type", t.type) + row("Date", fmtD(t.ts)) + row("Time", new Date(t.ts).toLocaleTimeString("en-IN")) +
      row("Item", item.name + " (" + itemCode(item) + ")") +
      row("Quantity", t.info ? "" : (t.qty > 0 ? "+" : "") + t.qty + " " + (item.unit || "pcs")) +
      row("Previous Balance", prev === null ? "" : prev) + row("New Balance", t.balance) +
      row("Condition", t.cond) + row("From", t.from) + row("To", t.to) + row("Performed By", t.by) +
      row("Reference Number", t.ref) + row("Remarks / Reason", t.remarks) +
      row("Related Allotment ID", t.ids.allotmentId) + row("Related Demand ID", t.ids.demandId) +
      row("Related Distribution ID", t.ids.distributionId) +
      '<div style="margin-top:14px;text-align:right"><button type="button" class="btn btn-primary" id="ipTxClose">Close</button></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", function (e) { if (e.target === modal || e.target.id === "ipTxClose") modal.remove(); });
  }

  /* ---------- exports ---------- */
  function exportRows(rows) {
    var item = state.item;
    return rows.map(function (t) {
      var prev = t.info ? "" : t.balance - t.qty;
      return [item.name, itemCode(item), catName(item.categoryId),
        "TX-" + t.ts + "-" + t.raw, fmtD(t.ts), new Date(t.ts).toLocaleTimeString("en-IN"),
        t.type, t.ref, t.from, t.to, t.info ? "" : t.qty, t.cond, prev, t.balance, t.by, t.remarks];
    });
  }
  function exportData(rows, suffix) {
    var item = state.item;
    return {
      title: "Item Transaction History \u2014 " + item.name,
      subtitle: itemCode(item) + " \u00b7 " + (catName(item.categoryId) || "\u2014") + " \u00b7 Generated " + new Date().toLocaleString() + " (" + rows.length + " transactions)",
      cols: ["Item Name", "Item Code", "Category", "Transaction ID", "Date", "Time", "Transaction Type", "Reference", "From", "To", "Quantity", "Condition", "Previous Balance", "New Balance", "Performed By", "Remarks"],
      rows: exportRows(rows), fileName: "item-history-" + itemCode(item).toLowerCase() + suffix
    };
  }
  function csvStr(rows) {
    var head = ["Item Name", "Item Code", "Category", "Transaction ID", "Date", "Time", "Transaction Type", "Reference", "From", "To", "Quantity", "Condition", "Previous Balance", "New Balance", "Performed By", "Remarks"];
    function escq(v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var lines = [head.join(",")];
    rows.forEach(function (r) { lines.push(r.map(escq).join(",")); });
    return lines.join("\r\n");
  }
  function doExport(kind) {
    try {
      var all = kind === "all";
      var d = exportData(all ? state.txs : state.view, all ? "-complete" : "-filtered");
      if (kind === "csv" || kind === "all") downloadBlob("\uFEFF" + csvStr(d.rows), "text/csv;charset=utf-8", d.fileName + ".csv");
      else if (kind === "excel") excelReport(d);
      else if (kind === "pdf") pdfReport(d);
      else if (kind === "print") printReport(d);
      toast("Export ready" + (all ? " (complete history)" : " (filtered view)") + ".", "success");
    } catch (e) { toast("Export failed: " + (e && e.message ? e.message : e), "error"); }
  }

  /* ---------- routing ---------- */
  function hashChange() {
    var m = location.hash.match(/^#items\/(.+)$/);
    if (m && m[1] && m[1] !== state.itemId && user() && document.getElementById("appRoot") && !document.getElementById("appRoot").classList.contains("hidden")) {
      window.openItemProfile(m[1]);
    }
  }
  window.addEventListener("hashchange", hashChange);
  var pollCount = 0;
  var poller = setInterval(function () {
    pollCount++;
    var m = location.hash.match(/^#items\/(.+)$/);
    if (m && m[1] && m[1] !== state.itemId && user() && document.getElementById("appRoot") && !document.getElementById("appRoot").classList.contains("hidden")) {
      window.openItemProfile(m[1]);
    }
    if (pollCount > 240) clearInterval(poller);
  }, 500);
  var _origSwitchTab = window.switchTab;
  if (typeof _origSwitchTab === "function") {
    window.switchTab = function (name) {
      if (name !== "itemprofile") {
        window.currentTab = name;
        if (location.hash.indexOf("#items/") === 0) history.replaceState(null, "", location.pathname + location.search);
        state.itemId = null; state.item = null;
      }
      return _origSwitchTab.apply(this, arguments);
    };
  }
  var _origOpenViewItem = window.openViewItem;
  if (typeof _origOpenViewItem === "function") {
    window.openViewItem = function (item) {
      window.__ipViewModalItemId = item && item.id ? item.id : null;
      return _origOpenViewItem.apply(this, arguments);
    };
  }

  /* ---------- global click delegation for item-name links ---------- */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest(".ip-item-link") : null;
    if (a) {
      e.preventDefault();
      e.stopPropagation();
      if (!state.prevTab) {
        state.prevTab = getCurrentActiveTab() || (state.kind === "cons" ? "consumables" : "inventory");
      }
      if (typeof closeModals === "function") {
        try { closeModals(); } catch (err) {}
      }
      document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(function (m) {
        try { m.classList.add("hidden"); } catch (err) {}
      });
      var id = a.dataset.ipId;
      var nm = a.dataset.ipName;
      var dist = a.dataset.ipDist;
      var opts = { name: nm, districtId: dist };
      if (id) {
        window.openItemProfile(id, opts);
      } else if (nm) {
        window.openItemProfileByName(nm, opts);
      }
    }
  }, true);

  /* ---------- "Open Full Profile" button inside existing View modal ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
      var vm = document.getElementById("viewItemModal");
      if (!vm || vm.querySelector("[data-ip-open-from-view]")) return;
      var footer = vm.querySelector(".modal-actions") || vm;
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "btn btn-outline"; btn.textContent = "Open Full Profile";
      btn.setAttribute("data-ip-open-from-view", "1");
      btn.addEventListener("click", function () {
        var id = window.__ipViewModalItemId || null;
        closeModals();
        if (id) window.openItemProfile(id);
      });
      footer.insertBefore(btn, footer.firstChild);
    }, 800);
  });

  try {
    var distView = document.getElementById("view-distribution");
    if (distView && !distView.classList.contains("hidden") && typeof renderDistribution === "function") {
      renderDistribution();
    }
  } catch (_) {}
})();
