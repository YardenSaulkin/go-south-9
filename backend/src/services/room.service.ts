import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import type { CurrentUser } from '../auth/current-user.service.js';
import type {
  CreateReservationInput,
  RoomAvailabilityInput,
  RoomSearchInput,
} from '../domain/facility.schemas.js';
import { db } from '../lib/db.js';

const roomSelect = {
  id: true,
  name: true,
  building: true,
  floor: true,
  capacity: true,
  features: true,
  imageUrl: true,
  description: true,
} satisfies Prisma.RoomSelect;

@Injectable()
export class RoomService {
  // Search returns every matching room; when a time window is supplied each
  // room also carries whether it is free, so the results list can show both
  // available and taken rooms without a second round trip.
  async search(input: RoomSearchInput) {
    const where: Prisma.RoomWhereInput = { isActive: true };

    if (input.q) {
      where.OR = [
        { name: { contains: input.q, mode: 'insensitive' } },
        { building: { contains: input.q, mode: 'insensitive' } },
        { description: { contains: input.q, mode: 'insensitive' } },
      ];
    }
    if (input.minCapacity) where.capacity = { gte: input.minCapacity };
    if (input.maxCapacity) {
      where.capacity = { ...(where.capacity as object), lte: input.maxCapacity };
    }
    if (input.features?.length) where.features = { hasEvery: input.features };

    const rooms = await db.room.findMany({
      where,
      select: roomSelect,
      orderBy: [{ building: 'asc' }, { name: 'asc' }],
    });

    if (!input.startAt || !input.endAt) {
      return rooms.map((room) => ({ ...room, isAvailable: true }));
    }

    const overlapping = await db.roomReservation.findMany({
      where: {
        roomId: { in: rooms.map((room) => room.id) },
        status: ReservationStatus.booked,
        startAt: { lt: input.endAt },
        endAt: { gt: input.startAt },
      },
      select: { roomId: true },
    });
    const takenRoomIds = new Set(overlapping.map((r) => r.roomId));

    return rooms.map((room) => ({
      ...room,
      isAvailable: !takenRoomIds.has(room.id),
    }));
  }

  // The booking screen draws its slot strip from the reservations in the day
  // window it asks for, so a taken hour is never offered.
  async getWithAvailability(roomId: string, input: RoomAvailabilityInput) {
    const room = await db.room.findUnique({ where: { id: roomId }, select: roomSelect });
    if (!room) throw new NotFoundException('החדר לא נמצא');

    const reservations = await db.roomReservation.findMany({
      where: {
        roomId,
        status: ReservationStatus.booked,
        startAt: { lt: input.to },
        endAt: { gt: input.from },
      },
      select: { id: true, startAt: true, endAt: true, title: true, userId: true },
      orderBy: { startAt: 'asc' },
    });

    return { room, reservations };
  }

  async reserve(user: CurrentUser, roomId: string, input: CreateReservationInput) {
    const existing = await db.roomReservation.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { room: { select: roomSelect } },
    });
    if (existing) return existing;

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room || !room.isActive) throw new NotFoundException('החדר לא נמצא');

    if (input.attendees && input.attendees > room.capacity) {
      throw new ConflictException(
        `החדר מתאים ל-${room.capacity} משתתפים בלבד`,
      );
    }

    const conflict = await db.roomReservation.findFirst({
      where: {
        roomId,
        status: ReservationStatus.booked,
        startAt: { lt: input.endAt },
        endAt: { gt: input.startAt },
      },
      select: { id: true },
    });
    if (conflict) throw new ConflictException('החדר כבר תפוס בשעה שנבחרה');

    try {
      return await db.roomReservation.create({
        data: {
          roomId,
          userId: user.id,
          title: input.title,
          attendees: input.attendees,
          startAt: input.startAt,
          endAt: input.endAt,
          idempotencyKey: input.idempotencyKey,
        },
        include: { room: { select: roomSelect } },
      });
    } catch (error) {
      // Two clients can pass the check above at the same time; the exclusion
      // constraint on room_reservations is what actually settles the race.
      if (
        error instanceof Error &&
        /room_reservations_no_overlap|23P01/.test(error.message)
      ) {
        throw new ConflictException('החדר כבר תפוס בשעה שנבחרה');
      }
      throw error;
    }
  }

  async listMyReservations(user: CurrentUser) {
    return db.roomReservation.findMany({
      where: { userId: user.id, status: ReservationStatus.booked },
      include: { room: { select: roomSelect } },
      orderBy: { startAt: 'asc' },
      take: 50,
    });
  }
}
