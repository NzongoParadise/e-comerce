import assert from 'node:assert/strict';
import test from 'node:test';

import { canRequestB2BAccount, getDashboardDestination, getUserRoles, isActiveWholesaleCustomer, isAdminUser } from './auth';

test('normalizes roles from auth payloads and database profiles', () => {
  assert.deepEqual(getUserRoles({ roles: ['ADMIN', 'customer'] }), ['admin', 'customer']);
  assert.deepEqual(getUserRoles({ accessRole: 'ADMIN' }), ['admin']);
  assert.deepEqual(getUserRoles({ accessRole: 'CUSTOMER' }), ['customer']);
  assert.deepEqual(getUserRoles({ roles: 'admin' }), ['admin']);
  assert.deepEqual(getUserRoles({ roles: ['admin'], accessRole: 'CUSTOMER' }), ['customer']);
});

test('detects admin users from either a role or configured admin emails', () => {
  process.env.ADMIN_EMAILS = 'admin@techglobal.io';

  assert.equal(isAdminUser({ roles: ['admin'] }), true);
  assert.equal(isAdminUser({ roles: ['admin'], accessRole: 'CUSTOMER' }), false);
  assert.equal(isAdminUser({ email: 'admin@techglobal.io', accessRole: 'CUSTOMER' }), false);
  assert.equal(isAdminUser({ accessRole: 'ADMIN' }), true);
  assert.equal(isAdminUser({ accessRole: 'CUSTOMER' }), false);
  assert.equal(isAdminUser({ email: 'admin@techglobal.io' }), true);
  assert.equal(getDashboardDestination({ accessRole: 'CUSTOMER' }), '/account');
  assert.equal(getDashboardDestination({ roles: ['admin'] }), '/admin');
});

test('restricts wholesale quotes to active B2B customer profiles', () => {
  assert.equal(isActiveWholesaleCustomer({ accessRole: 'CUSTOMER', accountType: 'B2B', status: 'ACTIVE' }), true);
  assert.equal(isActiveWholesaleCustomer({ accessRole: 'ADMIN', accountType: 'B2B', status: 'ACTIVE' }), false);
  assert.equal(isActiveWholesaleCustomer({ accessRole: 'CUSTOMER', accountType: 'B2C', status: 'ACTIVE' }), false);
  assert.equal(isActiveWholesaleCustomer({ accessRole: 'CUSTOMER', accountType: 'B2B', status: 'INACTIVE' }), false);
});

test('allows B2B requests only for active retail customers without a pending request', () => {
  assert.equal(canRequestB2BAccount({ accessRole: 'CUSTOMER', accountType: 'B2C', status: 'ACTIVE' }), true);
  assert.equal(canRequestB2BAccount({ accessRole: 'CUSTOMER', accountType: 'B2C', status: 'ACTIVE', b2bRequestStatus: 'PENDING' }), false);
  assert.equal(canRequestB2BAccount({ accessRole: 'CUSTOMER', accountType: 'B2B', status: 'ACTIVE' }), false);
  assert.equal(canRequestB2BAccount({ accessRole: 'ADMIN', accountType: 'B2C', status: 'ACTIVE' }), false);
  assert.equal(canRequestB2BAccount({ accessRole: 'CUSTOMER', accountType: 'B2C', status: 'INACTIVE' }), false);
});
