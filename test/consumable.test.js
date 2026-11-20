const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ConsumableLedger = require("../consumable-ledger");
const { authorizeConsumableWrites, diffConsumableWrites } = require("../api/_rbac");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const item = { id: "paper", name: 'Paper "A"', categoryId: "stationery", unit: "pcs", condition: "Good" };
const admin = { id: "admin", districtId: "district", locationId: "hq", role: "admin" };
const unit = { id: "unit-user", districtId: "district", locationId: "first", role: "staff" };
const recipient = { id: "staff-user", districtId: "district", locationId: "second", role: "staff" };
const colleague = { id: "colleague", districtId: "district", locationId: "first", role: "staff" };
const users = [admin, unit, recipient, colleague];
const locations = ["hq", "first", "second"].map(id => ({ id }));
const row = (id, type, qty, extra = {}) => ({
  id: String(id), createdAt: id, type, qty, itemId: item.id, categoryId: item.categoryId, ...extra
});
const add = row(1, "ADD", 10, { byId: admin.id, stockLocation: "" });
const request = row(2, "DISTRIBUTION_REQUEST", 10, {
  byId: admin.id, stockLocation: "", toType: "unit", toId: "first", toName: "First"
});
const approval = row(3, "DISTRIBUTION_APPROVED", 10, {
  byId: unit.id, requestId: request.id, toType: request.toType, toId: request.toId
});
const rejection = row(4, "DISTRIBUTION_REJECTED", 10, {
  byId: unit.id, requestId: request.id, toType: request.toType, toId: request.toId, reason: "Wrong item"
});
const onward = row(5, "DISTRIBUTION_REQUEST", 4, {
  byId: unit.id, stockLocation: "unit:first", toType: "staff", toId: recipient.id, toName: "Staff"
});
const onwardApproval = row(6, "DISTRIBUTION_APPROVED", 4, {
  byId: recipient.id, requestId: onward.id, toType: onward.toType, toId: onward.toId
});

function authorization(before, additions, account) {
  const state = txns => ({
    "hp_inventory.consumable_items": { district: [item] },
    "hp_inventory.consumable_txns": { district: txns },
    "hp_inventory.locations": { district: locations },
    "hp_inventory.users": users,
  });
  const prevState = state(before);
  const nextState = state([...additions.slice().reverse(), ...before]);
  return authorizeConsumableWrites(account, diffConsumableWrites(prevState, nextState), { prevState, nextState });
}

function functions(names, context) {
  vm.createContext(context);
  for (const name of names) {
    const match = new RegExp("^(?:async )?function " + name + "\\(", "m").exec(app);
    assert.ok(match, name);
    vm.runInContext(app.slice(match.index, app.indexOf("\n}", match.index) + 2), context);
  }
  return context;
}

const stockAt = (txns, location) => ConsumableLedger.atLocation(txns, item.id, location, users, locations);

test("district approvals release or settle a reservation once", () => {
  assert.equal(authorization([add], [request], admin).ok, true);
  assert.equal(authorization([add, request], [approval], recipient).ok, false);
  assert.equal(authorization([add, request], [approval], unit).ok, true);
  assert.equal(authorization([add, request], [rejection], unit).ok, true);
  assert.equal(authorization([add, request, approval], [rejection], unit).ok, false);
  assert.equal(ConsumableLedger.available(ConsumableLedger.district([add, request, rejection], item.id)), 10);
  assert.equal(stockAt([add, request, approval], "unit:first").pending, 0);
});

test("received stock can be moved onward even when the district store is empty", () => {
  const before = [add, request, approval];
  assert.equal(authorization(before, [onward], unit).ok, true);
  assert.equal(authorization([...before, onward], [onwardApproval], recipient).ok, true);
  const reserved = stockAt([...before, onward], "unit:first");
  assert.equal(reserved.pending, 4);
  assert.equal(ConsumableLedger.available(reserved), 6);
  const competing = { ...onward, id: "next", createdAt: 7, qty: 7 };
  assert.equal(authorization([...before, onward], [competing], unit).code, "RBAC_CONS_QTY");
  const settled = [...before, onward, onwardApproval];
  assert.equal(stockAt(settled, "unit:second").total, 4);
  assert.equal(stockAt(settled, "unit:first").distributed, 4);
  assert.equal(ConsumableLedger.district(settled, item.id).distributed, 10);
});

test("same-unit staff issues are deducted once from shared unit stock", () => {
  const outgoing = { ...onward, toId: colleague.id };
  const decision = { ...onwardApproval, toId: colleague.id, byId: colleague.id };
  const txns = [add, request, approval, outgoing, decision];
  assert.equal(ConsumableLedger.available(stockAt(txns, "unit:first")), 6);
  assert.equal(stockAt(txns, "staff:" + colleague.id).total, 4);
});

test("local intake and loss affect its own pool without reducing unrelated issues", () => {
  const receipt = row(7, "ADD", 5, { byId: recipient.id, stockLocation: "unit:second" });
  const receivedLoss = row(8, "LOSS", 2, { byId: unit.id, stockLocation: "unit:first" });
  const directLoss = row(9, "LOSS", 1, { byId: recipient.id, stockLocation: "unit:second" });
  const before = [add, request, approval, receipt];
  assert.equal(authorization(before, [receivedLoss], unit).ok, true);
  assert.equal(authorization([...before, receivedLoss], [directLoss], recipient).ok, true);
  const txns = [...before, receivedLoss, directLoss];
  assert.deepEqual(ConsumableLedger.district(txns, item.id), { total: 15, pending: 0, distributed: 8, lost: 3 });
  assert.equal(ConsumableLedger.available(ConsumableLedger.district(txns, item.id, true)), 0);
  assert.equal(ConsumableLedger.available(stockAt(txns, "unit:second")), 4);
});

test("batch snapshots include earlier rows even when created in one millisecond", () => {
  let counter = 1;
  const client = functions(["__consCommit"], {
    ConsumableLedger, currentUser: admin, getConsTxns: () => [add],
    __consNow: () => ({ date: "2026-11-20", time: "10:00", ts: 1 }),
    uid: () => String(++counter), __consIsAdminView: () => true,
  });
  const first = client.__consCommit("ADD", item, 2);
  const second = client.__consCommit("ADD", item, 3, null, null, "", "", [first, add]);
  assert.equal(second.next.total, 15);
  assert.ok(second.createdAt > first.createdAt);
  assert.equal(authorization([add], [first, second], admin).ok, true);
});

test("Main Distribution projects historical consumable status without editing stored rows", () => {
  const stored = { id: request.id, isConsumable: true, status: "completed", approvedBy: "Sender" };
  let txns = [request];
  const client = functions(["__distributionsInStore"], {
    loadData: key => key === "consumable_txns" ? { district: txns } : [stored],
  });
  assert.equal(client.__distributionsInStore("district")[0].status, "pending");
  txns = [rejection, request];
  assert.equal(client.__distributionsInStore("district")[0].status, "rejected");
  assert.equal(client.__distributionsInStore("district")[0].rejectRemark, rejection.reason);
  txns = [approval, request];
  assert.equal(client.__distributionsInStore("district")[0].status, "completed");
  assert.equal(stored.approvedBy, "Sender");
});

test("Demand receipt matches category and unit and keeps its destination", () => {
  const data = { consumable_items: { district: [
    { ...item, id: "wrong-category", categoryId: "other" },
    { ...item, id: "wrong-unit", unit: "box" },
    { ...item },
  ] } };
  const client = functions(["__receiveDemandStock"], {
    loadData: key => data[key], saveData: (key, value) => { data[key] = value; },
    currentUser: admin, todayStr: () => "2026-11-20", nowTimeStr: () => "10:00",
    uid: () => "receipt",
  });
  const demand = { requestedFromDistrict: "district", requestedFromLocation: "second", itemType: "cons" };
  assert.equal(client.__receiveDemandStock(demand, { itemName: item.name, categoryId: item.categoryId, unit: "PCS" }, 3, ""), true);
  const [receipt] = data.consumable_txns.district;
  assert.equal(receipt.itemId, item.id);
  assert.equal(receipt.stockLocation, "unit:second");
});

test("legacy unassigned intake remains available once at the district store", () => {
  const legacy = row(1, "ADD", 5, { byId: unit.id });
  assert.equal(ConsumableLedger.available(ConsumableLedger.district([legacy], item.id, true)), 5);
  assert.equal(ConsumableLedger.available(stockAt([legacy], "unit:first")), 0);
  const unscoped = { ...onward, stockLocation: undefined };
  assert.equal(authorization([legacy], [unscoped], unit).code, "RBAC_CONS_LEDGER");
});
