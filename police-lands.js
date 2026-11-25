(() => {
  const view = document.getElementById("view-police-lands");
  const get = id => document.getElementById("policeLands" + id);
  const form = get("Form");
  const field = name => form.elements.namedItem(name);
  const initialCenter = [29.4, 76.7];
  const mapFrame = get("MapFrame");
  const fullscreenButton = get("Fullscreen");
  const search = get("Search");
  const markers = new Map();
  const markerStyles = new Map([
    ["Police Station", "station"], ["Chowki", "chowki"], ["Police Lines", "lines"],
    ["Offices", "offices"], ["Other", "other"]
  ]);
  let context;
  let map;
  let pins;
  let draftPin;
  let records = [];
  let submission;
  let selectedId;
  let editing;
  let canManage = false;

  function recordPath(request, record) {
    return request.path + "/" + encodeURIComponent(record.id);
  }

  function openForm(record) {
    if (get("Save").disabled) return;
    closeForm();
    editing = record;
    if (record) {
      for (const name of ["name", "type", "owner", "area", "areaUnit", "latitude", "longitude"]) {
        field(name).value = record[name];
      }
      select(record);
    }
    get("FormTitle").textContent = record ? "Modify land record" : "Add land record";
    get("Save").textContent = record ? "Save Changes" : "Save Land";
    form.classList.remove("hidden");
    field("name").focus();
  }

  async function deleteRecord(record, button) {
    if (get("Save").disabled) return;
    if (!window.confirm("Delete land record “" + record.name + "”?")) return;
    const request = context;
    button.disabled = true;
    try {
      await __api("DELETE", recordPath(request, record), { revision: record.revision ?? 0 });
      if (context !== request) return;
      if (editing?.id === record.id) closeForm();
      if (selectedId === record.id) selectedId = null;
      records = records.filter(entry => entry.id !== record.id);
      renderRecords();
      get("Status").textContent = "Land record deleted.";
    } catch (error) {
      if (context !== request) return;
      get("Status").textContent = error.body?.error || "Could not confirm the deletion. Reopen Police Lands to check the record.";
    } finally {
      button.disabled = false;
    }
  }

  function renderActions(cell, record) {
    const actions = document.createElement("div");
    actions.className = "police-lands-row-actions";
    for (const [label, path, action] of [
      ["Modify", "M12 20h9M16 4l4 4M4 20l4-.8L21 6l-4-4L4 15z", () => openForm(record)],
      ["Delete", "M3 6h18M9 6V3h6v3m4 0-1 15H6L5 6m5 4v7m4-7v7", button => deleteRecord(record, button)]
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.title = label;
      button.setAttribute("aria-label", label + " " + record.name);
      button.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + path + '"/></svg>';
      button.addEventListener("click", () => action(button));
      actions.append(button);
    }
    cell.append(actions);
  }

  function select(record, focusMap = true) {
    selectedId = record.id;
    for (const button of get("List").querySelectorAll(".police-lands-record")) {
      button.setAttribute("aria-current", String(button.dataset.landId === selectedId));
    }
    if (focusMap && map) {
      map.setView([record.latitude, record.longitude], 16);
      markers.get(record.id)?.openPopup();
    }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === mapFrame) await document.exitFullscreen();
      else await mapFrame.requestFullscreen();
    } catch {
      get("Status").textContent = "Fullscreen is unavailable in this browser window.";
    }
  }

  function initializeMap() {
    if (map) return;
    const status = get("MapStatus");
    if (!window.L) {
      status.hidden = false;
      status.textContent = "Map could not load. You can still enter coordinates manually.";
      return;
    }
    map = L.map(get("Map")).setView(initialCenter, 8);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }).on("tileerror", () => {
      status.hidden = false;
      status.textContent = "Some map tiles are unavailable. The land register is still available.";
    }).on("tileloadstart", () => {
      status.hidden = true;
    }).addTo(map);
    pins = L.layerGroup().addTo(map);
    fullscreenButton.hidden = !document.fullscreenEnabled;
    map.on("click", ({ latlng }) => {
      if (form.classList.contains("hidden") || form.querySelector('[type="submit"]').disabled) return;
      field("latitude").value = latlng.lat.toFixed(6);
      field("longitude").value = latlng.wrap().lng.toFixed(6);
      updateDraftPin();
    });
  }

  function renderTable() {
    const body = get("List");
    body.replaceChildren();
    const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let matchCount = 0;
    for (const record of records) {
      const values = [record.name, record.type, record.owner, record.area + " " + record.areaUnit,
        record.latitude + ", " + record.longitude];
      const searchable = values.join(" ").toLowerCase();
      if (!terms.every(term => searchable.includes(term))) continue;
      matchCount++;
      const row = body.insertRow();
      const button = document.createElement("button");
      button.type = "button";
      button.className = "police-lands-record";
      button.textContent = record.name;
      button.dataset.landId = record.id;
      button.setAttribute("aria-current", String(record.id === selectedId));
      button.addEventListener("click", () => select(record));
      row.insertCell().append(button);
      for (const value of values.slice(1)) row.insertCell().textContent = value;
      const actionCell = row.insertCell();
      if (canManage) renderActions(actionCell, record);
    }
    get("Results").textContent = !records.length ? "No land records in this register."
      : matchCount === 0 ? "No land records match your search."
      : matchCount === records.length ? matchCount + " " + (matchCount === 1 ? "record" : "records")
      : matchCount + " of " + records.length + " records";
  }

  function renderRecords() {
    renderTable();
    if (!pins) return;
    pins.clearLayers();
    markers.clear();
    for (const record of records) {
      const style = markerStyles.get(record.type) || "other";
      const icon = L.divIcon({
        className: "police-lands-pin police-lands-pin--" + style,
        iconSize: [22, 26], iconAnchor: [11, 26], popupAnchor: [0, -24]
      });
      const label = record.name + " (" + record.type + ")";
      const marker = L.marker([record.latitude, record.longitude], { icon, title: label });
      const popup = document.createElement("span");
      popup.textContent = label;
      marker.bindPopup(popup).on("popupopen", () => select(record, false)).addTo(pins);
      marker.getElement().setAttribute("aria-label", label);
      markers.set(record.id, marker);
    }
  }

  function updateDraftPin() {
    const latitude = field("latitude").valueAsNumber;
    const longitude = field("longitude").valueAsNumber;
    draftPin?.remove();
    draftPin = null;
    if (map && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      draftPin = L.circleMarker([latitude, longitude], { radius: 9, color: "#dc762b", fillOpacity: 0.75, interactive: false }).addTo(map);
    }
  }

  function setSaving(saving) {
    for (const control of form.elements) control.disabled = saving;
  }

  function closeForm() {
    form.reset();
    form.classList.add("hidden");
    get("FormStatus").textContent = "";
    draftPin?.remove();
    draftPin = null;
    submission = null;
    editing = null;
    setSaving(false);
  }

  async function load(force = false) {
    if (view.classList.contains("hidden") || !currentUser) return;
    if (!activeDistrictId) {
      get("Status").textContent = "Select a district to open the land register.";
      return;
    }
    const key = JSON.stringify([activeDistrictId, currentUser.id, Boolean(developerAccount)]);
    if (!force && context?.key === key) return;
    const request = { key, path: "police-lands/" + encodeURIComponent(activeDistrictId) };
    context = request;
    get("District").textContent = getDistricts().find(district => district.id === activeDistrictId)?.name || "";
    get("Add").classList.add("hidden");
    get("Retry").classList.add("hidden");
    get("Results").textContent = "";
    get("List").replaceChildren();
    selectedId = null;
    canManage = false;
    records = [];
    pins?.clearLayers();
    markers.clear();
    closeForm();
    if (developerAccount) {
      get("Status").textContent = "Return to your signed-in account to use Police Lands.";
      return;
    }
    try {
      initializeMap();
      map?.invalidateSize().setView(initialCenter, 8);
    } catch (error) {
      console.error("Police Lands map initialization failed:", error);
      get("MapStatus").textContent = "Map could not load. You can still enter coordinates manually.";
      get("MapStatus").hidden = false;
    }
    get("Status").textContent = "Loading land records…";
    try {
      const result = await __api("GET", request.path);
      if (context !== request) return;
      records = result.records;
      canManage = result.canAdd;
      renderRecords();
      if (map && records.length) {
        map.fitBounds(records.map(record => [record.latitude, record.longitude]), { padding: [35, 35], maxZoom: 15 });
      }
      get("Add").classList.toggle("hidden", !result.canAdd);
      get("Status").textContent = "";
    } catch (error) {
      if (context !== request) return;
      get("Status").textContent = error.body?.error || "Could not load land records.";
      get("Retry").classList.remove("hidden");
    }
  }

  get("Retry").addEventListener("click", () => load(true));
  search.addEventListener("input", renderTable);
  fullscreenButton.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", () => {
    const action = document.fullscreenElement === mapFrame ? "Exit fullscreen (F)" : "Enter fullscreen (F)";
    fullscreenButton.title = action;
    fullscreenButton.setAttribute("aria-label", action);
    requestAnimationFrame(() => map?.invalidateSize({ pan: false }));
  });
  document.addEventListener("keydown", event => {
    if (event.key.toLowerCase() !== "f" || event.repeat || event.defaultPrevented ||
        event.ctrlKey || event.altKey || event.metaKey || fullscreenButton.hidden ||
        view.classList.contains("hidden") || document.querySelector(".modal-backdrop:not(.hidden)") ||
        event.target.closest?.("input, select, textarea, [contenteditable]")) return;
    event.preventDefault();
    toggleFullscreen();
  });
  get("Add").addEventListener("click", () => openForm());
  get("Cancel").addEventListener("click", () => {
    closeForm();
    get("Add").focus();
  });
  for (const name of ["latitude", "longitude"]) {
    field(name).addEventListener("input", updateDraftPin);
    field(name).addEventListener("change", () => {
      if (draftPin) map.setView(draftPin.getLatLng(), 15);
    });
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const request = context;
    const target = editing;
    const payload = Object.fromEntries(new FormData(form));
    for (const name of ["latitude", "longitude", "area"]) payload[name] = field(name).valueAsNumber;
    if (payload.area <= 0) {
      get("FormStatus").textContent = "Area must be greater than zero.";
      field("area").focus();
      return;
    }
    const fingerprint = JSON.stringify(payload);
    if (!target && submission?.fingerprint !== fingerprint) {
      submission = { fingerprint, id: globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) };
    }
    setSaving(true);
    get("FormStatus").textContent = "Saving land record…";
    try {
      const { record } = target
        ? await __api("PUT", recordPath(request, target), { ...payload, revision: target.revision ?? 0 })
        : await __api("POST", request.path, { ...payload, id: submission.id });
      if (context !== request) return;
      records = target ? records.map(entry => entry.id === record.id ? record : entry)
        : [record, ...records.filter(entry => entry.id !== record.id)];
      closeForm();
      renderRecords();
      select(record);
      get("Status").textContent = target ? "Land record updated." : "Land record saved.";
      get("Add").focus();
    } catch (error) {
      if (context !== request) return;
      get("FormStatus").textContent = error.body?.error || "Could not confirm the save. Retry to check the same submission.";
    } finally {
      if (context === request) setSaving(false);
    }
  });
  window.renderPoliceLands = load;
  load();
})();
