(function () {
  if (window.__manageNavDone) return;
  window.__manageNavDone = true;
  function boot() {
    var q = function (s) { return document.querySelector(s); };
    var bar = q("#topbar, #navBar, nav, header .navbar");
    if (!bar) { setTimeout(boot, 400); return; }
    var ids = ["manageDistrictsBtn", "manageUsersBtn", "manageLocsBtn"];
    var origs = ids.map(function (id) { return document.getElementById(id); });
    if (!origs[0]) { setTimeout(boot, 400); return; }
    origs.forEach(function (b) { if (b) b.style.display = "none"; });

    var role = null;
    try {
      var u = window.currentUser || (window.STATE && window.STATE.currentUser);
      role = u ? u.role : null;
    } catch (e) {}
    var isDev = role === "devadmin" || role === "admin";
    var isAdmin = isDev || !!role; 

    var mk = function (txt, origIdx) {
      var it = document.createElement("button");
      it.type = "button";
      it.className = "dropdown-item";
      it.textContent = txt;
      it.addEventListener("click", function () {
        menu.classList.add("hidden");
        var b = origs[origIdx];
        if (b) b.click();
      });
      return it;
    };

    var wr = document.createElement("div");
    wr.className = "btn-group";
    wr.style.margin = "0 4px";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm btn-gold";
    btn.id = "manageNavBtn";
    btn.innerHTML = "Manage &#9662;";
    var menu = document.createElement("div");
    menu.className = "dropdown-menu hidden";
    menu.id = "manageNavMenu";
    menu.style.right = "0";
    menu.style.minWidth = "160px";

    var devOnly = origs[0].getAttribute("data-dev-only") !== null;
    var adminOnly = origs.slice(1).filter(function (b) { return b && b.getAttribute("data-admin-only") !== null; });
    menu.appendChild(mk("Districts", 0));
    menu.appendChild(mk("Users", 1));
    menu.appendChild(mk("Locations", 2));

    var anchor = document.getElementById("logoutBtn") || bar.lastElementChild;
    wr.appendChild(btn);
    wr.appendChild(menu);
    bar.insertBefore(wr, anchor);

    var opened = false;
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      opened = !opened;
      menu.classList.toggle("hidden", !opened);
    });
    document.addEventListener("click", function (e) {
      if (opened && !e.target.closest("#manageNavMenu, #manageNavBtn")) {
        menu.classList.add("hidden");
        opened = false;
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
