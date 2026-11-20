const test = require("node:test");
const assert = require("node:assert/strict");
const { guardInspectionWrites, projectStateFor, restoreScopeFor, canAccessInspectionUnit, inspectionAttachmentScopes } = require("../api/_rbac");

const key = "hp_inventory.inspections_d";
const unit = { id: "u", role: "user", districtId: "d", locationId: "one" };
const colleague = { ...unit, id: "colleague" };
const admin = { ...unit, id: "admin", role: "admin" };
const dev = { ...unit, id: "dev", role: "devadmin" };
const pending = { id: "pending", itemName: "Radio", itemId: "radio", inspectedBy: "Officer", type: "routine",
  date: "2025-11-15", dueDate: "2025-11-19", locationId: "one", findings: "", status: "pending",
  createdBy: unit.id, createdAt: 1 };
const outside = { ...pending, id: "outside", locationId: "two", createdBy: "other" };
const base = {
  [key]: [pending, outside],
  "hp_inventory.inspections_e": [{ ...outside, id: "other-district" }],
  "hp_inventory.locations": { d: [{ id: "one" }, { id: "two" }] },
  "hp_inventory.items": { d: [{ id: "radio", locationId: "one", name: "Radio" }] }
};
const apply = (actor, records, before = base) => guardInspectionWrites(actor, before, { ...before, [key]: records });

test("inspection visibility and saves preserve records of other units and districts", () => {
  assert.deepEqual(projectStateFor(unit, base)[key], [pending]);
  assert.equal(projectStateFor(unit, base)["hp_inventory.inspections_e"], undefined);
  assert.deepEqual(projectStateFor(admin, base)[key], [pending, outside]);
  const visible = projectStateFor(unit, base);
  const patched = { ...visible, [key]: [{ ...pending, findings: "Counted" }] };
  const restored = restoreScopeFor(unit, base, patched);
  assert.deepEqual(restored[key], [{ ...pending, findings: "Counted" }, outside]);
  assert.deepEqual(restored["hp_inventory.inspections_e"], base["hp_inventory.inspections_e"]);
  assert.equal(guardInspectionWrites(unit, base, restored), null);
});

test("inspection follow-up is limited to the creator and deletion to Developer Admin", () => {
  const completed = { ...pending, status: "completed", findings: "Counted 10 radios" };
  assert.equal(apply(unit, [completed, outside]), null);
  assert.equal(apply(colleague, [completed, outside]).status, 403);
  assert.equal(apply(admin, [completed, outside]).status, 403);
  assert.equal(apply(dev, [completed, outside]), null);
  for (const actor of [unit, admin]) assert.match(apply(actor, [outside]).error, /Only Developer Admin/);
  assert.equal(apply(dev, [outside]), null);
  assert.equal(apply(unit, [{ ...completed, findings: "Changed" }, outside], { ...base, [key]: [completed, outside] }).status, 403);
});

test("new records require valid location, linked asset, dates and completed findings", () => {
  const validate = changes => apply(unit, [...base[key], { ...pending, id: "new", ...changes }]);
  assert.equal(validate({}), null);
  assert.equal(validate({ createdBy: "someone else" }).status, 403);
  assert.equal(validate({ locationId: "two" }).status, 403);
  assert.equal(validate({ date: "2999-01-01" }).status, 400);
  assert.equal(validate({ dueDate: "" }).status, 400);
  assert.equal(validate({ dueDate: "2025-11-14" }).status, 400);
  assert.equal(validate({ itemId: "wrong" }).status, 400);
  assert.equal(validate({ status: "completed" }).status, 400);
  assert.equal(validate({ status: "completed", findings: "Done", dueDate: "" }), null);
});

test("inspection attachments inherit the record district and unit", () => {
  const file = { id: "photo" };
  const scope = { districtId: "d", locationId: "one" };
  const state = { ...base, "hp_inventory.scan_files.photo": { inspectionScope: scope } };
  const updated = [{ ...pending, attachments: [file] }, outside];
  assert.equal(apply(unit, updated, state), null);
  assert.equal(apply(unit, updated).status, 400);
  assert.deepEqual(inspectionAttachmentScopes({ ...state, [key]: updated }, "photo"), [scope]);
  assert.equal(canAccessInspectionUnit(unit, "d", "one"), true);
  assert.equal(canAccessInspectionUnit(unit, "d", "two"), false);
  assert.equal(canAccessInspectionUnit(admin, "e", "one"), false);
});
