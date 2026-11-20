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
  function remaining(line) {
    return Math.max(0, (Number(line.qty) || 0) - (line.approvedQty || 0) - (line.rejectedQty || 0) - (line.cancelledQty || 0));
  }
  function active(record) {
    return !record.closed && !record.isConsumable && ["pending", "partially_completed"].includes(record.status);
  }
  function reserved(state, district, item, condition, exceptId) {
    let total = 0;
    for (const record of list(state, "distributions_" + district)) {
      if (!active(record) || record.id === exceptId) continue;
      for (const line of record.items || []) {
        const matches = line.fromItemId ? line.fromItemId === item.id :
          nameKey(line.itemName) === nameKey(item.name) && (!line.categoryId || line.categoryId === item.categoryId) &&
          (line.fromLocationId || record.fromLocationId) === item.locationId;
        if (matches && (!condition ? line.condition !== "damaged" : line.condition === condition)) total += remaining(line);
      }
    }
    return total;
  }
  function validateReservations(state, previous = {}) {
    for (const [district, items] of Object.entries(state[prefix + "items"] || {})) {
      for (const item of items) {
        const before = districtList(previous, "items", district).find(row => row.id === item.id);
        if (item.isDeleted) {
          if (conditions.some(condition => reserved(state, district, item, condition) > 0)) fail("Cancel pending distributions before deleting their source stock.");
          continue;
        }
        if (before && ["quantity", "conditionCounts", "allotted", "lostReturned", "damagedReturned"].every(field => JSON.stringify(item[field]) === JSON.stringify(before[field])) &&
          conditions.every(condition => reserved(state, district, item, condition) === reserved(previous, district, before, condition))) continue;
        const stock = counts(item);
        const previousCounts = before ? counts(before) : { good: 0, poor: 0, damaged: 0 };
        for (const condition of conditions) {
          const deficit = reserved(state, district, item, condition) - stock[condition];
          const oldDeficit = before ? reserved(previous, district, before, condition) - previousCounts[condition] : 0;
          if (deficit > Math.max(0, oldDeficit)) fail(`Pending distributions already reserve the ${condition} stock of "${item.name}".`);
        }
        const deficit = reserved(state, district, item) - available(item);
        const oldDeficit = before ? reserved(previous, district, before) - available(before) : 0;
        if (deficit > Math.max(0, oldDeficit)) fail(`Insufficient unreserved stock for "${item.name}". Edit or cancel an existing pending distribution first.`);
      }
    }
    for (const [district, items] of Object.entries(previous[prefix + "items"] || {})) {
      for (const item of items) {
        if (!districtList(state, "items", district).some(row => row.id === item.id) &&
          conditions.some(condition => reserved(state, district, item, condition) > 0)) fail("Cancel pending distributions before removing their source stock.");
      }
    }
  }
  function canReceive(user, record, state) {
    if (!user || !active(record) || !(record.items || []).some(line => remaining(line) > 0)) return false;
    if (user.role === "devadmin") return true;
    if (!scope(user, record.toDistrictId)) return false;
    if (record.toType === "admin") return user.role === "admin" && user.districtId === record.toDistrictId;
    const namedRecipient = list(state, "users").find(account => account.id === record.toUserId && account.active !== false &&
      account.districtId === record.toDistrictId && account.locationId === record.toLocationId);
    if (namedRecipient) return user.id === namedRecipient.id;
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
      for (const condition of conditions) {
        if (need[condition] > stock[condition] - reserved(state, record.fromDistrictId, need.source, condition, record.id)) fail(`Insufficient unreserved ${condition} stock for "${need.source.name}".`);
      }
      if (need.good + need.poor > available(need.source) - reserved(state, record.fromDistrictId, need.source, null, record.id)) fail(`Insufficient available stock for "${need.source.name}". Issued, lost, scrap and other reserved units cannot be distributed.`);
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
  function transfer(state, record, user, now, id, lines) {
    validateLines(state, { ...record, items: lines });
    const location = districtList(state, "locations", record.toDistrictId).find(row => row.id === record.toLocationId);
    if (!location) fail("The receiving location no longer exists.");
    const map = state[prefix + "items"] ||= {};
    const target = map[record.toDistrictId] ||= [];
    for (const line of lines) {
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
      if (!Number.isSafeInteger(destination.quantity)) fail("The receiving stock quantity is too large.");
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
    const movements = record.items.flatMap(line => line.transfers?.length ? line.transfers.map(movement => ({ ...line, ...movement })) :
      [{ ...line, qty: line.approvedQty ?? line.qty }]).filter(line => line.qty > 0);
    for (const line of movements) {
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
  function prepareLines(state, user, districtId, locationId, input, now, id) {
    return input.map(line => {
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
  }
  function create(state, user, command, now, id) {
    const districtId = command.districtId;
    const sender = user.role === "devadmin" && command.actingUserId
      ? list(state, "users").find(account => account.id === command.actingUserId && account.active !== false && account.districtId === districtId) : user;
    if (!sender) fail("The selected account no longer belongs to this district.");
    if (!scope(user, districtId)) fail("You cannot distribute stock from this district.", 403);
    const locationId = command.fromLocationId || user.locationId;
    const locations = districtList(state, "locations", districtId);
    if (!locations.some(row => row.id === locationId) || !ownsSource(user, districtId, locationId)) fail("Select an authorised source location.", 403);
    if (!command.targets?.length || !command.items?.length) fail("Select recipients and at least one item.");
    const district = list(state, "districts").find(row => row.id === districtId);
    if (!district) fail("The sender district no longer exists.");
    const targetKeys = new Set();
    const lines = prepareLines(state, user, districtId, locationId, command.items, now, id);
    const records = state[prefix + "distributions_" + districtId] ||= [];
    const created = [];
    for (const target of command.targets) {
      const targetDistrict = list(state, "districts").find(row => row.id === target.districtId);
      const location = districtList(state, "locations", target.districtId).find(row => row.id === target.locationId);
      if (!targetDistrict || !location || !["unit", "admin"].includes(target.type)) fail("Select an existing receiving unit.");
      if (target.type === "unit" && target.districtId !== districtId) fail("Cross-district stock must be sent to the receiving District Admin.");
      if (target.type === "admin" && target.districtId !== districtId && !["devadmin", "ig", "admin"].includes(user.role)) fail("Only administrators may distribute to other districts.", 403);
      if (target.type === "unit" && location.type === "district") fail("Select District Admin for the district headquarters.");
      if (target.type === "admin") {
        const adminLocation = list(state, "users").some(account => account.active !== false && account.role === "admin" &&
          account.districtId === target.districtId && account.locationId === location.id);
        if (!adminLocation && !["district", "otherHq"].includes(location.type)) fail("Select the configured District Admin headquarters.");
      }
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
        fromLocationName: locations.find(row => row.id === locationId).name, fromUserId: sender.id, fromUserName: sender.name || sender.username,
        toType: target.type, toDistrictId: target.districtId, toDistrictName: targetDistrict.name,
        toLocationId: location.id, toLocationName: location.name, toName: target.type === "admin" ? targetDistrict.name + " (Admin)" : location.name,
        toUserId: receiver?.id || null, toUserName: receiver?.name || "", items: structuredClone(lines),
        attachments: structuredClone(command.attachments || []), status: "pending", approveRemark: "", rejectRemark: "",
        approvedBy: "", approvedAt: null, rejectedBy: "", rejectedAt: null, createdAt: now, updatedAt: null, revision: 0 };
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
    else if (command.action === "clear") {
      if (user.role !== "devadmin") fail("Only Developer Admin may clear distributions.", 403);
      const records = list(state, "distributions_" + command.districtId);
      const ids = [];
      for (const record of records) {
        if (record.isConsumable) continue;
        if (record.transferred) reverse(state, record, user, now, id);
        else if (record.status === "completed") fail("A completed legacy distribution has no confirmed transfer to reverse.");
        ids.push(record.id);
      }
      state[prefix + "distributions_" + command.districtId] = records.filter(record => record.isConsumable);
      result = { ids };
    }
    else {
      const records = list(state, "distributions_" + command.storeId);
      const record = records.find(row => row.id === command.id);
      if (!record) fail("Distribution record not found.", 404);
      if (record.isConsumable) fail("Manage this distribution through its consumable ledger.");
      if (record.fromDistrictId !== command.storeId) fail("The distribution store does not match its sender.");
      if (command.expectedRevision !== undefined && command.expectedRevision !== (record.revision || 0)) fail("This distribution changed. Open it again.", 409);
      if (command.expectedUpdatedAt !== undefined && command.expectedUpdatedAt !== (record.updatedAt || record.createdAt)) fail("This distribution changed. Open it again.", 409);
      if (["amend", "cancel"].includes(command.action)) {
        if (!active(record) || (user.role !== "devadmin" && user.id !== record.fromUserId)) fail("Only the sender can edit or cancel an active pending distribution.", 403);
        if (command.action === "cancel") {
          for (const line of record.items) line.cancelledQty = (line.cancelledQty || 0) + remaining(line);
          record.status = "cancelled";
          record.closed = true;
          record.cancelledBy = user.name || user.username;
          record.cancelledAt = now;
        } else {
          if (!Array.isArray(command.items) || !command.items.length) fail("Keep at least one pending item, or cancel the request.");
          const requested = prepareLines(state, user, record.fromDistrictId, record.fromLocationId, command.items, now, id);
          const retained = record.items.filter(line => (line.approvedQty || 0) > 0).map(line => ({ ...line, qty: line.approvedQty }));
          for (const line of requested) {
            const previous = retained.find(row => row.fromItemId === line.fromItemId && row.condition === line.condition);
            if (previous) previous.qty += line.qty;
            else retained.push({ ...line, approvedQty: 0 });
          }
          record.items = retained;
          record.remarks = String(command.remarks || "");
          if (Array.isArray(command.attachments)) record.attachments = structuredClone(command.attachments);
        }
      } else if (["approve", "reject"].includes(command.action)) {
        if (!canReceive(user, record, state)) fail("Only the authorised recipient can decide a pending distribution.", 403);
        if (command.action === "approve") {
          const selected = command.approvals || record.items.map((line, index) => ({ key: line.key || String(index), qty: remaining(line) }));
          if (!Array.isArray(selected) || !selected.length) fail("Enter at least one receiving quantity.");
          const seen = new Set();
          const lines = [];
          for (const selection of selected) {
            const originalLine = record.items.find((line, index) => (line.key || String(index)) === selection.key);
            if (!originalLine || seen.has(selection.key) || !Number.isSafeInteger(selection.qty) || selection.qty < 0 || selection.qty > remaining(originalLine)) fail("Receiving quantities must be whole numbers within the pending quantities.");
            seen.add(selection.key);
            if (selection.qty) lines.push({ ...originalLine, key: originalLine.key || selection.key, qty: selection.qty });
          }
          if (!lines.length) fail("Enter at least one receiving quantity above zero.");
          transfer(state, record, user, now, id, lines);
          for (const movement of lines) {
            const originalLine = record.items.find((line, index) => (line.key || String(index)) === movement.key);
            originalLine.key = movement.key;
            originalLine.approvedQty = (originalLine.approvedQty || 0) + movement.qty;
            originalLine.toItemId = movement.toItemId;
            (originalLine.transfers ||= []).push({ fromItemId: movement.fromItemId, toItemId: movement.toItemId,
              qty: movement.qty, condition: movement.condition, at: now });
          }
          record.status = record.items.some(line => remaining(line) > 0) ? "partially_completed" : "completed";
          record.transferred = true;
          record.approveRemark = String(command.remark || ""); record.approvedBy = user.name || user.username; record.approvedAt = now;
        } else { if (!String(command.remark || "").trim()) fail("Rejection remark is required.");
          for (const line of record.items) line.rejectedQty = (line.rejectedQty || 0) + remaining(line);
          record.closed = true;
          record.status = record.transferred ? "partially_completed" : "rejected"; record.rejectRemark = String(command.remark).trim(); record.rejectedBy = user.name || user.username; record.rejectedAt = now;
        }
      } else {
        if (user.role !== "devadmin") fail("Only Developer Admin may edit or delete distributions.", 403);
        if (command.action === "delete") {
          if (record.transferred) reverse(state, record, user, now, id);
          else if (record.status === "completed") fail("This completed legacy distribution has no confirmed transfer to reverse.");
          records.splice(records.indexOf(record), 1);
        } else if (command.action === "edit") record.remarks = String(command.remark || "");
        else fail("Unknown distribution action.");
      }
      record.updatedAt = now;
      record.revision = (record.revision || 0) + 1;
      result = { id: record.id };
    }
    validateReservations(state, original);
    return { state, result };
  }
  return { execute, counts, available, remaining, reserved, active, validateReservations, canReceive, validateLines, unitKey };
});
