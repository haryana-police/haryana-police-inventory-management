(() => {
  const el = id => document.getElementById(id);
  const form = el('grievanceForm');
  const formHome = form.parentElement;
  const status = el('grievanceStatus');
  const detail = el('grievanceDetail');
  const rows = el('grievanceRows');
  let records = [];
  let resolving = null;
  let loading = false;
  let busy = false;
  let accountId;
  let previewUrl;
  let expandedId;

  const textFields = [el('grievanceBrief'), el('grievanceDescription')];
  function resizeField(field) {
    if (!field.offsetWidth) return;
    field.style.height = 'auto';
    const borders = field.offsetHeight - field.clientHeight;
    field.style.height = (field.scrollHeight + borders) + 'px';
  }
  textFields.forEach(field => field.addEventListener('input', () => resizeField(field)));
  window.addEventListener('resize', () => textFields.forEach(resizeField));

  function resetDetail() {
    expandedId = null;
    const detailRow = detail.closest('tr');
    if (detailRow) detailRow.remove();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    detail.replaceChildren();
    detail.classList.add('hidden');
  }

  function button(label, click, variant = 'btn-outline') {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'btn btn-sm ' + variant;
    control.textContent = label;
    control.addEventListener('click', click);
    return control;
  }

  function closeForm() {
    const formRow = form.closest('tr');
    form.classList.add('hidden');
    if (formRow) {
      formHome.insertBefore(form, status.nextSibling);
      formRow.remove();
    }
    resolving = null;
  }

  function start(record, row) {
    if (busy) return;
    resetDetail();
    closeForm();
    resolving = record?.id || null;
    if (row) {
      const formRow = rows.insertRow(row.sectionRowIndex + 1);
      const cell = formRow.insertCell();
      cell.colSpan = row.cells.length;
      cell.append(form);
    }
    form.reset();
    el('grievanceBriefGroup').classList.toggle('hidden', !!record);
    el('grievanceBrief').required = !record;
    el('grievanceFormTitle').textContent = record ? 'Resolve: ' + record.brief : 'Raise Grievance';
    form.classList.remove('hidden');
    textFields.forEach(resizeField);
    el(record ? 'grievanceDescription' : 'grievanceBrief').focus();
  }

  function errorText(error) {
    return error.body?.error || 'Grievance request failed. Please try again.';
  }

  function show(record, row) {
    if (busy) return;
    closeForm();
    const wasOpen = expandedId === record.id;
    resetDetail();
    if (wasOpen) return;
    expandedId = record.id;
    const detailRow = rows.insertRow(row.sectionRowIndex + 1);
    const cell = detailRow.insertCell();
    cell.colSpan = row.cells.length;
    cell.append(detail);
    const heading = document.createElement('h2');
    heading.textContent = record.brief;
    detail.append(heading);
    function section(label, text, upload, endpoint) {
      const title = document.createElement('h3');
      title.textContent = label;
      const body = document.createElement('p');
      body.style.whiteSpace = 'pre-wrap';
      body.textContent = text;
      detail.append(title, body);
      if (upload) {
        const preview = document.createElement('div');
        detail.append(button('Open ' + upload.name, async () => {
          try {
            const file = await __api('GET', 'grievances/' + record.id + '/' + endpoint);
            if (!preview.isConnected) return;
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            detail.querySelectorAll('img, video').forEach(node => node.remove());
            const bytes = Uint8Array.from(atob(file.data), char => char.charCodeAt(0));
            previewUrl = URL.createObjectURL(new Blob([bytes], { type: file.type }));
            const player = document.createElement(file.type.startsWith('video/') ? 'video' : 'img');
            player.controls = true;
            player.alt = upload.name;
            player.style.maxWidth = '100%';
            player.style.maxHeight = '420px';
            player.src = previewUrl;
            preview.replaceChildren(player);
          } catch (error) { status.textContent = errorText(error); }
        }), preview);
      }
    }
    section('Description', record.description, record.upload, 'upload');
    if (record.resolution) section('Resolution', record.resolution.description, record.resolution.upload, 'resolution-upload');
    detail.classList.remove('hidden');
  }

  window.loadGrievances = async function (manual = false) {
    const id = currentUser?.id;
    if (accountId !== id) {
      accountId = id;
      records = [];
      rows.replaceChildren();
      resetDetail();
      form.reset();
      closeForm();
      status.textContent = '';
    }
    if (!id || loading) return;
    loading = true;
    try {
      const result = await __api('GET', 'grievances');
      if (currentUser?.id !== id) return;
      records = result.records;
      const previousDetail = expandedId;
      const existingDetail = detail.closest('tr');
      const existingForm = form.closest('tr');
      rows.replaceChildren();
      for (const record of records) {
        const row = rows.insertRow();
        for (const value of [record.brief, record.raisedBy.name, new Date(record.createdAt).toLocaleString()]) {
          row.insertCell().textContent = value;
        }
        const statusCell = row.insertCell();
        statusCell.textContent = record.status;
        statusCell.dataset.grievanceStatus = record.status;
        const actions = row.insertCell();
        actions.append(button('View', () => show(record, row)));
        if (result.reviewer && record.status === 'Pending') actions.append(button('Resolve', () => start(record, row), 'btn-danger'));
        if (record.id === previousDetail && existingDetail) row.after(existingDetail);
        if (record.id === resolving && existingForm) row.after(existingForm);
      }
      if (previousDetail && !existingDetail?.isConnected) resetDetail();
      if (existingForm && !existingForm.isConnected) closeForm();
      if (!records.length) {
        const cell = rows.insertRow().insertCell();
        cell.colSpan = 5;
        cell.textContent = 'No grievances yet.';
      }
    } catch (error) { if (manual) status.textContent = errorText(error); }
    finally { loading = false; }
  };

  el('grievanceRaise').onclick = () => start();
  el('grievanceRefresh').onclick = () => window.loadGrievances(true);
  el('grievanceCancel').onclick = () => { if (!busy) closeForm(); };
  form.onsubmit = async event => {
    event.preventDefault();
    if (busy) return;
    const submit = form.querySelector('[type=submit]');
    submit.disabled = busy = true;
    status.textContent = 'Submitting…';
    try {
      const file = el('grievanceUpload').files[0];
      if (file?.size > 12 * 1024 * 1024) throw { body: { error: 'Choose a file up to 12 MB.' } };
      const description = el('grievanceDescription').value.trim();
      const brief = el('grievanceBrief').value.trim();
      const data = file && await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await __api('POST', resolving ? 'grievances/' + resolving + '/resolve' : 'grievances', {
        brief, description, upload: file ? { name: file.name, type: file.type, data } : null,
      });
      form.reset();
      status.textContent = resolving ? 'Grievance completed.' : result.notified ? 'Grievance submitted.' : 'Grievance submitted. Notification delivery failed.';
      closeForm();
      await window.loadGrievances(true);
    } catch (error) { status.textContent = errorText(error); }
    finally { submit.disabled = busy = false; }
  };
  setInterval(() => {
    if (window.currentTab === 'grievances') window.loadGrievances();
  }, 8000);
})();
