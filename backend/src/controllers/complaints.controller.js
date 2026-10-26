const handleError = require('../middleware/errorHandler');
const prisma = require('../lib/prisma');
const { createNotification } = require('../lib/notifications');
const socket = require('../lib/socket');

const submitComplaint = async (req, res) => {
  try {
    const { title, description, category } = req.body;
    if (typeof title !== 'string' || !title.trim() || title.length > 191 || typeof description !== 'string' || !description.trim() || description.length > 10000 || (category != null && (typeof category !== 'string' || category.length > 191))) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const complaint = await prisma.complaint.create({
      data: {
        userId: req.user.id,
        title,
        description,
        category: category || 'General',
        status: 'OPEN'
      }
    });
    
    // Notify admin
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    await Promise.all(admins.map(admin => createNotification(admin.id, 'New Complaint', `A new complaint has been filed: ${title}`, 'COMPLAINT')));

    res.status(201).json({ success: true, data: complaint });
    try { socket.getIO().emit('complaint_updated', {}); } catch (e) {}
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getMyComplaints = async (req, res) => {
  try {
    const complaints = await prisma.complaint.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: complaints });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getAllComplaints = async (req, res) => {
  try {
    const complaints = await prisma.complaint.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: complaints });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;

    if (!Number.isSafeInteger(Number(id)) || Number(id) < 1 || (status === undefined && adminNote === undefined) || (adminNote !== undefined && (typeof adminNote !== 'string' || adminNote.length > 10000))) return res.status(400).json({ success: false, message: 'Valid complaint status or response required' });

    const complaint = await prisma.complaint.findUnique({ where: { id: parseInt(id) } });
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    const updated = await prisma.complaint.update({
      where: { id: parseInt(id) },
      data: { status, adminNote }
    });

    if ((status !== undefined && status !== complaint.status) || (adminNote !== undefined && adminNote !== complaint.adminNote)) {
      await createNotification(
        complaint.userId, 
        'Complaint Update', 
        `Your complaint "${complaint.title}" has an update: ${status || complaint.status}.${adminNote ? ' Response: ' + adminNote : ''}`,
        'COMPLAINT'
      );
    }

    res.json({ success: true, data: updated });
    try { socket.getIO().emit('complaint_updated', {}); } catch (e) {}
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

module.exports = { submitComplaint, getMyComplaints, getAllComplaints, updateComplaintStatus };


