import { Body, Controller, Post } from '@nestjs/common';
import { loginSchema, signupSchema } from '../auth/auth.schemas.js';
import { parseOrThrow } from '../common/validation.js';
import { AuthService } from '../services/auth.service.js';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  async signup(@Body() body: unknown) {
    const user = await this.auth.signup(parseOrThrow(signupSchema, body));
    return { user };
  }

  @Post('login')
  async login(@Body() body: unknown) {
    const user = await this.auth.login(parseOrThrow(loginSchema, body));
    return { user };
  }
}
