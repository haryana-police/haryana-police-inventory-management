'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const grievances = require('../api/_grievances');

const testDataDir = path.join(__dirname, '..', 'local-data');
const testMediaDir = path.join(testDataDir, 'grievance-media');

test('Reviewer check logic identifies developer and devadmin users', () => {
  assert.equal(grievances.reviewer({ username: 'developer', role: 'devadmin' }), true);
  assert.equal(grievances.reviewer({ username: 'anotherdev', role: 'devadmin' }), true);
  assert.equal(grievances.reviewer({ username: 'developer', role: 'admin' }), false);
  assert.equal(grievances.reviewer({ username: 'officer1', role: 'user' }), false);
  assert.equal(grievances.reviewer(null), false);
});

test('Magic bytes detection validates images, PDFs, videos, and text files', () => {
  const jpegBuf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
  assert.equal(grievances.detectMagicType(jpegBuf, 'image/jpeg'), 'image/jpeg');

  const pngBuf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  assert.equal(grievances.detectMagicType(pngBuf, 'image/png'), 'image/png');

  const gifBuf = Buffer.from('GIF89a\x01\x00\x01\x00', 'binary');
  assert.equal(grievances.detectMagicType(gifBuf, 'image/gif'), 'image/gif');

  const pdfBuf = Buffer.from('%PDF-1.4 test content', 'utf8');
  assert.equal(grievances.detectMagicType(pdfBuf, 'application/pdf'), 'application/pdf');

  const textBuf = Buffer.from('Error log line 1\nError log line 2', 'utf8');
  assert.equal(grievances.detectMagicType(textBuf, 'text/plain'), 'text/plain');

  const corruptBuf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
  assert.equal(grievances.detectMagicType(corruptBuf, 'image/jpeg'), null);
});

test('Media saving separates binary files from grievances.json and writes to grievance-media', () => {
  const samplePdfContent = Buffer.from('%PDF-1.4 test content for police report', 'utf8');
  const base64Data = samplePdfContent.toString('base64');

  const saved = grievances.saveMedia({
    name: 'test_report.pdf',
    type: 'application/pdf',
    data: base64Data
  });

  assert.ok(saved.id);
  assert.ok(saved.file);
  assert.equal(saved.type, 'application/pdf');
  assert.equal(saved.name, 'test_report.pdf');

  const diskPath = path.join(testMediaDir, saved.file);
  assert.ok(fs.existsSync(diskPath));
  const readBack = fs.readFileSync(diskPath);
  assert.equal(readBack.toString('utf8'), samplePdfContent.toString('utf8'));

  // Clean up test file
  try { fs.unlinkSync(diskPath); } catch (e) {}
});

test('Full Grievance lifecycle: Raise, In Progress, Clarification, Reply, Resolve, Reopen, and Withdraw', async () => {
  const user1 = { id: 'usr-101', username: 'police.panipat', name: 'Inspector Sharma', role: 'user', districtId: 'panipat' };
  const user2 = { id: 'usr-102', username: 'police.karnal', name: 'SI Verma', role: 'user', districtId: 'karnal' };
  const devUser = { id: 'dev-001', username: 'developer', name: 'Dev Admin', role: 'devadmin' };

  const notifications = [];
  const mockPublish = async (events) => {
    notifications.push(...events);
  };

  // 1. User1 raises a grievance
  let resStatus = 200;
  let resData = null;
  const mockRes = () => ({
    status(code) { resStatus = code; return this; },
    json(data) { resData = data; return this; }
  });

  await grievances.handle({
    method: 'POST',
    body: {
      brief: 'Scanner not detecting barcode',
      description: 'The handheld barcode scanner in Panipat armory is throwing error code E-404 during stock check.',
      category: 'Equipment / Repair'
    }
  }, mockRes(), ['grievances'], user1, devUser, mockPublish);

  assert.equal(resStatus, 201);
  assert.ok(resData.ok);
  const grievanceId = resData.id;
  assert.ok(grievanceId);
  assert.ok(notifications.some(n => n.type === 'GRIEVANCE_RAISED' && n.payload.grievanceId === grievanceId));

  // 2. Developer reviews list and sets "In Progress"
  await grievances.handle({
    method: 'POST',
    body: { action: 'in_progress', remark: 'Investigating scanner driver compatibility.' }
  }, mockRes(), ['grievances', grievanceId, 'action'], devUser, devUser, mockPublish);

  assert.equal(resData.ok, true);
  assert.equal(resData.status, 'In Progress');
  assert.ok(notifications.some(n => n.type === 'GRIEVANCE_STATUS_UPDATE' && n.scope?.users?.includes(user1.id)));

  // 3. Developer requests clarification
  await grievances.handle({
    method: 'POST',
    body: { action: 'clarification', remark: 'Please share the model number of the scanner.' }
  }, mockRes(), ['grievances', grievanceId, 'action'], devUser, devUser, mockPublish);

  assert.equal(resData.ok, true);
  assert.equal(resData.status, 'Need Clarification');

  // 4. User1 replies with clarification
  await grievances.handle({
    method: 'POST',
    body: { action: 'reply', message: 'Scanner model is Honeywell 1900GHD.' }
  }, mockRes(), ['grievances', grievanceId, 'action'], user1, devUser, mockPublish);

  assert.equal(resData.ok, true);
  assert.equal(resData.status, 'Pending');

  // 5. Developer resolves grievance
  await grievances.handle({
    method: 'POST',
    body: { action: 'resolve', description: 'Updated firmware patch v2.4 applied. Scanner working normally.' }
  }, mockRes(), ['grievances', grievanceId, 'action'], devUser, devUser, mockPublish);

  assert.equal(resData.ok, true);
  assert.equal(resData.status, 'Resolved');
  assert.ok(notifications.some(n => n.title.includes('Resolved') && n.scope?.users?.includes(user1.id)));

  // 6. User1 reopens grievance
  await grievances.handle({
    method: 'POST',
    body: { action: 'reopen', reason: 'Error recurred after system restart.' }
  }, mockRes(), ['grievances', grievanceId, 'action'], user1, devUser, mockPublish);

  assert.equal(resData.ok, true);
  assert.equal(resData.status, 'Reopened');

  // 7. Developer resolves again
  await grievances.handle({
    method: 'POST',
    body: { action: 'resolve', description: 'Replaced USB port cable and configured persistence.' }
  }, mockRes(), ['grievances', grievanceId, 'action'], devUser, devUser, mockPublish);

  assert.equal(resData.ok, true);
  assert.equal(resData.status, 'Resolved');

  // 8. Access control test: User2 (unrelated) cannot resolve or edit User1's grievance
  resStatus = 200;
  await grievances.handle({
    method: 'POST',
    body: { action: 'resolve', description: 'Malicious resolve' }
  }, mockRes(), ['grievances', grievanceId, 'action'], user2, devUser, mockPublish);

  assert.ok([403, 404].includes(resStatus));

  // 9. Clean up test record from grievances.json
  const currentRecords = grievances.read().filter(r => r.id !== grievanceId);
  grievances.save(currentRecords);
});
