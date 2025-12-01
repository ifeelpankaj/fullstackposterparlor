/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '@poster-parler/models';
import { ConfigService } from '@nestjs/config';
import { config_keys } from '@poster-parler/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { UnauthorizedException } from '@poster-parler/utils';
import { AuthResponse, JwtTokenPayload, Tokens } from '@poster-parler/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';

@Injectable()
export class AuthService {
  private readonly jwtExpiresIn: number;
  private readonly client: OAuth2Client;
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {
    this.jwtExpiresIn = parseInt(
      this.configService.get<string>(config_keys.JWT_ACCESS_TOKEN_EXPIRATION) ||
        '3600'
    );
    const clientId = this.configService.get<string>(
      config_keys.GOOGLE_CLIENT_ID
    );

    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured');
    }

    this.client = new OAuth2Client(clientId);
  }
  async verifyGoogleToken(idToken: string): Promise<TokenPayload> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.configService.get<string>(config_keys.GOOGLE_CLIENT_ID),
      });

      const payload = ticket.getPayload();

      if (!payload?.email || !payload.email_verified) {
        throw new UnauthorizedException('Invalid token or email not verified');
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid Google token', error);
    }
  }
  async loginWithGoogle(idToken: string, res: Response): Promise<AuthResponse> {
    const googlePayload = await this.verifyGoogleToken(idToken);

    const { email, name, sub: googleId } = googlePayload;

    if (!email || !name) {
      throw new UnauthorizedException('Missing required user information');
    }

    let user = await this.userModel.findOne({ email }).exec();

    if (!user) {
      user = await this.userModel.create({
        name,
        email,
        googleId,
        lastLoginAt: new Date(),
        isActive: true,
      });
    } else {
      // Check if account is active
      if (!user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }

      user.lastLoginAt = new Date();
      await user.save();
    }

    const tokens = await this.generateTokens(user);
    this.setCookies(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
  setCookies(res: Response, refreshToken: string): void {
    const isProduction =
      this.configService.get<string>(config_keys.NODE_ENV) === 'production';

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }
  async generateTokens(user: UserDocument): Promise<Tokens> {
    const payload: JwtTokenPayload = {
      sub: String(user._id),
      email: user.email,
      role: user.role,
    };

    const accessTokenExpiration =
      this.configService.get<string>(config_keys.JWT_ACCESS_TOKEN_EXPIRATION) ||
      '15m';

    const refreshTokenExpiration =
      this.configService.get<string>(
        config_keys.JWT_REFRESH_TOKEN_EXPIRATION
      ) || '7d';

    const accessTokenSecret = this.configService.get<string>(
      config_keys.JWT_ACCESS_TOKEN_SECRET
    );

    const refreshTokenSecret = this.configService.get<string>(
      config_keys.JWT_REFRESH_TOKEN_SECRET
    );

    if (!accessTokenSecret || !refreshTokenSecret) {
      throw new Error('JWT secrets are not configured');
    }

    const accessToken = this.jwtService.sign(payload, {
      secret: accessTokenSecret,
      expiresIn: accessTokenExpiration,
    } as any);

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshTokenSecret,
      expiresIn: refreshTokenExpiration,
    } as any);

    return { accessToken, refreshToken };
  }
  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string }> {
    try {
      const refreshTokenSecret = this.configService.get<string>(
        config_keys.JWT_REFRESH_TOKEN_SECRET
      );

      if (!refreshTokenSecret) {
        throw new Error('JWT_REFRESH_TOKEN_SECRET is not configured');
      }

      const payload = this.jwtService.verify<JwtTokenPayload>(refreshToken, {
        secret: refreshTokenSecret,
      });

      // Verify user still exists and is active
      const user = await this.userModel.findById(payload.sub).exec();

      if (!user) {
        throw new UnauthorizedException('User no longer exists');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('User account is deactivated');
      }

      const accessTokenSecret = this.configService.get<string>(
        config_keys.JWT_ACCESS_TOKEN_SECRET
      );

      if (!accessTokenSecret) {
        throw new Error('JWT_ACCESS_TOKEN_SECRET is not configured');
      }

      const accessTokenExpiration =
        this.configService.get<string>(
          config_keys.JWT_ACCESS_TOKEN_EXPIRATION
        ) || '15m';

      const newPayload: JwtTokenPayload = {
        sub: String(user._id),
        email: user.email,
        role: user.role,
      };

      const accessToken = this.jwtService.sign(newPayload, {
        secret: accessTokenSecret,
        expiresIn: accessTokenExpiration,
      } as any);

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token', error);
    }
  }

  async logout(res: Response): Promise<{ message: string }> {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure:
        this.configService.get<string>(config_keys.NODE_ENV) === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return { message: 'Logged out successfully' };
  }
}
