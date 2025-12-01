import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { config_keys } from '@poster-parler/config';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { User, UserDocument } from '@poster-parler/models';
import { JwtTokenPayload } from '@poster-parler/common';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService
  ) {
    const secret = configService.get<string>(
      config_keys.JWT_ACCESS_TOKEN_SECRET
    );

    if (!secret) {
      throw new Error('JWT_ACCESS_TOKEN_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(), // For API clients
        JwtStrategy.extractJWTFromCookie, // For web browsers
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }
  private static extractJWTFromCookie(req: Request): string | null {
    if (req.cookies && req.cookies.access_token) {
      return req.cookies.access_token;
    }
    return null;
  }
  async validate(payload: JwtTokenPayload) {
    // Validate payload structure
    if (!payload.sub || !payload.email || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Verify user still exists and is active
    const user = await this.userModel.findById(payload.sub).exec();

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    return {
      id: (user._id as Types.ObjectId).toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };
  }
}
