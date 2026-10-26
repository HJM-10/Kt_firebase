const handleError = require('../middleware/errorHandler');
const prisma = require('../lib/prisma');

const validatePromo = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Promo code is required' });

    const promo = await prisma.promoCode.findUnique({ where: { code } });
    if (!promo || !promo.isActive) {
      return res.status(404).json({ success: false, message: 'Invalid or inactive promo code' });
    }

    if (promo.expiresAt && new Date() > promo.expiresAt) {
      return res.status(400).json({ success: false, message: 'Promo code expired' });
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return res.status(400).json({ success: false, message: 'Promo code usage limit reached' });
    }

    res.json({ success: true, data: promo });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getAllPromos = async (req, res) => {
  try {
    const promos = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: promos });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const createPromo = async (req, res) => {
  try {
    const { code, discountType, discountValue, maxUses, minOrderAmount, expiresAt } = req.body;
    
    if (!code || !discountValue) {
      return res.status(400).json({ success: false, message: 'code and discountValue are required' });
    }

    const existing = await prisma.promoCode.findUnique({ where: { code } });
    if (existing) return res.status(409).json({ success: false, message: 'Promo code already exists' });

    const promo = await prisma.promoCode.create({
      data: {
        code,
        discountType: discountType || 'PERCENTAGE',
        discountValue: parseFloat(discountValue),
        maxUses: maxUses ? parseInt(maxUses) : null,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }
    });
    res.status(201).json({ success: true, data: promo });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const updatePromo = async (req, res) => {
  try {
    const { isActive, maxUses, expiresAt } = req.body;
    const promo = await prisma.promoCode.update({
      where: { id: parseInt(req.params.id) },
      data: {
        isActive,
        maxUses: maxUses !== undefined ? parseInt(maxUses) : undefined,
        expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : undefined
      }
    });
    res.json({ success: true, data: promo });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

module.exports = { validatePromo, getAllPromos, createPromo, updatePromo };

