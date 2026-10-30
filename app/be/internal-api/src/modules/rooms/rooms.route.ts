import { randomUUID } from "node:crypto";
import { Op, QueryTypes } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { sequelize } from "../../database/sequelize";
import { BookingRoom, Participant, RequestForm, Room, RoomReservation, Training, TrainingSession } from "../../database/models";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { appendRequestAuditTrail } from "../audit-trail/audit-trail.service";
import Joi from "joi";
import { validateBody } from "../../utils/joi-validation";

export const roomsRouter = Router();

type Facility = { name: string; amount: string };
function pageNumber(value: unknown, fallback: number, max: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
}
function validRoom(value: Record<string, unknown>): value is Record<string, unknown> & { name: string; capacity: number; facilities: Facility[]; status?: "ACTIVE" | "INACTIVE" } {
  return typeof value.name === "string" && value.name.trim().length > 0 && value.name.trim().length <= 150
    && Number.isSafeInteger(value.capacity) && Number(value.capacity) > 0
    && Array.isArray(value.facilities) && value.facilities.every((facility) => facility && typeof facility.name === "string"
      && facility.name.trim().length > 0 && facility.name.trim().length <= 150
      && (typeof facility.amount === "string" || typeof facility.amount === "number")
      && String(facility.amount).trim().length > 0 && String(facility.amount).length <= 30)
    && (value.status === undefined || value.status === "ACTIVE" || value.status === "INACTIVE");
}
function parseFacilities(value: string | null): Facility[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as Facility[];
  } catch { /* read legacy single-text facility values */ }
  return [{ name: value, amount: "1" }];
}
function roomJson(room: Room) {
  const item = room.toJSON() as Record<string, unknown>;
  return { ...item, facilities: parseFacilities(room.facilities) };
}
function codeFor(value: string | number | bigint) { return `TR-${String(value).padStart(2, "0")}`; }
const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};
const validTime = (value: unknown): value is string => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
function minutesToTime(value: number) { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}:00`; }
async function findRoomConflicts(roomId: string, date: string, startTime: string, endTime: string, transaction?: Awaited<ReturnType<typeof sequelize.transaction>>) {
  const startAt = new Date(`${date}T${startTime.slice(0, 5)}+07:00`);
  const endAt = new Date(`${date}T${endTime.slice(0, 5)}+07:00`);
  const [trainingBookings, independentBookings] = await Promise.all([
    BookingRoom.findAll({
      where: { room_id: roomId },
      include: [{ model: TrainingSession, as: "session", where: { starts_at: { [Op.lt]: endAt }, ends_at: { [Op.gt]: startAt } }, required: true,
        include: [{ model: Training, as: "training", where: { status: { [Op.in]: ["SCHEDULED", "ONGOING"] } }, required: true, attributes: ["id", "name", "request_form_id"] }] }],
      ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
    }),
    RoomReservation.findAll({ where: { room_id: roomId, booking_date: date, status: "BOOKED", start_time: { [Op.lt]: endTime }, end_time: { [Op.gt]: startTime } }, ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}) }),
  ]);
  const matchedTrainingBookings = trainingBookings;
  const trainingIds = matchedTrainingBookings.map((booking) => (booking.get("session") as TrainingSession).training_id);
  const trainings = trainingIds.length ? await Training.findAll({ where: { id: { [Op.in]: trainingIds } }, attributes: ["id", "name", "request_form_id"], transaction }) : [];
  const requestFormIds = trainings.map((training) => training.request_form_id);
  const forms = requestFormIds.length ? await RequestForm.findAll({ where: { id: { [Op.in]: requestFormIds } }, attributes: ["id", "request_form_number"], transaction }) : [];
  const trainingConflicts = matchedTrainingBookings.map((booking) => {
    const session = booking.get("session") as TrainingSession;
    const training = trainings.find((item) => item.id === session.training_id);
    const form = forms.find((item) => item.id === training?.request_form_id);
    const starts = new Date(session.starts_at.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(11, 16);
    const ends = new Date(session.ends_at.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(11, 16);
    return { kind: "TRAINING" as const, className: training?.name ?? "Training", classCode: form?.request_form_number ?? null, startTime: starts, endTime: ends };
  });
  const reservationConflicts = independentBookings.map((booking) => ({ kind: "ROOM_BOOKING" as const, className: booking.reason === "OTHERS" ? booking.reason_detail ?? "Other booking" : booking.reason, classCode: null, startTime: booking.start_time.slice(0, 5), endTime: booking.end_time.slice(0, 5) }));
  return [...trainingConflicts, ...reservationConflicts];
}
async function nextRoomCode(transaction: Awaited<ReturnType<typeof sequelize.transaction>>) {
  const [row] = await sequelize.query<{ value: number | string | bigint }>("SELECT nextval('room_code_seq') AS value", { type: QueryTypes.SELECT, transaction });
  return codeFor(row.value);
}

roomsRouter.get("/eligible", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("ROOM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const participantCount = pageNumber(req.query.participantCount, 1, 100_000);
  if (!participantCount) return res.status(400).json({ message: "participantCount must be a positive integer" });
  const rooms = await Room.findAll({ where: { status: "ACTIVE" }, order: [["capacity", "ASC"], ["name", "ASC"]] });
  return res.json({ items: rooms.filter((room) => Number(room.capacity) >= participantCount).map(roomJson) });
}));

roomsRouter.get("/availability", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("ROOM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const { date, startTime, endTime, roomId } = req.query;
  if (!validDate(date) || !validTime(startTime) || !validTime(endTime) || endTime <= startTime || typeof roomId !== "string") return res.status(400).json({ message: "Choose a valid date, room, and time range." });
  const room = await Room.findOne({ where: { id: roomId, status: "ACTIVE" } });
  if (!room) return res.status(404).json({ message: "Training Room not found or inactive." });
  const conflicts = await findRoomConflicts(roomId, date, `${startTime}:00`, `${endTime}:00`);
  return res.json({ available: conflicts.length === 0, room: roomJson(room), date, startTime, endTime, conflicts });
}));

roomsRouter.get("/bookings", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("ROOM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const page = pageNumber(req.query.page, 1, 100_000);
  const pageSize = pageNumber(req.query.pageSize, 8, 100);
  const reason = req.query.reason;
  const search = req.query.search;
  const date = req.query.date;
  if (!page || !pageSize || (reason !== undefined && reason !== "ALL" && !["MEETING", "EVENTS", "WORKSHOP", "OTHERS"].includes(String(reason))) || (search !== undefined && (typeof search !== "string" || search.length > 150)) || (date !== undefined && !validDate(date))) return res.status(400).json({ message: "Invalid room booking filters." });
  const reasonFilter = typeof reason === "string" && ["MEETING", "EVENTS", "WORKSHOP", "OTHERS"].includes(reason) ? reason as "MEETING" | "EVENTS" | "WORKSHOP" | "OTHERS" : "ALL";
  const searchText = typeof search === "string" ? search : "";
  const searchPattern = searchText ? `%${searchText.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  const where = { status: "BOOKED", ...(typeof date === "string" ? { booking_date: date } : {}), ...(reasonFilter !== "ALL" ? { reason: reasonFilter } : {}), ...(searchPattern ? { [Op.or]: [{ detail_booking: { [Op.iLike]: searchPattern } }, { "$room.name$": { [Op.iLike]: searchPattern } }, { "$room.room_code$": { [Op.iLike]: searchPattern } }] } : {}) };
  const { rows, count } = await RoomReservation.findAndCountAll({ where, include: [{ model: Room, as: "room", attributes: ["name", "room_code"], required: true }], distinct: true, order: [["booking_date", "DESC"], ["start_time", "ASC"]], limit: pageSize, offset: (page - 1) * pageSize });
  return res.json({ items: rows.map((booking) => ({ ...booking.toJSON(), room: (booking.get("room") as Room).toJSON() })), page, pageSize, total: count });
}));

roomsRouter.post("/bookings", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("ROOM", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const schema = Joi.object({
    roomId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required(),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    startTime: Joi.string().pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/).required(),
    durationMinutes: Joi.number().integer().min(15).max(720).required(),
    reason: Joi.string().valid("MEETING", "EVENTS", "WORKSHOP", "OTHERS").required(),
    reasonDetail: Joi.string().max(255).allow("").default(""),
    detailBooking: Joi.string().trim().min(1).max(1000).required(),
  }).custom((value, helpers) => {
    const [year, month, day] = value.date.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return helpers.error("any.invalid");
    if (value.reason === "OTHERS" && !value.reasonDetail.trim()) return helpers.error("any.invalid");
    if (toMinutes(value.startTime) + value.durationMinutes >= 24 * 60) return helpers.error("any.invalid");
    return value;
  }).messages({ "any.invalid": "Check the date, booking duration, and reason details." });
  const value = validateBody<{ roomId: string; date: string; startTime: string; durationMinutes: number; reason: "MEETING" | "EVENTS" | "WORKSHOP" | "OTHERS"; reasonDetail: string; detailBooking: string }>(schema, req.body);
  const endTime = minutesToTime(toMinutes(value.startTime) + value.durationMinutes);
  const transaction = await sequelize.transaction();
  try {
    const room = await Room.findByPk(value.roomId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!room || room.status !== "ACTIVE") throw new AppError(409, "This Training Room is no longer available.");
    const conflicts = await findRoomConflicts(room.id, value.date, `${value.startTime}:00`, endTime, transaction);
    if (conflicts.length) {
      const conflict = conflicts[0];
      throw new AppError(409, `This room conflicts with ${conflict.classCode ? `${conflict.classCode} (${conflict.className})` : conflict.className} on ${value.date}, ${conflict.startTime}-${conflict.endTime}.`);
    }
    const booking = await RoomReservation.create({ id: randomUUID(), room_id: room.id, booking_date: value.date, start_time: `${value.startTime}:00`, end_time: endTime, reason: value.reason, reason_detail: value.reason === "OTHERS" ? value.reasonDetail.trim() : null, detail_booking: value.detailBooking.trim(), status: "BOOKED", created_by_subject: req.auth!.userId }, { transaction });
    await appendRequestAuditTrail(req, { action: "CREATE", objectType: "ROOM_RESERVATION", objectId: booking.id, after: { room_id: room.id, room_name: room.name, booking_date: value.date, start_time: booking.start_time, end_time: booking.end_time, reason: booking.reason, reason_detail: booking.reason_detail, detail_booking: booking.detail_booking }, processName: "room-reservation-create" }, transaction);
    await transaction.commit();
    return res.status(201).json({ item: booking });
  } catch (error) { await transaction.rollback(); throw error; }
}));

roomsRouter.get("/", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("ROOM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const page = pageNumber(req.query.page, 1, 100_000);
  const pageSize = pageNumber(req.query.pageSize, 8, 100);
  if (!page || !pageSize) return res.status(400).json({ message: "Invalid pagination" });
  const search = req.query.search;
  const status = req.query.status;
  const minCapacity = req.query.minCapacity;
  if (search !== undefined && (typeof search !== "string" || search.length > 150)) return res.status(400).json({ message: "Invalid search" });
  if (status !== undefined && status !== "ALL" && status !== "ACTIVE" && status !== "INACTIVE") return res.status(400).json({ message: "Invalid status" });
  if (minCapacity !== undefined && (typeof minCapacity !== "string" || !/^\d+$/.test(minCapacity) || Number(minCapacity) < 1 || Number(minCapacity) > 100_000)) return res.status(400).json({ message: "Invalid minimum capacity" });
  const escapedSearch = search ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  const where = {
    ...(escapedSearch ? { [Op.or]: [
      { room_code: { [Op.iLike]: escapedSearch } },
      { name: { [Op.iLike]: escapedSearch } },
      { facilities: { [Op.iLike]: escapedSearch } },
    ] } : {}),
    ...(status && status !== "ALL" ? { status } : {}),
    ...(minCapacity ? { capacity: { [Op.gte]: Number(minCapacity) } } : {}),
  };
  const { count, rows } = await Room.findAndCountAll({
    where,
    order: [["room_code", "ASC"]],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return res.json({ items: rows.map(roomJson), page, pageSize, total: count });
}));

roomsRouter.get("/:id", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("ROOM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const room = await Room.findByPk(req.params.id);
  return room ? res.json({ item: roomJson(room) }) : res.status(404).json({ message: "Training Room not found" });
}));

roomsRouter.post("/", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("ROOM", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  if (!validRoom(body)) return res.status(400).json({ message: "Training Room details are invalid" });
  const transaction = await sequelize.transaction();
  try {
    const room = await Room.create({ id: randomUUID(), room_code: await nextRoomCode(transaction), name: body.name.trim(), capacity: body.capacity, facilities: JSON.stringify(body.facilities.map((facility) => ({ name: facility.name.trim(), amount: String(facility.amount).trim() }))), status: body.status ?? "ACTIVE" }, { transaction });
    await appendRequestAuditTrail(req, { action: "CREATE", objectType: "ROOM", objectId: room.id, after: { room_code: room.room_code, name: room.name, capacity: room.capacity, facilities: parseFacilities(room.facilities), status: room.status }, processName: "training-room-create" }, transaction);
    await transaction.commit();
    return res.status(201).json({ item: roomJson(room) });
  } catch (error) { await transaction.rollback(); throw error; }
}));

roomsRouter.put("/:id", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("ROOM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  if (!validRoom(body) || !body.status) return res.status(400).json({ message: "Training Room details are invalid" });
  const transaction = await sequelize.transaction();
  try {
    const room = await Room.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!room) { await transaction.rollback(); return res.status(404).json({ message: "Training Room not found" }); }
    if (body.capacity < Number(room.capacity)) {
      const trainings = await Training.findAll({
        attributes: ["id", "name"],
        where: { status: { [Op.in]: ["SCHEDULED", "ONGOING"] } },
        include: [
          { model: TrainingSession, as: "sessions", attributes: ["starts_at"], required: true,
            include: [{ model: BookingRoom, as: "roomBookings", attributes: [], where: { room_id: room.id }, required: true }] },
          { model: Participant, as: "participants", attributes: ["id"], required: false },
        ],
        transaction,
      });
      const conflicts = trainings
        .map((training) => ({ training_name: training.name, participant_count: (training.get("participants") as Array<{ id: string }> | undefined)?.length ?? 0 }))
        .filter((training) => training.participant_count > body.capacity);
      if (conflicts.length) {
        await transaction.rollback();
        const details = conflicts.map((item) => `${item.training_name} (${item.participant_count} students)`).join(", ");
        return res.status(409).json({ message: `Capacity cannot be reduced to ${body.capacity}; scheduled training exceeds the new capacity: ${details}.` });
      }
    }
    const before = { room_code: room.room_code, name: room.name, capacity: room.capacity, facilities: parseFacilities(room.facilities), status: room.status };
    await room.update({ name: body.name.trim(), capacity: body.capacity, facilities: JSON.stringify(body.facilities.map((facility) => ({ name: facility.name.trim(), amount: String(facility.amount).trim() }))), status: body.status }, { transaction });
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "ROOM", objectId: room.id, before, after: { room_code: room.room_code, name: room.name, capacity: room.capacity, facilities: parseFacilities(room.facilities), status: room.status }, processName: "training-room-update" }, transaction);
    await transaction.commit();
    return res.json({ item: roomJson(room) });
  } catch (error) { await transaction.rollback(); throw error; }
}));

roomsRouter.delete("/:id", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("ROOM", ACCESS_ACTIONS.DELETE), asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const room = await Room.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!room) { await transaction.rollback(); return res.status(404).json({ message: "Training Room not found" }); }
    const bookings = await BookingRoom.count({ where: { room_id: room.id }, transaction });
    if (bookings > 0) { await transaction.rollback(); return res.status(409).json({ message: "This Training Room has a booking and cannot be deleted." }); }
    await appendRequestAuditTrail(req, { action: "DELETE", objectType: "ROOM", objectId: room.id, before: { room_code: room.room_code, name: room.name, capacity: room.capacity, status: room.status }, processName: "training-room-delete" }, transaction);
    await room.destroy({ transaction });
    await transaction.commit();
    return res.status(204).end();
  } catch (error) { await transaction.rollback(); if ((error as { name?: string }).name === "SequelizeForeignKeyConstraintError") return res.status(409).json({ message: "This Training Room has a booking and cannot be deleted." }); throw error; }
}));
