const handleError = require('../middleware/errorHandler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const sanitizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    // Public registration always creates a customer.
    const userRole = 'CUSTOMER';

    const user = await prisma.user.create({
      data: { name, email: sanitizedEmail, password: hashed, phone, role: userRole },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ success: true, data: { user, token } });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const sanitizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.isActive) return res.status(401).json({ success: false, message: 'Account is inactive' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, data: { user: userWithoutPassword, token } });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true }
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, phone },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true }
    });
    res.json({ success: true, data: user });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) {
      return res.status(400).json({ success: false, code: 'INCORRECT_PASSWORD', message: 'Incorrect current password' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed }
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword };


