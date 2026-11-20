const test = require('node:test');
const assert = require('node:assert/strict');
const { authorizeStructureWrites, authorizeUserCollectionWrite } = require('../api/_rbac');

test('Account Management: Mobile validation requires valid Indian 10-digit number starting with 6-9', () => {
  const prevState = {
    'hp_inventory.users': [{ id: 'u_admin', username: 'admin', role: 'admin', districtId: 'dist_1', password: 'hash' }],
    'hp_inventory.districts': [{ id: 'dist_1', name: 'Panipat', code: 'PPT', headquarters: 'Panipat' }],
    'hp_inventory.locations': { dist_1: [{ id: 'loc_1', name: 'HQ', type: 'district' }] }
  };

  const devUser = { id: 'u_dev', username: 'developer', role: 'devadmin' };

  // Invalid mobile (starts with 0)
  const invalidMobileState = {
    ...prevState,
    'hp_inventory.users': [
      ...prevState['hp_inventory.users'],
      { id: 'u_new', username: 'newuser', name: 'New User', role: 'user', mobile: '0000000000', password: 'password123', districtId: 'dist_1', locationId: 'loc_1' }
    ]
  };
  const verdictInvalid = authorizeStructureWrites(devUser, prevState, invalidMobileState);
  assert.equal(verdictInvalid.ok, false);
  assert.equal(verdictInvalid.code, 'RBAC_USER_MOBILE');

  // Valid mobile (starts with 9)
  const validMobileState = {
    ...prevState,
    'hp_inventory.users': [
      ...prevState['hp_inventory.users'],
      { id: 'u_new', username: 'newuser', name: 'New User', role: 'user', mobile: '9876543210', password: 'password123', districtId: 'dist_1', locationId: 'loc_1' }
    ]
  };
  const verdictValid = authorizeStructureWrites(devUser, prevState, validMobileState);
  assert.equal(verdictValid.ok, true);
});

test('Account Management: User collection preserves active/inactive status flag', () => {
  const currentUsers = [
    { id: 'u1', username: 'user1', name: 'User One', role: 'user', districtId: 'dist_1', locationId: 'loc_1', mobile: '9876543210', active: true }
  ];
  const incomingUsers = [
    { id: 'u1', username: 'user1', name: 'User One', role: 'user', districtId: 'dist_1', locationId: 'loc_1', mobile: '9876543210', active: false }
  ];

  const admin = { id: 'admin1', username: 'admin', role: 'admin', districtId: 'dist_1' };
  const verdict = authorizeUserCollectionWrite(admin, currentUsers, incomingUsers);
  // District Admin is allowed to deactivate a user in their own district
  assert.equal(verdict, null);
});
