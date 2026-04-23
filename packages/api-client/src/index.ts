import type { components, paths } from './generated';

type HttpMethod = 'get' | 'post' | 'put';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type Operation<Path extends keyof paths, Method extends HttpMethod> = NonNullable<paths[Path][Method]>;

type RequestBody<Path extends keyof paths, Method extends HttpMethod> =
  Operation<Path, Method> extends { requestBody: { content: { 'application/json': infer Body } } }
    ? Body
    : never;

type QueryParams<Path extends keyof paths, Method extends HttpMethod> =
  Operation<Path, Method> extends { parameters: { query?: infer Query } }
    ? Query
    : never;

type PathParams<Path extends keyof paths, Method extends HttpMethod> =
  Operation<Path, Method> extends { parameters: { path?: infer Params } }
    ? Params
    : never;

export type { components, paths };

export type ClientOptions = {
  baseUrl: string;
  accessToken?: string | null;
  fetch?: typeof globalThis.fetch;
};

function withQuery(path: string, query?: Record<string, string | number | boolean | null | undefined>) {
  if (!query) {
    return path;
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const search = searchParams.toString();

  return search ? `${path}?${search}` : path;
}

function withPathParams(path: string, params?: Record<string, string>) {
  if (!params) {
    return path;
  }

  return Object.entries(params).reduce(
    (currentPath, [key, value]) => currentPath.replace(`{${key}}`, encodeURIComponent(value)),
    path,
  );
}

async function request<TResult, Path extends keyof paths, Method extends HttpMethod>(
  path: Path,
  method: Method,
  options: ClientOptions & {
    body?: RequestBody<Path, Method>;
    query?: QueryParams<Path, Method>;
    pathParams?: PathParams<Path, Method>;
  },
): Promise<TResult> {
  const headers = new Headers();
  const fetcher = options.fetch ?? globalThis.fetch;

  headers.set('Content-Type', 'application/json');

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  const response = await fetcher(
    `${options.baseUrl}${withQuery(
      withPathParams(path, options.pathParams as Record<string, string> | undefined),
      options.query as Record<string, string | number | boolean | null | undefined> | undefined,
    )}`,
    {
      method: method.toUpperCase(),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, errorText || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as TResult;
  }

  return response.json() as Promise<TResult>;
}

export type AuthResponse = components['schemas']['AuthResponse'];
export type RegisterRequest = components['schemas']['RegisterRequest'];
export type LoginRequest = components['schemas']['LoginRequest'];
export type BootstrapResponse = components['schemas']['BootstrapResponse'];
export type DashboardOverviewResponse = components['schemas']['DashboardOverviewResponse'];
export type FamilyInviteResponse = components['schemas']['FamilyInviteResponse'];
export type FamilyInviteDetailsResponse = components['schemas']['FamilyInviteDetailsResponse'];
export type CreateFamilyInviteRequest = components['schemas']['CreateFamilyInviteRequest'];
export type AcceptFamilyInviteRequest = components['schemas']['AcceptFamilyInviteRequest'];
export type DeleteAccountRequest = components['schemas']['DeleteAccountRequest'];
export type DeleteFamilyRequest = components['schemas']['DeleteFamilyRequest'];
export type ProfileResponse = components['schemas']['ProfileResponse'];
export type CreateProfileRequest = components['schemas']['CreateProfileRequest'];
export type UpdateProfileRequest = components['schemas']['UpdateProfileRequest'];
export type ShoppingItemResponse = components['schemas']['ShoppingItemResponse'];
export type CreateShoppingItemRequest = components['schemas']['CreateShoppingItemRequest'];
export type WeeklyCalendarResponse = components['schemas']['WeeklyCalendarResponse'];
export type CalendarEventResponse = components['schemas']['CalendarEventResponse'];
export type CreateCalendarEventRequest = components['schemas']['CreateCalendarEventRequest'];
export type UpdateCalendarEventRequest = components['schemas']['UpdateCalendarEventRequest'];
export type WeeklyMealsResponse = components['schemas']['WeeklyMealsResponse'];
export type MealPlanResponse = components['schemas']['MealPlanResponse'];
export type CreateMealPlanRequest = components['schemas']['CreateMealPlanRequest'];
export type UpdateMealPlanRequest = components['schemas']['UpdateMealPlanRequest'];
export type MealRequestResponse = components['schemas']['MealRequestResponse'];
export type CreateMealRequestRequest = components['schemas']['CreateMealRequestRequest'];
export type DevelopmentSeedResponse = {
  email: string;
  password: string;
  seeded: boolean;
};

export function register(client: ClientOptions, body: RegisterRequest) {
  return request<AuthResponse, '/api/v1/auth/register', 'post'>('/api/v1/auth/register', 'post', { ...client, body });
}

export function login(client: ClientOptions, body: LoginRequest) {
  return request<AuthResponse, '/api/v1/auth/login', 'post'>('/api/v1/auth/login', 'post', { ...client, body });
}

export function getBootstrap(client: ClientOptions) {
  return request<BootstrapResponse, '/api/v1/me/bootstrap', 'get'>('/api/v1/me/bootstrap', 'get', client);
}

export function getDashboardOverview(client: ClientOptions, date?: string) {
  return request<DashboardOverviewResponse, '/api/v1/dashboard/overview', 'get'>('/api/v1/dashboard/overview', 'get', {
    ...client,
    query: date ? { date } : undefined,
  });
}

export function getProfiles(client: ClientOptions) {
  return request<ProfileResponse[], '/api/v1/profiles', 'get'>('/api/v1/profiles', 'get', client);
}

export function getFamilyInvites(client: ClientOptions) {
  return request<FamilyInviteResponse[], '/api/v1/family-invites', 'get'>('/api/v1/family-invites', 'get', client);
}

export function createFamilyInvite(client: ClientOptions, body: CreateFamilyInviteRequest) {
  return request<FamilyInviteResponse, '/api/v1/family-invites', 'post'>('/api/v1/family-invites', 'post', {
    ...client,
    body,
  });
}

export function getFamilyInvite(client: ClientOptions, token: string) {
  return request<FamilyInviteDetailsResponse, '/api/v1/invites/{token}', 'get'>('/api/v1/invites/{token}', 'get', {
    ...client,
    pathParams: { token },
  });
}

export function acceptFamilyInvite(client: ClientOptions, token: string, body: AcceptFamilyInviteRequest) {
  return request<AuthResponse, '/api/v1/invites/{token}/accept', 'post'>('/api/v1/invites/{token}/accept', 'post', {
    ...client,
    body,
    pathParams: { token },
  });
}

export function deleteAccount(client: ClientOptions, body: DeleteAccountRequest) {
  return request<unknown, '/api/v1/privacy/account/delete', 'post'>('/api/v1/privacy/account/delete', 'post', {
    ...client,
    body,
  });
}

export function deleteFamily(client: ClientOptions, body: DeleteFamilyRequest) {
  return request<unknown, '/api/v1/privacy/family/delete', 'post'>('/api/v1/privacy/family/delete', 'post', {
    ...client,
    body,
  });
}

export function createProfile(client: ClientOptions, body: CreateProfileRequest) {
  return request<ProfileResponse, '/api/v1/profiles', 'post'>('/api/v1/profiles', 'post', { ...client, body });
}

export function updateProfile(client: ClientOptions, profileId: string, body: UpdateProfileRequest) {
  return request<ProfileResponse, '/api/v1/profiles/{profileId}', 'put'>('/api/v1/profiles/{profileId}', 'put', {
    ...client,
    body,
    pathParams: { profileId },
  });
}

export function getShoppingItems(client: ClientOptions) {
  return request<ShoppingItemResponse[], '/api/v1/shopping', 'get'>('/api/v1/shopping', 'get', client);
}

export function createShoppingItem(client: ClientOptions, body: CreateShoppingItemRequest) {
  return request<ShoppingItemResponse, '/api/v1/shopping', 'post'>('/api/v1/shopping', 'post', { ...client, body });
}

export function updateShoppingItem(client: ClientOptions, itemId: string, body: { isCompleted: boolean }) {
  return request<ShoppingItemResponse, '/api/v1/shopping/{itemId}', 'put'>('/api/v1/shopping/{itemId}', 'put', {
    ...client,
    body,
    pathParams: { itemId },
  });
}

export function getCalendarWeek(client: ClientOptions, start: string) {
  return request<WeeklyCalendarResponse, '/api/v1/calendar/week', 'get'>('/api/v1/calendar/week', 'get', {
    ...client,
    query: { start },
  });
}

export function createCalendarEvent(client: ClientOptions, body: CreateCalendarEventRequest) {
  return request<CalendarEventResponse, '/api/v1/calendar', 'post'>('/api/v1/calendar', 'post', { ...client, body });
}

export function updateCalendarEvent(client: ClientOptions, eventId: string, body: UpdateCalendarEventRequest) {
  return request<CalendarEventResponse, '/api/v1/calendar/{eventId}', 'put'>('/api/v1/calendar/{eventId}', 'put', {
    ...client,
    body,
    pathParams: { eventId },
  });
}

export function getMealsWeek(client: ClientOptions, start: string) {
  return request<WeeklyMealsResponse, '/api/v1/meals/week', 'get'>('/api/v1/meals/week', 'get', {
    ...client,
    query: { start },
  });
}

export function createMealPlan(client: ClientOptions, body: CreateMealPlanRequest) {
  return request<MealPlanResponse, '/api/v1/meals', 'post'>('/api/v1/meals', 'post', { ...client, body });
}

export function updateMealPlan(client: ClientOptions, mealId: string, body: UpdateMealPlanRequest) {
  return request<MealPlanResponse, '/api/v1/meals/{mealId}', 'put'>('/api/v1/meals/{mealId}', 'put', {
    ...client,
    body,
    pathParams: { mealId },
  });
}

export function getMealRequests(client: ClientOptions, start: string) {
  return request<MealRequestResponse[], '/api/v1/meals/requests', 'get'>('/api/v1/meals/requests', 'get', {
    ...client,
    query: { start },
  });
}

export function createMealRequest(client: ClientOptions, body: CreateMealRequestRequest) {
  return request<MealRequestResponse, '/api/v1/meals/requests', 'post'>('/api/v1/meals/requests', 'post', { ...client, body });
}

export function assignMealRequest(client: ClientOptions, requestId: string, assigneeProfileId: string | null) {
  return request<MealRequestResponse, '/api/v1/meals/requests/{requestId}/assign', 'put'>('/api/v1/meals/requests/{requestId}/assign', 'put', {
    ...client,
    body: { assigneeProfileId },
    pathParams: { requestId },
  });
}

export function acceptMealRequest(client: ClientOptions, requestId: string) {
  return request<MealRequestResponse, '/api/v1/meals/requests/{requestId}/accept', 'post'>('/api/v1/meals/requests/{requestId}/accept', 'post', {
    ...client,
    pathParams: { requestId },
  });
}

export function seedDevelopmentUser(client: ClientOptions) {
  return request<DevelopmentSeedResponse, '/api/v1/dev/seed', 'post'>('/api/v1/dev/seed', 'post', client);
}
