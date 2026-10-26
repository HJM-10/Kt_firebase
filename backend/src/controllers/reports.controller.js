const handleError = require('../middleware/errorHandler');
const prisma = require('../lib/prisma');

const getRevenueSummary = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { status: 'PAID' },
      select: { amount: true, updatedAt: true }
    });

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    // Group by month
    const revenueByMonth = {};
    payments.forEach(p => {
      const month = p.updatedAt.toISOString().substring(0, 7);
      revenueByMonth[month] = (revenueByMonth[month] || 0) + p.amount;
    });

    res.json({ success: true, data: { totalRevenue, revenueByMonth } });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getBookingAnalytics = async (req, res) => {
  try {
    const bookings = await prisma.booking.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statusCounts = {};
    bookings.forEach(b => {
      statusCounts[b.status] = b._count.id;
    });

    res.json({ success: true, data: { statusCounts } });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getUtilizationReport = async (req, res) => {
  try {
    const totalSlots = await prisma.bookingSlot.count();
    const bookedSlots = await prisma.bookingSlot.count({ where: { isBooked: true } });
    
    const utilizationRate = totalSlots > 0 ? (bookedSlots / totalSlots) * 100 : 0;
    
    res.json({ success: true, data: { totalSlots, bookedSlots, utilizationRate } });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getCustomerAnalytics = async (req, res) => {
  try {
    const totalCustomers = await prisma.user.count({ where: { role: 'CUSTOMER' } });
    
    // Top customers by spending
    const topCustomersRaw = await prisma.payment.groupBy({
      where: { status: 'PAID', user: { role: 'CUSTOMER' } },
      by: ['userId'],
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5
    });
    
    const userIds = topCustomersRaw.map(t => t.userId);
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
    
    const topCustomers = topCustomersRaw.map(t => ({
      user: users.find(u => u.id === t.userId),
      totalSpent: t._sum.amount || 0
    }));

    res.json({ success: true, data: { totalCustomers, topCustomers } });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const exportBookingsCsv = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        user: { select: { name: true, email: true } },
        slot: { include: { venue: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    let csv = 'ID,Date,User Name,User Email,Venue,Total Price,Status\n';
    bookings.forEach(b => {
      const date = b.createdAt.toISOString().split('T')[0];
      const venue = b.slot?.venue?.name || '';
      const cell = value => `"${String(value).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
      csv += `${b.id},${date},${cell(b.user.name)},${cell(b.user.email)},${cell(venue)},${b.finalPrice},${b.status}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="bookings.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

module.exports = { getRevenueSummary, getBookingAnalytics, getUtilizationReport, getCustomerAnalytics, exportBookingsCsv };

