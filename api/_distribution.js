const Ledger = require("../distribution-ledger");
const { stableStringify } = require("./_rbac");
const prefix = "hp_inventory.distributions_";

// Stock distribution records and their inventory effects are written together
// by the command endpoint. Consumable mirrors remain tied to their own ledger.
function guardStateWrites(user, previous, next) {
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    if (!key.startsWith(prefix) || stableStringify(previous[key]) === stableStringify(next[key])) continue;
    if (!user) return { status: 401, error: "Sign in to manage distributions." };
    const oldRows = Array.isArray(previous[key]) ? previous[key] : [];
    const newRows = next[key] || [];
    if (!Array.isArray(newRows)) return { status: 400, error: "Invalid distribution records." };
    if (newRows.some(row => !row || typeof row.id !== "string") || new Set(newRows.map(row => row.id)).size !== newRows.length) {
      return { status: 400, error: "Distribution records require unique IDs." };
    }
    const district = key.slice(prefix.length);
    const transactions = next["hp_inventory.consumable_txns"]?.[district] || [];
    for (const id of new Set([...oldRows.map(row => row.id), ...newRows.map(row => row.id)])) {
      const old = oldRows.find(row => row.id === id);
      const row = newRows.find(record => record.id === id);
      if (stableStringify(old) === stableStringify(row)) continue;
      if ((old && !old.isConsumable) || (row && !row.isConsumable)) {
        return { status: 403, error: "Use the authorised distribution action to create, approve, reject, edit or delete stock distributions." };
      }
      const request = transactions.find(txn => txn.id === id && txn.type === "DISTRIBUTION_REQUEST");
      const beforeTransactions = previous["hp_inventory.consumable_txns"]?.[district] || [];
      const related = rows => rows.filter(txn => txn.id === id || txn.requestId === id);
      if (user.role !== "devadmin" && stableStringify(related(beforeTransactions)) === stableStringify(related(transactions))) {
        return { status: 403, error: "Update the authorised consumable ledger before changing its distribution record." };
      }
      if (!row && !request) continue;
      const line = row?.items?.[0];
      if (!row || !request || row.items?.length !== 1 || !line || line.fromItemId !== request.itemId ||
        Number(line.qty) !== Number(request.qty) || row.fromDistrictId !== district || row.toDistrictId !== district ||
        row.fromUserId !== request.byId || row.toType !== request.toType ||
        (request.toType === "unit" ? row.toLocationId !== request.toId : row.toUserId !== request.toId)) {
        return { status: 403, error: "Consumable distribution records must match their authorised ledger request." };
      }
    }
  }
  return null;
}

module.exports = { ...Ledger, guardStateWrites };
