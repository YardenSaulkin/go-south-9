import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { CurrentUserService } from '../auth/current-user.service.js';
import { parseOrThrow } from '../common/validation.js';
import {
  analyzePhotoSchema,
  createReportSchema,
  insightsQuerySchema,
} from '../domain/facility.schemas.js';
import { FacilityAiService } from '../services/facility-ai.service.js';
import { FacilityInsightsService } from '../services/facility-insights.service.js';
import { FacilityReportService } from '../services/facility-report.service.js';

@Controller('api/facility')
export class FacilityController {
  constructor(
    private readonly users: CurrentUserService,
    private readonly ai: FacilityAiService,
    private readonly reports: FacilityReportService,
    private readonly insights: FacilityInsightsService,
  ) {}

  @Post('reports/analyze')
  async analyze(
    @Headers('x-user-id') userId: string | undefined,
    @Body() body: unknown,
  ) {
    await this.users.require(userId);
    return this.ai.analyzePhoto(parseOrThrow(analyzePhotoSchema, body));
  }

  @Post('reports')
  async createReport(
    @Headers('x-user-id') userId: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.users.require(userId);
    return this.reports.create(user, parseOrThrow(createReportSchema, body));
  }

  @Get('reports')
  async listReports(
    @Headers('x-user-id') userId: string | undefined,
    @Query('scope') scope: string | undefined,
  ) {
    const user = await this.users.require(userId);
    return this.reports.listForUser(user, scope === 'all' ? 'all' : 'mine');
  }

  @Get('reports/:id')
  async getReport(
    @Headers('x-user-id') userId: string | undefined,
    @Param('id') id: string,
  ) {
    await this.users.require(userId);
    return this.reports.getById(id);
  }

  @Get('insights')
  async getInsights(
    @Headers('x-user-id') userId: string | undefined,
    @Query() query: unknown,
  ) {
    await this.users.require(userId);
    const { days } = parseOrThrow(insightsQuerySchema, query);
    return this.insights.get(days);
  }
}
