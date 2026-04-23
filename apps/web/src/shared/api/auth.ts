import { http } from './http';

export type AuthResponse = {
  accessToken: string;
  expiresAtUtc: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  familyName: string;
  displayName: string;
  timezone: string;
  colorKey: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export async function register(request: RegisterRequest) {
  return http<AuthResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function login(request: LoginRequest) {
  return http<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
