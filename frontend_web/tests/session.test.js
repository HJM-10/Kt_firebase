import { test } from 'node:test';
import assert from 'node:assert/strict';
const values = new Map();
globalThis.sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) };
globalThis.window = { location: { href: '/' } };
const { default: api } = await import('../src/api/axios.js');
const { default: auth } = await import('../src/store/authStore.js');
const failure = (status, data) => async config => { throw { config, ...(status ? { response: { status, data } } : {}) }; };
test('startup outage retains token, blocks unverified access, and retry verifies role', async () => {
 for (const status of [undefined, 503]) {
  values.set('ssh_token','existing-token');
  auth.setState({ user: null, isAuthenticated: false });
  api.defaults.adapter = failure(status, {message:'private error'});
  await auth.getState().init();
  assert.equal(values.get('ssh_token'),'existing-token');
  assert.equal(auth.getState().isAuthenticated,false);
  assert.match(auth.getState().authError, /try again/);
  api.defaults.adapter = async config => ({config,status:200,data:{data:{id:1,role:'CUSTOMER'}}});
  await auth.getState().init();
  assert.equal(auth.getState().authError,null);
  assert.equal(auth.getState().user.role,'CUSTOMER');
  assert.equal(auth.getState().isAuthenticated,true);
 }
});
test('credential and permission errors preserve session; true expiry clears and redirects', async () => {
 for (const status of [400,401,403,503]) {
  values.set('ssh_token','existing-token');
  api.defaults.adapter = failure(status,{message:'error'});
  await assert.rejects(api.get('/auth/password'));
  assert.equal(values.get('ssh_token'),'existing-token');
 }
 api.defaults.adapter = failure(401,{code:'SESSION_INVALID'});
 await assert.rejects(api.get('/auth/me'));
 assert.equal(values.has('ssh_token'),false);
 assert.equal(window.location.href,'/login');
});
