/* ============================================================
   mobile.js — mobile drawer + page title + responsive tables
   Additive UI only: no business logic, no data/permission changes.
   Reuses the app's EXISTING #sidebarToggle; desktop collapse is
   preserved untouched (we only intercept on narrow viewports).
   ============================================================ */
(function () {
  "use strict";
  if (window.__mobileInit2) return;
  window.__mobileInit2 = true;

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    var app = document.getElementById("appRoot");
    if (!app) { setTimeout(function () { ready(run); }, 400); return; }
    run();

    function run() {
      var app2 = document.getElementById("appRoot");
      if (!app2) return;

      /* ---------- 1. Scrim + page title (no extra top bar) ---------- */
      if (!document.getElementById("mScrim")) {
        var scrim = document.createElement("div");
        scrim.className = "m-scrim";
        scrim.id = "mScrim";
        scrim.setAttribute("aria-hidden", "true");
        document.body.appendChild(scrim);
        scrim.addEventListener("click", closeNav);
      }

      var left = document.querySelector("#topbar .topbar-left");
      if (left && !document.getElementById("mPageTitle")) {
        var t = document.createElement("div");
        t.className = "m-page-title";
        t.id = "mPageTitle";
        t.setAttribute("aria-live", "polite");
        left.appendChild(t);
      }

      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeNav();
      });

      /* ---------- 2. Drive the EXISTING sidebar toggle ---------- */
      var toggle = document.getElementById("sidebarToggle");
      if (toggle) {
        // Capture phase: intercept only on mobile so the app's own
        // desktop sidebar-collapsed behaviour is preserved.
        toggle.addEventListener("click", function (e) {
          if (!isNarrow()) return;      // desktop: let the app handle it
          e.stopPropagation();
          e.preventDefault();
          if (document.body.classList.contains("m-nav-open")) closeNav();
          else openNav();
        }, true);

        toggle.setAttribute("aria-controls", "sidebar");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation menu");
      }

      /* ---------- 3. Drawer open/close ---------- */
      function openNav() {
        document.body.classList.add("m-nav-open");
        var t = document.getElementById("sidebarToggle");
        if (t) {
          t.setAttribute("aria-expanded", "true");
          t.setAttribute("aria-label", "Close navigation menu");
        }
      }

      function closeNav() {
        if (!document.body.classList.contains("m-nav-open")) return;
        document.body.classList.remove("m-nav-open");
        var t = document.getElementById("sidebarToggle");
        if (t) {
          t.setAttribute("aria-expanded", "false");
          t.setAttribute("aria-label", "Open navigation menu");
        }
      }

      /* ---------- 4. Close drawer after choosing a destination ---------- */
      document.addEventListener("click", function (e) {
        if (!document.body.classList.contains("m-nav-open")) return;
        var sb = document.getElementById("sidebar");
        if (sb && sb.contains(e.target)) {
          var hit = e.target.closest("a,button,[data-tab],[data-page],[data-dist-tab]");
          if (hit) setTimeout(closeNav, 80);
        }
      });

      var mq = window.matchMedia("(min-width: 1025px)");
      var onChange = function () { if (mq.matches) closeNav(); };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);

      /* ---------- 5. Page name in the top bar ---------- */
      var TITLE_MAP = {
        dashboard: "Dashboard", inventory: "Inventory", stock: "Stock",
        items: "Items", categories: "Categories", demands: "Demands",
        transactions: "Transactions", requests: "Access Requests",
        reports: "Reports", notifications: "Notifications",
        settings: "Settings", profile: "Profile", agent: "IMS Agent",
        "account-management": "Account Management"
      };

      function syncTitle() {
        var box = document.getElementById("mPageTitle");
        if (!box) return;
        var active = document.querySelector(
          "#sidebar .active, #sidebar [aria-current='page'], #sidebar .nav-item.active"
        );
        if (!active) { if (!box.textContent) box.textContent = "Haryana Police IMS"; return; }
        var key = active.getAttribute("data-tab") || active.getAttribute("data-page") || "";
        var label = TITLE_MAP[key];
        if (!label) {
          var raw = (active.getAttribute("data-title") || active.textContent || "").replace(/\s+/g, " ").trim();
          label = raw && raw.length <= 40 ? raw : "";
        }
        if (!label) label = "Haryana Police IMS";
        if (box.textContent !== label) box.textContent = label;
      }

      /* ---------- 6. Tables: label cells for the card layout ---------- */
      function enhanceTables() {
        var tables = document.querySelectorAll(".table-wrap table");
        Array.prototype.forEach.call(tables, function (tbl) {
          var head = tbl.querySelector("thead tr");
          if (!head) return;
          var labels = Array.prototype.map.call(head.children, function (th) {
            return (th.textContent || "").replace(/\s+/g, " ").trim();
          });
          if (tbl.dataset.mEnhanced !== "1") {
            tbl.dataset.mEnhanced = "1";
            tbl.classList.add("stacked");
          }
          Array.prototype.forEach.call(tbl.querySelectorAll("tbody tr"), function (tr) {
            Array.prototype.forEach.call(tr.children, function (td, i) {
              if (!td.getAttribute("data-th") && labels[i]) td.setAttribute("data-th", labels[i]);
            });
          });
        });
      }

      var pending = false;
      function refresh() {
        enhanceTables();
        syncTitle();
        syncStickyTop();
      }
      function schedule() {
        if (pending) return;
        pending = true;
        window.requestAnimationFrame(function () { pending = false; refresh(); });
      }

      /* ---------- 7. Keep --sticky-top equal to the REAL topbar height ----------
         The app sticks table headers with top: var(--sticky-top) (58px default).
         The responsive topbar can be one OR two rows tall, so a fixed value let
         headers sit inside the bar and overlap rows. Measure it for real. */
      function syncStickyTop() {
        var bar = document.getElementById("topbar");
        if (!bar) return;
        var h = Math.round(bar.getBoundingClientRect().height);
        if (!h || h < 1) return;
        var cur = document.documentElement.style.getPropertyValue("--sticky-top");
        if (cur !== h + "px") {
          document.documentElement.style.setProperty("--sticky-top", h + "px");
        }
        // Keep the app's own >=1025px sticky rule honest: it is written as
        // `top: var(--sticky-top)` and would otherwise reuse a value measured
        // while the bar was two rows tall, pushing the header over row 1.
      }
      var stickyPending = false;
      function scheduleSticky() {
        if (stickyPending) return;
        stickyPending = true;
        window.requestAnimationFrame(function () { stickyPending = false; syncStickyTop(); });
      }

      refresh();
      syncStickyTop();
      // The topbar can re-flow after fonts/data land, so keep re-measuring
      if (window.MutationObserver) {
        new MutationObserver(scheduleSticky).observe(document.body, {
          childList: true, subtree: true, attributes: true,
          attributeFilter: ["class", "style"]
        });
      }
      if (window.MutationObserver) {
        new MutationObserver(schedule).observe(app2, { childList: true, subtree: true });
      }
      if (window.ResizeObserver) {
        try {
          var ro = new ResizeObserver(scheduleSticky);
          var barEl = document.getElementById("topbar");
          if (barEl) ro.observe(barEl);
        } catch (e) { /* older browser */ }
      }
      window.addEventListener("hashchange", schedule);
      window.addEventListener("resize", schedule);
      window.addEventListener("orientationchange", scheduleSticky);
      window.addEventListener("load", scheduleSticky);
      setTimeout(scheduleSticky, 400);
      setTimeout(scheduleSticky, 1200);
    }
  });

  function isNarrow() {
    /* The drawer range only: 769px - 1024px.
       At 1024px and below this used to mean "the sidebar is a drawer", but the
       bottom bar now owns everything under 768px and has no drawer to open and
       no toggle to press. app.js asks the same question with the same query,
       so the two can never both act on a single click. */
    return window.matchMedia("(min-width: 769px) and (max-width: 1024px)").matches;
  }
})();



