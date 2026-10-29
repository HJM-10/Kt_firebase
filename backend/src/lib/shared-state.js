let state;
function sharedState() {
  if (!process.env.REDIS_URL) return null;
  if (!state) {
    const { createClient } = require('redis');
    const client = createClient({ url: process.env.REDIS_URL, disableOfflineQueue: true, commandsQueueMaxLength: 1000, socket: { connectTimeout: 5000 } });
    client.on('error', () => console.error('Shared state connection unavailable'));
    state = { client, ready: client.connect() };
    state.ready.catch(() => {});
  }
  return state;
}
function rateLimitStore(prefix) {
  const shared = sharedState();
  if (!shared) return {};
  const { RedisStore } = require('rate-limit-redis');
  return { store: new RedisStore({ prefix: `arena:${prefix}:`, sendCommand: async (...args) => {
    await shared.ready;
    if (!shared.client.isReady) throw Object.assign(new Error('Shared rate limiter is unavailable'), { status: 503 });
    return shared.client.sendCommand(args);
  } }) };
}
async function close() { if (state?.client.isOpen) await state.client.close(); }
module.exports = { sharedState, rateLimitStore, close };
