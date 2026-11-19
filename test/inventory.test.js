const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function harness({ detached = false } = {}) {
  const fields = {};
  const state = {
    item: { id: "i", name: "Test", districtId: "d", quantity: 20, allotted: 5,
      conditionCounts: { good: 17, poor: 2, damaged: 1 } },
    issues: [{ id: "a", itemId: "i", districtId: "d", qtyAllotted: 5, qtyReturned: 0,
      condition: "good", name: "Person", returns: [] }],
    saves: 0,
    messages: []
  };
  const field = id => fields[id] ||= { value: "", classList: { add() {}, remove() {}, toggle() {} } };
  const context = {
    $: field, getItems: () => [state.item], getItemsForDistrict: () => [state.item],
    getAllotments: () => detached ? structuredClone(state.issues) : state.issues,
    getVisibleAllotments: () => state.issues,
    getCategories: () => [], getLocations: () => [], getDistricts: () => [],
    __allocStockFiltered: () => [state.item], __invStockLoc: "own", activeDistrictId: "d",
    canEdit: () => true, canEditItem: () => true, itemOwnedByCurrentUser: () => true,
    isDevAdmin: () => true, isAdmin: () => false, confirm: () => true,
    toast: message => state.messages.push(message), __allocFieldErr: (_, message) => state.messages.push(message),
    persistAlloc: (items, issues) => { state.saves++; state.item = items[0]; state.issues = issues; },
    saveItems: () => state.saves++, closeModals() {}, render() {}, __audit() {}, esc: String,
    currentUser: { name: "Tester" }, uid: () => String(Math.random()), window: {}, structuredClone,
    __adjustBusy: false
  };
  vm.createContext(context);
  const names = ["allocTotals", "stockConditionCounts", "scrapQty", "availableQty", "allocStatusOfItem",
    "allocLost", "allocRecovered", "legacyReturnedLoss", "allocRecoverable", "allocOutstanding", "allocRemaining",
    "allocStatusOf", "historyTotalDelta", "itemHistoryPush", "__histWithBalances", "saveInvLoss", "saveReturn",
    "deleteIssuedItem", "cancelAllotment", "submitLoss", "submitRecovery", "saveAdjust", "commitAdjustment",
    "__allocStockExportData", "renderAdjustmentStockSummary", "commitAddStock"];
  for (const name of names) {
    const match = new RegExp(`^(?:async )?function ${name}\\(`, "m").exec(source);
    assert.ok(match, `Missing function ${name}`);
    const tail = source.slice(match.index + 1);
    const next = /\n(?:async )?function /.exec(tail);
    vm.runInContext(source.slice(match.index, next ? match.index + 1 + next.index : undefined), context);
  }
  vm.runInContext('todayStr = () => "2026-11-19"; nowTimeStr = () => "23:59"; __returnAllotId = "a"; __invLossItemId = "i"; __allocLossId = "a"; __allocRecoveryId = "a";', context);
  const values = { ajItem: "i", ajType: "correction", ajQty: "2", ajTotal: "23", ajDate: "2026-11-19",
    ajTime: "10:00", rtQty: "2", rtCondition: "good", rtDate: "2026-11-19", rtTime: "10:00",
    ilQty: "2", lsQty: "2", rcQty: "2", rcCategory: "c", rcItem: "i", rcMode: "found",
    rcDate: "2026-11-19", rcTime: "10:00" };
  for (const [id, value] of Object.entries(values)) field("#" + id).value = value;
  return { context, state, field, event: { preventDefault() {}, target: { querySelector: () => null } } };
}

test("available stock across issued, lost and scrap combinations", () => {
  const { context: c } = harness();
  for (let quantity = 0; quantity < 40; quantity++) {
    for (let issued = 0; issued <= quantity; issued++) {
      assert.equal(c.availableQty({ quantity, allotted: issued }), quantity - issued);
    }
  }
  assert.equal(c.availableQty({ quantity: 20, allotted: 4, lostReturned: 2,
    damagedReturned: 1, conditionCounts: { damaged: 3 } }), 10);
});

test("correction changes Good only and rejects excessive reduction", async () => {
  for (const [total, good] of [[23, 20], [18, 15]]) {
    const { context: c, state, field, event } = harness();
    field("#ajTotal").value = String(total);
    await c.saveAdjust(event);
    assert.equal(state.item.quantity, total);
    assert.equal(state.item.conditionCounts.good, good);
    assert.equal(state.item.conditionCounts.poor, 2);
    assert.equal(state.item.conditionCounts.damaged, 1);
  }
  const { context: c, state, field, event } = harness();
  field("#ajTotal").value = "2";
  await c.saveAdjust(event);
  assert.equal(state.saves, 0);
  assert.equal(state.item.quantity, 20);
});

test("both stock loss entry points retain matching total and conditions", async () => {
  const a = harness(), b = harness();
  a.field("#ajType").value = "loss";
  await a.context.saveAdjust(a.event);
  b.context.saveInvLoss(b.event);
  for (const h of [a, b]) {
    assert.equal(h.state.item.quantity, 20);
    assert.equal(h.state.item.conditionCounts.good, 17);
    assert.equal(h.state.item.lostReturned, 2);
    assert.equal(h.context.availableQty(h.state.item), 12);
  }
});

test("legacy missing condition quantities retain total when stock is added", () => {
  const { context: c } = harness();
  const item = { quantity: 20, lostReturned: 2, conditionCounts: { good: 18, poor: 0, damaged: 0 } };
  const counts = c.stockConditionCounts(item);
  counts.good++;
  assert.equal(counts.good + counts.poor + counts.damaged, 21);
});

test("Add Stock accepts unit letter casing and preserves the saved unit", async () => {
  for (const [savedUnit, requestedUnit, accepted] of [
    ["Pcs", "pcs", true], ["PCS", "pcs", true], ["pcs", "pcs", true],
    ["Kg", "kg", true], ["pairs", "pairs", true], ["Pcs", "kg", false]
  ]) {
    const { context: c, state, field, event } = harness();
    Object.assign(state.item, { unit: savedUnit, categoryId: "c", locationId: "loc" });
    const values = { ".as-row-cat": "c", ".as-row-item": "i", ".as-row-unit": requestedUnit,
      ".as-row-min": "0", ".as-row-qty-good": "20", ".as-row-qty-poor": "0" };
    const row = { dataset: { key: "1" }, querySelector: selector => ({ value: values[selector] || "" }) };
    Object.assign(c, {
      $$: () => [row], canManageItems: () => true, getLocations: () => [{ id: "loc" }],
      getAllDistrictItems: () => [state.item], __asPhotos: {}, __asBreakdown: () => "",
      saveItems: items => { state.item = items[0]; state.saves++; }
    });
    field("#asLocation").value = "loc";
    c.currentUser.locationId = "loc";
    await c.commitAddStock(event);
    assert.equal(state.item.unit, savedUnit);
    assert.equal(state.item.quantity, accepted ? 40 : 20, `${savedUnit} / ${requestedUnit}`);
    assert.equal(state.saves, accepted ? 1 : 0);
    if (accepted) assert.equal(state.item.conditionCounts.good, 37);
  }
});

test("Good, damaged and scrap returns update conditions and balances", () => {
  for (const condition of ["good", "poor", "damaged"]) {
    const { context: c, state, field, event } = harness();
    field("#rtCondition").value = condition;
    c.saveReturn(event);
    assert.equal(state.item.allotted, 3);
    assert.equal(c.allocOutstanding(state.issues[0]), 3);
    assert.equal(state.item.conditionCounts.good, condition === "good" ? 17 : 15);
    assert.equal(state.item.conditionCounts.poor, condition === "poor" ? 4 : 2);
    assert.equal(c.scrapQty(state.item), condition === "damaged" ? 3 : 1);
    assert.equal(c.availableQty(state.item), condition === "damaged" ? 14 : 16);
    assert.equal(state.item.quantity, 20);
  }
});

test("loss via return can be recovered and never counted twice", () => {
  const { context: c, state, field, event } = harness();
  field("#rtCondition").value = "lost";
  c.saveReturn(event);
  assert.equal(c.allocRecoverable(state.issues[0]), 2);
  assert.equal(c.allocOutstanding(state.issues[0]), 3);
  assert.equal(state.item.lostReturned, 2);
  c.submitRecovery(event);
  assert.equal(c.allocRecoverable(state.issues[0]), 0);
  assert.equal(state.item.lostReturned, 0);
  assert.equal(c.allocOutstanding(state.issues[0]), 3);
});

test("legacy lost returns remain recoverable", () => {
  const { context: c, state, event } = harness();
  Object.assign(state.issues[0], { qtyReturned: 2, returns: [{ qty: 2, condition: "lost" }] });
  Object.assign(state.item, { allotted: 3, lostReturned: 2 });
  assert.equal(c.allocRecoverable(state.issues[0]), 2);
  c.submitRecovery(event);
  assert.equal(c.allocRecoverable(state.issues[0]), 0);
  assert.equal(state.item.lostReturned, 0);
});

test("cancellation is idempotent and clears outstanding", () => {
  const { context: c, state } = harness();
  state.item.allotted = 8;
  c.cancelAllotment("a");
  assert.equal(state.item.allotted, 3);
  assert.equal(c.allocOutstanding(state.issues[0]), 0);
  c.cancelAllotment("a");
  assert.equal(state.item.allotted, 3);
  assert.equal(state.saves, 1);
});

test("loss, recovery and cancellation persist detached offline records", () => {
  const { context: c, state, field, event } = harness({ detached: true });
  field("#lsReason").value = "Lost during duty";
  c.submitLoss(event);
  assert.equal(state.issues[0].qtyLost, 2);
  assert.equal(c.allocRecoverable(state.issues[0]), 2);
  c.submitRecovery(event);
  assert.equal(state.issues[0].qtyRecovered, 2);
  assert.equal(state.item.lostReturned, 0);
  c.cancelAllotment("a");
  assert.equal(state.issues[0].status, "CANCELLED");
  assert.equal(state.item.allotted, 0);
  const saves = state.saves;
  c.cancelAllotment("a");
  assert.equal(state.saves, saves);
});

test("fractional quantities are rejected without changing stock", () => {
  for (const [method, input] of [["saveReturn", "rtQty"], ["saveInvLoss", "ilQty"],
    ["submitLoss", "lsQty"], ["submitRecovery", "rcQty"]]) {
    const { context: c, state, field, event } = harness();
    field("#lsReason").value = "Test";
    field("#" + input).value = "1.5";
    c[method](event);
    assert.equal(state.saves, 0, method);
    assert.equal(state.item.allotted, 5);
  }
});

test("deleting an issue reverses a scrap return and outstanding stock", () => {
  const { context: c, state, field, event } = harness();
  field("#rtCondition").value = "damaged";
  c.saveReturn(event);
  c.deleteIssuedItem("a");
  assert.equal(state.item.allotted, 0);
  assert.equal(state.item.conditionCounts.good, 17);
  assert.equal(state.item.conditionCounts.damaged, 1);
  assert.equal(state.issues.length, 0);
});

test("history balances represent total stock through issue, return and loss", () => {
  const { context: c } = harness();
  const item = { quantity: 20, history: [{ type: "ALLOTMENT", qty: -5 }, { type: "RETURN", qty: 2 }, { type: "LOSS", qty: 1 }] };
  for (const row of c.__histWithBalances(item)) {
    assert.equal(row.prev, 20);
    assert.equal(row.balance, 20);
  }
});

test("stock summary and export agree on damaged and scrap quantities", () => {
  const { context: c, state, field } = harness();
  state.item.damagedReturned = 2;
  state.item.scrappedQuantity = 3;
  const report = c.__allocStockExportData();
  assert.equal(report.rows[0][report.cols.indexOf("Damaged")], 2);
  assert.equal(report.rows[0][report.cols.indexOf("Scrap")], 6);
  assert.equal(report.rows.at(-1)[report.cols.indexOf("Scrap")], 6);
  c.renderAdjustmentStockSummary();
  assert.match(field("#ajStockSummary").innerHTML, /Damaged<\/span>.*?>2<\/strong>/);
  assert.match(field("#ajStockSummary").innerHTML, /Scrap<\/span>.*?>6<\/strong>/);
});

test("lost-only stock is not labelled fully issued", () => {
  const { context: c } = harness();
  assert.equal(c.allocStatusOfItem({ quantity: 2, lostReturned: 2 }).label, "Out of Stock");
  assert.equal(c.allocStatusOfItem({ quantity: 2, allotted: 2 }).label, "Fully Issued");
});

test("server rejects stock overcommitment including condition scrap", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "api", "index.js"), "utf8").replace(/\r\n/g, "\n");
  const start = server.indexOf("function validateAllocState(");
  const end = server.indexOf("\n  return null;\n}", start) + "\n  return null;\n}".length;
  const c = vm.createContext({});
  vm.runInContext(server.slice(start, end), c);
  const state = { "hp_inventory.items": { d: [{ id: "i", quantity: 10, allotted: 8,
    conditionCounts: { good: 5, poor: 0, damaged: 5 } }] } };
  assert.match(c.validateAllocState(state), /Available quantity/);
  state["hp_inventory.items"].d[0].allotted = 5;
  assert.equal(c.validateAllocState(state), null);
  assert.equal(c.validateAllocState({ "hp_inventory.allotments": [{ qtyAllotted: 5, qtyReturned: 2,
    qtyRecovered: 2, returns: [{ condition: "lost", qty: 2 }] }] }), null);
});
