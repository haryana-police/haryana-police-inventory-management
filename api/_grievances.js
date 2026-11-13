'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const file = path.join(__dirname, '..', 'local-data', 'grievances.json');
const maxBytes = 12 * 1024 * 1024;
const types = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']);
const reviewer = user => user.username === 'developer' && user.role === 'devadmin';
const canRead = (record, user) => reviewer(user) || record.raisedBy.id === user.id;

function read() {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

function save(records) {
  const temp = file + '.' + crypto.randomUUID();
  try {
    fs.writeFileSync(temp, JSON.stringify(records), { flag: 'wx' });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

function media(value) {
  if (value == null) return null;
  if (!types.has(value.type) || typeof value.name !== 'string' ||
      typeof value.data !== 'string' || !value.data || value.data.length > Math.ceil(maxBytes / 3) * 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(value.data) || Buffer.from(value.data, 'base64').length > maxBytes) {
    throw new TypeError('Choose a supported photo or video up to 12 MB.');
  }
  return { name: value.name.slice(0, 200), type: value.type, data: value.data };
}

function metadata(value) {
  return value && { name: value.name, type: value.type };
}

async function handle(req, res, seg, user, developer, publish) {
  const records = read();
  const record = records.find(r => r.id === seg[1] && canRead(r, user));
  const body = req.body || {};
  if (req.method === 'GET' && !seg[1]) {
    return res.json({ reviewer: reviewer(user), records: records.filter(r => canRead(r, user)).map(r => ({
      ...r, upload: metadata(r.upload),
      resolution: r.resolution && { ...r.resolution, upload: metadata(r.resolution.upload) },
    })) });
  }
  if (req.method === 'GET' && ['upload', 'resolution-upload'].includes(seg[2])) {
    const upload = seg[2] === 'upload' ? record?.upload : record?.resolution?.upload;
    return upload ? res.json(upload) : res.status(404).json({ error: 'Attachment not found.' });
  }
  const raising = req.method === 'POST' && !seg[1];
  const resolving = req.method === 'POST' && seg[2] === 'resolve';
  if (!raising && !resolving) return res.status(404).json({ error: 'Grievance action not found.' });
  if (resolving && !reviewer(user)) return res.status(403).json({ error: 'Only Developer Admin can resolve grievances.' });
  if (resolving && !record) return res.status(404).json({ error: 'Grievance not found.' });
  if (resolving && record.status !== 'Pending') return res.status(409).json({ error: 'This grievance is already complete.' });
  if (raising && !developer) return res.status(503).json({ error: 'Developer Admin is unavailable.' });
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const brief = typeof body.brief === 'string' ? body.brief.trim() : '';
  if (!description || description.length > 5000 || (raising && (!brief || brief.length > 160))) {
    return res.status(400).json({ error: 'Enter a valid brief and description.' });
  }
  let upload;
  try { upload = media(body.upload); } catch (error) { return res.status(400).json({ error: error.message }); }
  if (resolving) {
    record.status = 'Complete';
    record.resolution = { description, upload, resolvedAt: Date.now() };
    save(records);
    return res.json({ ok: true });
  }
  const id = crypto.randomUUID();
  records.unshift({ id, brief, description, upload, status: 'Pending', createdAt: Date.now(),
    raisedBy: { id: user.id, name: user.name || user.username } });
  save(records);
  let notified = true;
  try {
    await publish([{ type: 'GRIEVANCE_RAISED', title: 'New Grievance', message: brief,
      scope: { grievanceReviewerId: developer.id }, payload: { grievanceId: id }, dedupe: 'grievance:' + id }]);
  } catch (error) {
    notified = false;
    console.error('[grievance notification]', error.message);
  }
  return res.status(201).json({ ok: true, notified });
}

module.exports = { handle, reviewer };
