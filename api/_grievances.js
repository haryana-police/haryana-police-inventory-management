'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const dataDir = path.join(__dirname, '..', 'local-data');
const file = path.join(dataDir, 'grievances.json');
const mediaDir = path.join(dataDir, 'grievance-media');
const maxBytes = 12 * 1024 * 1024; // 12 MB

try {
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
} catch (e) {}

const reviewer = user => !!user && ((user.username === 'developer' && user.role === 'devadmin') || user.role === 'devadmin');

const canRead = (record, user) => {
  if (!user || !record) return false;
  if (reviewer(user)) return true;
  if (record.raisedBy && record.raisedBy.id === user.id) return true;
  if (user.role === 'admin' && record.raisedBy && record.raisedBy.districtId && record.raisedBy.districtId === user.districtId) return true;
  return false;
};

const rateLimitMap = new Map();
function isRateLimited(userId) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const list = (rateLimitMap.get(userId) || []).filter(t => now - t < windowMs);
  if (list.length >= 25) return true;
  list.push(now);
  rateLimitMap.set(userId, list);
  return false;
}

function read() {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function save(records) {
  const temp = file + '.' + crypto.randomUUID();
  try {
    fs.writeFileSync(temp, JSON.stringify(records, null, 2), { flag: 'wx' });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) try { fs.unlinkSync(temp); } catch (e) {}
  }
}

function isPlainText(buf) {
  const len = Math.min(buf.length, 1024);
  for (let i = 0; i < len; i++) {
    const c = buf[i];
    if (c === 0 || (c < 9 && c !== 0) || (c > 13 && c < 32)) return false;
  }
  return true;
}

function detectMagicType(buf, declaredType) {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 6 && (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a')) return 'image/gif';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 0, 4) === '%PDF') return 'application/pdf';
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    return declaredType === 'video/quicktime' ? 'video/quicktime' : 'video/mp4';
  }
  if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return 'video/webm';
  if (isPlainText(buf)) return 'text/plain';
  return null;
}

function saveMedia(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || typeof value.name !== 'string' || typeof value.data !== 'string') {
    throw new TypeError('Invalid attachment format.');
  }
  let cleanData = value.data.replace(/[\r\n\s]/g, '');
  if (cleanData.includes(',')) cleanData = cleanData.split(',')[1];
  const buf = Buffer.from(cleanData, 'base64');
  if (buf.length === 0 || buf.length > maxBytes) {
    throw new TypeError('Choose a photo, video, PDF, or log file up to 12 MB.');
  }
  const detectedType = detectMagicType(buf, value.type);
  if (!detectedType) {
    throw new TypeError('Unsupported or corrupt file. Choose a valid photo, video, PDF, or log file.');
  }
  const fileId = crypto.randomUUID();
  const extMap = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
    'application/pdf': '.pdf', 'text/plain': '.txt'
  };
  const ext = extMap[detectedType] || '.bin';
  const diskFilename = fileId + ext;
  fs.writeFileSync(path.join(mediaDir, diskFilename), buf);
  const cleanName = path.basename(value.name).slice(0, 200).replace(/[^\w.\-\s()]/g, '_');
  return {
    id: fileId,
    file: diskFilename,
    name: cleanName || 'attachment' + ext,
    type: detectedType,
    size: buf.length
  };
}

function getMediaContent(uploadMeta) {
  if (!uploadMeta) return null;
  if (uploadMeta.data) {
    return { name: uploadMeta.name, type: uploadMeta.type, data: uploadMeta.data };
  }
  if (uploadMeta.file) {
    const filePath = path.join(mediaDir, uploadMeta.file);
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      return {
        name: uploadMeta.name,
        type: uploadMeta.type,
        data: buf.toString('base64'),
        size: buf.length
      };
    }
  }
  return null;
}

function metadata(value) {
  return value && { id: value.id, name: value.name, type: value.type, size: value.size };
}

function userSummary(user) {
  return {
    id: user.id,
    name: user.name || user.username,
    username: user.username,
    role: user.role,
    districtId: user.districtId || null
  };
}

async function handle(req, res, seg, user, developer, publish) {
  if (isRateLimited(user.id)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment before trying again.' });
  }

  const records = read();
  const targetId = seg[1];
  const record = records.find(r => r.id === targetId && canRead(r, user));
  const body = req.body || {};

  // GET list
  if (req.method === 'GET' && !targetId) {
    const isRev = reviewer(user);
    const visibleRecords = records
      .filter(r => canRead(r, user))
      .map(r => ({
        ...r,
        upload: metadata(r.upload),
        resolution: r.resolution && { ...r.resolution, upload: metadata(r.resolution.upload) },
        history: Array.isArray(r.history) ? r.history.map(h => ({ ...h, upload: metadata(h.upload) })) : []
      }));
    return res.json({ reviewer: isRev, records: visibleRecords });
  }

  // GET attachment download / preview
  if (req.method === 'GET' && ['upload', 'resolution-upload', 'history-upload'].includes(seg[2])) {
    if (!record) return res.status(404).json({ error: 'Grievance not found or access denied.' });
    let uploadTarget = null;
    if (seg[2] === 'upload') {
      uploadTarget = record.upload;
    } else if (seg[2] === 'resolution-upload') {
      uploadTarget = record.resolution?.upload;
    } else if (seg[2] === 'history-upload') {
      const idx = parseInt(seg[3], 10);
      if (Array.isArray(record.history) && record.history[idx]) {
        uploadTarget = record.history[idx].upload;
      }
    }
    const content = getMediaContent(uploadTarget);
    return content ? res.json(content) : res.status(404).json({ error: 'Attachment not found.' });
  }

  const raising = req.method === 'POST' && !targetId;
  const legacyResolving = req.method === 'POST' && targetId && seg[2] === 'resolve';
  const takingAction = req.method === 'POST' && targetId && (seg[2] === 'action' || legacyResolving);

  if (!raising && !takingAction) {
    return res.status(404).json({ error: 'Grievance endpoint not found.' });
  }

  // Raise Grievance
  if (raising) {
    const brief = typeof body.brief === 'string' ? body.brief.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Technical / Bug';

    if (!brief || brief.length > 160) {
      return res.status(400).json({ error: 'Enter a concise brief (up to 160 characters).' });
    }
    if (!description || description.length > 5000) {
      return res.status(400).json({ error: 'Enter a detailed description (up to 5000 characters).' });
    }

    let upload = null;
    try {
      upload = saveMedia(body.upload);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const id = crypto.randomUUID();
    const actor = userSummary(user);
    const now = Date.now();
    const newRecord = {
      id,
      brief,
      description,
      category,
      upload,
      status: 'Pending',
      createdAt: now,
      raisedBy: actor,
      history: [
        {
          action: 'Raised',
          status: 'Pending',
          by: actor,
          timestamp: now,
          remark: brief
        }
      ]
    };

    records.unshift(newRecord);
    save(records);

    let notified = true;
    try {
      const devScope = developer?.id ? { grievanceReviewerId: developer.id } : { roles: ['devadmin'] };
      await publish([{
        type: 'GRIEVANCE_RAISED',
        title: 'New Grievance: ' + brief,
        message: `${actor.name} (${actor.role}) raised: ${brief}`,
        scope: devScope,
        payload: { grievanceId: id },
        dedupe: 'grievance:' + id
      }]);
    } catch (err) {
      notified = false;
      console.error('[grievance notification]', err.message);
    }

    return res.status(201).json({ ok: true, id, notified });
  }

  // Action / State Transition
  if (takingAction) {
    if (!record) return res.status(404).json({ error: 'Grievance not found or access denied.' });

    const action = legacyResolving ? 'resolve' : (body.action || '').toLowerCase();
    const isRev = reviewer(user);
    const isOwner = record.raisedBy?.id === user.id;
    const actor = userSummary(user);
    const now = Date.now();

    if (!Array.isArray(record.history)) record.history = [];

    // ACTION: in_progress (Reviewer)
    if (action === 'in_progress') {
      if (!isRev) return res.status(403).json({ error: 'Only Developer Admin can mark grievances in progress.' });
      if (['Resolved', 'Complete', 'Withdrawn'].includes(record.status)) {
        return res.status(409).json({ error: `Cannot mark a ${record.status.toLowerCase()} grievance in progress.` });
      }
      const remark = typeof body.remark === 'string' && body.remark.trim() ? body.remark.trim() : 'Under active investigation.';
      record.status = 'In Progress';
      record.history.push({
        action: 'In Progress',
        status: 'In Progress',
        by: actor,
        timestamp: now,
        remark
      });
      save(records);

      try {
        await publish([{
          type: 'GRIEVANCE_STATUS_UPDATE',
          title: 'Grievance In Progress: ' + record.brief,
          message: remark,
          scope: { users: [record.raisedBy.id] },
          payload: { grievanceId: record.id },
          dedupe: 'grievance:' + record.id + ':progress:' + now
        }]);
      } catch (e) {}

      return res.json({ ok: true, status: record.status });
    }

    // ACTION: clarification (Reviewer)
    if (action === 'clarification') {
      if (!isRev) return res.status(403).json({ error: 'Only Developer Admin can request clarification.' });
      const remark = typeof body.remark === 'string' ? body.remark.trim() : '';
      if (!remark) return res.status(400).json({ error: 'Please enter what clarification is needed.' });

      let upload = null;
      try { upload = saveMedia(body.upload); } catch (e) { return res.status(400).json({ error: e.message }); }

      record.status = 'Need Clarification';
      record.history.push({
        action: 'Need Clarification',
        status: 'Need Clarification',
        by: actor,
        timestamp: now,
        remark,
        upload
      });
      save(records);

      try {
        await publish([{
          type: 'GRIEVANCE_STATUS_UPDATE',
          title: 'Clarification Needed: ' + record.brief,
          message: remark,
          scope: { users: [record.raisedBy.id] },
          payload: { grievanceId: record.id },
          dedupe: 'grievance:' + record.id + ':clarify:' + now
        }]);
      } catch (e) {}

      return res.json({ ok: true, status: record.status });
    }

    // ACTION: resolve (Reviewer)
    if (action === 'resolve') {
      if (!isRev) return res.status(403).json({ error: 'Only Developer Admin can resolve grievances.' });
      if (['Resolved', 'Complete'].includes(record.status)) {
        return res.status(409).json({ error: 'This grievance is already resolved.' });
      }
      const description = typeof body.description === 'string' ? body.description.trim() : (typeof body.remark === 'string' ? body.remark.trim() : '');
      if (!description || description.length > 5000) {
        return res.status(400).json({ error: 'Enter resolution details (up to 5000 characters).' });
      }

      let upload = null;
      try { upload = saveMedia(body.upload); } catch (e) { return res.status(400).json({ error: e.message }); }

      record.status = 'Resolved';
      record.resolution = {
        description,
        upload,
        resolvedAt: now,
        resolvedBy: actor
      };
      record.history.push({
        action: 'Resolved',
        status: 'Resolved',
        by: actor,
        timestamp: now,
        remark: description,
        upload
      });
      save(records);

      try {
        await publish([{
          type: 'GRIEVANCE_STATUS_UPDATE',
          title: 'Grievance Resolved: ' + record.brief,
          message: description,
          scope: { users: [record.raisedBy.id] },
          payload: { grievanceId: record.id },
          dedupe: 'grievance:' + record.id + ':resolve:' + now
        }]);
      } catch (e) {}

      return res.json({ ok: true, status: record.status });
    }

    // ACTION: reject (Reviewer)
    if (action === 'reject') {
      if (!isRev) return res.status(403).json({ error: 'Only Developer Admin can reject grievances.' });
      const reason = typeof body.reason === 'string' ? body.reason.trim() : (typeof body.remark === 'string' ? body.remark.trim() : '');
      if (!reason || reason.length > 2000) {
        return res.status(400).json({ error: 'Enter a valid rejection reason.' });
      }

      let upload = null;
      try { upload = saveMedia(body.upload); } catch (e) { return res.status(400).json({ error: e.message }); }

      record.status = 'Rejected';
      record.rejection = {
        reason,
        rejectedAt: now,
        rejectedBy: actor
      };
      record.history.push({
        action: 'Rejected',
        status: 'Rejected',
        by: actor,
        timestamp: now,
        remark: reason,
        upload
      });
      save(records);

      try {
        await publish([{
          type: 'GRIEVANCE_STATUS_UPDATE',
          title: 'Grievance Rejected: ' + record.brief,
          message: reason,
          scope: { users: [record.raisedBy.id] },
          payload: { grievanceId: record.id },
          dedupe: 'grievance:' + record.id + ':reject:' + now
        }]);
      } catch (e) {}

      return res.json({ ok: true, status: record.status });
    }

    // ACTION: reply / provide clarification (Complainant)
    if (action === 'reply') {
      if (!isOwner) return res.status(403).json({ error: 'Only the grievance author can reply to clarification.' });
      const message = typeof body.message === 'string' ? body.message.trim() : (typeof body.remark === 'string' ? body.remark.trim() : '');
      if (!message) return res.status(400).json({ error: 'Enter your response message.' });

      let upload = null;
      try { upload = saveMedia(body.upload); } catch (e) { return res.status(400).json({ error: e.message }); }

      record.status = 'Pending';
      record.history.push({
        action: 'Clarification Provided',
        status: 'Pending',
        by: actor,
        timestamp: now,
        remark: message,
        upload
      });
      save(records);

      try {
        const devScope = developer?.id ? { grievanceReviewerId: developer.id } : { roles: ['devadmin'] };
        await publish([{
          type: 'GRIEVANCE_UPDATE',
          title: 'Clarification Received: ' + record.brief,
          message: `${actor.name}: ${message}`,
          scope: devScope,
          payload: { grievanceId: record.id },
          dedupe: 'grievance:' + record.id + ':reply:' + now
        }]);
      } catch (e) {}

      return res.json({ ok: true, status: record.status });
    }

    // ACTION: edit (Complainant)
    if (action === 'edit') {
      if (!isOwner) return res.status(403).json({ error: 'Only the grievance author can edit this grievance.' });
      if (!['Pending', 'Need Clarification'].includes(record.status)) {
        return res.status(409).json({ error: 'Grievance can only be edited while Pending or in Clarification.' });
      }
      const brief = typeof body.brief === 'string' ? body.brief.trim() : record.brief;
      const description = typeof body.description === 'string' ? body.description.trim() : record.description;
      const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : record.category;

      if (!brief || brief.length > 160) return res.status(400).json({ error: 'Brief must be 1 to 160 characters.' });
      if (!description || description.length > 5000) return res.status(400).json({ error: 'Description must be 1 to 5000 characters.' });

      if (body.upload !== undefined) {
        try {
          record.upload = body.upload ? saveMedia(body.upload) : null;
        } catch (e) {
          return res.status(400).json({ error: e.message });
        }
      }

      record.brief = brief;
      record.description = description;
      record.category = category;
      record.updatedAt = now;
      record.history.push({
        action: 'Edited',
        status: record.status,
        by: actor,
        timestamp: now,
        remark: 'Grievance details updated'
      });
      save(records);

      return res.json({ ok: true, record: { ...record, upload: metadata(record.upload) } });
    }

    // ACTION: reopen (Complainant)
    if (action === 'reopen') {
      if (!isOwner) return res.status(403).json({ error: 'Only the grievance author can reopen this grievance.' });
      if (!['Resolved', 'Complete'].includes(record.status)) {
        return res.status(409).json({ error: 'Only resolved grievances can be reopened.' });
      }
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (!reason) return res.status(400).json({ error: 'Please enter why this grievance is being reopened.' });

      let upload = null;
      try { upload = saveMedia(body.upload); } catch (e) { return res.status(400).json({ error: e.message }); }

      record.status = 'Reopened';
      record.history.push({
        action: 'Reopened',
        status: 'Reopened',
        by: actor,
        timestamp: now,
        remark: reason,
        upload
      });
      save(records);

      try {
        const devScope = developer?.id ? { grievanceReviewerId: developer.id } : { roles: ['devadmin'] };
        await publish([{
          type: 'GRIEVANCE_UPDATE',
          title: 'Grievance Reopened: ' + record.brief,
          message: `${actor.name} reopened: ${reason}`,
          scope: devScope,
          payload: { grievanceId: record.id },
          dedupe: 'grievance:' + record.id + ':reopen:' + now
        }]);
      } catch (e) {}

      return res.json({ ok: true, status: record.status });
    }

    // ACTION: withdraw (Complainant)
    if (action === 'withdraw') {
      if (!isOwner) return res.status(403).json({ error: 'Only the grievance author can withdraw this grievance.' });
      if (['Resolved', 'Complete', 'Withdrawn'].includes(record.status)) {
        return res.status(409).json({ error: `Grievance is already ${record.status.toLowerCase()}.` });
      }
      const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'Withdrawn by author.';
      record.status = 'Withdrawn';
      record.history.push({
        action: 'Withdrawn',
        status: 'Withdrawn',
        by: actor,
        timestamp: now,
        remark: reason
      });
      save(records);

      try {
        const devScope = developer?.id ? { grievanceReviewerId: developer.id } : { roles: ['devadmin'] };
        await publish([{
          type: 'GRIEVANCE_UPDATE',
          title: 'Grievance Withdrawn: ' + record.brief,
          message: `${actor.name} withdrew: ${record.brief}`,
          scope: devScope,
          payload: { grievanceId: record.id },
          dedupe: 'grievance:' + record.id + ':withdraw:' + now
        }]);
      } catch (e) {}

      return res.json({ ok: true, status: record.status });
    }

    return res.status(400).json({ error: 'Unknown grievance action: ' + action });
  }
}

module.exports = { handle, reviewer, saveMedia, detectMagicType, read, save };
