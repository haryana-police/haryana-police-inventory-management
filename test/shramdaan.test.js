const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { guardShramDaanWrites, projectStateFor, restoreScopeFor } = require("../api/_rbac");

const key = "hp_inventory.shramdaan_d";
const locations = "hp_inventory.locations";
const unit = { id: "u", role: "user", districtId: "d", locationId: "one" };
const admin = { ...unit, id: "a", role: "admin" };
const developer = { ...unit, id: "dev", role: "devadmin" };
const existing = { id: "old", createdBy: unit.id, locationId: "one" };
const other = { id: "other", createdBy: "other", locationId: "two" };
const base = { [key]: [existing, other], [locations]: { d: [{ id: "one", name: "Unit One" }] } };
const fixture = {
  id: "new", createdBy: unit.id, locationId: "one", locationName: "Unit One",
  workType: "cleaning", customType: "", participants: 5, description: "Cleaned the yard",
  date: "2025-11-20", time: "08:00",
  photos: [{ stamped: true, capturedAt: "2025-11-20 08:00", dataUrl: "data:image/jpeg;base64,/9j/2Q==" }]
};

test("only Developer Admin can delete a Shramdaan record", () => {
  const after = { ...base, [key]: [other] };
  for (const actor of [unit, admin, { ...admin, role: "ig" }]) {
    assert.match(guardShramDaanWrites(actor, base, after).error, /Only Developer Admin/);
  }
  assert.equal(guardShramDaanWrites(null, base, after).status, 401);
  assert.equal(guardShramDaanWrites(developer, base, after), null);
});

test("unit scope hides other units and preserves their stored records on save", () => {
  assert.deepEqual(projectStateFor(unit, base)[key], [existing]);
  assert.deepEqual(projectStateFor(admin, base)[key], base[key]);
  const submitted = { ...base, [key]: [fixture, existing] };
  const restored = restoreScopeFor(unit, base, submitted);
  assert.deepEqual(restored[key], [fixture, existing, other]);
  assert.equal(guardShramDaanWrites(unit, base, restored), null);
  assert.deepEqual(restoreScopeFor(unit, base, { ...base, [key]: [existing] })[key], base[key]);
});

test("backend checks creator, assigned unit, required photos and final stamp", () => {
  const validate = change => guardShramDaanWrites(unit, base, { ...base, [key]: [...base[key], { ...fixture, ...change }] });
  assert.equal(validate({}), null);
  assert.equal(validate({ createdBy: "another" }).status, 403);
  assert.equal(validate({ locationId: "two" }).status, 403);
  assert.equal(validate({ photos: [] }).status, 400);
  assert.equal(validate({ time: "09:00" }).status, 400);
  assert.equal(validate({ customType: "old custom" }).status, 400);
  assert.equal(validate({ participants: 0 }).status, 400);
  assert.equal(validate({ date: "2999-11-20" }).status, 400);
  assert.equal(validate({ date: "2025-02-30" }).status, 400);
});

test("client waits for save acknowledgement and leaves the form open on failure", async () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const start = src.indexOf("async function saveShramDaanEntry(");
  const end = src.indexOf("\nfunction openShramDaanDetailModal(", start);
  const values = {
    shramWorkType: "cleaning", shramCustomType: "stale", shramLocation: "one",
    shramDate: fixture.date, shramTime: fixture.time, shramParticipants: "5",
    shramDescription: fixture.description,
  };
  let rejectSave;
  let closed = false;
  let saved;
  const messages = [];
  const context = vm.createContext({
    $: selector => ({ value: values[selector.slice(1)], querySelectorAll: () => [] }),
    __shramSaving: false, __shramPhotoReads: 0, __shramPhotos: [{ name: "input.png" }],
    currentUser: unit, activeDistrictId: "d", signedInUser: () => unit, isAdmin: () => false,
    ROLE_LABELS: { user: "User" }, SHRAM_WORK_TYPES: ["cleaning"], uid: () => "fixture",
    getLocations: () => base[locations].d, todayStr: () => fixture.date, nowTimeStr: () => "09:00",
    getShramDaanList: () => [], saveShramDaanList: rows => { saved = rows; },
    __shramUpdateSaveButton() {}, __audit() {}, renderShramDaan() {},
    __shramStampPhoto: async (_, record) => ({ capturedAt: record.date + " " + record.time }),
    toast: (...args) => messages.push(args), closeModals: () => { closed = true; },
    window: { __apiFlush: () => new Promise((_, reject) => { rejectSave = reject; }) }
  });
  vm.runInContext(src.slice(start, end), context);
  const saving = context.saveShramDaanEntry();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(saved[0].customType, "");
  assert.equal(closed, false);
  assert.equal(messages.length, 0);
  await context.saveShramDaanEntry();
  rejectSave(new Error("Save failed"));
  await saving;
  assert.equal(closed, false);
  assert.deepEqual(messages, [["Save failed", "error"]]);
  assert.equal(context.__shramSaving, false);
});
