const mockClient = { isReady: true, isOpen: true, on: jest.fn(), connect: jest.fn(() => Promise.resolve()), sendCommand: jest.fn(() => Promise.resolve(1)), close: jest.fn() };
jest.mock('redis', () => ({ createClient: jest.fn(() => mockClient) }));
jest.mock('rate-limit-redis', () => ({ RedisStore: jest.fn(function(options) { this.options = options; }) }));
let original;
beforeEach(() => { original = process.env.REDIS_URL; jest.resetModules(); jest.clearAllMocks(); });
afterEach(() => { if (original === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = original; });
test('single-instance mode requires no Redis connection', () => {
  delete process.env.REDIS_URL;
  const state = require('../src/lib/shared-state');
  expect(state.sharedState()).toBeNull(); expect(state.rateLimitStore('login')).toEqual({}); expect(require('redis').createClient).not.toHaveBeenCalled();
});
test('replicas use deterministic isolated limiter keys and one client', async () => {
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  const state = require('../src/lib/shared-state');
  const first = state.rateLimitStore('auth').store, second = state.rateLimitStore('login').store;
  expect(first.options.prefix).toBe('arena:auth:'); expect(second.options.prefix).toBe('arena:login:');
  await first.options.sendCommand('PING'); expect(mockClient.sendCommand).toHaveBeenCalledWith(['PING']); expect(require('redis').createClient).toHaveBeenCalledTimes(1);
});
test('shared limiter fails closed when its connection is unavailable', async () => {
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  const state = require('../src/lib/shared-state');
  const store = state.rateLimitStore('login').store; mockClient.isReady = false;
  await expect(store.options.sendCommand('INCR', 'key')).rejects.toMatchObject({ status: 503 });
  mockClient.isReady = true; await state.close(); expect(mockClient.close).toHaveBeenCalled();
});
