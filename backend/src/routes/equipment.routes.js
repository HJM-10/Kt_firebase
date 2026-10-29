const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getAllEquipment, createEquipment, updateEquipment, deleteEquipment, rentEquipment, getMyRentals, getAllRentals } = require('../controllers/equipment.controller');

router.get('/', getAllEquipment);

router.use(authenticate);

router.post('/:id/rent', rentEquipment);
router.get('/my-rentals', getMyRentals);
router.post('/rentals/:id/cancel', require('../controllers/equipment.controller').cancelRental);

router.use(requireAdmin);
router.post('/rentals/:id/return', require('../controllers/equipment.controller').returnRental);

router.post('/', createEquipment);
router.put('/:id', updateEquipment);
router.delete('/:id', deleteEquipment);
router.get('/rentals/all', getAllRentals);

module.exports = router;
