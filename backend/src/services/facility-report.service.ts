import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportStatus, UserRole } from '@prisma/client';
import type { ReportCategory, ReportUrgency } from '@prisma/client';
import type { CurrentUser } from '../auth/current-user.service.js';
import type { CreateReportInput } from '../domain/facility.schemas.js';
import {
  REPORT_CATEGORY_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_URGENCY_LABELS,
  routeReport,
} from '../domain/facility.js';
import { db } from '../lib/db.js';

const reportInclude = {
  room: { select: { id: true, name: true, building: true, floor: true } },
  reportedBy: {
    select: { id: true, firstName: true, lastName: true, personalNumber: true },
  },
} satisfies Prisma.FacilityReportInclude;

@Injectable()
export class FacilityReportService {
  // The photo is the heaviest column on the row and the lists never render it,
  // so it is only loaded when a single report is opened.
  private readonly listSelect = {
    id: true,
    reportNumber: true,
    objectLabel: true,
    issueDescription: true,
    category: true,
    urgency: true,
    status: true,
    locationDescription: true,
    assignedTeam: true,
    expectedResponseHours: true,
    aiConfidence: true,
    createdAt: true,
    acknowledgedAt: true,
    resolvedAt: true,
    room: reportInclude.room,
    reportedBy: reportInclude.reportedBy,
  } satisfies Prisma.FacilityReportSelect;

  async create(user: CurrentUser, input: CreateReportInput) {
    const existing = await db.facilityReport.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: reportInclude,
    });
    if (existing) return presentReport(existing);

    if (input.roomId) {
      const room = await db.room.findUnique({ where: { id: input.roomId } });
      if (!room) throw new NotFoundException('החדר שנבחר לא נמצא');
    }

    // The handling team and the response time are compound policy, derived
    // here rather than taken from the client.
    const routing = routeReport(input.category, input.urgency);

    const report = await db.facilityReport.create({
      data: {
        objectLabel: input.objectLabel,
        issueDescription: input.issueDescription,
        category: input.category,
        urgency: input.urgency,
        status: ReportStatus.open,
        locationDescription: input.locationDescription,
        roomId: input.roomId,
        photoDataUrl: input.photo,
        assignedTeam: routing.assignedTeam,
        expectedResponseHours: routing.expectedResponseHours,
        aiConfidence: input.aiConfidence,
        aiAnalysis: (input.aiAnalysis ?? undefined) as Prisma.InputJsonValue,
        reportedByUserId: user.id,
        orgScopeId: user.orgScopeId,
        idempotencyKey: input.idempotencyKey,
      },
      include: reportInclude,
    });

    return presentReport(report);
  }

  // Everyone follows the calls they opened; an admin can also review every
  // call in the compound, which is what the insights numbers are built from.
  async listForUser(user: CurrentUser, scope: 'mine' | 'all') {
    if (scope === 'all' && user.role !== UserRole.admin) {
      throw new ForbiddenException('צפייה בכל הקריאות מותרת למנהל בלבד');
    }

    const reports = await db.facilityReport.findMany({
      where: scope === 'mine' ? { reportedByUserId: user.id } : {},
      select: this.listSelect,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return reports.map((report) => presentReport(report));
  }

  async getById(id: string) {
    const report = await db.facilityReport.findUnique({
      where: { id },
      include: reportInclude,
    });
    if (!report) throw new NotFoundException('הקריאה לא נמצאה');
    return presentReport(report);
  }
}

// The fields the presentation below needs; both the list rows and the full
// rows satisfy it.
interface PresentableReport {
  category: ReportCategory;
  urgency: ReportUrgency;
  status: ReportStatus;
  createdAt: Date;
  expectedResponseHours: number;
}

// One shape for every screen: the raw row plus the Hebrew labels and the
// response deadline the confirmation and follow-up screens display.
function presentReport<T extends PresentableReport>(report: T) {
  const dueAt = new Date(
    report.createdAt.getTime() + report.expectedResponseHours * 3_600_000,
  );

  return {
    ...report,
    categoryLabel: REPORT_CATEGORY_LABELS[report.category],
    urgencyLabel: REPORT_URGENCY_LABELS[report.urgency],
    statusLabel: REPORT_STATUS_LABELS[report.status],
    dueAt,
  };
}
