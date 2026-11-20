/* Shared consumable balances for the browser and state API. */
(function (root) {
  "use strict";

  const empty = () => ({ total: 0, pending: 0, distributed: 0, lost: 0 });
  const quantity = txn => Math.max(0, Math.floor(Number(txn.qty) || 0));
  const available = balance => balance.total - balance.pending - balance.distributed - balance.lost;

  function stockKey(user, locations) {
    if (!user) return "";
    return user.locationId && locations.some(location => location.id === user.locationId)
      ? "unit:" + user.locationId : "staff:" + user.id;
  }

  function district(transactions, itemId, centralOnly = false) {
    const balance = empty();
    const directStock = new Map();
    const requests = new Map();
    const itemTransactions = transactions.filter(txn => txn?.itemId === itemId);
    itemTransactions.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const directAt = location => directStock.get(location) || 0;
    for (const txn of itemTransactions) {
      const qty = quantity(txn);
      const location = txn.stockLocation;
      if (txn.type === "ADD") {
        if (!localOutsideReport(location)) balance.total += qty;
        if (location) directStock.set(location, directAt(location) + qty);
      } else if (txn.type === "DISTRIBUTION_REQUEST") {
        // Only stock not already allocated to a recipient can enter district
        // Pending. An onward request on previously distributed stock is local.
        const reserved = location ? Math.min(qty, directAt(location)) : qty;
        requests.set(txn.id, { location, reserved });
        if (location) directStock.set(location, directAt(location) - reserved);
        if (!localOutsideReport(location)) balance.pending += reserved;
      } else if (txn.type === "DISTRIBUTION_APPROVED" || txn.type === "DISTRIBUTION_REJECTED") {
        const request = requests.get(txn.requestId);
        // Historical ledgers may contain decisions without a surviving request.
        const origin = request?.location ?? location;
        const reserved = request?.reserved ?? (origin ? 0 : qty);
        if (!localOutsideReport(origin)) {
          balance.pending -= reserved;
          if (txn.type === "DISTRIBUTION_APPROVED") balance.distributed += reserved;
        }
        if (origin && txn.type === "DISTRIBUTION_REJECTED") {
          directStock.set(origin, directAt(origin) + reserved);
        }
      } else if (txn.type === "LOSS" && !localOutsideReport(location)) {
        if (location) {
          const directLoss = Math.min(qty, directAt(location));
          directStock.set(location, directAt(location) - directLoss);
          balance.distributed -= Math.min(qty - directLoss, Math.max(0, balance.distributed));
        }
        balance.lost += qty;
      }
    }
    return balance;

    function localOutsideReport(location) {
      return centralOnly && Boolean(location);
    }
  }

  function atLocation(transactions, itemId, location, users, locations) {
    const balance = empty();
    const decisions = new Map();
    const requests = new Map();
    const userById = new Map(users.map(user => [String(user.id), user]));
    const contains = key => {
      if (key === location) return true;
      if (!location.startsWith("unit:") || !key.startsWith("staff:")) return false;
      return stockKey(userById.get(key.slice(6)), locations) === location;
    };
    for (const txn of transactions) {
      if (txn?.itemId !== itemId) continue;
      if (txn.type === "DISTRIBUTION_REQUEST") requests.set(txn.id, txn);
      else if (txn.type === "DISTRIBUTION_APPROVED" || txn.type === "DISTRIBUTION_REJECTED") {
        decisions.set(txn.requestId, txn);
      } else {
        const actor = userById.get(String(txn.byId));
        // An old intake did not record a stock location. Keep it in the
        // district store rather than making the same quantity available twice.
        const origin = txn.stockLocation ?? (txn.type === "ADD" || actor?.role === "admin" ||
          actor?.role === "devadmin" ? "" : stockKey(actor, locations));
        if (!contains(origin)) continue;
        if (txn.type === "ADD") balance.total += quantity(txn);
        if (txn.type === "LOSS") balance.lost += quantity(txn);
      }
    }
    for (const request of requests.values()) {
      const target = request.toType + ":" + request.toId;
      const actor = userById.get(String(request.byId));
      const origin = request.stockLocation ?? (actor?.role === "admin" || actor?.role === "devadmin" ? "" : stockKey(actor, locations));
      const startsHere = contains(origin);
      const endsHere = contains(target);
      // An issue recorded by a unit to its own staff or unit consumes shared
      // stock once. The individual staff receipt is still visible separately.
      const ownIssue = startsHere && request.stockLocation !== undefined;
      const decision = decisions.get(request.id);
      if (decision?.type === "DISTRIBUTION_APPROVED") {
        if (endsHere && !ownIssue) balance.total += quantity(request);
        if (startsHere && (ownIssue || target !== origin)) {
          balance.distributed += quantity(request);
        }
      } else if (!decision && startsHere && (ownIssue || target !== origin)) balance.pending += quantity(request);
    }
    return balance;
  }

  const ledger = { available, atLocation, district, stockKey };
  if (typeof module === "object" && module.exports) module.exports = ledger;
  else root.ConsumableLedger = ledger;
})(globalThis);
