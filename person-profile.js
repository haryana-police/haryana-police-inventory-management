/* ============================================================
   PERSON DETAILS / ISSUE HISTORY & COMPLETE AUDIT — HP Inventory
   2026.09.81 — unified, computed view over EXISTING records.
   Reuses: persons master, allotments (+returns/losses/recoveries),
   items, categories, locations. Loads after item-profile.js.
   ============================================================ */
"use strict";
(function () {
  var VERSION = "2026.09.195";
  var VIEW_ID = "view-personprofile";
  var PHOTOS_CAP = 20;
  var state = {
    personId: null, person: null, pseudo: false, districtId: null,
    allots: [], txs: [], view: [], page: 0, pageSize: 25,
    sortKey: "ts", sortDir: -1,
    q: "", fType: "", fCat: "", fItem: "", fCond: "", fFrom: "", fTo: "",
    built: false, searchTimer: null
  };
  window.__ppVersion = VERSION;

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
  function fmtT(ts) { return ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""; }
  function tsOf(date, time, at) {
    if (at) return at;
    try { return date ? new Date(date + "T" + (time || "00:00") + ":00").getTime() : 0; } catch (e) { return 0; }
  }
  function catName(id) { var c = (getCategories() || []).find(function (x) { return x.id === id; }); return c ? c.name : ""; }
  function distName(id) { var d = (getDistricts() || []).find(function (x) { return x.id === id; }); return d ? d.name : (id || ""); }
  function locName(districtId, locId) {
    if (!locId) return "";
    var l = (window.getAllLocations ? (getAllLocations()[districtId] || []) : []).find(function (x) { return x.id === locId; });
    return l ? l.name : locId;
  }
  function user() { try { return (typeof currentUser !== "undefined" && currentUser) || null; } catch (e) { return null; } }
  function isAdminLike() { var u = user(); return !!u && (u.role === "admin" || u.role === "devadmin"); }
  function canSeePII() { return isAdminLike(); }
  function itemCode(item) {
    if (!item) return "";
    if (item.code || item.sku) return item.code || item.sku;
    return "ITM-" + String(item.id || "").slice(-6).toUpperCase();
  }
  function out(a) { return window.allocOutstanding ? allocOutstanding(a) : Math.max(0, (a.qtyAllotted || 0) - (a.qtyReturned || 0) - (a.qtyLost || 0)); }

  /* ---------- person resolution ---------- */
  function getPersonsSafe() { try { return getPersons() || []; } catch (e) { return []; } }
  function allotmentsForPerson(p) {
    var belt = String((p && p.beltNo) || "").toUpperCase();
    var nm = String((p && p.name) || "").toLowerCase();
    var pool = window.getVisibleAllotments ? getVisibleAllotments() : (getAllotments() || []);
    return pool.filter(function (a) {
      if (p && p.id && a.personId && a.personId === p.id) return true;
      return String(a.beltNo || "").toUpperCase() === belt && String(a.name || "").toLowerCase() === nm;
    });
  }
  function pseudoPersonFromAllotments(allots, belt, name) {
    var first = allots[0] || {};
    return {
      id: "pseudo:" + String(belt || name || "").toUpperCase(),
      name: name || first.name || "", rank: first.rank || "", beltNo: belt || first.beltNo || "",
      posting: first.posting || "", districtId: first.districtId || activeDistrictId,
      locationId: first.locationId || null, mobile: first.mobile || "",
      createdAt: first.createdAt || null, __pseudo: true
    };
  }
  window.resolvePersonForProfile = function (ref) {
    // ref: { id, belt, name }
    var persons = getPersonsSafe();
    var p = null;
    if (ref.id && ref.id.indexOf("pseudo:") !== 0) p = persons.find(function (x) { return x.id === ref.id; });
    if (!p && ref.belt) p = persons.find(function (x) { return String(x.beltNo || "").toUpperCase() === String(ref.belt).toUpperCase(); });
    if (p) return { person: p, allots: allotmentsForPerson(p), pseudo: false };
    var allots = (window.getVisibleAllotments ? getVisibleAllotments() : (getAllotments() || [])).filter(function (a) {
      if (ref.belt && String(a.beltNo || "").toUpperCase() !== String(ref.belt).toUpperCase()) return false;
      if (ref.id && a.personId && a.personId !== ref.id) return false;
      if (ref.name && String(a.name || "").toLowerCase() !== String(ref.name).toLowerCase()) return false;
      return !!(ref.belt || ref.id || ref.name);
    });
    if (allots.length) return { person: pseudoPersonFromAllotments(allots, ref.belt, ref.name), allots: allots, pseudo: true };
    return null;
  };
  function canManagePersonPhotos(person, allots) {
    var u = user();
    if (!u || u.role === "devadmin") return false;
    if (u.role === "admin") return true;
    var visLoc = null;
    try { visLoc = window.getVisibleLocationId ? getVisibleLocationId() : null; } catch (e) {}
    if (!visLoc) return false;
    return (allots || []).some(function (a) { return a.locationId === visLoc; });
  }

  /* ---------- clickable person links (used across app tables) ---------- */
  window.__ppLink = function (a) {
    try {
      if (!a || (!a.name && !a.beltNo)) return esc((a && a.name) || "");
      var pid = a.personId || "";
      var belt = a.beltNo || "";
      var known = pid && getPersonsSafe().some(function (p) { return p.id === pid; });
      if (!known && belt) known = getPersonsSafe().some(function (p) { return String(p.beltNo || "").toUpperCase() === String(belt).toUpperCase(); });
      var attrs = 'class="pp-person-link" data-pp-id="' + esc(known ? pid : "") + '" data-pp-belt="' + esc(belt) + '" title="Open Person Details"';
      return '<a href="javascript:void(0)" ' + attrs + ">" + esc(a.name || "") + "</a>";
    } catch (e) { return esc((a && a.name) || ""); }
  };
  /* Keep the existing modal entry point working — reroute it to the full page */
  window.openAllocPersonDetail = function (beltNo) {
    var r = window.resolvePersonForProfile({ belt: beltNo });
    if (!r) { toast("No records found for BELT " + (beltNo || "") + ".", "error"); return; }
    window.openPersonProfile(r.person.id, { belt: r.person.beltNo });
  };

  /* ---------- transaction derivation ---------- */
  function T(o) {
    return {
      ts: o.ts || 0, seq: o.seq || 0, type: o.type, allotId: o.allotId || "", issueId: o.issueId || "",
      itemId: o.itemId || "", itemName: o.itemName || "", categoryId: o.categoryId || "", categoryName: o.categoryName || "",
      qty: o.qty || 0, ref: o.ref || "", issuedBy: o.issuedBy || "", processedBy: o.processedBy || "",
      cond: o.cond || "", remark: o.remark || "", subRef: o.subRef || "",
      outBefore: o.outBefore, outAfter: o.outAfter, partial: !!o.partial, info: !!o.info
    };
  }
  function deriveTxs(allots) {
    var txs = [], seq = 0;
    var sorted = allots.slice().sort(function (x, y) { return (x.createdAt || 0) - (y.createdAt || 0); });
    sorted.forEach(function (a) {
      var baseRef = a.beltNo || a.issueId || a.id;
      txs.push(T({ ts: tsOf(a.date, a.time, a.createdAt), seq: seq++, type: "Issue", allotId: a.id, issueId: a.issueId || "",
        itemId: a.itemId, itemName: a.itemName, categoryId: a.categoryId, categoryName: a.categoryName || catName(a.categoryId),
        qty: a.qtyAllotted || 0, ref: baseRef, issuedBy: a.createdBy || "", processedBy: a.name || "",
        cond: "Good", remark: a.remarks || ("Issued " + (a.qtyAllotted || 0) + " units"), subRef: a.issueId || a.id,
        outBefore: 0, outAfter: a.qtyAllotted || 0 }));
      var evs = [];
      (a.returns || []).forEach(function (r, i) { if (r.condition !== "cancelled") evs.push({ kind: "return", e: r, i: i, ts: tsOf(r.date, r.time, r.at) }); });
      (a.losses || []).forEach(function (l, i) { evs.push({ kind: "loss", e: l, i: i, ts: tsOf(l.date, l.time, l.at) }); });
      (a.recoveries || []).forEach(function (rc, i) { evs.push({ kind: "recovery", e: rc, i: i, ts: tsOf(rc.date, rc.time, rc.at) }); });
      evs.sort(function (x, y) { return (x.ts || 0) - (y.ts || 0); });
      var ret = 0, lost = 0;
      evs.forEach(function (ev) {
        var e = ev.e;
        var outBefore = Math.max(0, (a.qtyAllotted || 0) - ret - lost);
        var t, cond = "", remark = "", processedBy = "", partial = false, qty = Number(e.qty) || 0;
        if (ev.kind === "return") {
          if (e.condition === "lost") { t = "Lost"; lost += qty; cond = "Lost"; remark = e.remarks || "Reported lost during return"; }
          else {
            partial = qty < outBefore;
            t = partial ? "Partial Return" : "Return";
            ret += qty;
            cond = e.condition === "good" ? "Good" : e.condition === "poor" ? "Damaged" : e.condition === "damaged" ? "Scrap" : e.condition === "other" ? "Other" : (e.condition || "");
            remark = e.remarks || "";
          }
          processedBy = e.receivedBy || "";
          t = ev.kind === "return" && e.condition !== "lost" && !partial ? "Return" : t;
        } else if (ev.kind === "loss") {
          t = "Lost"; lost += qty; cond = "Lost"; remark = e.reason || ""; processedBy = e.by || "";
        } else {
          t = "Recovered"; cond = "Good"; remark = (e.mode ? "Recovered via " + e.mode : "") + (e.remarks ? " \u2014 " + e.remarks : ""); processedBy = e.by || "";
        }
        var outAfter = Math.max(0, (a.qtyAllotted || 0) - ret - lost);
        var typeLabel = t === "Recovered" ? "Recovered" : t;
        txs.push(T({ ts: ev.ts, seq: seq++, type: typeLabel, allotId: a.id, issueId: a.issueId || "",
          itemId: a.itemId, itemName: a.itemName, categoryId: a.categoryId, categoryName: a.categoryName || catName(a.categoryId),
          qty: qty, ref: baseRef + " \u00b7 " + (ev.kind === "return" ? "R" + (ev.i + 1) : ev.kind === "loss" ? "L" + (ev.i + 1) : "V" + (ev.i + 1)),
          issuedBy: a.createdBy || "", processedBy: processedBy, cond: cond, remark: remark,
          subRef: e.id || (a.issueId || a.id) + "-" + ev.kind + "-" + (ev.i + 1),
          outBefore: outBefore, outAfter: outAfter, partial: partial }));
      });
      (a.returns || []).forEach(function (r, i) {
        if (r.condition !== "cancelled") return;
        var outBefore = out(a);
        txs.push(T({ ts: tsOf(r.date, r.time, r.at), seq: seq++, type: "Issue Cancelled", allotId: a.id, issueId: a.issueId || "",
          itemId: a.itemId, itemName: a.itemName, categoryId: a.categoryId, categoryName: a.categoryName || catName(a.categoryId),
          qty: r.qty || 0, ref: (a.beltNo || a.issueId || a.id) + " \u00b7 C" + (i + 1), issuedBy: a.createdBy || "",
          processedBy: (a.statusNote || "").replace("Cancelled by ", ""), cond: "Good", remark: r.remarks || a.statusNote || "Issue cancelled, stock restored",
          subRef: a.id, outBefore: outBefore, outAfter: 0 }));
      });
    });
    txs.sort(function (x, y) { return (x.ts - y.ts) || (x.seq - y.seq); });
    return txs;
  }
  function computeSummary(allots) {
    var s = { issues: allots.length, issued: 0, returned: 0, partial: 0, lost: 0, held: 0, items: 0, pending: 0, recovered: 0 };
    var names = {};
    allots.forEach(function (a) {
      s.issued += a.qtyAllotted || 0;
      s.held += out(a);
      if (a.itemName) { names[a.itemName] = 1; }
      if (out(a) > 0 && a.status !== "CANCELLED") s.pending++;
      (a.returns || []).forEach(function (r) {
        if (r.condition === "cancelled") return;
        if (r.condition === "lost") { s.lost += r.qty || 0; return; }
        s.returned += r.qty || 0;
      });
      (a.losses || []).forEach(function (l) { s.lost += l.qty || 0; });
      (a.recoveries || []).forEach(function (rc) { s.recovered += rc.qty || 0; });
    });
    /* partial qty: recompute from derived rows for accuracy */
    s.items = Object.keys(names).length;
    return s;
  }

  /* ---------- photos ---------- */
  function photosMap() { return loadData("personPhotos") || {}; }
  function loadPhotos(pid) { return photosMap()[pid] || []; }
  function profilePhoto(pid) {
    var list = loadPhotos(pid);
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
  window.__ppUploadPhoto = function (file) {
    var p = state.person;
    if (!p) return Promise.reject("No person selected");
    if (!canManagePersonPhotos(p, state.allots)) return Promise.reject("You do not have permission to upload photos for this person.");
    return validateAndCompress(file).then(function (img) {
      var map = photosMap();
      var list = map[p.id] || (map[p.id] = []);
      if (list.length >= PHOTOS_CAP) return Promise.reject("Photo limit reached (" + PHOTOS_CAP + " per person). Delete old photos to add more.");
      list.forEach(function (x) { x.isProfile = false; });
      var rec = { id: (window.uid ? uid() : Date.now().toString(36)), data: img.data, name: img.name, size: img.size,
        uploadedBy: user() ? (user().name || user().username) : "", uploadedAt: Date.now(), isProfile: true };
      list.push(rec);
      saveData("personPhotos", map);
      try { __audit("Person Photo Uploaded", img.name + " for " + p.name + " (BELT: " + (p.beltNo || "") + ")", { entity: "Person" }); } catch (e) {}
      return rec;
    });
  };

  /* ---------- camera capture (shared modal from item-profile.js) ---------- */
  function ppOpenCamera() {
    if (!window.__ipOpenCamera) { toast("Camera unavailable. Use Upload Photo instead.", "error"); return; }
    window.__ipOpenCamera(function (file) {
      var prog = document.getElementById("ppUploadProgress");
      if (prog) prog.classList.remove("hidden");
      window.__ppUploadPhoto(file).then(function () {
        if (prog) prog.classList.add("hidden");
        toast("Photo captured and set as profile photo.", "success");
        renderAll();
      }).catch(function (msg) {
        if (prog) prog.classList.add("hidden");
        toast(typeof msg === "string" ? msg : "Photo upload failed.", "error");
      });
    });
  }

  /* ---------- skeleton ---------- */
  function buildSkeleton() {
    var view = document.getElementById(VIEW_ID);
    if (!view) return;
    view.innerHTML =
      '<div class="ip-wrap">' +
        '<div class="ip-topbar"><div style="flex:1;min-width:260px">' +
          '<div class="ip-breadcrumb"><a data-pp-nav="back">&larr; Back</a><span>&rsaquo;</span><a data-pp-nav="allot">Item Issued</a><span>&rsaquo;</span><b id="ppCrumbName">\u2014</b></div>' +
          '<div class="ip-title-row"><h1 class="ip-title" id="ppTitle">\u2014</h1><span id="ppRankBadge"></span></div>' +
          '<div class="ip-meta" id="ppMeta"></div>' +
          '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap" id="ppTopActions"></div>' +
        '</div>' +
        '<div class="ip-photo-card">' +
          '<div class="ip-photo-frame" id="ppPhotoFrame"></div>' +
          '<div class="ip-photo-actions">' +
            '<button type="button" class="btn btn-primary" id="ppUploadBtn">Upload Photo</button>' +
            '<button type="button" class="btn btn-outline" id="ppCameraBtn">&#128247; Camera</button>' +
            '<input type="file" id="ppPhotoInput" accept="image/*" hidden>' +
            '<div id="ppUploadProgress" class="hidden" style="font-size:.72rem;color:var(--muted)">Processing\u2026</div>' +
          '</div>' +
        '</div></div>' +
        '<div id="ppBody"></div>' +
      '</div>';
    state.built = true;
    bindSkeletonEvents();
  }
  function bindSkeletonEvents() {
    var view = document.getElementById(VIEW_ID);
    if (!view || view.dataset.ppBound) return;
    view.dataset.ppBound = "1";
    view.addEventListener("click", function (e) {
      if (!e.target || !e.target.closest) return;
      var nav = e.target.closest("[data-pp-nav]");
      if (nav) { e.preventDefault(); closePersonProfile(); return; }
      if (e.target.id === "ppUploadBtn") { var i = document.getElementById("ppPhotoInput"); if (i) i.click(); return; }
      if (e.target.id === "ppCameraBtn") { ppOpenCamera(); return; }
      if (e.target.id === "ppGalUpload") { var i2 = document.getElementById("ppPhotoInput"); if (i2) i2.click(); return; }
      if (e.target.id === "ppGalCamera") { ppOpenCamera(); return; }
      var gal = e.target.closest("[data-gal-act]");
      if (gal) { handleGalleryAction(gal.dataset.galAct, gal.dataset.galId); return; }
      var zoom = e.target.closest("[data-gal-view]");
      if (zoom) { lightbox(zoom.getAttribute("src")); return; }
      var th = e.target.closest(".ip-tx-table th[data-sk]");
      if (th) { sortBy(th.dataset.sk); return; }
      var row = e.target.closest(".ip-tx-table tbody tr[data-tx]");
      if (row) { openTxDetails(Number(row.dataset.tx)); return; }
      var pg = e.target.closest("[data-ppg]");
      if (pg && !pg.disabled) { state.page += pg.dataset.ppg === "prev" ? -1 : 1; renderTable(); return; }
      var clr = e.target.closest("#ppClearFilters");
      if (clr) { clearFilters(); return; }
      var ed = e.target.closest("#ppEditBtn");
      if (ed) { openEditPersonModal(); return; }
    });
    var inp = document.getElementById("ppPhotoInput");
    if (inp) inp.addEventListener("change", function () {
      if (!inp.files || !inp.files[0]) return;
      var prog = document.getElementById("ppUploadProgress");
      if (prog) prog.classList.remove("hidden");
      window.__ppUploadPhoto(inp.files[0]).then(function () {
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
  function closePersonProfile() {
    state.personId = null; state.person = null;
    if (location.hash.indexOf("#persons/") === 0) history.replaceState(null, "", location.pathname + location.search);
    if (window.switchTab) switchTab("allotments");
  }
  window.openPersonProfile = function (personId, refHint) {
    if (!user()) { toast("Please login first.", "error"); return; }
    var ref = { id: personId, belt: (refHint && refHint.belt) || "" };
    var r = window.resolvePersonForProfile(ref);
    if (!r) return renderError("notfound");
    var person = r.person, allots = r.allots;
    var dist = person.districtId || (allots[0] && allots[0].districtId) || activeDistrictId;
    if (dist !== activeDistrictId) {
      if (window.isDevAdmin && isDevAdmin() && window.setActiveDistrict) setActiveDistrict(dist);
      else return renderError("unauthorized");
    }
    state.personId = person.id; state.person = person; state.pseudo = !!r.pseudo;
    state.districtId = dist; state.allots = allots;
    state.page = 0; state.q = ""; state.fType = ""; state.fCat = ""; state.fItem = ""; state.fCond = ""; state.fFrom = ""; state.fTo = "";
    state.sortKey = "ts"; state.sortDir = -1;
    var want = "#persons/" + encodeURIComponent(person.id);
    if (location.hash !== want) location.hash = want;
    if (window.switchTab) switchTab("personprofile");
    renderAll();
  };
  function renderError(kind) {
    state.personId = null; state.person = null; state.built = false;
    var view = document.getElementById(VIEW_ID);
    if (!view) return;
    if (window.switchTab) switchTab("personprofile");
    var msg = kind === "unauthorized"
      ? "You do not have permission to view this person's records."
      : "No person or issue records were found for this link. The person may have been removed or the link is invalid.";
    view.innerHTML = '<div class="ip-wrap"><div class="ip-error-view">' +
      '<div class="big">&#128100;</div><h2>Person Not Found</h2>' +
      '<p style="color:var(--muted)">' + esc(msg) + "</p>" +
      '<button type="button" class="btn btn-primary" data-pp-nav="back">Back to Item Issued</button></div></div>';
    view.onclick = function (e) { if (e.target.closest && e.target.closest('[data-pp-nav="back"]')) closePersonProfile(); };
  }

  /* ---------- render ---------- */
  function renderAll() {
    var p = state.person;
    if (!p) return;
    if (!state.built) buildSkeleton();
    var view = document.getElementById(VIEW_ID);
    if (!view) return;
    view.classList.remove("hidden");
    fillHeader(p);
    state.txs = deriveTxs(state.allots);
    state.summary = computeSummary(state.allots);
    state.summary.partial = state.txs.filter(function (t) { return t.type === "Partial Return"; }).reduce(function (s, t) { return s + t.qty; }, 0);
    fillBody(p);
    applyFilters();
  }
  function fillHeader(p) {
    $("#ppCrumbName").textContent = p.name || "";
    $("#ppTitle").textContent = p.name || "";
    $("#ppRankBadge").innerHTML = p.rank ? '<span class="status-badge status-neutral">' + esc(p.rank) + "</span>" : "";
    var mob = canSeePII() ? (p.mobile || "\u2014") : "Restricted";
    $("#ppMeta").innerHTML = [
      ["Belt No.", p.beltNo || "\u2014"], ["Posting", p.posting || "\u2014"], ["Mobile", mob],
      ["District", distName(p.districtId)], ["Designation", p.designation || (p.rank ? p.rank : "\u2014")]
    ].map(function (m) { return '<span class="ip-chip">' + esc(m[0]) + ": <b>" + esc(String(m[1])) + "</b></span>"; }).join("");
    var acts = $("#ppTopActions");
    if (acts) acts.innerHTML =
      (p.__pseudo ? '<span class="status-badge status-low" title="The person master record was removed; profile rebuilt from issue records.">Rebuilt from issue records</span>' : "") +
      (isAdminLike() && !p.__pseudo ? '<button type="button" class="btn btn-outline" id="ppEditBtn">Edit Details</button>' : "") +
      '<button type="button" class="btn btn-outline" id="ppIssueBtn">Issue Item</button>';
    var ib = document.getElementById("ppIssueBtn");
    if (ib) ib.addEventListener("click", function () { window.openAllotModal && openAllotModal(); });
    var upBtn = document.getElementById("ppUploadBtn");
    if (upBtn) upBtn.style.display = canManagePersonPhotos(p, state.allots) ? "" : "none";
    var camBtn = document.getElementById("ppCameraBtn");
    if (camBtn) camBtn.style.display = canManagePersonPhotos(p, state.allots) ? "" : "none";
    var ph = profilePhoto(p.id);
    $("#ppPhotoFrame").innerHTML = ph ? '<img src="' + ph.data + '" alt="Person photo">' : '<div class="ip-no-photo">\uD83D\uDC64</div>';
  }
  function fillBody(p) {
    var s = state.summary;
    var cardsRow1 = [
      ["ISSUES", s.issues, "ip-blue"], ["TOTAL ISSUED", s.issued, "ip-blue"], ["RETURNED", s.returned, "ip-green"],
      ["PARTIAL RETURN", s.partial, "ip-amber"], ["LOST", s.lost, "ip-red"]
    ];
    var cardsRow2 = [
      ["CURRENTLY HELD", s.held, "ip-amber"], ["DIFFERENT ITEMS", s.items, ""],
      ["PENDING RETURNS", s.pending, "ip-red"], ["RECOVERED", s.recovered, "ip-green"]
    ];
    var cats = (getCategories() || []);
    var items = [];
    state.allots.forEach(function (a) { if (a.itemName && items.indexOf(a.itemName) === -1) items.push(a.itemName); });
    var statCard = function (c) {
      return '<div class="ip-stat ' + c[2] + '"><div class="ip-num">' + fmtN(c[1]) + '</div><div class="ip-lbl">' + c[0] + "</div></div>";
    };
    $("#ppBody").innerHTML =
      '<div class="ip-cards ip-row5">' + cardsRow1.map(statCard).join("") + "</div>" +
      '<div class="ip-cards ip-row4">' + cardsRow2.map(statCard).join("") + "</div>" +
      '<div class="ip-section"><h3>Active Holdings</h3><div id="ppHoldings"></div></div>' +
      '<div class="ip-section"><h3>Person Item History</h3>' + toolbarHtml(cats, items) +
      '<div class="ip-table-wrap"><table class="ip-tx-table" data-sortable="false"><thead><tr>' +
        th("ts", "Date &amp; Time") + th("itemName", "Item") + th("type", "Transaction Type") + th("qty", "Quantity") +
        th("ref", "Reference") + th("issuedBy", "Issued By") + th("processedBy", "Processed By") + th("cond", "Condition") + th("remark", "Remark") + "<th>Action</th>" +
      "</tr></thead><tbody id=\"ppTxBody\"></tbody></table></div>" +
      '<div class="ip-pager" id="ppPager"></div></div>' +
      '<div class="ip-section"><h3>Complete Issue, Return &amp; Lost Audit</h3><div id="ppAudit"></div></div>' +
      '<div class="ip-section"><h3>Photo History</h3><div id="ppGallery"></div></div>';
    bindToolbar();
  }
  function th(key, label) { return '<th data-sk="' + key + '">' + label + ' <span class="sort-arrow" data-ar="' + key + '"></span></th>'; }
  function toolbarHtml(cats, items) {
    var types = ["Issue", "Return", "Partial Return", "Lost", "Recovered", "Issue Cancelled"];
    return '<div class="ip-toolbar">' +
      '<input type="text" id="ppSearch" placeholder="Search item, type, ref, remark, user... (debounced)" style="min-width:230px;flex:1">' +
      '<select id="ppFType"><option value="">All Types</option>' + types.map(function (t) { return '<option value="' + t + '">' + t + "</option>"; }).join("") + "</select>" +
      '<select id="ppFCat"><option value="">All Categories</option>' + cats.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + "</option>"; }).join("") + "</select>" +
      '<select id="ppFItem"><option value="">All Items</option>' + items.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + "</option>"; }).join("") + "</select>" +
      '<select id="ppFCond"><option value="">All Conditions</option><option>Good</option><option>Damaged</option><option>Scrap</option><option>Lost</option><option>Other</option></select>' +
      '<input type="date" id="ppFFrom" title="From date"><input type="date" id="ppFTo" title="To date">' +
      '<button type="button" class="btn btn-outline" id="ppClearFilters">Clear Filters</button>' +
      '<div class="stat-export-dd"><button type="button" class="btn btn-outline" id="ppExportBtn">Export / Download <span class="ee-caret">&#9662;</span></button>' +
      '<div class="stat-export-menu hidden" id="ppExportMenu">' +
        '<button data-ppx="csv">Export CSV (filtered)</button>' +
        '<button data-ppx="excel">Export Excel (filtered)</button>' +
        '<button data-ppx="pdf">Export PDF (filtered)</button>' +
        '<button data-ppx="print">Print (filtered)</button>' +
        '<button data-ppx="all">Download Complete History (CSV)</button>' +
      "</div></div>" +
      '<span class="ip-count-note" id="ppCount"></span></div>';
  }
  var toolbarDocBound = false;
  function bindToolbar() {
    ["ppSearch", "ppFType", "ppFCat", "ppFItem", "ppFCond", "ppFFrom", "ppFTo"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.dataset.ppBound) return;
      el.dataset.ppBound = "1";
      if (id === "ppSearch") {
        el.addEventListener("input", function () {
          clearTimeout(state.searchTimer);
          state.searchTimer = setTimeout(function () {
            state.q = ($("#ppSearch").value || "").toLowerCase();
            state.page = 0; applyFilters();
          }, 250);
        });
      } else {
        el.addEventListener(el.tagName === "SELECT" || el.type === "date" ? "change" : "input", function () {
          state.fType = $("#ppFType").value; state.fCat = $("#ppFCat").value; state.fItem = $("#ppFItem").value;
          state.fCond = $("#ppFCond").value; state.fFrom = $("#ppFFrom").value; state.fTo = $("#ppFTo").value;
          state.page = 0; applyFilters();
        });
      }
    });
    var clr = document.getElementById("ppClearFilters");
    if (clr && !clr.dataset.ppBound) { clr.dataset.ppBound = "1"; clr.addEventListener("click", clearFilters); }
    if (!toolbarDocBound) {
      toolbarDocBound = true;
      document.addEventListener("click", function (e) {
        if (!e.target || !e.target.closest) return;
        if (!e.target.closest("#ppExportMenu") && !e.target.closest("#ppExportBtn")) {
          var m = document.getElementById("ppExportMenu");
          if (m) m.classList.add("hidden");
        }
      });
    }
    var eb = document.getElementById("ppExportBtn");
    if (eb && !eb.dataset.ppBound) { eb.dataset.ppBound = "1"; eb.addEventListener("click", function (e) { e.stopPropagation(); $("#ppExportMenu").classList.toggle("hidden"); }); }
    var menu = document.getElementById("ppExportMenu");
    if (menu && !menu.dataset.ppBound) {
      menu.dataset.ppBound = "1";
      menu.addEventListener("click", function (e) {
        var b = e.target.closest("[data-ppx]");
        if (!b) return;
        $("#ppExportMenu").classList.add("hidden");
        doExport(b.dataset.ppx);
      });
    }
  }
  function clearFilters() {
    state.q = ""; state.fType = ""; state.fCat = ""; state.fItem = ""; state.fCond = ""; state.fFrom = ""; state.fTo = "";
    state.page = 0; state.sortKey = "ts"; state.sortDir = -1;
    ["ppSearch", "ppFFrom", "ppFTo"].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ""; });
    ["ppFType", "ppFCat", "ppFItem", "ppFCond"].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ""; });
    applyFilters();
  }

  /* ---------- filter / sort / page ---------- */
  function applyFilters() {
    var t = state.txs;
    if (state.fType) t = t.filter(function (x) { return x.type === state.fType; });
    if (state.fCat) t = t.filter(function (x) { return x.categoryId === state.fCat; });
    if (state.fItem) t = t.filter(function (x) { return x.itemName === state.fItem; });
    if (state.fCond) t = t.filter(function (x) { return (x.cond || "").toLowerCase() === state.fCond.toLowerCase(); });
    if (state.fFrom) { var f = new Date(state.fFrom + "T00:00:00").getTime(); t = t.filter(function (x) { return x.ts >= f; }); }
    if (state.fTo) { var to = new Date(state.fTo + "T00:00:00").getTime() + 86400000; t = t.filter(function (x) { return x.ts < to; }); }
    if (state.q) {
      var q = state.q;
      t = t.filter(function (x) {
        return [x.itemName, x.categoryName, x.type, x.ref, x.subRef, x.remark, x.cond, x.issuedBy, x.processedBy,
          String(x.qty), itemCode({ id: x.itemId }), state.person.name, state.person.beltNo].join(" ").toLowerCase().indexOf(q) !== -1;
      });
    }
    var dir = state.sortDir, k = state.sortKey;
    t = t.slice().sort(function (a, b) {
      var va = a[k], vb = b[k];
      if (typeof va === "string" || typeof vb === "string") return String(va || "").localeCompare(String(vb || "")) * dir;
      return ((va || 0) - (vb || 0)) * dir;
    });
    state.view = t;
    renderTable(); renderAudit(); renderHoldings(); renderGallery();
  }
  function sortBy(key) {
    if (state.sortKey === key) state.sortDir = -state.sortDir;
    else { state.sortKey = key; state.sortDir = key === "ts" ? -1 : 1; }
    applyFilters();
  }
  function typeBadge(t) {
    var cls = t === "Issue" ? "ip-tb-out" : t === "Return" ? "ip-tb-added" : t === "Partial Return" ? "ip-tb-warn" :
      t === "Lost" ? "ip-tb-out" : t === "Recovered" ? "ip-tb-added" : "ip-tb-info";
    var qcls = t === "Issue" || t === "Lost" ? "ip-qty-neg" : (t === "Return" || t === "Partial Return" || t === "Recovered") ? "ip-qty-pos" : "ip-qty-zero";
    return { cls: cls, qcls: qcls };
  }
  function renderTable() {
    var body = $("#ppTxBody");
    if (!body) return;
    document.querySelectorAll("#view-personprofile .sort-arrow").forEach(function (s) {
      s.textContent = s.dataset.ar === state.sortKey ? (state.sortDir > 0 ? "\u25B2" : "\u25BC") : "";
    });
    var rows = state.view;
    var pages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    if (state.page >= pages) state.page = pages - 1;
    var start = state.page * state.pageSize;
    var page = rows.slice(start, start + state.pageSize);
    var note = $("#ppCount");
    if (note) note.textContent = rows.length + " transaction" + (rows.length === 1 ? "" : "s");
    var filtered = state.q || state.fType || state.fCat || state.fItem || state.fCond || state.fFrom || state.fTo;
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="10"><div class="ip-empty"><div class="big">&#128203;</div>' +
        (filtered ? "No transactions match your search/filter." :
          "No transactions found for this person yet.<br>Issue, return, partial return and loss records will appear here automatically.") + "</div></td></tr>";
    } else {
      body.innerHTML = page.map(function (t) {
        var idx = state.txs.indexOf(t);
        var b = typeBadge(t.type);
        return '<tr data-tx="' + idx + '">' +
          '<td style="white-space:nowrap">' + fmtD(t.ts) + "<br><span style=\"color:var(--muted)\">" + fmtT(t.ts) + "</span></td>" +
          '<td class="item-name">' + (window.__ipLink ? __ipLink({ id: t.itemId, name: t.itemName }) : esc(t.itemName)) +
            (t.categoryName ? '<span style="display:block;color:var(--muted);font-size:.72rem">' + esc(t.categoryName) + "</span>" : "") + "</td>" +
          '<td><span class="ip-typebadge ' + b.cls + '">' + esc(t.type) + "</span></td>" +
          '<td class="' + b.qcls + '">' + fmtN(t.qty) + "</td>" +
          "<td>" + esc(t.ref) + '<span style="display:block;color:var(--muted);font-size:.7rem">' + esc(t.subRef || "") + "</span></td>" +
          "<td>" + esc(t.issuedBy || "\u2014") + "</td><td>" + esc(t.processedBy || "\u2014") + "</td>" +
          "<td>" + esc(t.cond || "\u2014") + "</td>" +
          '<td style="max-width:200px">' + esc(t.remark || "\u2014") + "</td>" +
          '<td><button type="button" class="btn btn-outline" data-txview="' + idx + '">View</button></td></tr>';
      }).join("");
    }
    var p = $("#ppPager");
    if (p) p.innerHTML = rows.length
      ? '<button type="button" class="btn btn-outline" data-ppg="prev" ' + (state.page === 0 ? "disabled" : "") + '>&larr; Prev</button>' +
        '<span>Showing ' + (start + 1) + "\u2013" + Math.min(start + state.pageSize, rows.length) + " of " + rows.length + " \u00b7 Page " + (state.page + 1) + "/" + pages + "</span>" +
        '<button type="button" class="btn btn-outline" data-ppg="next" ' + (state.page >= pages - 1 ? "disabled" : "") + ">Next &rarr;</button>" +
        '<select id="ppPageSize2"><option' + (state.pageSize === 25 ? " selected" : "") + ">25</option><option" + (state.pageSize === 50 ? " selected" : "") + ">50</option><option" + (state.pageSize === 100 ? " selected" : "") + ">100</option></select>"
      : "";
    var ps2 = document.getElementById("ppPageSize2");
    if (ps2) ps2.addEventListener("change", function () { state.pageSize = Number(ps2.value) || 25; state.page = 0; renderTable(); });
  }
  function renderAudit() {
    var box = $("#ppAudit");
    if (!box) return;
    var p = state.person;
    var rows = state.view;
    if (!rows.length) { box.innerHTML = '<div class="ip-empty">No audit entries to show.</div>'; return; }
    var html = '<div class="ip-timeline">';
    var lastDay = "";
    rows.forEach(function (t) {
      var d = new Date(t.ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      if (d !== lastDay) { html += '<div class="ip-tl-date">' + d + "</div>"; lastDay = d; }
      var b = typeBadge(t.type);
      html += '<div class="ip-tl-item ' + (t.type === "Lost" ? "ip-neg" : (t.type === "Return" || t.type === "Partial Return" || t.type === "Recovered") ? "ip-pos" : "") + '">' +
        '<span class="t">' + fmtT(t.ts) + "</span><b>" + esc(t.type) + "</b> " +
        '<span style="color:var(--muted)">' + esc(t.itemName) + " \u00b7 Qty " + fmtN(t.qty) + " \u00b7 Held " + fmtN(t.outBefore) + " &rarr; " + fmtN(t.outAfter) + "</span>" +
        '<span class="sub">Person: ' + esc(p.name) + " (" + esc(p.beltNo || "\u2014") + ") \u00b7 Item ID: " + esc(t.itemId) +
        " \u00b7 Ref: " + esc(t.ref) + " \u00b7 Issued by: " + esc(t.issuedBy || "\u2014") + " \u00b7 Processed by: " + esc(t.processedBy || "\u2014") +
        (t.remark ? " \u00b7 " + esc(t.remark) : "") + " \u00b7 Related issue: " + esc(t.allotId) + "</span></div>";
    });
    box.innerHTML = html + "</div>";
  }
  function renderHoldings() {
    var box = $("#ppHoldings");
    if (!box) return;
    var active = state.allots.filter(function (a) { return out(a) > 0 && a.status !== "CANCELLED"; });
    if (!active.length) { box.innerHTML = '<div class="ip-empty">Nothing currently held \u2014 all issued quantities have been returned, lost or cancelled.</div>'; return; }
    box.innerHTML = '<div class="ip-table-wrap"><table class="ip-tx-table" data-sortable="false"><thead><tr><th>Item</th><th>Category</th><th>Issued</th><th>Held</th><th>Lost</th><th>Issued On</th><th>Status</th></tr></thead><tbody>' +
      active.map(function (a) {
        return "<tr><td>" + (window.__ipLink ? __ipLink({ id: a.itemId, name: a.itemName }) : esc(a.itemName)) + "</td>" +
          '<td><span class="cat-badge">' + esc(a.categoryName || catName(a.categoryId)) + "</span></td>" +
          '<td class="qty-strong">' + fmtN(a.qtyAllotted || 0) + '</td><td class="qty-strong">' + fmtN(out(a)) + "</td>" +
          '<td style="color:var(--red)">' + fmtN(Math.max(0, (a.qtyLost || 0) - (a.qtyRecovered || 0))) + "</td><td>" + fmtD(a.createdAt) + "</td>" +
          "<td>" + (window.allocStatusBadge ? allocStatusBadge(allocStatusOf(a)) : esc(a.status || "")) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  function renderGallery() {
    var box = $("#ppGallery");
    if (!box) return;
    var list = loadPhotos(state.personId);
    var manage = canManagePersonPhotos(state.person, state.allots);
    if (!list.length) {
      box.innerHTML = '<div class="ip-empty"><div class="big">&#128247;</div>No photos uploaded.<br>' +
        (manage ? '<div style="margin-top:8px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
          '<button type="button" class="btn btn-primary" id="ppGalUpload">Upload Photo</button>' +
          '<button type="button" class="btn btn-outline" id="ppGalCamera">&#128247; Camera</button></div>' : "") + "</div>";
      return;
    }
    box.innerHTML = (manage ? '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">' +
        '<button type="button" class="btn btn-primary" id="ppGalUpload">Upload Photo</button>' +
        '<button type="button" class="btn btn-outline" id="ppGalCamera">&#128247; Camera</button></div>' : "") +
      '<div class="ip-gallery">' + list.slice().reverse().map(function (p) {
      return '<div class="ip-gal-item">' + (p.isProfile ? '<span class="ip-gal-badge">Profile</span>' : "") +
        '<img src="' + p.data + '" data-gal-view alt="photo">' +
        '<div class="ip-gal-meta"><b>' + esc(p.name || "photo") + "</b>" + fmtDT(p.uploadedAt) + "<br>by " + esc(p.uploadedBy || "\u2014") + "</div>" +
        (manage ? '<div class="ip-gal-actions">' +
          (p.isProfile ? "" : '<button type="button" class="btn btn-outline" data-gal-act="profile" data-gal-id="' + p.id + '">Set Profile</button>') +
          '<button type="button" class="btn btn-outline act-dd-del" data-gal-act="del" data-gal-id="' + p.id + '">Delete</button></div>' : "") +
        "</div>";
    }).join("") + "</div>";
  }
  function handleGalleryAction(act, photoId) {
    var map = photosMap(), list = map[state.personId] || [];
    if (act === "profile") {
      list.forEach(function (p) { p.isProfile = p.id === photoId; });
      saveData("personPhotos", map);
      toast("Profile photo updated.", "success"); renderAll(); return;
    }
    if (act === "del") {
      if (!confirm("Delete this photo? This cannot be undone.")) return;
      map[state.personId] = list.filter(function (p) { return p.id !== photoId; });
      saveData("personPhotos", map);
      try { __audit("Person Photo Deleted", photoId + " for " + state.person.name, { entity: "Person" }); } catch (e) {}
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

  /* ---------- transaction details dialog ---------- */
  function openTxDetails(idx) {
    var t = state.txs[idx];
    if (!t) return;
    var p = state.person;
    var item = (window.getItems ? getItems() : []).find(function (i) { return i.id === t.itemId; });
    function row(k, v) { return v ? '<div class="ip-info-row"><span class="k">' + k + '</span><span class="v">' + esc(String(v)) + "</span></div>" : ""; }
    var modal = document.createElement("div");
    modal.className = "ip-modal"; modal.id = "ppTxModal";
    modal.innerHTML = '<div class="ip-modal-box"><h3>' + esc(t.type) + " \u2014 Transaction Details</h3>" +
      '<div class="ip-sub">' + esc(p.name) + " \u00b7 " + fmtDT(t.ts) + "</div>" +
      row("Transaction ID", t.subRef || ("TX-" + t.ts)) +
      row("Transaction Type", t.type) + row("Date", fmtD(t.ts)) + row("Time", fmtT(t.ts)) +
      row("Person", p.name + (p.beltNo ? " (BELT: " + p.beltNo + ")" : "") + " \u00b7 ID " + p.id) +
      row("Item", t.itemName + (item ? " (" + itemCode(item) + ")" : "")) +
      row("Item ID", t.itemId) + row("Category", t.categoryName || catName(t.categoryId)) +
      row("Batch ID", item && item.batchId ? item.batchId : "") +
      row("Quantity", t.qty + " " + (item && item.unit ? item.unit : "units")) +
      row("Previous Held (this issue)", t.outBefore) + row("New Held (this issue)", t.outAfter) +
      row("Issued By", t.issuedBy) + row("Processed / Received By", t.processedBy) +
      row("Condition", t.cond) + row("Reference Number", t.ref) +
      row("Related Issue Transaction ID", t.allotId) + row("Related Issue (issueId)", t.issueId) +
      row("Reason / Remark", t.remark) + (t.partial ? row("Note", "Partial return \u2014 part of the issued quantity was returned; the rest remains held.") : "") +
      '<div style="margin-top:14px;text-align:right"><button type="button" class="btn btn-primary" id="ppTxClose">Back to Person Details</button></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", function (e) { if (e.target === modal || e.target.id === "ppTxClose") modal.remove(); });
  }

  /* ---------- person master edit (admin only) ---------- */
  function openEditPersonModal() {
    var p = state.person;
    if (!p || p.__pseudo || !isAdminLike()) return;
    var modal = document.createElement("div");
    modal.className = "ip-modal"; modal.id = "ppEditModal";
    modal.innerHTML = '<div class="ip-modal-box"><h3>Edit Person Details</h3>' +
      '<div class="ip-info-grid" style="max-width:none">' +
      '<div class="ip-info-row"><span class="k">Name</span><span class="v"><input type="text" id="ppEditName" maxlength="80" value="' + esc(p.name || "") + '" style="max-width:200px"></span></div>' +
      '<div class="ip-info-row"><span class="k">Mobile No.</span><span class="v"><input type="tel" id="ppEditMobile" maxlength="15" value="' + esc(p.mobile || "") + '" style="max-width:200px"></span></div>' +
      '<div class="ip-info-row"><span class="k">Designation</span><span class="v"><input type="text" id="ppEditDesig" maxlength="60" value="' + esc(p.designation || "") + '" style="max-width:200px"></span></div>' +
      '<div class="ip-info-row"><span class="k">Posting</span><span class="v"><input type="text" id="ppEditPosting" maxlength="80" value="' + esc(p.posting || "") + '" style="max-width:200px"></span></div>' +
      '<div class="ip-info-row"><span class="k">BELT Number</span><span class="v"><input type="text" id="ppEditBelt" maxlength="30" value="' + esc(p.beltNo || "") + '" style="max-width:200px"></span></div>' +
      "</div>" +
      '<div style="margin-top:14px;text-align:right;display:flex;gap:8px;justify-content:flex-end">' +
      '<button type="button" class="btn btn-outline" id="ppEditCancel">Cancel</button>' +
      '<button type="button" class="btn btn-primary" id="ppEditSave">Save</button></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", function (e) {
      if (e.target === modal || e.target.id === "ppEditCancel") { modal.remove(); return; }
      if (e.target.id !== "ppEditSave") return;
      var name = ($("#ppEditName").value || "").trim();
      var mobile = ($("#ppEditMobile").value || "").trim();
      var desig = ($("#ppEditDesig").value || "").trim();
      var posting = ($("#ppEditPosting").value || "").trim();
      var belt = ($("#ppEditBelt").value || "").trim().toUpperCase();
      if (!name) return toast("Person name is required.", "error");
      if (!belt) return toast("BELT number is required.", "error");
      if (mobile && !/^[0-9+()\-\s]{6,15}$/.test(mobile)) return toast("Enter a valid mobile number (6-15 digits).", "error");
      var persons = getPersonsSafe();
      var rec = persons.find(function (x) { return x.id === p.id; });
      if (!rec) { toast("Person master record not found.", "error"); return; }
      var oldBeltU = (p.beltNo || "").toUpperCase();
      var beltChanged = belt !== oldBeltU;
      if (beltChanged && persons.some(function (x) { return x.id !== p.id && (x.beltNo || "").toUpperCase() === belt; })) return toast("BELT number already exists for another person.", "error");
      var nameChanged = name !== p.name;
      if (name) rec.name = name;
      if (beltChanged) rec.beltNo = belt;
      if (mobile) rec.mobile = mobile; else delete rec.mobile;
      if (desig) rec.designation = desig; else delete rec.designation;
      if (posting) rec.posting = posting; else delete rec.posting;
      rec.updatedAt = Date.now(); rec.updatedBy = user() ? (user().name || user().username) : "";
      savePersons(persons);
      /* Name / BELT edits propagate to issued-item records so the Issued Items
         table shows the updated identity automatically (2026.09.190). */
      var u = user();
      if (u && u.role === "admin" && (nameChanged || beltChanged)) {
        var allots = getAllotments();
        var touched = false;
        allots.forEach(function (a) {
          var mine = (a.personId && a.personId === p.id) || (!a.personId && (a.beltNo || "").toUpperCase() === oldBeltU);
          if (!mine) return;
          if (nameChanged && a.name !== name) { a.name = name; touched = true; }
          if (beltChanged && a.beltNo !== belt) { a.beltNo = belt; touched = true; }
        });
        if (touched) saveAllotments(allots);
      }
      try { __audit("Person Details Updated", name + " (BELT: " + belt + ")" + (nameChanged || beltChanged ? " \u2014 synced to issued records" : ""), { entity: "Person" }); } catch (e2) {}
      modal.remove();
      state.person = rec;
      toast("Person details saved.", "success");
      renderAll();
    });
  }

  /* ---------- exports ---------- */
  function exportRows(rows) {
    var p = state.person;
    return rows.map(function (t, i) {
      return [i + 1, p.name, p.beltNo || "", t.itemName, t.categoryName || catName(t.categoryId), t.type, t.qty,
        t.ref, t.subRef, fmtD(t.ts), fmtT(t.ts), t.issuedBy, t.processedBy, t.cond, t.remark, t.allotId];
    });
  }
  function exportData(rows, suffix) {
    var p = state.person;
    return {
      title: "Person Item History \u2014 " + p.name + (p.beltNo ? " (BELT: " + p.beltNo + ")" : ""),
      subtitle: "Person ID " + p.id + " \u00b7 Generated " + new Date().toLocaleString() + " (" + rows.length + " transactions)",
      cols: ["S. No.", "Person Name", "Belt No.", "Item Name", "Category", "Transaction Type", "Quantity", "Reference", "Transaction ID", "Date", "Time", "Issued By", "Received / Processed By", "Condition", "Remark", "Related Issue ID"],
      rows: exportRows(rows), fileName: "person-history-" + String(p.beltNo || p.id).toLowerCase().replace(/[^a-z0-9]+/g, "-") + suffix
    };
  }
  function csvStr(rows) {
    var head = ["S. No.", "Person Name", "Belt No.", "Item Name", "Category", "Transaction Type", "Quantity", "Reference", "Transaction ID", "Date", "Time", "Issued By", "Received / Processed By", "Condition", "Remark", "Related Issue ID"];
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

  /* ---------- global click delegation ---------- */
  document.addEventListener("click", function (e) {
    if (!e.target || !e.target.closest) return;
    var view = e.target.closest("[data-txview]");
    if (view) { e.preventDefault(); e.stopPropagation(); openTxDetails(Number(view.dataset.txview)); return; }
    var a = e.target.closest(".pp-person-link");
    if (a) {
      e.preventDefault(); e.stopPropagation();
      var ref = { id: a.dataset.ppId || "", belt: a.dataset.ppBelt || "" };
      var r = window.resolvePersonForProfile(ref);
      if (!r) { toast("No records found for this person.", "error"); return; }
      window.openPersonProfile(r.person.id, { belt: r.person.beltNo });
    }
  }, true);

  /* ---------- routing ---------- */
  function hashChange() {
    var m = location.hash.match(/^#persons\/(.+)$/);
    if (m && m[1] && decodeURIComponent(m[1]) !== state.personId && user() && document.getElementById("appRoot") && !document.getElementById("appRoot").classList.contains("hidden")) {
      window.openPersonProfile(decodeURIComponent(m[1]));
    }
  }
  window.addEventListener("hashchange", hashChange);
  var pollCount = 0;
  var poller = setInterval(function () {
    pollCount++;
    var m = location.hash.match(/^#persons\/(.+)$/);
    if (m && m[1] && decodeURIComponent(m[1]) !== state.personId && user() && document.getElementById("appRoot") && !document.getElementById("appRoot").classList.contains("hidden")) {
      window.openPersonProfile(decodeURIComponent(m[1]));
    }
    if (pollCount > 240) clearInterval(poller);
  }, 500);
  var _origSwitchTab = window.switchTab;
  if (typeof _origSwitchTab === "function") {
    window.switchTab = function (name) {
      if (name !== "personprofile") {
        if (location.hash.indexOf("#persons/") === 0) history.replaceState(null, "", location.pathname + location.search);
      }
      return _origSwitchTab.apply(this, arguments);
    };
  }
})();
