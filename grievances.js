(() => {
  'use strict';

  const el = id => document.getElementById(id);
  const rows = el('grievanceRows');
  const searchInput = el('grievanceSearch');
  const statusFilter = el('grievanceStatusFilter');
  const categoryFilter = el('grievanceCategoryFilter');
  const pagerContainer = el('pager_grievances');

  // Modals
  const grievanceModal = el('grievanceModal');
  const grievanceModalForm = el('grievanceModalForm');
  const grievanceModalTitle = el('grievanceModalTitle');
  const grievanceCategorySelect = el('grievanceCategorySelect');
  const grievanceBriefInput = el('grievanceBriefInput');
  const grievanceDescInput = el('grievanceDescInput');
  const grievanceFileInput = el('grievanceFileInput');
  const grievanceModalStatus = el('grievanceModalStatus');
  const grievanceModalSubmitBtn = el('grievanceModalSubmitBtn');

  // Detail Modal
  const detailModal = el('grievanceDetailModal');
  const detailTitle = el('grievanceDetailTitle');
  const detailStatusBadge = el('grievanceDetailStatusBadge');
  const detailRaisedBy = el('grievanceDetailRaisedBy');
  const detailCategory = el('grievanceDetailCategory');
  const detailDate = el('grievanceDetailDate');
  const detailId = el('grievanceDetailId');
  const detailDesc = el('grievanceDetailDesc');
  const detailAttachmentsSection = el('grievanceDetailAttachmentsSection');
  const detailAttachmentsList = el('grievanceDetailAttachmentsList');
  const detailMediaPreview = el('grievanceDetailMediaPreview');
  const detailTimeline = el('grievanceDetailTimeline');
  const actionButtons = el('grievanceActionButtons');
  const actionForm = el('grievanceActionForm');
  const actionRemarkLabel = el('grievanceActionRemarkLabel');
  const actionRemark = el('grievanceActionRemark');
  const actionFile = el('grievanceActionFile');
  const actionCancelBtn = el('grievanceActionCancelBtn');
  const actionSubmitBtn = el('grievanceActionSubmitBtn');

  let allRecords = [];
  let isReviewer = false;
  let activeGrievanceId = null;
  let editingRecordId = null;
  let activeAction = null;
  let loading = false;
  let busy = false;
  let currentPage = 0;
  let pageSize = 10;
  let blobUrls = new Map();

  function showToast(msg, type = 'info') {
    if (typeof window.toast === 'function') {
      window.toast(msg, type);
    } else {
      console.log(`[${type}] ${msg}`);
    }
  }

  function formatDateTime(timestamp) {
    if (!timestamp) return '—';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function getStatusBadge(status) {
    const s = String(status || 'Pending');
    let colorClass = 'status-grievance-pending';
    if (s === 'In Progress') colorClass = 'status-grievance-progress';
    else if (s === 'Need Clarification') colorClass = 'status-grievance-clarify';
    else if (s === 'Resolved' || s === 'Complete') colorClass = 'status-grievance-resolved';
    else if (s === 'Rejected') colorClass = 'status-grievance-rejected';
    else if (s === 'Reopened') colorClass = 'status-grievance-reopened';
    else if (s === 'Withdrawn') colorClass = 'status-grievance-withdrawn';
    return `<span class="status-badge ${colorClass}">${s}</span>`;
  }

  function cleanupBlobUrls() {
    blobUrls.forEach(url => URL.revokeObjectURL(url));
    blobUrls.clear();
  }

  function updateStats() {
    let total = allRecords.length;
    let pending = 0;
    let inProgress = 0;
    let resolved = 0;
    let clarify = 0;

    allRecords.forEach(r => {
      const s = r.status;
      if (s === 'Pending' || s === 'Reopened') pending++;
      else if (s === 'In Progress') inProgress++;
      else if (s === 'Resolved' || s === 'Complete') resolved++;
      else if (s === 'Need Clarification') clarify++;
    });

    if (el('statTotalGrievances')) el('statTotalGrievances').textContent = total;
    if (el('statPendingGrievances')) el('statPendingGrievances').textContent = pending;
    if (el('statInProgressGrievances')) el('statInProgressGrievances').textContent = inProgress;
    if (el('statResolvedGrievances')) el('statResolvedGrievances').textContent = resolved;
    if (el('statClarifyGrievances')) el('statClarifyGrievances').textContent = clarify;
  }

  function filterRecords() {
    const query = (searchInput?.value || '').toLowerCase().trim();
    const st = statusFilter?.value || 'all';
    const cat = categoryFilter?.value || 'all';

    return allRecords.filter(r => {
      if (st !== 'all') {
        if (st === 'Resolved') {
          if (r.status !== 'Resolved' && r.status !== 'Complete') return false;
        } else if (r.status !== st) {
          return false;
        }
      }
      if (cat !== 'all' && (r.category || 'Technical / Bug') !== cat) {
        return false;
      }
      if (query) {
        const text = [
          r.brief,
          r.description,
          r.category,
          r.raisedBy?.name,
          r.raisedBy?.username,
          r.id
        ].filter(Boolean).join(' ').toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }

  function renderTable() {
    if (!rows) return;
    const filtered = filterRecords();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage >= totalPages) currentPage = Math.max(0, totalPages - 1);

    const startIdx = currentPage * pageSize;
    const pageRecords = filtered.slice(startIdx, startIdx + pageSize);

    rows.replaceChildren();

    if (!pageRecords.length) {
      const tr = rows.insertRow();
      const td = tr.insertCell();
      td.colSpan = 6;
      td.style.textAlign = 'center';
      td.style.padding = '36px 16px';
      td.style.color = 'var(--text-muted)';
      td.innerHTML = `
        <div style="font-size:15px;font-weight:500;">No grievances found</div>
        <div style="font-size:13px;margin-top:4px;">No grievance reports match your current filter criteria.</div>
      `;
      renderPager(total, totalPages);
      return;
    }

    pageRecords.forEach(record => {
      const tr = rows.insertRow();
      tr.dataset.grievanceId = record.id;

      // Brief
      const tdBrief = tr.insertCell();
      tdBrief.style.fontWeight = '500';
      tdBrief.innerHTML = `
        <div style="cursor:pointer;color:var(--primary,#2563eb);" class="grievance-brief-link" title="Click to view details">${escapeHtml(record.brief)}</div>
        <div style="font-size:11px;color:var(--text-muted);font-family:monospace;margin-top:2px;">ID: ${record.id.slice(0, 8)}...</div>
      `;
      tdBrief.querySelector('.grievance-brief-link').addEventListener('click', () => openDetail(record.id));

      // Category
      const tdCat = tr.insertCell();
      tdCat.textContent = record.category || 'Technical / Bug';
      tdCat.style.fontSize = '13px';

      // Raised By
      const tdAuthor = tr.insertCell();
      const authorName = record.raisedBy?.name || record.raisedBy?.username || 'Unknown';
      const authorRole = record.raisedBy?.role ? ` (${record.raisedBy.role})` : '';
      tdAuthor.innerHTML = `<div>${escapeHtml(authorName)}</div><div style="font-size:11px;color:var(--text-muted);">${escapeHtml(authorRole)}</div>`;

      // Date
      const tdDate = tr.insertCell();
      tdDate.style.fontSize = '12px';
      tdDate.style.whiteSpace = 'nowrap';
      tdDate.textContent = formatDateTime(record.createdAt);

      // Status
      const tdStatus = tr.insertCell();
      tdStatus.innerHTML = getStatusBadge(record.status);

      // Actions
      const tdActions = tr.insertCell();
      tdActions.style.textAlign = 'right';
      tdActions.style.whiteSpace = 'nowrap';

      const viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'btn btn-sm btn-outline';
      viewBtn.textContent = 'View';
      viewBtn.addEventListener('click', () => openDetail(record.id));
      tdActions.append(viewBtn);

      // Quick action button if reviewer and pending
      if (isReviewer && ['Pending', 'In Progress', 'Need Clarification', 'Reopened'].includes(record.status)) {
        const resolveBtn = document.createElement('button');
        resolveBtn.type = 'button';
        resolveBtn.className = 'btn btn-sm btn-primary';
        resolveBtn.style.marginLeft = '6px';
        resolveBtn.textContent = 'Action';
        resolveBtn.addEventListener('click', () => {
          openDetail(record.id);
        });
        tdActions.append(resolveBtn);
      }
    });

    renderPager(total, totalPages);
  }

  function renderPager(total, totalPages) {
    if (!pagerContainer) return;
    if (total === 0) {
      pagerContainer.innerHTML = '';
      return;
    }

    const start = total ? currentPage * pageSize + 1 : 0;
    const end = Math.min(total, (currentPage + 1) * pageSize);

    pagerContainer.innerHTML = `
      <div class="pager" style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;flex-wrap:wrap;gap:10px;">
        <span class="pager-info" style="font-size:13px;color:var(--text-muted);">
          Showing ${start}–${end} of ${total} grievances
        </span>
        <div style="display:flex;gap:12px;align-items:center;">
          <label style="font-size:13px;display:flex;align-items:center;gap:6px;margin:0;">
            Rows:
            <select id="grievancePageSize" class="form-control" style="width:70px;padding:2px 8px;height:30px;">
              <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
              <option value="25" ${pageSize === 25 ? 'selected' : ''}>25</option>
              <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
            </select>
          </label>
          <div class="pager-btns" style="display:flex;gap:6px;">
            <button type="button" class="btn btn-sm btn-outline" id="grievancePrevPage" ${currentPage === 0 ? 'disabled' : ''}>&larr; Prev</button>
            <span style="font-size:13px;align-self:center;padding:0 6px;">${currentPage + 1} / ${totalPages}</span>
            <button type="button" class="btn btn-sm btn-outline" id="grievanceNextPage" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Next &rarr;</button>
          </div>
        </div>
      </div>
    `;

    el('grievancePageSize')?.addEventListener('change', e => {
      pageSize = Number(e.target.value) || 10;
      currentPage = 0;
      renderTable();
    });
    el('grievancePrevPage')?.addEventListener('click', () => {
      if (currentPage > 0) {
        currentPage--;
        renderTable();
      }
    });
    el('grievanceNextPage')?.addEventListener('click', () => {
      if (currentPage < totalPages - 1) {
        currentPage++;
        renderTable();
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // File to base64
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result;
        resolve(res.includes(',') ? res.split(',')[1] : res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Open Raise / Edit Modal
  function openRaiseModal(recordToEdit = null) {
    editingRecordId = recordToEdit?.id || null;
    grievanceModalForm.reset();
    if (grievanceModalStatus) grievanceModalStatus.textContent = '';
    if (grievanceModalSubmitBtn) {
      grievanceModalSubmitBtn.disabled = false;
      grievanceModalSubmitBtn.textContent = editingRecordId ? 'Save Changes' : 'Submit Grievance';
    }

    if (recordToEdit) {
      grievanceModalTitle.textContent = 'Edit Grievance';
      grievanceCategorySelect.value = recordToEdit.category || 'Technical / Bug';
      grievanceBriefInput.value = recordToEdit.brief || '';
      grievanceDescInput.value = recordToEdit.description || '';
    } else {
      grievanceModalTitle.textContent = 'Raise Grievance';
      grievanceCategorySelect.value = 'Technical / Bug';
      grievanceBriefInput.value = '';
      grievanceDescInput.value = '';
    }

    grievanceModal.classList.remove('hidden');
    grievanceBriefInput.focus();
  }

  function closeModals() {
    grievanceModal?.classList.add('hidden');
    detailModal?.classList.add('hidden');
    actionForm?.classList.add('hidden');
    cleanupBlobUrls();
    activeGrievanceId = null;
    editingRecordId = null;
    activeAction = null;
  }

  // Detail Modal
  async function openDetail(id) {
    const record = allRecords.find(r => r.id === id);
    if (!record) return;

    activeGrievanceId = id;
    cleanupBlobUrls();
    if (detailMediaPreview) detailMediaPreview.innerHTML = '';
    if (actionForm) actionForm.classList.add('hidden');

    detailTitle.textContent = record.brief;
    detailStatusBadge.innerHTML = getStatusBadge(record.status);

    const authorName = record.raisedBy?.name || record.raisedBy?.username || 'Unknown';
    const authorRole = record.raisedBy?.role ? ` (${record.raisedBy.role})` : '';
    detailRaisedBy.textContent = authorName + authorRole;
    detailCategory.textContent = record.category || 'Technical / Bug';
    detailDate.textContent = formatDateTime(record.createdAt);
    detailId.textContent = record.id;
    detailDesc.textContent = record.description || '';

    // Attachments
    renderAttachments(record);

    // Timeline / History
    renderTimeline(record);

    // Actions
    renderActions(record);

    detailModal.classList.remove('hidden');
  }

  function renderAttachments(record) {
    detailAttachmentsList.innerHTML = '';
    const attachments = [];

    if (record.upload) {
      attachments.push({ title: 'Initial Attachment: ' + record.upload.name, meta: record.upload, endpoint: 'upload' });
    }
    if (record.resolution?.upload) {
      attachments.push({ title: 'Resolution Attachment: ' + record.resolution.upload.name, meta: record.resolution.upload, endpoint: 'resolution-upload' });
    }
    if (Array.isArray(record.history)) {
      record.history.forEach((h, idx) => {
        if (h.upload) {
          attachments.push({ title: `${h.action} Attachment: ${h.upload.name}`, meta: h.upload, endpoint: `history-upload/${idx}` });
        }
      });
    }

    if (!attachments.length) {
      detailAttachmentsSection.classList.add('hidden');
      return;
    }

    detailAttachmentsSection.classList.remove('hidden');
    attachments.forEach(att => {
      const chip = document.createElement('div');
      chip.className = 'attachment-chip';
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:8px;padding:6px 12px;background:var(--bg-subtle,#f1f5f9);border:1px solid var(--border-color,#cbd5e1);border-radius:6px;font-size:12px;cursor:pointer;';
      chip.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        <span style="font-weight:500;">${escapeHtml(att.title)}</span>
      `;
      chip.addEventListener('click', () => loadAttachmentPreview(record.id, att));
      detailAttachmentsList.append(chip);
    });
  }

  async function loadAttachmentPreview(recordId, att) {
    try {
      const containerId = 'preview-' + att.endpoint.replace('/', '-');
      let previewBox = el(containerId);
      if (previewBox) {
        previewBox.remove();
        return; // Toggle off if already opened
      }

      previewBox = document.createElement('div');
      previewBox.id = containerId;
      previewBox.style.cssText = 'margin-top:10px;padding:12px;border:1px solid var(--border-color,#cbd5e1);border-radius:8px;background:var(--bg-card,#fff);position:relative;';
      previewBox.innerHTML = `<div style="font-size:13px;color:var(--text-muted);">Loading attachment...</div>`;
      detailMediaPreview.append(previewBox);

      const file = await __api('GET', `grievances/${recordId}/${att.endpoint}`);
      if (!previewBox.isConnected) return;

      const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: file.type });
      const url = URL.createObjectURL(blob);
      blobUrls.set(containerId, url);

      previewBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-weight:600;font-size:13px;">${escapeHtml(file.name)}</span>
          <div style="display:flex;gap:8px;">
            <a href="${url}" download="${escapeHtml(file.name)}" class="btn btn-sm btn-outline">Download</a>
            <button type="button" class="btn btn-sm btn-outline" style="padding:2px 8px;">&times;</button>
          </div>
        </div>
      `;
      previewBox.querySelector('button').onclick = () => {
        URL.revokeObjectURL(url);
        blobUrls.delete(containerId);
        previewBox.remove();
      };

      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = file.name;
        img.style.cssText = 'max-width:100%;max-height:450px;border-radius:6px;object-fit:contain;display:block;margin:0 auto;';
        previewBox.append(img);
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.style.cssText = 'max-width:100%;max-height:450px;border-radius:6px;display:block;margin:0 auto;';
        previewBox.append(video);
      } else if (file.type === 'application/pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.cssText = 'width:100%;height:450px;border:none;border-radius:6px;';
        previewBox.append(iframe);
      } else {
        // Text / Log
        const text = new TextDecoder().decode(bytes);
        const pre = document.createElement('pre');
        pre.style.cssText = 'max-height:300px;overflow:auto;background:#0f172a;color:#f8fafc;padding:10px;border-radius:6px;font-size:12px;white-space:pre-wrap;';
        pre.textContent = text;
        previewBox.append(pre);
      }
    } catch (err) {
      showToast(err.body?.error || 'Failed to open attachment.', 'error');
    }
  }

  function renderTimeline(record) {
    detailTimeline.innerHTML = '';
    const history = Array.isArray(record.history) && record.history.length
      ? record.history
      : [{
          action: 'Raised',
          status: 'Pending',
          by: record.raisedBy,
          timestamp: record.createdAt,
          remark: record.description
        }];

    history.forEach(item => {
      const node = document.createElement('div');
      node.style.cssText = 'position:relative;margin-bottom:16px;';
      const actorName = item.by?.name || item.by?.username || 'System';
      const actorRole = item.by?.role ? ` (${item.by.role})` : '';

      node.innerHTML = `
        <div style="position:absolute;left:-23px;top:2px;width:12px;height:12px;border-radius:50%;background:var(--primary,#2563eb);border:2px solid #fff;"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
          <span style="font-weight:600;font-size:13px;">${escapeHtml(item.action)}</span>
          <span style="font-size:11px;color:var(--text-muted);">${formatDateTime(item.timestamp)}</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">By ${escapeHtml(actorName + actorRole)}</div>
        ${item.remark ? `<div style="font-size:13px;line-height:1.4;background:var(--bg-subtle,#f8fafc);padding:8px 12px;border-radius:6px;border:1px solid var(--border-color,#e2e8f0);white-space:pre-wrap;">${escapeHtml(item.remark)}</div>` : ''}
        ${item.upload ? `<div style="font-size:11px;color:var(--primary,#2563eb);margin-top:4px;">Attached: ${escapeHtml(item.upload.name)}</div>` : ''}
      `;
      detailTimeline.append(node);
    });
  }

  function renderActions(record) {
    actionButtons.innerHTML = '';
    actionForm.classList.add('hidden');
    const isOwner = currentUser && record.raisedBy?.id === currentUser.id;

    function addActionBtn(label, variant, onClick) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm ' + variant;
      btn.textContent = label;
      btn.addEventListener('click', onClick);
      actionButtons.append(btn);
    }

    // Reviewer Actions
    if (isReviewer) {
      if (!['Resolved', 'Complete', 'Withdrawn'].includes(record.status)) {
        if (record.status !== 'In Progress') {
          addActionBtn('Mark In Progress', 'btn-outline', () => promptAction('in_progress', 'Mark In Progress', 'Add optional progress note'));
        }
        addActionBtn('Request Clarification', 'btn-outline', () => promptAction('clarification', 'Request Clarification', 'Enter what information is required from complainant'));
        addActionBtn('Resolve Grievance', 'btn-primary', () => promptAction('resolve', 'Resolve Grievance', 'Enter resolution summary and corrective actions taken'));
        addActionBtn('Reject Grievance', 'btn-danger', () => promptAction('reject', 'Reject Grievance', 'Enter reason for rejection'));
      }
    }

    // Complainant Actions
    if (isOwner) {
      if (record.status === 'Need Clarification') {
        addActionBtn('Reply / Provide Clarification', 'btn-primary', () => promptAction('reply', 'Reply to Clarification', 'Enter your response / details'));
      }
      if (record.status === 'Resolved' || record.status === 'Complete') {
        addActionBtn('Reopen Grievance', 'btn-danger', () => promptAction('reopen', 'Reopen Grievance', 'State why the grievance is not satisfactorily resolved'));
      }
      if (['Pending', 'Need Clarification'].includes(record.status)) {
        addActionBtn('Edit Grievance', 'btn-outline', () => {
          closeModals();
          openRaiseModal(record);
        });
      }
      if (!['Resolved', 'Complete', 'Withdrawn'].includes(record.status)) {
        addActionBtn('Withdraw Grievance', 'btn-outline', () => promptAction('withdraw', 'Withdraw Grievance', 'Enter reason for withdrawal (optional)'));
      }
    }

    if (!actionButtons.children.length) {
      el('grievanceDetailActionPanel').classList.add('hidden');
    } else {
      el('grievanceDetailActionPanel').classList.remove('hidden');
    }
  }

  function promptAction(actionType, title, labelText) {
    activeAction = actionType;
    actionRemarkLabel.textContent = labelText;
    actionRemark.value = '';
    actionFile.value = '';
    actionSubmitBtn.textContent = title;
    actionForm.classList.remove('hidden');
    actionRemark.focus();
  }

  // Handle Action Form Submission
  actionCancelBtn?.addEventListener('click', () => {
    actionForm.classList.add('hidden');
    activeAction = null;
  });

  actionForm?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!activeGrievanceId || !activeAction || busy) return;

    busy = true;
    actionSubmitBtn.disabled = true;
    actionSubmitBtn.textContent = 'Submitting...';

    try {
      const file = actionFile.files[0];
      if (file && file.size > 12 * 1024 * 1024) {
        throw new Error('File exceeds 12 MB limit.');
      }

      let uploadData = null;
      if (file) {
        const base64 = await readFileAsBase64(file);
        uploadData = { name: file.name, type: file.type, data: base64 };
      }

      const remarkText = actionRemark.value.trim();
      const payload = {
        action: activeAction,
        remark: remarkText,
        description: remarkText,
        reason: remarkText,
        message: remarkText,
        upload: uploadData
      };

      await __api('POST', `grievances/${activeGrievanceId}/action`, payload);
      showToast(`Grievance ${activeAction} completed successfully.`, 'success');
      actionForm.classList.add('hidden');
      await window.loadGrievances(true);
      openDetail(activeGrievanceId);
    } catch (err) {
      showToast(err.body?.error || err.message || 'Action failed.', 'error');
    } finally {
      busy = false;
      actionSubmitBtn.disabled = false;
      actionSubmitBtn.textContent = 'Submit';
    }
  });

  // Handle Raise / Edit Modal Form Submission
  grievanceModalForm?.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;

    busy = true;
    grievanceModalSubmitBtn.disabled = true;
    grievanceModalSubmitBtn.textContent = 'Submitting...';
    if (grievanceModalStatus) grievanceModalStatus.textContent = 'Uploading & submitting...';

    try {
      const file = grievanceFileInput.files[0];
      if (file && file.size > 12 * 1024 * 1024) {
        throw new Error('File exceeds 12 MB limit. Choose a file under 12 MB.');
      }

      let uploadData = null;
      if (file) {
        const base64 = await readFileAsBase64(file);
        uploadData = { name: file.name, type: file.type, data: base64 };
      }

      const payload = {
        brief: grievanceBriefInput.value.trim(),
        description: grievanceDescInput.value.trim(),
        category: grievanceCategorySelect.value,
        upload: uploadData
      };

      if (editingRecordId) {
        payload.action = 'edit';
        await __api('POST', `grievances/${editingRecordId}/action`, payload);
        showToast('Grievance updated successfully.', 'success');
      } else {
        await __api('POST', 'grievances', payload);
        showToast('Grievance raised successfully. Developer Admin notified.', 'success');
      }

      closeModals();
      await window.loadGrievances(true);
    } catch (err) {
      const msg = err.body?.error || err.message || 'Failed to submit grievance.';
      if (grievanceModalStatus) grievanceModalStatus.textContent = msg;
      showToast(msg, 'error');
    } finally {
      busy = false;
      grievanceModalSubmitBtn.disabled = false;
      grievanceModalSubmitBtn.textContent = editingRecordId ? 'Save Changes' : 'Submit';
    }
  });

  // Global load function
  window.loadGrievances = async function(manual = false, openGrievanceId = null) {
    if (!currentUser) return;
    if (loading) return;
    loading = true;

    try {
      const res = await __api('GET', 'grievances');
      allRecords = Array.isArray(res.records) ? res.records : [];
      isReviewer = !!res.reviewer;

      updateStats();
      renderTable();

      // If openGrievanceId specified (e.g. from notification deep-link)
      if (openGrievanceId) {
        openDetail(openGrievanceId);
      } else if (activeGrievanceId && !detailModal.classList.contains('hidden')) {
        // Silently update open detail without closing
        const updated = allRecords.find(r => r.id === activeGrievanceId);
        if (updated) {
          detailStatusBadge.innerHTML = getStatusBadge(updated.status);
          renderTimeline(updated);
          renderActions(updated);
        }
      }
    } catch (err) {
      if (manual) showToast(err.body?.error || 'Failed to load grievances.', 'error');
    } finally {
      loading = false;
    }
  };

  window.openGrievanceById = function(id) {
    if (window.currentTab !== 'grievances') {
      if (typeof switchTab === 'function') switchTab('grievances');
    }
    window.loadGrievances(true, id);
  };

  // Event Listeners
  el('grievanceRaise')?.addEventListener('click', () => openRaiseModal());
  el('grievanceRefresh')?.addEventListener('click', () => {
    window.loadGrievances(true);
    showToast('Grievances refreshed.', 'info');
  });

  searchInput?.addEventListener('input', () => {
    currentPage = 0;
    renderTable();
  });
  statusFilter?.addEventListener('change', () => {
    currentPage = 0;
    renderTable();
  });
  categoryFilter?.addEventListener('change', () => {
    currentPage = 0;
    renderTable();
  });

  // Stat card click to filter
  document.querySelectorAll('#grievanceStats [data-grievance-filter]').forEach(card => {
    card.addEventListener('click', () => {
      const filterVal = card.dataset.grievanceFilter;
      if (statusFilter) statusFilter.value = filterVal;
      currentPage = 0;
      renderTable();
    });
  });

  // Periodic Auto-refresh (every 8 seconds when on grievances tab)
  setInterval(() => {
    if (window.currentTab === 'grievances' && !busy) {
      window.loadGrievances();
    }
  }, 8000);

  // Close modals on data-close
  document.querySelectorAll('#grievanceModal [data-close], #grievanceDetailModal [data-close]').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });
})();
