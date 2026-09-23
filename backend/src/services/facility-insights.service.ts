import { Injectable } from '@nestjs/common';
import { ReportStatus, ReservationStatus } from '@prisma/client';
import {
  REPORT_CATEGORY_LABELS,
  WORKING_DAYS,
  WORKING_HOURS,
  hoursBetween,
  localDayAndHour,
} from '../domain/facility.js';
import { db } from '../lib/db.js';

interface Window {
  from: Date;
  to: Date;
}

// Every number on the insights screen is derived here from the reservation and
// report rows in the window, so the screen shows the compound's real activity.
@Injectable()
export class FacilityInsightsService {
  async get(days: number) {
    const now = new Date();
    const current: Window = {
      from: new Date(now.getTime() - days * 86_400_000),
      to: now,
    };
    const previous: Window = {
      from: new Date(current.from.getTime() - days * 86_400_000),
      to: current.from,
    };

    const [rooms, reservations, previousReservations, reports, previousReports] =
      await Promise.all([
        db.room.findMany({
          where: { isActive: true },
          select: { id: true, name: true, capacity: true, building: true },
        }),
        this.reservationsIn(current),
        this.reservationsIn(previous),
        this.reportsIn(current),
        this.reportsIn(previous),
      ]);

    const occupancy = occupancyRate(rooms.length, reservations, days);
    const previousOccupancy = occupancyRate(rooms.length, previousReservations, days);

    const openReports = reports.filter(
      (report) => report.status !== ReportStatus.resolved,
    ).length;
    const previousOpenReports = previousReports.filter(
      (report) => report.status !== ReportStatus.resolved,
    ).length;

    const responseHours = averageResponseHours(reports);
    const previousResponseHours = averageResponseHours(previousReports);

    return {
      windowDays: days,
      generatedAt: now,
      roomCount: rooms.length,
      occupancy: {
        rate: occupancy,
        changePercent: percentChange(occupancy, previousOccupancy),
      },
      reports: {
        total: reports.length,
        open: openReports,
        resolved: reports.length - openReports,
        changePercent: percentChange(openReports, previousOpenReports),
      },
      responseTime: {
        averageHours: responseHours,
        changePercent: percentChange(responseHours, previousResponseHours),
        // Reports still waiting have no response time yet, so the average is
        // reported together with how many rows it was measured on.
        sampleSize: reports.filter((report) => report.acknowledgedAt ?? report.resolvedAt)
          .length,
      },
      heatmap: buildHeatmap(reservations, rooms.length),
      categories: buildCategoryBreakdown(reports),
      busiestRooms: busiestRooms(rooms, reservations),
    };
  }

  private reservationsIn(window: Window) {
    return db.roomReservation.findMany({
      where: {
        status: ReservationStatus.booked,
        startAt: { lt: window.to },
        endAt: { gt: window.from },
      },
      select: { roomId: true, startAt: true, endAt: true },
    });
  }

  private reportsIn(window: Window) {
    return db.facilityReport.findMany({
      where: { createdAt: { gte: window.from, lt: window.to } },
      select: {
        category: true,
        status: true,
        createdAt: true,
        acknowledgedAt: true,
        resolvedAt: true,
      },
    });
  }
}

type ReservationRow = { roomId: string; startAt: Date; endAt: Date };
type ReportRow = {
  category: keyof typeof REPORT_CATEGORY_LABELS;
  status: ReportStatus;
  createdAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
};

// Booked hours as a share of the working hours available in the window.
function occupancyRate(
  roomCount: number,
  reservations: ReservationRow[],
  days: number,
): number {
  if (roomCount === 0) return 0;

  const workingDaysInWindow = Math.max(
    1,
    Math.round((days * WORKING_DAYS.length) / 7),
  );
  const capacityHours =
    roomCount * workingDaysInWindow * (WORKING_HOURS.end - WORKING_HOURS.start);
  const bookedHours = reservations.reduce(
    (total, reservation) => total + hoursBetween(reservation.startAt, reservation.endAt),
    0,
  );

  return round(Math.min(100, (bookedHours / capacityHours) * 100), 0);
}

function averageResponseHours(reports: ReportRow[]): number {
  const answered = reports
    .map((report) => report.acknowledgedAt ?? report.resolvedAt)
    .filter((date): date is Date => date !== null);
  if (answered.length === 0) return 0;

  const total = reports.reduce((sum, report) => {
    const answeredAt = report.acknowledgedAt ?? report.resolvedAt;
    return answeredAt ? sum + hoursBetween(report.createdAt, answeredAt) : sum;
  }, 0);

  return round(total / answered.length, 1);
}

// Day-of-week × hour grid of how heavily the rooms were booked, matching the
// working window the booking screen offers.
function buildHeatmap(reservations: ReservationRow[], roomCount: number) {
  const hours = Array.from(
    { length: WORKING_HOURS.end - WORKING_HOURS.start },
    (_, index) => WORKING_HOURS.start + index,
  );
  const counts = new Map<string, number>();

  for (const reservation of reservations) {
    // One bucket per booked hour, so a three hour booking fills three cells.
    for (
      let cursor = new Date(reservation.startAt);
      cursor < reservation.endAt;
      cursor = new Date(cursor.getTime() + 3_600_000)
    ) {
      const { day, hour } = localDayAndHour(cursor);
      if (!WORKING_DAYS.includes(day as (typeof WORKING_DAYS)[number])) continue;
      if (hour < WORKING_HOURS.start || hour >= WORKING_HOURS.end) continue;
      const key = `${day}:${hour}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return {
    days: [...WORKING_DAYS],
    hours,
    cells: WORKING_DAYS.map((day) =>
      hours.map((hour) => {
        const booked = counts.get(`${day}:${hour}`) ?? 0;
        return roomCount > 0 ? round(Math.min(100, (booked / roomCount) * 100), 0) : 0;
      }),
    ),
  };
}

function buildCategoryBreakdown(reports: ReportRow[]) {
  const counts = new Map<string, number>();
  for (const report of reports) {
    counts.set(report.category, (counts.get(report.category) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([category, count]) => ({
      category,
      label: REPORT_CATEGORY_LABELS[category as keyof typeof REPORT_CATEGORY_LABELS],
      count,
      percent: reports.length ? round((count / reports.length) * 100, 0) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function busiestRooms(
  rooms: { id: string; name: string }[],
  reservations: ReservationRow[],
) {
  const hoursByRoom = new Map<string, number>();
  for (const reservation of reservations) {
    hoursByRoom.set(
      reservation.roomId,
      (hoursByRoom.get(reservation.roomId) ?? 0) +
        hoursBetween(reservation.startAt, reservation.endAt),
    );
  }

  return rooms
    .map((room) => ({
      roomId: room.id,
      name: room.name,
      bookedHours: round(hoursByRoom.get(room.id) ?? 0, 1),
    }))
    .sort((a, b) => b.bookedHours - a.bookedHours)
    .slice(0, 5);
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round(((current - previous) / previous) * 100, 0);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
