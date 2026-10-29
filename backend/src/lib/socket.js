const { Server } = require('socket.io');

let io;
let subscriber;
let ready = Promise.resolve();

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(','),
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
      }
    });
    const shared = require('./shared-state').sharedState();
    if (shared) {
      subscriber = shared.client.duplicate();
      subscriber.on('error', () => console.error('Live update subscription unavailable'));
      ready = Promise.all([shared.ready, subscriber.connect()]).then(() => {
        io.adapter(require('@socket.io/redis-adapter').createAdapter(shared.client, subscriber));
      });
      ready.catch(() => {});
    }
    return io;
  },
  ready: () => ready,
  healthy: () => !subscriber || subscriber.isReady,
  close: async () => { if (subscriber?.isOpen) await subscriber.close(); await require('./shared-state').close(); },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!');
    }
    return io;
  }
};
