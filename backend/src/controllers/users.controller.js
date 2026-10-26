const handleError = require('../middleware/errorHandler');
const prisma = require('../lib/prisma');

const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            bookings: true,
            payments: true,
            complaints: true
          }
        },
        bookings: {
          select: {
            finalPrice: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate total spent for each user
    const usersWithStats = users.map(user => {
      const totalSpent = user.bookings
        .filter(b => b.status === 'CONFIRMED' || b.status === 'SCANNED')
        .reduce((sum, b) => sum + b.finalPrice, 0);
      
      const { bookings, ...userData } = user; // remove raw bookings array
      return {
        ...userData,
        totalSpent
      };
    });

    res.json({ success: true, data: usersWithStats });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['ADMIN', 'CUSTOMER'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { role },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true }
    });
    res.json({ success: true, message: 'User role updated', data: user });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    await prisma.$transaction(async (tx) => {
      // Mark user as inactive
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false }
      });

      // Cancel all upcoming active bookings
      const activeBookings = await tx.booking.findMany({
        where: {
          userId,
          status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }
        },
        include: { slot: true }
      });

      for (const b of activeBookings) {
        await tx.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED' } });
        await tx.bookingSlot.update({ where: { id: b.slotId }, data: { isBooked: false } });
        await tx.payment.updateMany({ where: { bookingId: b.id, status: 'PENDING' }, data: { status: 'FAILED' } });
      }
    });

    res.json({ success: true, message: 'User marked as inactive and future bookings cancelled' });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

module.exports = { getUsers, updateUserRole, deleteUser };

