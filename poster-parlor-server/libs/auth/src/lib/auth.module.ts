/* eslint-disable @typescript-eslint/no-explicit-any */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { config_keys } from '@poster-parler/config';
import { User, UserSchema } from '@poster-parler/models';
import { GoogleAuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from '../strategies/jwt-strategy';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/role.guard';
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (
        configService: ConfigService
      ): Promise<JwtModuleOptions> => {
        const secret = configService.get<string>(
          config_keys.JWT_REFRESH_TOKEN_SECRET
        );
        const expiresIn = configService.get<string>(
          config_keys.JWT_REFRESH_TOKEN_EXPIRATION
        );

        if (!secret) {
          throw new Error('JWT_REFRESH_TOKEN_SECRET is not configured');
        }

        // Provide a default expiry (or throw). This ensures expiresIn is not undefined.
        const normalizedExpiresIn = expiresIn ?? '7d';

        return {
          secret,
          signOptions: {
            // normalizedExpiresIn can be string like '7d' or number; cast to any to satisfy JwtModuleOptions typings.
            expiresIn: normalizedExpiresIn as unknown as any,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [GoogleAuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtStrategy],
})
export class AuthModule {}
