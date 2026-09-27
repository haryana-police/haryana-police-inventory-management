/* IMS Agent tests — LocalProvider NLU + plan gating (no network, no DB) */
const assert = require("assert");
const path = require("path");
let mod;
let loaded = false;
const candidates = [
  path.join(__dirname, "..", "api", "agent.js"),
  path.join(process.cwd(), "api", "agent.js")
];
for (const c of candidates) { try { mod = require(c); loaded = true; break; } catch (e) {} }
assert.ok(loaded, "api/agent.js not found");
const I = (msg, ctx) => mod.localInterpret(msg, ctx || {});

/* intent understanding: English */
let r = I("Add 20 shirts", {});
assert.strictEqual(r.plan.kind, "prepare");
assert.strictEqual(r.plan.tool, "addStock");
assert.strictEqual(r.plan.args.qty, 20);
assert.ok(/shirt/.test(r.plan.args.item));

/* Hinglish */
r = I("Uniform mein 20 shirt add karo", {});
assert.strictEqual(r.plan.kind, "prepare");
assert.strictEqual(r.plan.args.qty, 20);

/* view demands */
r = I("Pending demands dikhao", {});
assert.strictEqual(r.plan.kind, "tool");
assert.strictEqual(r.plan.tool, "pendingDemands");

/* navigation */
r = I("reports kholo", {});
assert.strictEqual(r.plan.kind, "navigate");
assert.strictEqual(r.plan.tab, "reports");

/* greeting */
r = I("Hello IMS", {});
assert.ok(r.reply.length > 5);

/* confirmation gating — no pending + "yes" must NOT execute */
r = I("yes", {});
assert.notStrictEqual(r.plan && r.plan.kind, "execute");

/* confirmation gating — pending + yes => execute */
r = I("yes", { pending: { tool: "addStock", summary: "Shirt x20", args: {}, executeLine: "x" }, pendingConfirmed: false });
assert.strictEqual(r.plan.kind, "execute");
assert.strictEqual(r.plan.tool, "addStock");

/* cancel */
r = I("cancel", { pending: { tool: "addStock" } });
assert.strictEqual(r.plan.kind, "cancel");

/* sleep */
r = I("stop", {});
assert.strictEqual(r.intent, "sleep");
assert.strictEqual(r.state, "SLEEPING");

/* quality parsing */
r = I("5 kharab helmets add karo", {});
assert.strictEqual(r.plan.kind, "prepare");
assert.strictEqual(r.plan.args.quality, "poor");
assert.strictEqual(r.plan.args.qty, 5);

/* ambiguity: no qty/item => unknown, never execute */
r = I("add stock", {});
assert.notStrictEqual(r.plan && r.plan.kind, "execute");

/* reprepare qty change while pending */
r = I("make it 30", { pending: { tool: "addStock", args: { item: "shirt", qty: 20 } } });
assert.strictEqual(r.plan.kind, "reprepare");
assert.strictEqual(r.plan.args.qty, 30);

/* provider config: no key => local */
assert.strictEqual(mod.llmConfig(), null);

console.log("agent tests: ALL PASS (" + 14 + " checks)");