const handleError = require('../middleware/errorHandler');
const prisma = require('../lib/prisma');

const getAllEquipment = async (req, res) => {
  try {
    const equipment = await prisma.equipment.findMany({
      include: { sport: { select: { name: true } } },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: equipment });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const createEquipment = async (req, res) => {
  try {
    const { name, description, sportId, pricePerSlot, quantity, imageUrl } = req.body;
    if (!name || !sportId) {
      return res.status(400).json({ success: false, message: 'Name and sportId are required' });
    }

    const eq = await prisma.equipment.create({
      data: {
        name, description, sportId: parseInt(sportId),
        pricePerSlot: parseFloat(pricePerSlot || 0),
        quantity: parseInt(quantity || 1),
        imageUrl
      }
    });

    res.status(201).json({ success: true, data: eq });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const updateEquipment = async (req, res) => {
  try {
    const { name, description, sportId, pricePerSlot, quantity, imageUrl, isActive } = req.body;
    const eq = await prisma.equipment.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name, description, sportId: sportId ? parseInt(sportId) : undefined,
        pricePerSlot: pricePerSlot !== undefined ? parseFloat(pricePerSlot) : undefined,
        quantity: quantity !== undefined ? parseInt(quantity) : undefined,
        imageUrl, isActive
      }
    });
    res.json({ success: true, data: eq });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const deleteEquipment = async (req, res) => {
  try {
    await prisma.equipment.update({ where: { id: parseInt(req.params.id) }, data: { isActive: false } });
    res.json({ success: true, message: 'Equipment deactivated; rental history retained' });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};


const rentEquipment = async (req, res) => {
  try {
    const { quantity, rentalDate, returnDate } = req.body;
    const equipmentId = parseInt(req.params.id);
    if (!Number.isSafeInteger(Number(quantity)) || Number(quantity) < 1 || !Number.isFinite(Date.parse(rentalDate)) || (returnDate && (!Number.isFinite(Date.parse(returnDate)) || new Date(returnDate) < new Date(rentalDate)))) return res.status(400).json({ success: false, message: 'Positive quantity and valid rental dates are required' });
    
    if (!quantity || !rentalDate) {
      return res.status(400).json({ success: false, message: 'quantity and rentalDate are required' });
    }

    const eq = await prisma.equipment.findUnique({ where: { id: equipmentId } });
    if (!eq) return res.status(404).json({ success: false, message: 'Equipment not found' });
    if (!eq.isActive) return res.status(400).json({ success: false, message: 'Equipment is currently unavailable' });
    if (eq.quantity < quantity) {
      return res.status(400).json({ success: false, message: `Only ${eq.quantity} available` });
    }

    const totalPrice = eq.pricePerSlot * quantity;

    const result = await prisma.$transaction(async (tx) => {
      await tx.equipment.update({ where: { id: equipmentId }, data: { updatedAt: new Date() } });
      const inventory = await tx.equipment.findUnique({ where: { id: equipmentId } });
      const start = new Date(new Date(rentalDate).toISOString().slice(0, 10));
      const end = returnDate ? new Date(new Date(returnDate).toISOString().slice(0, 10)) : start;
      const reserved = await tx.equipmentRental.aggregate({ where: { equipmentId, status: 'CONFIRMED', rentalDate: { lte: end }, OR: [{ returnDate: { gte: start } }, { returnDate: null, rentalDate: { gte: start } }] }, _sum: { quantity: true } });
      if (!inventory.isActive || (reserved._sum.quantity || 0) + Number(quantity) > inventory.quantity) throw Object.assign(new Error('Insufficient equipment available for these dates'), { status: 409 });
      const rental = await tx.equipmentRental.create({
        data: {
          userId: req.user.id,
          equipmentId,
          quantity: parseInt(quantity),
          totalPrice,
          rentalDate: new Date(rentalDate),
          returnDate: end,
          status: 'CONFIRMED'
        }
      });

      const payment = await tx.payment.create({
        data: {
          userId: req.user.id,
          amount: totalPrice,
          purpose: 'EQUIPMENT_RENTAL',
          rentalId: rental.id,
          status: totalPrice === 0 ? 'PAID' : 'PENDING'
        }
      });
      rental.paymentId = payment.id;

      return rental;
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getMyRentals = async (req, res) => {
  try {
    const rentals = await prisma.equipmentRental.findMany({
      where: { userId: req.user.id },
      include: { equipment: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: rentals });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getAllRentals = async (req, res) => {
  try {
    const rentals = await prisma.equipmentRental.findMany({
      include: { 
        equipment: true,
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: rentals });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

module.exports = { getAllEquipment, createEquipment, updateEquipment, deleteEquipment, rentEquipment, getMyRentals, getAllRentals };

