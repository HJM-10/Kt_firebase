const prisma = require('./prisma');
// Prisma may read a row before its UPDATE acquires the lock. READ COMMITTED
// ensures subsequent capacity/payment checks see the latest committed state.
module.exports = async (callback, options = {}) => {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(callback, { isolationLevel: 'ReadCommitted', ...options }); }
    catch (error) { if (error.code !== 'P2034' || attempt >= 2) throw error; }
  }
};
