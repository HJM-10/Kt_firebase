import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { subscribeResource } from '../src/services/live-events.js';
test('resource refresh handles changes, reconnect recovery and cleanup without disconnecting other screens', () => {
  const socket = new EventEmitter();
  socket.connect = () => socket.emit('connect');
  let inventory = 0, promos = 0;
  const stopInventory = subscribeResource(socket, 'equipment', () => inventory++);
  const stopPromos = subscribeResource(socket, 'promo', () => promos++);
  const before = inventory;
  socket.emit('resource_changed', { resource: 'equipment' });
  assert.equal(inventory, before + 1);
  const offersBefore = promos;
  socket.emit('resource_changed', null);
  socket.emit('resource_changed', { resource: 'unrelated' });
  assert.equal(promos, offersBefore);
  socket.emit('disconnect'); // Changes can occur while the screen is disconnected.
  socket.emit('connect');
  assert.equal(promos, offersBefore + 1);
  stopInventory();
  const closedInventory = inventory;
  socket.emit('connect'); socket.emit('resource_changed', { resource: 'equipment' });
  assert.equal(inventory, closedInventory);
  assert.equal(promos, offersBefore + 2);
  stopPromos();
  assert.equal(socket.listenerCount('connect'), 0);
  assert.equal(socket.listenerCount('resource_changed'), 0);
});
