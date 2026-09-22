import Joi from 'joi';
import { Booking } from '../models/Booking.js';

const createSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required(),
  purpose: Joi.string().allow('').optional(),
  bookedBy: Joi.string().hex().length(24).optional()
});

const updateSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  purpose: Joi.string().allow(''),
  bookedBy: Joi.string().hex().length(24)
}).min(1);

function findConflict(booking, excludeId) {
  const query = {
    roomNumber: booking.roomNumber,
    startDate: { $lt: booking.endDate },
    endDate: { $gt: booking.startDate }
  };

  if (excludeId) query._id = { $ne: excludeId };
  return Booking.findOne(query);
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .populate('bookedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('bookedBy', 'name email');

    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) return res.status(400).json({ message: error.message });

    const conflict = await findConflict(value);
    if (conflict) {
      return res.status(409).json({
        message: 'This room is already booked during that time'
      });
    }

    const booking = await Booking.create(value);
    await booking.populate('bookedBy', 'name email');
    res.status(201).json({ booking });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) return res.status(400).json({ message: error.message });

    const proposed = {
      roomNumber: value.roomNumber ?? booking.roomNumber,
      startDate: value.startDate ?? booking.startDate,
      endDate: value.endDate ?? booking.endDate,
      purpose: value.purpose ?? booking.purpose,
      bookedBy: value.bookedBy ?? booking.bookedBy?.toString()
    };
    const validated = createSchema.validate(proposed, {
      abortEarly: false,
      stripUnknown: true
    });
    if (validated.error) {
      return res.status(400).json({ message: validated.error.message });
    }

    const conflict = await findConflict(validated.value, req.params.id);
    if (conflict) {
      return res.status(409).json({
        message: 'This room is already booked during that time'
      });
    }

    booking.set(validated.value);
    await booking.save();
    await booking.populate('bookedBy', 'name email');
    res.json({ booking });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
