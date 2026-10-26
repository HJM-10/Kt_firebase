const handleError = require('../middleware/errorHandler');
const prisma = require('../lib/prisma');

const getSports = async (req, res) => {
  try {
    const sports = await prisma.sport.findMany({
      where: { isActive: true },
      include: { _count: { select: { venues: true, tournaments: true } } },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: sports });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getSportById = async (req, res) => {
  try {
    const sport = await prisma.sport.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { venues: { where: { isActive: true } } }
    });
    if (!sport) return res.status(404).json({ success: false, message: 'Sport not found' });
    res.json({ success: true, data: sport });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const createSport = async (req, res) => {
  try {
    const { name, description, icon, imageUrl } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    const sport = await prisma.sport.create({ data: { name, description, icon, imageUrl } });
    res.status(201).json({ success: true, data: sport });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Sport already exists' });
    }
    console.error(err);
    handleError(err, req, res);
  }
};

const updateSport = async (req, res) => {
  try {
    const { name, description, icon, imageUrl, isActive } = req.body;
    const sport = await prisma.sport.update({
      where: { id: parseInt(req.params.id) },
      data: { name, description, icon, imageUrl, isActive }
    });
    res.json({ success: true, data: sport });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Sport not found' });
    }
    console.error(err);
    handleError(err, req, res);
  }
};

const deleteSport = async (req, res) => {
  try {
    await prisma.sport.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false }
    });
    res.json({ success: true, message: 'Sport deactivated' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Sport not found' });
    }
    console.error(err);
    handleError(err, req, res);
  }
};

module.exports = { getSports, getSportById, createSport, updateSport, deleteSport };

