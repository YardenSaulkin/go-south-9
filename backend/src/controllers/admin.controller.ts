import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { CurrentUserService } from '../auth/current-user.service.js';
import { parseOrThrow } from '../common/validation.js';
import { AdminService } from '../services/admin.service.js';

const setRoleSchema = z.object({
  role: z.enum([UserRole.poc, UserRole.normal]),
});

@Controller('api/admin')
export class AdminController {
  constructor(
    private readonly users: CurrentUserService,
    private readonly admin: AdminService,
  ) {}

  private async requireAdmin(headerValue: string | undefined) {
    const user = await this.users.require(headerValue);
    if (user.role !== UserRole.admin) {
      throw new ForbiddenException('גישה מותרת למנהל בלבד');
    }
    return user;
  }

  @Get('users')
  async listUsers(@Headers('x-user-id') userId: string | undefined) {
    await this.requireAdmin(userId);
    return this.admin.listUsers();
  }

  @Patch('users/:id/role')
  async setRole(
    @Headers('x-user-id') userId: string | undefined,
    @Param('id') targetId: string,
    @Body() body: unknown,
  ) {
    await this.requireAdmin(userId);
    const { role } = parseOrThrow(setRoleSchema, body);
    await this.admin.setUserRole(targetId, role);
    return { success: true };
  }
}
