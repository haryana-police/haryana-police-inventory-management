/* ui-fix.js - Add Stock dropdowns bigger + consumable buttons match inventory page */
(function () {
  function applyFix() {
    var style = document.createElement("style");
    style.textContent =
      "#stockAddModal select, #allocModal select, #allotStockModal select, #allocStockModal select {" +
      "  font-size: 1.05rem; padding: 10px 12px; height: 46px; min-height: 46px;" +
      "  border-radius: 8px; border: 1px solid #6c757d !important; width: 100%;" +
      "  background-color: #fff; color: #212529; cursor: pointer; " +
      "  box-shadow: 0 1px 3px rgba(0,0,0,0.12);" +
      "}\n" +
      "#stockAddModal label, #allocModal label, #allotStockModal label, #allocStockModal label {" +
      "  font-size: 1rem; font-weight: 600; margin-bottom: 6px; color: #212529;" +
      "}\n" +
      "#stockAddModal .form-select, #allocModal .form-select, #allotStockModal .form-select, #allocStockModal .form-select {" +
      "  font-size: 1.05rem; height: 46px; padding: 10px 12px; border-radius: 8px;" +
      "}\n" +
      "@media (max-width: 600px) {" +
      "  #stockAddModal select, #allocModal select, #allotStockModal select, #allocStockModal select {" +
      "    height: 50px; min-height: 50px; font-size: 1.1rem;" +
      "  }" +
      "}\n";
    document.head.appendChild(style);

    var consumables = document.querySelectorAll(".consumable-row, [data-type='consumable'], .consumables-section button");
    var inventory = document.querySelector(".inventory-row, .item-row, [data-section='inventory'] button");
    var baseClass = inventory ? (inventory.className || "btn btn-outline") : "btn btn-outline";
    consumables.forEach(function (b) {
      if (b.tagName === "BUTTON") {
        b.className = baseClass + " btn-sm";
      }
    });
    window.__consumableMatchUI = true;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () {
    setTimeout(applyFix, 0);
  });
  else setTimeout(applyFix, 0);
})();
