(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DistributionLedger = factory();
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const prefix = "hp_inventory.";
  const conditions = ["good", "poor", "damaged"];
  const unitKey = value => String(value || "pcs").trim().toLowerCase();
  const nameKey = value => String(value || "").trim().toLowerCase();

  function fail(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    throw error;
  }
  function list(state, key) { return state[prefix + key] || []; }
  function districtList(state, key, district) { return (state[prefix + key] || {})[district] || []; }
  function scope(user, district) {
    return user.role === "devadmin" || (user.role === "ig"
      ? (user.districtIds || []).includes(district) : user.districtId === district);
  }
  function ownsSource(user, district, location) {
    return scope(user, district) && (["devadmin", "ig", "admin"].includes(user.role) || user.locationId === location);
  }
  function counts(item) {
    const result = { good: 0, poor: 0, damaged: 0, ...item.conditionCounts };
    if (!conditions.every(key => Number.isSafeInteger(result[key]) && result[key] >= 0) ||
      !Number.isSafeInteger(item.quantity) || item.quantity < 0) fail("Stock quantities must be non-negative whole numbers.");
    const missing = item.quantity - conditions.reduce((sum, key) => sum + result[key], 0);
    if (missing < 0) fail("Condition quantities exceed the recorded stock total. Reconcile this item first.");
    result.good += missing;
    return result;
  }
  function available(item) {
    return item.quantity - (item.allotted || 0) - (item.lostReturned || 0) -
      (item.damagedReturned || 0) - counts(item).damaged;
  }
  function canReceive(user, record, state) {
    if (!user || record.status !== "pending" || record.isConsumable) return false;
    if (user.role === "devadmin") return true;
    if (!scope(user, record.toDistrictId)) return false;
    if (record.toType === "admin") return user.role === "admin" && user.districtId === record.toDistrictId;
    if (record.toUserId) return user.id === record.toUserId;
    if (user.locationId === record.toLocationId && user.districtId === record.toDistrictId) return true;
    const assigned = list(state, "users").some(account => account.active !== false &&
      account.districtId === record.toDistrictId && account.locationId === record.toLocationId);
    return !assigned && user.role === "admin" && user.districtId === record.toDistrictId;
  }
  function sourceFor(state, record, line) {
    const items = districtList(state, "items", record.fromDistrictId).filter(item => !item.isDeleted);
    const matches = line.fromItemId ? items.filter(item => item.id === line.fromItemId) : items.filter(item =>
      nameKey(item.name) === nameKey(line.itemName) && (!line.fromLocationId || line.fromLocationId === item.locationId) &&
      (!line.categoryId || line.categoryId === item.categoryId));
    const source = matches.length === 1 ? matches[0] : null;
    if (!source || (line.categoryId && line.categoryId !== source.categoryId) ||
      (line.fromLocationId && line.fromLocationId !== source.locationId) ||
      (line.unit && unitKey(line.unit) !== unitKey(source.unit))) fail("The original source item or its category/unit has changed.");
    return source;
  }
  function validateLines(state, record) {
    if (!Array.isArray(record.items) || !record.items.length) fail("Add at least one distribution item.");
    const requested = new Map();
    for (const line of record.items) {
      if (!Number.isSafeInteger(line.qty) || line.qty <= 0 || !conditions.includes(line.condition)) fail("Enter positive whole quantities and valid conditions.");
      const source = sourceFor(state, record, line);
      const need = requested.get(source.id) || { source, good: 0, poor: 0, damaged: 0 };
      need[line.condition] += line.qty;
      requested.set(source.id, need);
    }
    for (const need of requested.values()) {
      const stock = counts(need.source);
      for (const condition of conditions) if (need[condition] > stock[condition]) fail(`Insufficient ${condition} stock for "${need.source.name}".`);
      if (need.good + need.poor > available(need.source)) fail(`Insufficient available stock for "${need.source.name}". Issued, lost and scrap units cannot be distributed.`);
    }
  }
  function history(item, type, delta, record, actor, now, id) {
    (item.history ||= []).push({ id: id(), type, qty: delta, totalDelta: delta,
      prev: item.quantity - delta, balance: item.quantity, ref: record.distNo,
      person: actor.name || actor.username || "", user: actor.name || actor.username || "",
      date: new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
      time: new Date(now).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }),
      remarks: type === "ADJUST" ? "Distribution deleted and stock reversed" : "Distribution " + record.distNo, at: now });
  }
  function targetCategory(state, record, source, id) {
    const category = districtList(state, "categories", record.fromDistrictId).find(row => row.id === source.categoryId);
    if (!category) fail("The source category no longer exists.");
    const map = state[prefix + "categories"] ||= {};
    const target = map[record.toDistrictId] ||= [];
    let match = target.find(row => nameKey(row.name) === nameKey(category.name));
    if (!match) { match = { ...category, id: id() }; target.push(match); }
    return match.id;
  }
  function transfer(state, record, user, now, id) {
    validateLines(state, record);
    const location = districtList(state, "locations", record.toDistrictId).find(row => row.id === record.toLocationId);
    if (!location) fail("The receiving location no longer exists.");
    const map = state[prefix + "items"] ||= {};
    const target = map[record.toDistrictId] ||= [];
    for (const line of record.items) {
      const source = sourceFor(state, record, line);
      if (record.fromDistrictId === record.toDistrictId && source.locationId === location.id) fail("Source and receiving locations must be different.");
      const categoryId = targetCategory(state, record, source, id);
      let destination = target.find(item => !item.isDeleted && item.locationId === location.id &&
        item.categoryId === categoryId && nameKey(item.name) === nameKey(source.name) && unitKey(item.unit) === unitKey(source.unit));
      if (!destination) {
        destination = { id: id(), name: source.name, categoryId, unit: source.unit || "pcs", locationId: location.id,
          quantity: 0, minStock: 0, conditionCounts: { good: 0, poor: 0, damaged: 0 }, createdAt: now };
        target.push(destination);
      }
      source.conditionCounts = counts(source);
      destination.conditionCounts = counts(destination);
      source.conditionCounts[line.condition] -= line.qty;
      source.quantity -= line.qty;
      destination.conditionCounts[line.condition] += line.qty;
      destination.quantity += line.qty;
      source.updatedAt = destination.updatedAt = now;
      line.fromItemId = source.id;
      line.fromLocationId = source.locationId;
      line.toItemId = destination.id;
      line.toLocationId = destination.locationId;
      history(source, "DISPATCH", -line.qty, record, user, now, id);
      history(destination, "STOCK_IN", line.qty, record, user, now, id);
    }
  }
  function reverse(state, record, user, now, id) {
    if (!record.items?.length) fail("This distribution has no stock movements to reverse.");
    for (const line of record.items) {
      const source = districtList(state, "items", record.fromDistrictId).find(item => item.id === line.fromItemId && !item.isDeleted);
      const recipient = districtList(state, "items", record.toDistrictId).find(item => item.id === line.toItemId && !item.isDeleted);
      if (!source || !recipient || source === recipient || !conditions.includes(line.condition) ||
        !Number.isSafeInteger(line.qty) || line.qty < 1) fail("The original stock records are required to reverse this distribution.");
      const remaining = counts(recipient);
      if (remaining[line.condition] < line.qty || (line.condition !== "damaged" && available(recipient) < line.qty)) fail("Recipient stock is issued, lost, scrapped or no longer available for reversal.");
      for (const [item, delta] of [[source, line.qty], [recipient, -line.qty]]) {
        item.conditionCounts = counts(item);
        item.conditionCounts[line.condition] += delta;
        item.quantity += delta;
        item.updatedAt = now;
        history(item, "ADJUST", delta, record, user, now, id);
      }
    }
  }
  function create(state, user, command, now, id) {
    const districtId = command.districtId;
    if (!scope(user, districtId)) fail("You cannot distribute stock from this district.", 403);
    const locationId = command.fromLocationId || user.locationId;
    const locations = districtList(state, "locations", districtId);
    if (!locations.some(row => row.id === locationId) || !ownsSource(user, districtId, locationId)) fail("Select an authorised source location.", 403);
    if (!command.targets?.length || !command.items?.length) fail("Select recipients and at least one item.");
    const district = list(state, "districts").find(row => row.id === districtId);
    if (!district) fail("The sender district no longer exists.");
    const targetKeys = new Set();
    const lines = command.items.map(line => {
      if (!conditions.includes(line.condition) || !Number.isSafeInteger(line.qty) || line.qty < 1) fail("Enter positive whole quantities.");
      let source;
      if (line.fromItemId) source = sourceFor(state, { fromDistrictId: districtId }, line);
      else {
        const category = districtList(state, "categories", districtId).find(row => row.id === line.categoryId);
        if (!category || !nameKey(line.itemName)) fail("Choose a valid item and category.");
        const items = (state[prefix + "items"] ||= {})[districtId] ||= [];
        source = items.find(item => !item.isDeleted && item.locationId === locationId && item.categoryId === category.id &&
          nameKey(item.name) === nameKey(line.itemName) && unitKey(item.unit) === unitKey(line.unit));
        if (!source) {
          source = { id: id(), name: String(line.itemName).trim(), categoryId: category.id, locationId,
            unit: line.unit || "pcs", quantity: 0, minStock: 0, conditionCounts: { good: 0, poor: 0, damaged: 0 }, createdAt: now };
          items.push(source);
        }
      }
      if (!ownsSource(user, districtId, source.locationId)) fail("You can only distribute stock from your authorised units.", 403);
      const category = districtList(state, "categories", districtId).find(row => row.id === source.categoryId);
      if (!category) fail("The source category no longer exists.");
      return { key: id(), itemName: source.name, qty: line.qty, condition: line.condition, fromItemId: source.id,
        fromLocationId: source.locationId, categoryId: source.categoryId, categoryName: category.name, unit: source.unit || "pcs", toItemId: null };
    });
    const records = state[prefix + "distributions_" + districtId] ||= [];
    const created = [];
    for (const target of command.targets) {
      const targetDistrict = list(state, "districts").find(row => row.id === target.districtId);
      const location = districtList(state, "locations", target.districtId).find(row => row.id === target.locationId);
      if (!targetDistrict || !location || !["unit", "admin"].includes(target.type)) fail("Select an existing receiving unit.");
      if (target.type === "unit" && target.districtId !== districtId) fail("Cross-district stock must be sent to the receiving District Admin.");
      if (target.type === "admin" && target.districtId !== districtId && !["devadmin", "ig", "admin"].includes(user.role)) fail("Only administrators may distribute to other districts.", 403);
      if (target.type === "unit" && location.type === "district") fail("Select District Admin for the district headquarters.");
      if (lines.some(line => target.districtId === districtId && line.fromLocationId === location.id)) fail("Source and receiving locations must be different.");
      const key = JSON.stringify([target.type, target.districtId, location.id]);
      if (targetKeys.has(key)) fail("A recipient was selected more than once.");
      targetKeys.add(key);
      const recipients = list(state, "users").filter(account => account.active !== false && account.districtId === target.districtId &&
        (target.type === "admin" ? account.role === "admin" : account.locationId === location.id));
      const receiver = recipients.length === 1 ? recipients[0] : null;
      const seq = (Number(state[prefix + "distSeq"]) || 0) + 1;
      state[prefix + "distSeq"] = seq;
      const record = { id: id(), distNo: "DIST-" + String(seq).padStart(6, "0"), remarks: String(command.remarks || ""),
        fromDistrictId: districtId, fromDistrictName: district.name, fromLocationId: locationId,
        fromLocationName: locations.find(row => row.id === locationId).name, fromUserId: user.id, fromUserName: user.name || user.username,
        toType: target.type, toDistrictId: target.districtId, toDistrictName: targetDistrict.name,
        toLocationId: location.id, toLocationName: location.name, toName: target.type === "admin" ? targetDistrict.name + " (Admin)" : location.name,
        toUserId: receiver?.id || null, toUserName: receiver?.name || "", items: structuredClone(lines),
        attachments: structuredClone(command.attachments || []), status: "pending", approveRemark: "", rejectRemark: "",
        approvedBy: "", approvedAt: null, rejectedBy: "", rejectedAt: null, createdAt: now, updatedAt: null };
      records.push(record);
      created.push(record.id);
    }
    return { ids: created };
  }
  function execute(original, user, command, options) {
    if (!user || user.active === false) fail("Sign in to manage distributions.", 401);
    const state = structuredClone(original);
    const { now, id } = options;
    let result;
    if (command.action === "create") result = create(state, user, command, now, id);
    else {
      const records = list(state, "distributions_" + command.storeId);
      const record = records.find(row => row.id === command.id);
      if (!record) fail("Distribution record not found.", 404);
      if (record.isConsumable) fail("Manage this distribution through its consumable ledger.");
      if (record.fromDistrictId !== command.storeId) fail("The distribution store does not match its sender.");
      if (["approve", "reject"].includes(command.action)) {
        if (!canReceive(user, record, state)) fail("Only the authorised recipient can decide a pending distribution.", 403);
        if (command.action === "approve") { transfer(state, record, user, now, id); record.status = "completed"; record.transferred = true;
          record.approveRemark = String(command.remark || ""); record.approvedBy = user.name || user.username; record.approvedAt = now;
        } else { if (!String(command.remark || "").trim()) fail("Rejection remark is required.");
          record.status = "rejected"; record.rejectRemark = String(command.remark).trim(); record.rejectedBy = user.name || user.username; record.rejectedAt = now;
        }
      } else {
        if (user.role !== "devadmin") fail("Only Developer Admin may edit or delete distributions.", 403);
        if (command.expectedUpdatedAt !== undefined && command.expectedUpdatedAt !== (record.updatedAt || record.createdAt)) fail("This distribution changed. Open it again.", 409);
        if (command.action === "delete") {
          if (record.transferred) reverse(state, record, user, now, id);
          else if (record.status === "completed") fail("This completed legacy distribution has no confirmed transfer to reverse.");
          records.splice(records.indexOf(record), 1);
        } else if (command.action === "edit") record.remarks = String(command.remark || "");
        else fail("Unknown distribution action.");
      }
      record.updatedAt = now;
      result = { id: record.id };
    }
    return { state, result };
  }
  return { execute, counts, available, canReceive, validateLines, unitKey };
});
