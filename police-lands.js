(() => {
  const view = document.getElementById("view-police-lands");
  const get = id => document.getElementById("policeLands" + id);
  const form = get("Form");
  const field = name => form.elements.namedItem(name);
  const initialCenter = [29.4, 76.7];
  let context;
  let map;
  let pins;
  let draftPin;
  let records = [];
  let submission;

  function select(record, focusMap = true) {
    const details = document.createElement("dl");
    for (const [label, value] of [
      ["Land name", record.name], ["Property type", record.type], ["Owner", record.owner],
      ["Area", record.area + " " + record.areaUnit],
      ["Coordinates", record.latitude + ", " + record.longitude]
    ]) {
      const term = document.createElement("dt");
      const definition = document.createElement("dd");
      term.textContent = label;
      definition.textContent = value;
      details.append(term, definition);
    }
    get("Details").replaceChildren(details);
    if (focusMap && map) map.setView([record.latitude, record.longitude], 16);
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
    map.on("click", ({ latlng }) => {
      if (form.classList.contains("hidden") || form.querySelector('[type="submit"]').disabled) return;
      field("latitude").value = latlng.lat.toFixed(6);
      field("longitude").value = latlng.wrap().lng.toFixed(6);
      updateDraftPin();
    });
  }

  function renderRecords() {
    const list = get("List");
    list.replaceChildren();
    pins?.clearLayers();
    for (const record of records) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "police-lands-record";
      const title = document.createElement("strong");
      title.textContent = record.name;
      const subtitle = document.createElement("span");
      subtitle.textContent = record.type + " · " + record.area + " " + record.areaUnit;
      button.append(title, subtitle);
      button.addEventListener("click", () => select(record));
      list.append(button);
      if (pins) {
        const marker = L.marker([record.latitude, record.longitude], { title: record.name, alt: record.name });
        const popup = document.createElement("span");
        popup.textContent = record.name;
        marker.bindPopup(popup).on("popupopen", () => select(record, false)).addTo(pins);
      }
    }
    if (!records.length) list.textContent = "No land records in this register.";
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
    get("Details").replaceChildren();
    get("List").replaceChildren();
    records = [];
    pins?.clearLayers();
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
  get("Add").addEventListener("click", () => {
    form.classList.remove("hidden");
    field("name").focus();
  });
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
    const payload = Object.fromEntries(new FormData(form));
    for (const name of ["latitude", "longitude", "area"]) payload[name] = field(name).valueAsNumber;
    if (payload.area <= 0) {
      get("FormStatus").textContent = "Area must be greater than zero.";
      field("area").focus();
      return;
    }
    const fingerprint = JSON.stringify(payload);
    if (submission?.fingerprint !== fingerprint) {
      submission = { fingerprint, id: globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) };
    }
    setSaving(true);
    get("FormStatus").textContent = "Saving land record…";
    try {
      const { record } = await __api("POST", request.path, { ...payload, id: submission.id });
      if (context !== request) return;
      records = [record, ...records.filter(entry => entry.id !== record.id)];
      closeForm();
      renderRecords();
      select(record);
      get("Status").textContent = "Land record saved.";
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
