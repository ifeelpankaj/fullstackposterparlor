import { UserRole } from '@poster-parler/models';
export interface JwtTokenPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// auth/interfaces/auth-response.interface.ts
export interface AuthResponse {
  accessToken?: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

// auth/interfaces/tokens.interface.ts
export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface RequestUser {
  id: string;
  email: string;
  role: string;
}
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
