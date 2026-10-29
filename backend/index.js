const app = require('./src/app');
const http = require('http');
const prisma = require('./src/lib/prisma');
const socket = require('./src/lib/socket');

if (!process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32)) {
  throw new Error('Configure JWT_SECRET (at least 32 characters in production)');
}
const server = http.createServer(app);
socket.init(server);
const stopLifecycle = require('./src/lib/reservation-lifecycle').startLifecycleWorker();
socket.ready().then(() => server.listen(process.env.PORT || 5000, () => console.log('Smart Sports Hub API started'))).catch(() => { console.error('Cannot start shared live updates'); process.exitCode = 1; });
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    stopLifecycle();
    socket.getIO().close();
    server.close(async () => { await socket.close(); await prisma.$disconnect(); });
    setTimeout(() => process.exit(1), 25000).unref();
  });
}
