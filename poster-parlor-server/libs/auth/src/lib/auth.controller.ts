// auth/auth.controller.ts
import {
  Body,
  Controller,
  Post,
  Res,
  Req,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from '@poster-parler/models';
import { RequestUser } from '@poster-parler/common';
import { HttpResponseUtil } from '@poster-parler/utils';
import { Auth, Public } from '../decorators/auth.decorators';

@Controller('auth/google')
export class GoogleAuthController {
  constructor(private readonly googleAuthService: AuthService) {}
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.googleAuthService.loginWithGoogle(
      dto.idToken,
      res
    );

    return HttpResponseUtil.created(result, 'User registered successfully');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request) {
    const token = req.cookies?.['refresh_token'];

    if (!token) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = this.googleAuthService.refreshAccessToken(token);

    return HttpResponseUtil.created(result, 'Fetched refresh token');
  }
  @Auth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    const _result = this.googleAuthService.logout(res);
    return HttpResponseUtil.success(null, (await _result).message);
  }
  @Auth()
  @Get('me')
  async getCurrentUser(@Req() req: Request & { user: RequestUser }) {
    const result = req.user;
    return result;
  }
}
