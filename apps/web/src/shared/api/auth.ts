import {
  login as loginRequest,
  register as registerRequest,
  type AuthResponse,
  type LoginRequest,
  type RegisterRequest,
} from '@planner/api-client';

import { env } from '../config/env';

export type { AuthResponse, LoginRequest, RegisterRequest };

export async function register(request: RegisterRequest) {
  return registerRequest({ baseUrl: env.apiBaseUrl }, request);
}

export async function login(request: LoginRequest) {
  return loginRequest({ baseUrl: env.apiBaseUrl }, request);
}
