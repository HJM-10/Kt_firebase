const { z } = require('zod');
const id = z.coerce.number().int().positive();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Invalid date');

const authSchemas = {
  register: z.object({
    body: z.object({
      name: z.string().min(2, 'Name must be at least 2 characters'),
      email: z.string().email('Invalid email address'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
      phone: z.string().optional(),
      role: z.literal('CUSTOMER').optional()
    })
  }),
  login: z.object({
    body: z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(1, 'Password is required'),
    })
  }),
  updateProfile: z.object({
    body: z.object({
      name: z.string().min(2, 'Name must be at least 2 characters').optional(),
      phone: z.string().optional()
    })
  }),
  changePassword: z.object({
    body: z.object({
      oldPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().min(6, 'New password must be at least 6 characters')
    })
  })
};

const bookingSchemas = {
  createSlot: z.object({
    body: z.object({
      venueId: id,
      date,
      startTime: time,
      endTime: time,
    }).refine(value => value.endTime > value.startTime, 'End time must be after start time')
  }),
  createBooking: z.object({
    body: z.object({
      slotId: id,
      notes: z.string().max(2000).optional(),
      promoCode: z.string().max(100).optional(),
      walkInName: z.string().max(100).optional(),
      walkInPhone: z.string().max(30).optional()
    })
  })
};

module.exports = { authSchemas, bookingSchemas };
