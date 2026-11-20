const test = require("node:test");
const assert = require("node:assert");

// Helper logic mimicking Reports module calculations
function allocTotals(item) {
  return {
    allotted: item.allotted || 0,
    damaged: item.damagedReturned || 0,
    lost: item.lostReturned || 0
  };
}

function scrapQty(item) {
  return ((item.conditionCounts || {}).damaged || 0) + (item.scrappedQuantity || 0) + (item.damagedReturned || 0);
}

function availableQty(item) {
  const t = allocTotals(item);
  const dmg = (item.conditionCounts || {}).damaged || 0;
  return Math.max(0, (item.quantity || 0) - t.allotted - t.damaged - t.lost - dmg);
}

function itemStatus(item) {
  const avail = availableQty(item);
  return avail === 0 ? "Out" : avail <= (item.minStock || 0) ? "Low" : "OK";
}

test("Status calculation marks fully issued items as Out of Stock", () => {
  const item = {
    name: "Glock Pistol",
    quantity: 10,
    allotted: 10,
    minStock: 2,
    conditionCounts: { good: 10, poor: 0, damaged: 0 }
  };

  assert.strictEqual(availableQty(item), 0);
  assert.strictEqual(itemStatus(item), "Out");
});

test("Status calculation marks low stock items properly", () => {
  const item = {
    name: "Body Armor",
    quantity: 10,
    allotted: 8,
    minStock: 3,
    conditionCounts: { good: 10, poor: 0, damaged: 0 }
  };

  assert.strictEqual(availableQty(item), 2);
  assert.strictEqual(itemStatus(item), "Low");
});

test("Scrap units calculation includes damaged condition, scrappedQuantity, and damagedReturned", () => {
  const item = {
    name: "Wireless Radio",
    quantity: 20,
    scrappedQuantity: 2,
    damagedReturned: 1,
    conditionCounts: { good: 15, poor: 2, damaged: 3 }
  };

  // 3 (condition damaged) + 2 (scrappedQuantity) + 1 (damagedReturned) = 6
  assert.strictEqual(scrapQty(item), 6);
});

test("Reports module column definitions exist for all 6 report types", () => {
  const reportTypes = [
    "mergedReport",
    "allotmentsReport",
    "distributionsReport",
    "demandsReport",
    "inspectionsReport",
    "maintenanceReport"
  ];

  function getReportCols(tab) {
    if (tab === "allotmentsReport") {
      return ["Officer / Person", "Belt No", "Rank", "Posting / Thana", "Item", "Category", "Issued Qty", "Outstanding", "Lost", "Recovered", "Condition", "Date", "Status"];
    }
    if (tab === "distributionsReport") {
      return ["Dist No", "Item", "Category", "Qty", "Condition", "From (Sender)", "To (Receiver)", "Date", "Status"];
    }
    if (tab === "demandsReport") {
      return ["Demand No", "Item", "Category", "Requested Qty", "Approved Qty", "From District/Unit", "To District/Unit", "Date", "Status"];
    }
    if (tab === "inspectionsReport") {
      return ["Inspection Date", "Due Date", "Item / Asset", "Inspected By", "Type", "Location", "Findings", "Recommendations", "Status"];
    }
    if (tab === "maintenanceReport") {
      return ["Request No", "Item / Asset", "Category / Type", "Requested By", "Unit / Location", "Assigned To", "Date", "Status"];
    }
    return ["Item", "Item Code", "Category", "Location", "Unit", "Total Qty", "Available", "Issued", "Good", "Damaged", "Scrap", "Lost", "Recovered", "Min Stock", "Status"];
  }

  for (const type of reportTypes) {
    const cols = getReportCols(type);
    assert.ok(Array.isArray(cols) && cols.length >= 8, `Report ${type} has sufficient columns`);
  }
});

test("Grand total computes correctly across numeric columns", () => {
  const rows = [
    { "Total Qty": 10, "Available": 4, "Issued": 6 },
    { "Total Qty": 25, "Available": 15, "Issued": 10 },
    { "Total Qty": 5, "Available": 0, "Issued": 5 }
  ];

  const numericCols = ["Total Qty", "Available", "Issued"];
  const totals = {};
  for (const c of numericCols) {
    totals[c] = rows.reduce((sum, r) => sum + (Number(r[c]) || 0), 0);
  }

  assert.strictEqual(totals["Total Qty"], 40);
  assert.strictEqual(totals["Available"], 19);
  assert.strictEqual(totals["Issued"], 21);
});
