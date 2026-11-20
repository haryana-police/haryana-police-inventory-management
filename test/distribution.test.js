const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");
const Ledger = require("../distribution-ledger");
const RBAC = require("../api/_rbac");
const Distribution = require("../api/_distribution");

const key = name => "hp_inventory." + name;
const sender = { id: "sender", username: "sender", name: "Sender", role: "mhc", districtId: "a", locationId: "source" };
const receiver = { id: "receiver", username: "receiver", name: "Receiver", role: "mhc", districtId: "a", locationId: "recipient" };
const outsider = { id: "outsider", username: "outsider", name: "Other", role: "mhc", districtId: "a", locationId: "other" };
const admin = { id: "admin", username: "admin", name: "District B", role: "admin", districtId: "b", locationId: "hq-b" };
const developer = { id: "dev", username: "dev", name: "Developer", role: "devadmin", districtId: "a", locationId: "source" };

function fixture() {
  return {
    [key("districts")]: [{ id: "a", name: "District A" }, { id: "b", name: "District B" }],
    [key("users")]: [sender, receiver, outsider, admin, developer].map(user => ({ ...user, password: "$2b$12$test" })),
    [key("locations")]: { a: [{ id: "source", name: "Source", type: "station" }, { id: "recipient", name: "Recipient", type: "station" },
      { id: "other", name: "Other", type: "station" }], b: [{ id: "hq-b", name: "District B HQ", type: "district" }] },
    [key("categories")]: { a: [{ id: "cat-a", name: "Equipment" }], b: [{ id: "cat-b", name: "Equipment" }] },
    [key("items")]: { a: [{ id: "radio", name: "Radio", unit: "Pcs", categoryId: "cat-a", locationId: "source",
      quantity: 10, conditionCounts: { good: 7, poor: 2, damaged: 1 } }], b: [] },
    [key("distributions_a")]: [], [key("distributions_b")]: []
  };
}
let sequence = 0;
function options() { return { now: 1795161000000, id: () => "new-" + (++sequence) }; }
function createCommand(extra = {}) {
  return { action: "create", districtId: "a", fromLocationId: "source",
    targets: [{ type: "unit", districtId: "a", locationId: "recipient" }],
    items: [{ fromItemId: "radio", categoryId: "cat-a", condition: "good", qty: 2 }], ...extra };
}
function pending(extra = {}) {
  const result = Ledger.execute(fixture(), sender, createCommand(extra), options());
  return { state: result.state, id: result.result.ids[0], options: options() };
}
function decision(id, action = "approve", extra = {}) { return { action, storeId: "a", id, ...extra }; }
const source = state => state[key("items")].a.find(item => item.id === "radio");
const record = state => state[key("distributions_a")][0];

test("request creation is pending and identities come from the authenticated actor", () => {
  const original = fixture();
  const result = Ledger.execute(original, sender, createCommand({ fromUserId: outsider.id, fromUserName: "Spoofed", status: "completed" }), options());
  assert.equal(record(result.state).fromUserId, sender.id);
  assert.equal(record(result.state).status, "pending");
  assert.equal(source(result.state).quantity, 10);
  assert.equal(original[key("distributions_a")].length, 0);
});

test("developer account access keeps the selected sender while ordinary users cannot impersonate", () => {
  const selected = Ledger.execute(fixture(), developer, createCommand({ actingUserId: sender.id }), options()).state;
  assert.equal(record(selected).fromUserId, sender.id);
  const ordinary = Ledger.execute(fixture(), sender, createCommand({ actingUserId: developer.id }), options()).state;
  assert.equal(record(ordinary).fromUserId, sender.id);
});

test("unrelated users cannot create, approve, reject, edit or delete another unit's stock request", () => {
  assert.throws(() => Ledger.execute(fixture(), outsider, createCommand(), options()), /authorised source/);
  const { state, id } = pending();
  for (const action of ["approve", "reject", "edit", "delete"]) {
    assert.throws(() => Ledger.execute(state, outsider, decision(id, action, { remark: "Fake" }), options()));
  }
  assert.equal(source(state).quantity, 10);
});

test("issued, lost and scrap stock are excluded cumulatively across condition rows", () => {
  const { state, id } = pending();
  Object.assign(source(state), { allotted: 6, lostReturned: 2 });
  assert.equal(Ledger.available(source(state)), 1);
  assert.throws(() => Ledger.execute(state, receiver, decision(id), options()), /available stock/);
  const next = pending({ items: [{ fromItemId: "radio", categoryId: "cat-a", condition: "good", qty: 7 },
    { fromItemId: "radio", categoryId: "cat-a", condition: "poor", qty: 2 }] });
  source(next.state).allotted = 1;
  assert.throws(() => Ledger.execute(next.state, receiver, decision(next.id), options()), /available stock/);
});

test("approval moves the exact stored quantity and ignores client inventory fields", () => {
  const { state, id } = pending();
  const { state: next } = Ledger.execute(state, receiver, decision(id, "approve", { quantity: 100, minStock: 999, approvedBy: "Fake" }), options());
  assert.equal(source(next).quantity, 8);
  assert.equal(source(next).minStock, undefined);
  assert.equal(next[key("items")].a.find(item => item.locationId === "recipient").quantity, 2);
  assert.equal(record(next).approvedBy, receiver.name);
  assert.equal(record(next).transferred, true);
  assert.throws(() => Ledger.execute(next, receiver, decision(id), options()));
});

test("same name and category with a different measurement stays in a separate item", () => {
  const { state, id } = pending();
  state[key("items")].a.push({ id: "boxes", name: "Radio", categoryId: "cat-a", locationId: "recipient", unit: "boxes",
    quantity: 1, conditionCounts: { good: 1, poor: 0, damaged: 0 } });
  const { state: next } = Ledger.execute(state, receiver, decision(id), options());
  assert.equal(next[key("items")].a.find(item => item.id === "boxes").quantity, 1);
  assert.equal(next[key("items")].a.find(item => item.locationId === "recipient" && item.unit === "Pcs").quantity, 2);
});

test("unit casing matches without changing the recipient's stored unit", () => {
  const { state, id } = pending();
  state[key("items")].a.push({ id: "existing", name: "radio", categoryId: "cat-a", locationId: "recipient", unit: "pcs",
    quantity: 1, conditionCounts: { good: 1, poor: 0, damaged: 0 } });
  const { state: next } = Ledger.execute(state, receiver, decision(id), options());
  assert.equal(next[key("items")].a.find(item => item.id === "existing").quantity, 3);
  assert.equal(next[key("items")].a.find(item => item.id === "existing").unit, "pcs");
});

test("normal unit accounts cannot create cross-district requests", () => {
  assert.throws(() => Ledger.execute(fixture(), sender, createCommand({
    targets: [{ type: "admin", districtId: "b", locationId: "hq-b" }]
  }), options()), /Only administrators/);
});

test("cross-district source stays private while the administrator receives valid stock", () => {
  const made = Ledger.execute(fixture(), developer, createCommand({ targets: [{ type: "admin", districtId: "b", locationId: "hq-b" }] }), options());
  const scoped = RBAC.projectStateFor(admin, made.state);
  assert.equal(scoped[key("items")].a, undefined);
  const { state } = Ledger.execute(made.state, admin, decision(made.result.ids[0]), options());
  assert.equal(source(state).quantity, 8);
  assert.equal(state[key("items")].b[0].quantity, 2);
  assert.equal(state[key("items")].b[0].categoryId, "cat-b");
});

test("receiving district gets a local category when it has no matching category", () => {
  const base = fixture(); base[key("categories")].b = [];
  const made = Ledger.execute(base, developer, createCommand({ targets: [{ type: "admin", districtId: "b", locationId: "hq-b" }] }), options());
  const { state } = Ledger.execute(made.state, admin, decision(made.result.ids[0]), options());
  assert.equal(state[key("categories")].b[0].name, "Equipment");
  assert.equal(state[key("items")].b[0].categoryId, state[key("categories")].b[0].id);
});

test("legacy total 10 minus transfer 2 remains 8 with lost stock retained", () => {
  const { state, id } = pending();
  Object.assign(source(state), { conditionCounts: { good: 7, poor: 0, damaged: 0 }, lostReturned: 3 });
  const next = Ledger.execute(state, receiver, decision(id), options()).state;
  assert.equal(source(next).quantity, 8);
  assert.equal(source(next).conditionCounts.good, 8);
  assert.equal(source(next).lostReturned, 3);
  assert.equal(Ledger.available(source(next)), 5);
});

test("delete reverses a completed transfer and refuses issued/lost/scrap-held receiver stock", () => {
  const { state, id } = pending();
  const approved = Ledger.execute(state, receiver, decision(id), options()).state;
  const reversed = Ledger.execute(approved, developer, decision(id, "delete"), options()).state;
  assert.equal(source(reversed).quantity, 10);
  assert.equal(reversed[key("items")].a.find(item => item.locationId === "recipient").quantity, 0);
  const destination = approved[key("items")].a.find(item => item.locationId === "recipient");
  Object.assign(destination, { quantity: 4, allotted: 1, conditionCounts: { good: 2, poor: 0, damaged: 2 } });
  assert.throws(() => Ledger.execute(approved, developer, decision(id, "delete"), options()), /available for reversal/);
  assert.equal(source(approved).quantity, 8);
  assert.equal(record(approved).status, "completed");
});

test("rejection requires a remark and does not alter stock", () => {
  const { state, id } = pending();
  assert.throws(() => Ledger.execute(state, receiver, decision(id, "reject"), options()), /remark/);
  const next = Ledger.execute(state, receiver, decision(id, "reject", { remark: "No space" }), options()).state;
  assert.equal(source(next).quantity, 10);
  assert.equal(record(next).status, "rejected");
});

test("invalid quantities, locations, categories, empty records and self transfers are rejected", () => {
  for (const qty of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => Ledger.execute(fixture(), sender, createCommand({ items: [{ fromItemId: "radio", categoryId: "cat-a", condition: "good", qty }] }), options()));
  }
  for (const locationId of ["missing", "source"]) {
    assert.throws(() => Ledger.execute(fixture(), sender, createCommand({ targets: [{ type: "unit", districtId: "a", locationId }] }), options()));
  }
  const { state, id } = pending(); record(state).items = [];
  assert.throws(() => Ledger.execute(state, receiver, decision(id), options()));
  record(state).items = [{ fromItemId: "radio", categoryId: "wrong", condition: "good", qty: 2 }];
  assert.throws(() => Ledger.execute(state, receiver, decision(id), options()));
});

test("client status changes never grant item-write permissions", () => {
  const { state } = pending(); const next = structuredClone(state);
  record(next).status = "completed"; source(next).quantity = 100; source(next).conditionCounts.good = 97;
  assert.equal(RBAC.distributionExemptKeys(state, next).size, 0);
  assert.equal(RBAC.authorizeItemWrites(outsider, RBAC.diffItemWrites(state, next), { prevState: state, nextState: next }).ok, false);
  assert.equal(Distribution.guardStateWrites(outsider, state, next).status, 403);
});

test("pending requests reserve condition stock and prevent duplicate commitments", () => {
  const { state } = pending();
  assert.equal(Ledger.reserved(state, "a", source(state)), 2);
  const command = createCommand({ items: [{ fromItemId: "radio", categoryId: "cat-a", condition: "good", qty: 6 }] });
  assert.throws(() => Ledger.execute(state, sender, command, options()), /reserve|unreserved/);
  const issued = structuredClone(state); source(issued).allotted = 8;
  assert.throws(() => Ledger.validateReservations(issued, state), /unreserved/);
});

test("sender amendment and cancellation update and release reservations", () => {
  const { state, id } = pending();
  const amended = Ledger.execute(state, sender, decision(id, "amend", {
    items: [{ fromItemId: "radio", categoryId: "cat-a", condition: "good", qty: 4 }], remarks: "Need four"
  }), options()).state;
  assert.equal(record(amended).items[0].qty, 4);
  assert.equal(Ledger.reserved(amended, "a", source(amended)), 4);
  assert.throws(() => Ledger.execute(amended, outsider, decision(id, "cancel"), options()), /Only the sender/);
  const cancelled = Ledger.execute(amended, sender, decision(id, "cancel"), options()).state;
  assert.equal(source(cancelled).quantity, 10);
  assert.equal(Ledger.reserved(cancelled, "a", source(cancelled)), 0);
  assert.equal(record(cancelled).status, "cancelled");
  assert.equal(Ledger.canReceive(receiver, record(cancelled), cancelled), false);
});

test("partial receipts move selected quantities, retain reservations and reverse exactly what arrived", () => {
  const { state, id } = pending();
  const lineKey = record(state).items[0].key;
  const partial = Ledger.execute(state, receiver, decision(id, "approve", { approvals: [{ key: lineKey, qty: 1 }] }), options()).state;
  assert.equal(record(partial).status, "partially_completed");
  assert.equal(record(partial).items[0].approvedQty, 1);
  assert.equal(source(partial).quantity, 9);
  assert.equal(Ledger.reserved(partial, "a", source(partial)), 1);
  assert.equal(Ledger.canReceive(receiver, record(partial), partial), true);
  const completed = Ledger.execute(partial, receiver, decision(id, "approve", { approvals: [{ key: lineKey, qty: 1 }] }), options()).state;
  assert.equal(record(completed).status, "completed");
  assert.equal(source(completed).quantity, 8);
  const reversed = Ledger.execute(completed, developer, decision(id, "delete"), options()).state;
  assert.equal(source(reversed).quantity, 10);
  assert.equal(reversed[key("items")].a.find(item => item.locationId === "recipient").quantity, 0);
});

test("partial receipt followed by cancellation or rejection keeps received stock", () => {
  for (const action of ["cancel", "reject"]) {
    const { state, id } = pending();
    const partial = Ledger.execute(state, receiver, decision(id, "approve", {
      approvals: [{ key: record(state).items[0].key, qty: 1 }]
    }), options()).state;
    const closed = Ledger.execute(partial, action === "cancel" ? sender : receiver, decision(id, action, { remark: "Stop remaining stock" }), options()).state;
    assert.equal(source(closed).quantity, 9);
    assert.equal(closed[key("items")].a.find(item => item.locationId === "recipient").quantity, 1);
    assert.equal(Ledger.reserved(closed, "a", source(closed)), 0);
    assert.equal(Ledger.canReceive(receiver, record(closed), closed), false);
    const reversed = Ledger.execute(closed, developer, decision(id, "delete"), options()).state;
    assert.equal(source(reversed).quantity, 10);
  }
});

test("sender changes only remaining quantities after a partial receipt", () => {
  const { state, id } = pending();
  const partial = Ledger.execute(state, receiver, decision(id, "approve", { approvals: [{ key: record(state).items[0].key, qty: 1 }] }), options()).state;
  const amended = Ledger.execute(partial, sender, decision(id, "amend", {
    items: [{ fromItemId: "radio", categoryId: "cat-a", condition: "poor", qty: 2 }]
  }), options()).state;
  assert.equal(record(amended).items.find(line => line.condition === "good").approvedQty, 1);
  assert.equal(record(amended).items.find(line => line.condition === "good").qty, 1);
  const completed = Ledger.execute(amended, receiver, decision(id), options()).state;
  assert.equal(source(completed).quantity, 7);
  assert.equal(record(completed).status, "completed");
  const reversed = Ledger.execute(completed, developer, decision(id, "delete"), options()).state;
  assert.equal(source(reversed).quantity, 10);
  assert.deepEqual(source(reversed).conditionCounts, { good: 7, poor: 2, damaged: 1 });
});

test("stale partial decisions and fractional receipt quantities are rejected", () => {
  const { state, id } = pending();
  const lineKey = record(state).items[0].key;
  for (const qty of [0, -1, 1.5, 3]) assert.throws(() => Ledger.execute(state, receiver,
    decision(id, "approve", { approvals: [{ key: lineKey, qty }] }), options()));
  const partial = Ledger.execute(state, receiver, decision(id, "approve", {
    expectedRevision: 0, approvals: [{ key: lineKey, qty: 1 }]
  }), options()).state;
  assert.throws(() => Ledger.execute(partial, receiver, decision(id, "approve", {
    expectedRevision: 0, approvals: [{ key: lineKey, qty: 1 }]
  }), options()), /changed/);
});

test("multiple recipients reserve the combined quantity atomically", () => {
  const original = fixture();
  const command = createCommand({ targets: [{ type: "unit", districtId: "a", locationId: "recipient" },
    { type: "unit", districtId: "a", locationId: "other" }],
    items: [{ fromItemId: "radio", categoryId: "cat-a", condition: "good", qty: 4 }] });
  assert.throws(() => Ledger.execute(original, sender, command, options()), /reserve|unreserved/);
  assert.equal(original[key("distributions_a")].length, 0);
  command.items[0].qty = 2;
  const next = Ledger.execute(original, sender, command, options()).state;
  assert.equal(next[key("distributions_a")].length, 2);
  assert.equal(Ledger.reserved(next, "a", source(next)), 4);
});

test("consumable mirrors remain tied to their authorised ledger", () => {
  const previous = fixture(), next = structuredClone(previous);
  const request = { id: "cons-request", type: "DISTRIBUTION_REQUEST", itemId: "paper", qty: 2,
    byId: sender.id, toType: "unit", toId: "recipient" };
  next[key("consumable_txns")] = { a: [request] };
  next[key("distributions_a")].push({ id: request.id, isConsumable: true, fromDistrictId: "a", toDistrictId: "a",
    fromUserId: sender.id, toType: "unit", toLocationId: "recipient", status: "pending",
    items: [{ fromItemId: "paper", qty: 2 }] });
  assert.equal(Distribution.guardStateWrites(sender, previous, next), null);
  const forged = structuredClone(next); record(forged).status = "completed";
  assert.equal(Distribution.guardStateWrites(outsider, next, forged).status, 403);
  const deleted = structuredClone(next); deleted[key("distributions_a")] = [];
  assert.equal(Distribution.guardStateWrites(developer, next, deleted).status, 403);
  deleted[key("consumable_txns")].a = [];
  assert.equal(Distribution.guardStateWrites(developer, next, deleted), null);
});

test("API reservation validation also blocks inventory writes consuming pending stock", async () => {
  const api = apiHarness();
  await api.post("distribution", { command: createCommand(), requestId: "reserve" });
  const previous = api.state(), visible = structuredClone(RBAC.projectStateFor(sender, previous));
  visible[key("users")] = visible[key("users")].map(user => { delete user.password; return user; });
  const next = structuredClone(visible); source(next).allotted = 8;
  const response = await api.post("state", { state: next, changedKeys: [key("items")],
    baseState: { [key("items")]: visible[key("items")] }, requestId: "consume-reserved" });
  assert.equal(response.status, 400);
  assert.match(response.result.error, /unreserved/);
  assert.equal(source(api.state()).allotted, undefined);
});

function apiHarness(initial = fixture()) {
  let stored = initial;
  for (const user of stored[key("users")]) {
    (stored[key("sessions")] ||= {})[crypto.createHash("sha256").update(user.id).digest("hex")] = { userId: user.id, expiresAt: Date.now() + 600000 };
  }
  class Pool {
    syncDemoAccounts() {}
    async query(sql, params) {
      if (sql.includes("SELECT data FROM app_state")) return { rows: [{ data: structuredClone(stored) }] };
      if (sql.includes("INSERT INTO app_state")) stored = JSON.parse(params[0]);
      return { rows: [] };
    }
  }
  const file = path.join(__dirname, "..", "api", "index.js");
  const realRequire = createRequire(file);
  const context = { require: name => name === "./_filepool" ? { Pool } : realRequire(name),
    module: { exports: {} }, exports: {}, process: { env: {}, nextTick() {} },
    console: { log() {}, warn() {}, error() {} }, __dirname: path.dirname(file),
    Buffer, URL, setTimeout, clearTimeout, setInterval, clearInterval, structuredClone };
  context.global = context;
  vm.createContext(context); vm.runInContext(fs.readFileSync(file, "utf8"), context);
  async function post(route, body, actor = sender) {
    let status = 200, result;
    const request = { method: "POST", query: { path: [route] }, body,
      headers: actor ? { authorization: "Bearer " + actor.id } : {}, socket: { remoteAddress: "127.0.0.1" } };
    const response = { setHeader() {}, status(value) { status = value; return this; },
      json(value) { result = value; return this; }, end() {} };
    await context.module.exports(request, response);
    return { status, result };
  }
  return { post, state: () => structuredClone(stored) };
}

test("real API command endpoint authenticates and deduplicates concurrent/retried creates", async () => {
  const api = apiHarness(), body = { command: createCommand(), requestId: "submission" };
  assert.equal((await api.post("distribution", body, null)).status, 401);
  const responses = await Promise.all([api.post("distribution", body), api.post("distribution", body)]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  assert.equal(responses[1].result.replayed, true);
  assert.equal(api.state()[key("distributions_a")].length, 1);
  const changed = structuredClone(body); changed.command.items[0].qty = 3;
  assert.equal((await api.post("distribution", changed)).status, 409);
});

test("real API rejects forged generic state and unauthenticated key writes", async () => {
  const api = apiHarness();
  assert.equal((await api.post("key", { key: key("distributions_a"), value: [{ id: "forged" }] }, null)).status, 401);
  assert.equal((await api.post("key", { key: key("distributions_a"), value: [] }, outsider)).status, 403);
  const made = await api.post("distribution", { command: createCommand(), requestId: "create" });
  assert.equal(made.status, 200);
  const previous = api.state(); const visible = structuredClone(RBAC.projectStateFor(outsider, previous));
  visible[key("users")] = visible[key("users")].map(user => { delete user.password; return user; });
  const next = structuredClone(visible); record(next).status = "completed";
  const response = await api.post("state", { state: next, changedKeys: [key("distributions_a")],
    baseState: { [key("distributions_a")]: visible[key("distributions_a")] }, requestId: "forged" }, outsider);
  assert.equal(response.status, 403);
  assert.equal(record(api.state()).status, "pending");
});

test("real API executes cross-district approval once without trusting client quantities", async () => {
  const api = apiHarness();
  const made = await api.post("distribution", { command: createCommand({ targets: [{ type: "admin", districtId: "b", locationId: "hq-b" }] }), requestId: "cross" }, developer);
  assert.equal(made.status, 200);
  const id = made.result.ids[0];
  assert.equal((await api.post("distribution", { command: decision(id), requestId: "unauthorised" }, outsider)).status, 403);
  const body = { command: decision(id, "approve", { quantity: 100 }), requestId: "approve" };
  assert.equal((await api.post("distribution", body, admin)).status, 200);
  assert.equal((await api.post("distribution", body, admin)).result.replayed, true);
  const state = api.state();
  assert.equal(source(state).quantity, 8);
  assert.equal(state[key("items")].b[0].quantity, 2);
  assert.equal(state[key("items")].b[0].categoryId, "cat-b");
});
