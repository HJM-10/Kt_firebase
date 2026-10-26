// Local-only entry point; uses the actual application and authorization middleware.
require('dotenv').config({ quiet: true });
const database = new URL(process.env.DATABASE_URL);
if (process.env.NODE_ENV === 'production' || database.hostname !== '127.0.0.1' || database.port !== '3307' || database.pathname !== '/smart_sports_hub_demo') throw new Error('Requires isolated local demo database');
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
const app = require('../src/app');
const server = require('node:http').createServer(app);
const socket = require('../src/lib/socket');
const prisma = require('../src/lib/prisma');
socket.init(server);
const stopLifecycle = require('../src/lib/reservation-lifecycle').startLifecycleWorker();
server.listen(5000, '127.0.0.1', () => console.log('Demo API ready at http://127.0.0.1:5000/api'));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  stopLifecycle();
  socket.getIO().close();
  server.close(async () => { await prisma.$disconnect(); });
});
