import { randomUUID } from "node:crypto";
import { Op, literal } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { sequelize } from "../../database/sequelize";
import { BookingRoom, Participant, Room, Training, TrainingSession } from "../../database/models";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { appendRequestAuditTrail } from "../audit-trail/audit-trail.service";

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
async function nextRoomCode(transaction: Awaited<ReturnType<typeof sequelize.transaction>>) {
  const row = await Room.findOne({ attributes: [[literal("nextval('room_code_seq')"), "value"]], raw: true, transaction }) as unknown as { value: number | string | bigint };
  return codeFor(row.value);
}

roomsRouter.get("/eligible", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("ROOM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const participantCount = pageNumber(req.query.participantCount, 1, 100_000);
  if (!participantCount) return res.status(400).json({ message: "participantCount must be a positive integer" });
  const rooms = await Room.findAll({ where: { status: "ACTIVE" }, order: [["capacity", "ASC"], ["name", "ASC"]] });
  return res.json({ items: rooms.filter((room) => Number(room.capacity) >= participantCount).map(roomJson) });
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
