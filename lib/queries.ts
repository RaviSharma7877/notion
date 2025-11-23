import { getStoredUser } from '@/lib/auth/storage';
import { extractUserSecretId } from '@/lib/auth/user';

const normalizeBaseUrl = (candidate: string | undefined | null, fallback: string) => {
  const raw = candidate && candidate.trim().length > 0 ? candidate.trim() : fallback;
  return raw.replace(/\/$/, '');
};

const API_GATEWAY_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ?? process.env.API_GATEWAY_BASE_URL,
  'http://localhost:8080'
);

const PRIMARY_API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL,
  `${API_GATEWAY_BASE_URL}/api`
);

const NOTES_API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_NOTES_API_BASE_URL,
  PRIMARY_API_BASE_URL
);

const USERS_API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_USERS_API_BASE_URL,
  PRIMARY_API_BASE_URL
);

const aiPrefix = process.env.NEXT_PUBLIC_AI_API_PREFIX;
const DEFAULT_AI_BASE = aiPrefix
  ? normalizeBaseUrl(
      `${API_GATEWAY_BASE_URL}${aiPrefix.startsWith('/') ? aiPrefix : `/${aiPrefix}`}`,
      `${PRIMARY_API_BASE_URL}/ai`
    )
  : `${PRIMARY_API_BASE_URL}/ai`;

const AI_API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_AI_API_BASE_URL,
  DEFAULT_AI_BASE
);

type UUID = string;

export interface TitleRequest {
  workspaceId: UUID;
  maxLen: number;
}

export interface SummaryRequest {
  fileId: UUID;
  maxWords: number;
}

export interface ComposeRequest {
  workspaceId?: UUID;
  folderId?: UUID;
  instructions: string;
}

export interface WorkspaceCompositionResult {
  workspaceId: UUID;
  workspaceCreated: boolean;
  workspaceTitle: string;
  folderId: UUID;
  folderCreated: boolean;
  folderTitle: string;
  fileId: UUID;
  fileCreated: boolean;
  fileTitle: string;
}

export interface AiCapabilities {
  mode: string;
  allowed: string[];
  disallowed: string[];
  guidance: string;
}

export interface AiStreamEvent {
  event: string;
  data: string;
  id?: string;
  retry?: number;
  raw: string;
}

export interface AiStreamHandlers<TChunk = string> {
  onEvent?: (event: AiStreamEvent) => void;
  onStart?: (event: AiStreamEvent) => void;
  onChunk?: (chunk: TChunk, event: AiStreamEvent) => void;
  onDone?: (event: AiStreamEvent) => void;
  onError?: (error: Error, event?: AiStreamEvent) => void;
  onFinish?: () => void;
}

export interface AiStreamSubscription {
  cancel: () => void;
  signal: AbortSignal;
}

export interface AiResponse {
  result: string;
}

export interface CollaboratorDto {
  id: UUID;
  workspaceId: UUID;
  userId: UUID;
}

export interface FileDto {
  id: UUID;
  title: string;
  iconId: string;
  data: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  inTrash: boolean | null;
  bannerUrl: string | null;
  workspaceId: UUID;
  folderId: UUID;
}

export interface FolderDto {
  id: UUID;
  title: string;
  iconId: string;
  data: string | null;
  inTrash: boolean | null;
  bannerUrl: string | null;
  workspaceId: UUID;
}

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'INCOMPLETE'
  | 'INCOMPLETE_EXPIRED'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID'
  | 'TRIALING';

export interface SubscriptionDto {
  id: string;
  userId: UUID;
  status: SubscriptionStatus | null;
  metadata: Record<string, unknown> | null;
  priceId: string | null;
  quantity: number | null;
  cancelAtPeriodEnd: boolean | null;
  created: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  endedAt: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  trialStart: string | null;
  trialEnd: string | null;
}

export type PricingType = 'ONE_TIME' | 'RECURRING';

export type PricingPlanInterval = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export interface PriceDto {
  id: string;
  productId: string | null;
  active: boolean | null;
  description: string | null;
  unitAmount: number | null;
  currency: string | null;
  type: PricingType | null;
  interval: PricingPlanInterval | null;
  intervalCount: number | null;
  trialPeriodDays: number | null;
  metadata: Record<string, unknown> | null;
}

export interface ProductDto {
  id: string;
  active: boolean | null;
  name: string | null;
  description: string | null;
  image: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ProductWithPrices extends ProductDto {
  prices: PriceDto[];
}

export interface CustomerDto {
  id: UUID;
  stripeCustomerId: string | null;
}

export interface UserDto {
  id?: UUID | string;
  userId?: UUID | string | number;
  userSecretId?: UUID | string;
  email?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  billingAddress?: Record<string, unknown> | null;
  updatedAt?: string | null;
  paymentMethod?: Record<string, unknown> | null;
  roles?: string[] | null;
  [key: string]: unknown;
}

export interface WorkspaceDto {
  id: UUID;
  title: string;
  iconId: string;
  data: string | null;
  inTrash: boolean | null;
  logo: string | null;
  bannerUrl: string | null;
  workspaceOwner: UUID;
}

export interface Page<T> {
  content: T[];
  empty: boolean;
  first: boolean;
  last: boolean;
  number: number;
  numberOfElements: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface PageRequestOptions {
  page?: number;
  size?: number;
  sort?: string | string[];
}

function notesUrl(path: string, query?: Record<string, unknown>) {
  return buildUrl(NOTES_API_BASE_URL, path, query);
}

function usersUrl(path: string, query?: Record<string, unknown>) {
  return buildUrl(USERS_API_BASE_URL, path, query);
}

function aiUrl(path: string, query?: Record<string, unknown>) {
  return buildUrl(AI_API_BASE_URL, path, query);
}

// Small helper to attach Authorization on both client and server.
async function withAuthHeaders(headers: Headers, skipAuth?: boolean) {
  if (skipAuth) return;

  // Client: use localStorage (unchanged behavior)
  // Helper to try to decode JWT without verification (client-side hint)
  function tryDecodeJwtSub(jwt?: string): string | undefined {
    if (!jwt) return undefined;
    const parts = jwt.split('.');
    if (parts.length !== 3) return undefined;
    try {
      const payload = JSON.parse(typeof atob !== 'undefined' ? atob(parts[1]) : Buffer.from(parts[1], 'base64').toString('utf8')) as Record<string, unknown>;
      const sub = (payload['sub'] || payload['userId'] || payload['uid']) as string | undefined;
      return sub;
    } catch {
      return undefined;
    }
  }

  if (typeof window === 'undefined') return;

  const stored = getStoredUser<UserDto & { token?: string | null; refreshToken?: string | null }>();
  const token = stored?.token ?? undefined;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // Provide X-User-Id header if backend requires it
  const userId =
    extractUserSecretId(stored) ??
    stored?.userSecretId ??
    stored?.id ??
    stored?.userId ??
    tryDecodeJwtSub(token);
  if (userId && !headers.has('X-User-Id')) {
    headers.set('X-User-Id', String(userId));
  }
}

async function request<T>(url: string, init: RequestInit = {}, options: { skipAuth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!headers.has('Content-Type') && init.body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  await withAuthHeaders(headers, options.skipAuth);

  // Log file update requests with database data
  if (url.includes('/files/') && init.method === 'PUT' && init.body) {
    try {
      const bodyData = JSON.parse(init.body as string)
      if (bodyData.data) {
        const parsedData = JSON.parse(bodyData.data)
        const dbBlocks = parsedData.filter((b: any) => b.type?.startsWith('database_'))
        if (dbBlocks.length > 0) {
          console.log("[API] Sending file update with database blocks:", {
            url,
            databaseBlocks: dbBlocks.map((b: any) => ({
              type: b.type,
              id: b.id,
              recordsCount: b.records?.length ?? 0,
              records: b.records
            }))
          })
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('Content-Type') ?? '';
  const isJson = contentType.includes('application/json');
  let payload: unknown = null;

  if (response.status !== 204) {
    if (isJson) {
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
    } else {
      try {
        payload = await response.text();
      } catch {
        payload = null;
      }
    }
  }

  if (!response.ok) {
    const message = extractErrorMessageFromPayload(payload, response);
    if (typeof console !== 'undefined') {
      console.error('[API Error]', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        message,
      });
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!isJson) {
    return payload as T;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    // Only extract 'data' if it looks like a wrapper object (has ONLY 'data' or very few top-level keys)
    // This prevents extracting the 'data' field from DTOs like FileDto that have 'data' as a content field
    if ('data' in record) {
      const keys = Object.keys(record);
      // If the object only has 'data' key or 'data' + a few metadata keys like 'message', 'status', it's likely a wrapper
      const isWrapper = keys.length <= 3 && !('id' in record) && !('title' in record);
      if (isWrapper) {
        const data = record['data'] as T;
        return data;
      }
    }
  }

  // Log file GET responses with database data
  if (url.includes('/files/') && init.method !== 'PUT' && payload && typeof payload === 'object') {
    const filePayload = payload as any
    if (filePayload.data) {
      try {
        const parsedData = typeof filePayload.data === 'string' ? JSON.parse(filePayload.data) : filePayload.data
        const dbBlocks = Array.isArray(parsedData) ? parsedData.filter((b: any) => b.type?.startsWith('database_')) : []
        if (dbBlocks.length > 0) {
          console.log("[API] Received file GET response with database blocks:", {
            url,
            fileId: filePayload.id,
            databaseBlocks: dbBlocks.map((b: any) => ({
              type: b.type,
              id: b.id,
              recordsCount: b.records?.length ?? 0,
              records: b.records
            }))
          })
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  console.log('payload ',payload)
  return payload as T;
}

async function streamRequest(
  url: string,
  init: RequestInit = {},
  handlers: AiStreamHandlers = {},
  options: { skipAuth?: boolean; signal?: AbortSignal } = {}
): Promise<void> {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'text/event-stream');
  }
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!headers.has('Content-Type') && init.body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  await withAuthHeaders(headers, options.skipAuth);

  const controller = options.signal ? undefined : new AbortController();
  const signal = options.signal ?? controller!.signal;

  try {
    const response = await fetch(url, {
      ...init,
      headers,
      credentials: 'include',
      signal,
    });

    if (!response.ok) {
      const message = await extractErrorMessage(response);
      throw new Error(message);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Unable to read AI stream.');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    const parseEvent = (raw: string): AiStreamEvent => {
      const lines = raw.split('\n');
      let eventName = 'message';
      let data = '';
      let id: string | undefined;
      let retry: number | undefined;

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          if (data.length > 0) {
            data += '\n';
          }
          data += line.slice(5).trimStart();
        } else if (line.startsWith('id:')) {
          id = line.slice(3).trim();
        } else if (line.startsWith('retry:')) {
          const parsed = Number.parseInt(line.slice(6).trim(), 10);
          retry = Number.isNaN(parsed) ? undefined : parsed;
        }
      }

      return {
        event: eventName,
        data,
        id,
        retry,
        raw,
      };
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 2);

        if (rawEvent.length > 0) {
          const parsed = parseEvent(rawEvent);
          handlers.onEvent?.(parsed);

          if (parsed.event.endsWith('-start')) {
            handlers.onStart?.(parsed);
          } else if (parsed.event.endsWith('-chunk')) {
            handlers.onChunk?.(parsed.data, parsed);
          } else if (parsed.event.endsWith('-done')) {
            handlers.onDone?.(parsed);
          } else if (parsed.event.endsWith('-error')) {
            handlers.onError?.(new Error(parsed.data || 'AI stream failed.'), parsed);
          }
        }

        boundary = buffer.indexOf('\n\n');
      }
    }
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError' || (error as Error)?.message === 'The user aborted a request.') {
      handlers.onFinish?.();
      return;
    }
    handlers.onError?.(error as Error);
  } finally {
    handlers.onFinish?.();
    controller?.abort();
  }
}

function extractErrorMessageFromPayload(payload: unknown, response: Response): string {
  if (typeof payload === 'string' && payload.trim().length > 0) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const error = record['error'];
    if (error && typeof error === 'object') {
      const errorRecord = error as Record<string, unknown>;
      if (typeof errorRecord['message'] === 'string' && errorRecord['message']!.length > 0) {
        return errorRecord['message'] as string;
      }
    }
    if (typeof record['message'] === 'string' && (record['message'] as string).length > 0) {
      return record['message'] as string;
    }
  }

  return `${response.status} ${response.statusText}`;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const cloned = response.clone();
    const contentType = cloned.headers.get('Content-Type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = await cloned.json().catch(() => null);
      return extractErrorMessageFromPayload(payload, response);
    }
    const text = await cloned.text();
    if (typeof text === 'string' && text.trim().length > 0) {
      return text;
    }
  } catch {
    // ignore
  }
  return `${response.status} ${response.statusText}`;
}

function buildUrl(base: string, path: string, query?: Record<string, unknown>): string {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${normalizedBase}${normalizedPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        value.forEach((entry) => url.searchParams.append(key, String(entry)));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function pageParams(options?: PageRequestOptions) {
  if (!options) return undefined;
  const entries: Record<string, unknown> = {};
  if (options.page !== undefined) entries.page = options.page;
  if (options.size !== undefined) entries.size = options.size;
  if (options.sort !== undefined) entries.sort = options.sort;
  return entries;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  authType?: string;
}

export interface SignupRequest {
  email: string;
  fullName?: string;
  password?: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken?: string | null;
  mfaEnabled?: boolean;
  secretImageUri?: string | null;
  user: UserDto;
  userId?: string | number;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken?: string | null;
}

export async function signupRequest(payload: SignupRequest): Promise<LoginResult> {
  const url = usersUrl('/users/register');
  const body: Record<string, unknown> = {
    email: payload.email,
    fullName: payload.fullName ?? payload.email,
  };
  if (payload.password) {
    body.password = payload.password;
  }

  try {
    return await request<LoginResult>(
      url,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      { skipAuth: true }
    );
  } catch (error) {
    console.warn('[Auth] signupRequest failed, falling back to local stub response.', error);
    const fallbackId = `user-${Date.now()}`;
    const fullName = payload.fullName ?? payload.email;
    const [firstName, ...rest] = fullName.split(' ').filter(Boolean);
    const fallbackUser: UserDto = {
      id: fallbackId,
      userId: fallbackId,
      userSecretId: fallbackId,
      email: payload.email,
      fullName,
      firstName: firstName ?? fullName,
      lastName: rest.length > 0 ? rest.join(' ') : null,
      avatarUrl: null,
      roles: ['USER'],
    };
    return {
      accessToken: `mock-signup-token-${Date.now()}`,
      refreshToken: null,
      user: fallbackUser,
      userId: fallbackUser.id,
    };
  }
}

export async function loginRequest(payload: LoginRequest): Promise<LoginResult> {
  const url = usersUrl('/users/authenticate');
  const body = {
    email: payload.email,
    password: payload.password,
    authType: payload.authType ?? 'EMAIL',
    rememberMe: payload.rememberMe ?? false,
  };
  return request<LoginResult>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  }, { skipAuth: true });
}

export async function refreshSession(refreshToken?: string): Promise<RefreshResult> {
  if (!refreshToken) {
    throw new Error('Missing refresh token');
  }
  const url = usersUrl('/users/refresh-token', { refreshToken });
  const body = { refreshToken };
  return request<RefreshResult>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  }, { skipAuth: true });
}

export async function logoutRequest(refreshToken?: string): Promise<{ revoked: boolean }> {
  // backend does not offer a logout route; consider this a client-side operation
  return { revoked: true };
}

export async function fetchCurrentUser(email: string): Promise<UserDto> {
  if (!email) {
    throw new Error('Email is required to fetch user profile');
  }
  const url = usersUrl('/users/email', { email });
  return request<UserDto>(url);
}

export async function getUser(identifier: string): Promise<UserDto> {
  if (!identifier) {
    throw new Error('User identifier is required');
  }

  if (identifier.includes('@')) {
    return fetchCurrentUser(identifier);
  }

  try {
    const url = usersUrl('/users', { id: identifier });
    return await request<UserDto>(url);
  } catch {
    try {
      const page = await listUsers({ q: identifier, size: 5 });
      const match =
        page.content.find(
          (item) =>
            item.id === identifier ||
            (item.userId && String(item.userId) === identifier) ||
            item.userSecretId === identifier
        ) ?? null;
      if (match) {
        return match;
      }
    } catch {
      // swallow and fall through to placeholder
    }
  }

  return {
    id: identifier,
    email: identifier.includes('@') ? identifier : null,
    fullName: null,
    avatarUrl: null,
    billingAddress: null,
    updatedAt: null,
    paymentMethod: null,
  };
}

export async function suggestTitle(body: TitleRequest): Promise<AiResponse> {
  const url = aiUrl('/suggest-title');
  return request<AiResponse>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function summarizeFile(body: SummaryRequest): Promise<AiResponse> {
  const url = aiUrl('/summarize-file');
  return request<AiResponse>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

interface AiStreamOptions {
  signal?: AbortSignal;
  skipAuth?: boolean;
  headers?: HeadersInit;
}

function startAiStream(
  endpoint: string,
  body: unknown,
  handlers: AiStreamHandlers,
  options: AiStreamOptions = {}
): AiStreamSubscription {
  const controller = new AbortController();

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  const signal = controller.signal;
  const headers = options.headers;

  void streamRequest(
    aiUrl(endpoint),
    {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    },
    handlers,
    { skipAuth: options.skipAuth, signal }
  );

  return {
    cancel: () => controller.abort(),
    signal,
  };
}

export function streamSuggestTitle(body: TitleRequest, handlers: AiStreamHandlers = {}, options?: AiStreamOptions): AiStreamSubscription {
  return startAiStream('/suggest-title', body, handlers, options);
}

export function streamSummarizeFile(body: SummaryRequest, handlers: AiStreamHandlers = {}, options?: AiStreamOptions): AiStreamSubscription {
  return startAiStream('/summarize-file', body, handlers, options);
}

export function streamComposeWorkspace(body: ComposeRequest, handlers: AiStreamHandlers = {}, options?: AiStreamOptions): AiStreamSubscription {
  return startAiStream('/compose', body, handlers, options);
}

export function fetchAiCapabilities(): Promise<AiCapabilities> {
  return request<AiCapabilities>(aiUrl('/capabilities'));
}

export type CollaboratorCreateInput = Omit<CollaboratorDto, 'id'>;

export async function createCollaborator(dto: CollaboratorCreateInput): Promise<CollaboratorDto> {
  console.warn('[Collaboration] createCollaborator is disabled in this build. Returning stub collaborator.');
  return {
    id: `collaborator-stub-${Date.now()}`,
    workspaceId: dto.workspaceId,
    userId: dto.userId,
  };
}

export async function getCollaborator(id: UUID): Promise<CollaboratorDto> {
  console.warn('[Collaboration] getCollaborator is disabled in this build. Returning stub collaborator.');
  return {
    id,
    workspaceId: 'stub-workspace',
    userId: 'stub-user',
  };
}

export async function listCollaborators(_: {
  workspaceId?: UUID;
  userId?: UUID;
} & PageRequestOptions = {}): Promise<Page<CollaboratorDto>> {
  console.warn('[Collaboration] listCollaborators is disabled in this build. Returning empty list.');
  return {
    content: [],
    empty: true,
    first: true,
    last: true,
    number: 0,
    numberOfElements: 0,
    size: 0,
    totalElements: 0,
    totalPages: 0,
  };
}

export async function deleteCollaborator(id: UUID): Promise<void> {
  console.warn('[Collaboration] deleteCollaborator is disabled in this build. No action taken.', { id });
}

export type FileCreateInput = Omit<FileDto, 'id' | 'inTrash'> & { inTrash?: boolean };

export async function createFile(dto: FileCreateInput): Promise<FileDto> {
  const url = notesUrl('/files');
  return request<FileDto>(url, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function getFile(id: UUID): Promise<FileDto> {
  const url = notesUrl(`/files/${id}`);
  console.log(url)
  const result = await request<FileDto>(url);
  console.log('result ', result)
  return result;
}

export async function listFiles(params: {
  workspaceId?: UUID;
  folderId?: UUID;
  q?: string;
} & PageRequestOptions = {}): Promise<Page<FileDto>> {
  const { workspaceId, folderId, q, ...page } = params;
  const url = notesUrl('/files', {
    workspaceId,
    folderId,
    q,
    ...pageParams(page),
  });
  return request<Page<FileDto>>(url);
}

export type FileUpdateInput = Partial<FileDto>;

export async function updateFile(id: UUID, dto: FileUpdateInput): Promise<FileDto> {
  const url = notesUrl(`/files/${id}`);
  return request<FileDto>(url, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function deleteFile(id: UUID): Promise<void> {
  const url = notesUrl(`/files/${id}`);
  await request<void>(url, { method: 'DELETE' });
}

export type FolderCreateInput = Omit<FolderDto, 'id' | 'inTrash'> & { inTrash?: boolean };

export async function createFolder(dto: FolderCreateInput): Promise<FolderDto> {
  const url = notesUrl('/folders');
  return request<FolderDto>(url, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function getFolder(id: UUID): Promise<FolderDto> {
  const url = notesUrl(`/folders/${id}`);
  return request<FolderDto>(url);
}

export async function listFolders(params: {
  workspaceId?: UUID;
  q?: string;
} & PageRequestOptions = {}): Promise<Page<FolderDto>> {
  const { workspaceId, q, ...page } = params;
  const url = notesUrl('/folders', {
    workspaceId,
    q,
    ...pageParams(page),
  });
  return request<Page<FolderDto>>(url);
}

export type FolderUpdateInput = Partial<FolderDto>;

export async function updateFolder(id: UUID, dto: FolderUpdateInput): Promise<FolderDto> {
  const url = notesUrl(`/folders/${id}`);
  return request<FolderDto>(url, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function deleteFolder(id: UUID): Promise<void> {
  const url = notesUrl(`/folders/${id}`);
  await request<void>(url, { method: 'DELETE' });
}

export type SubscriptionCreateInput = Omit<SubscriptionDto, 'endedAt' | 'cancelAt' | 'canceledAt' | 'trialStart' | 'trialEnd'> &
  Partial<Pick<SubscriptionDto, 'endedAt' | 'cancelAt' | 'canceledAt' | 'trialStart' | 'trialEnd'>>;

export async function createSubscription(dto: SubscriptionCreateInput): Promise<SubscriptionDto> {
  const url = usersUrl('/subscriptions');
  return request<SubscriptionDto>(url, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function getSubscription(id: string): Promise<SubscriptionDto> {
  const url = usersUrl(`/subscriptions/${id}`);
  return request<SubscriptionDto>(url);
}

export async function listSubscriptions(params: {
  priceId?: string;
  status?: SubscriptionStatus;
} & PageRequestOptions = {}): Promise<Page<SubscriptionDto>> {
  const { priceId, status, ...page } = params;
  const url = usersUrl('/subscriptions', {
    priceId,
    status,
    ...pageParams(page),
  });
  return request<Page<SubscriptionDto>>(url);
}

export async function updateSubscription(id: string, dto: SubscriptionDto): Promise<SubscriptionDto> {
  const url = usersUrl(`/subscriptions/${id}`);
  return request<SubscriptionDto>(url, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function deleteSubscription(id: string): Promise<void> {
  const url = usersUrl(`/subscriptions/${id}`);
  await request<void>(url, { method: 'DELETE' });
}

export type PriceCreateInput = PriceDto;

export async function createPrice(dto: PriceCreateInput): Promise<PriceDto> {
  const url = usersUrl('/prices');
  return request<PriceDto>(url, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function getPrice(id: string): Promise<PriceDto> {
  const url = usersUrl(`/prices/${id}`);
  return request<PriceDto>(url);
}

export async function listPrices(params: {
  productId?: string;
  active?: boolean;
} & PageRequestOptions = {}): Promise<Page<PriceDto>> {
  const { productId, active, ...page } = params;
  const url = usersUrl('/prices', {
    productId,
    active,
    ...pageParams(page),
  });
  return request<Page<PriceDto>>(url);
}

export async function updatePrice(id: string, dto: PriceDto): Promise<PriceDto> {
  const url = usersUrl(`/prices/${id}`);
  return request<PriceDto>(url, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function deletePrice(id: string): Promise<void> {
  const url = usersUrl(`/prices/${id}`);
  await request<void>(url, { method: 'DELETE' });
}

export type ProductCreateInput = ProductDto;

export async function createProduct(dto: ProductCreateInput): Promise<ProductDto> {
  const url = usersUrl('/products');
  return request<ProductDto>(url, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function getProduct(id: string): Promise<ProductDto> {
  const url = usersUrl(`/products/${id}`);
  return request<ProductDto>(url);
}

export async function listProducts(params: {
  q?: string;
  active?: boolean;
} & PageRequestOptions = {}): Promise<Page<ProductDto>> {
  const { q, active, ...page } = params;
  const url = usersUrl('/products', {
    q,
    active,
    ...pageParams(page),
  });
  return request<Page<ProductDto>>(url);
}

export async function updateProduct(id: string, dto: ProductDto): Promise<ProductDto> {
  const url = usersUrl(`/products/${id}`);
  return request<ProductDto>(url, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const url = usersUrl(`/products/${id}`);
  await request<void>(url, { method: 'DELETE' });
}

export type CustomerCreateInput = CustomerDto;

export async function createCustomer(dto: CustomerCreateInput): Promise<CustomerDto> {
  const url = usersUrl('/customers');
  return request<CustomerDto>(url, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function getCustomer(id: UUID): Promise<CustomerDto> {
  const url = usersUrl(`/customers/${id}`);
  return request<CustomerDto>(url);
}

export async function listCustomers(params: {
  q?: string;
} & PageRequestOptions = {}): Promise<Page<CustomerDto>> {
  const { q, ...page } = params;
  const url = usersUrl('/customers', {
    q,
    ...pageParams(page),
  });
  return request<Page<CustomerDto>>(url);
}

export async function updateCustomer(id: UUID, dto: CustomerDto): Promise<CustomerDto> {
  const url = usersUrl(`/customers/${id}`);
  return request<CustomerDto>(url, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function deleteCustomer(id: UUID): Promise<void> {
  const url = usersUrl(`/customers/${id}`);
  await request<void>(url, { method: 'DELETE' });
}

export type UserCreateInput = Omit<UserDto, 'id' | 'updatedAt'> & {
  id?: UUID;
  updatedAt?: string | null;
};

export async function createUser(dto: UserCreateInput): Promise<UserDto> {
  const url = usersUrl('/users');
  return request<UserDto>(url, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function listUsers(params: {
  q?: string;
} & PageRequestOptions = {}): Promise<Page<UserDto>> {
  const { q, ...page } = params;
  const url = usersUrl('/users', {
    q,
    ...pageParams(page),
  });
  return request<Page<UserDto>>(url);
}

export async function updateUser(id: UUID, dto: UserDto): Promise<UserDto> {
  const url = usersUrl(`/users/${id}`);
  return request<UserDto>(url, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function deleteUser(id: UUID): Promise<void> {
  const url = usersUrl(`/users/${id}`);
  await request<void>(url, { method: 'DELETE' });
}

export async function findUserByEmail(email: string): Promise<UserDto | null> {
  const page = await listUsers({ q: email, size: 10 });
  const normalized = email.trim().toLowerCase();
  const match = page.content.find(
    (user) => user.email?.trim().toLowerCase() === normalized
  );
  return match ?? null;
}

export type WorkspaceCreateInput = Omit<WorkspaceDto, 'id' | 'inTrash'> & { inTrash?: boolean };

export async function createWorkspace(dto: WorkspaceCreateInput): Promise<WorkspaceDto> {
  const url = notesUrl('/workspaces');
  return request<WorkspaceDto>(url, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function getWorkspace(id: UUID): Promise<WorkspaceDto> {
  const url = notesUrl(`/workspaces/${id}`);
  return request<WorkspaceDto>(url);
}

export async function listWorkspaces(params: {
  q?: string;
  owner?: UUID;
  inTrash?: boolean;
} & PageRequestOptions = {}): Promise<Page<WorkspaceDto>> {
  const { q, owner, inTrash, ...page } = params;
  const url = notesUrl('/workspaces', {
    q,
    owner,
    inTrash,
    ...pageParams(page),
  });
  return request<Page<WorkspaceDto>>(url);
}

export type WorkspaceUpdateInput = Partial<WorkspaceDto>;

export async function updateWorkspace(id: UUID, dto: WorkspaceUpdateInput): Promise<WorkspaceDto> {
  const url = notesUrl(`/workspaces/${id}`);
  return request<WorkspaceDto>(url, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function deleteWorkspace(id: UUID): Promise<void> {
  const url = notesUrl(`/workspaces/${id}`);
  await request<void>(url, { method: 'DELETE' });
}

export interface UploadBannerOptions {
  entityId: UUID;
  entityType: 'workspace' | 'folder' | 'file';
  file: File | Blob;
}

function parseUploadResponse(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of ['bannerUrl', 'logo', 'avatarUrl', 'url', 'path']) {
      const value = record[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
  }
  return '';
}

async function uploadBinary(url: string, file: File | Blob, method: 'POST' | 'PUT' = 'POST'): Promise<string> {
  const formData = new FormData();

  formData.append('file', file);

  const headers: Record<string, string> = {};

  // Client: keep existing behavior with localStorage token
  if (typeof window !== 'undefined') {
    const stored = getStoredUser<UserDto & { token?: string | null }>();
    const token = stored?.token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    method,
    body: formData,
    headers: Object.keys(headers).length ? headers : undefined,
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return '';
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    return parseUploadResponse(payload);
  }

  const text = await response.text();
  return text;
}

export async function uploadBanner(options: UploadBannerOptions): Promise<string> {
  const { entityId, entityType, file } = options;
  // New backend expects base64 JSON for file banners at /files/{fileId}/banner
  if (entityType === 'file' && typeof File !== 'undefined' && file instanceof File) {
    const url = notesUrl(`/files/${entityId}/banner`);

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = (err) => reject(err);
    });

    const headers = new Headers({ 'Content-Type': 'application/json' });
    await withAuthHeaders(headers);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        type: 'base64',
        content: base64, 
        fileName: file.name, 
        mimeType: file.type || 'application/octet-stream' 
      }),
    });

    if (!response.ok) {
      const message = await extractErrorMessage(response);
      throw new Error(message);
    }

    // Prefer X-Banner-Url header provided by backend
    const headerUrl = response.headers.get('X-Banner-Url');
    if (headerUrl && headerUrl.length > 0) {
      return headerUrl;
    }

    // Fall back to parsing JSON/text if any
    const contentType = response.headers.get('Content-Type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        const payload = await response.json();
        return parseUploadResponse(payload);
      } catch {
        return '';
      }
    }
    try {
      const text = await response.text();
      return text;
    } catch {
      return '';
    }
  }

  // Legacy behavior for workspace/folder (multipart)
  const url = notesUrl(`/${entityType}s/${entityId}/banner`);
  return uploadBinary(url, file, 'POST');
}

export interface UploadBannerUrlOptions {
  entityId: UUID;
  entityType: 'workspace' | 'folder' | 'file';
  imageUrl: string;
}

export async function uploadBannerFromUrl(options: UploadBannerUrlOptions): Promise<string> {
  const { entityId, entityType, imageUrl } = options;
  
  if (entityType === 'file') {
    const url = notesUrl(`/files/${entityId}/banner`);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    await withAuthHeaders(headers);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        type: 'url',
        content: imageUrl
      }),
    });

    if (!response.ok) {
      const message = await extractErrorMessage(response);
      throw new Error(message);
    }

    // For URL type, response should be JSON
    const contentType = response.headers.get('Content-Type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      return payload.bannerUrl || imageUrl;
    }

    // Fall back to header
    const headerUrl = response.headers.get('X-Banner-Url');
    return headerUrl || imageUrl;
  }

  // For workspace/folder, we'll need to implement URL support in the legacy endpoint
  throw new Error('URL upload not supported for workspace/folder yet');
}

export async function deleteBanner(entityType: UploadBannerOptions['entityType'], entityId: UUID): Promise<void> {
  const url = notesUrl(`/${entityType}s/${entityId}/banner`);
  await request<void>(url, { method: 'DELETE' });
}

export async function uploadWorkspaceLogo(workspaceId: UUID, file: File | Blob): Promise<string> {
  const url = notesUrl(`/workspaces/${workspaceId}/logo`);
  return uploadBinary(url, file, 'POST');
}

export async function uploadUserAvatar(userId: UUID, file: File | Blob): Promise<string> {
  const url = usersUrl(`/users/${userId}/avatar`);
  return uploadBinary(url, file, 'POST');
}

export async function getActiveProductsWithPrice(): Promise<{
  data: ProductWithPrices[];
  error?: Error;
}> {
  try {
    const productsPage = await listProducts({ active: true, size: 100 });
    const products = productsPage.content ?? [];

    const pricesByProduct = await Promise.all(
      products.map(async (product) => {
        if (!product.id) {
          return [];
        }
        const pricePage = await listPrices({ productId: product.id, active: true, size: 100 });
        return pricePage.content ?? [];
      })
    );

    const combined: ProductWithPrices[] = products.map((product, index) => ({
      ...product,
      prices: pricesByProduct[index] ?? [],
    }));

    return { data: combined };
  } catch (error) {
    return { data: [], error: error as Error };
  }
}

// Collaboration Room Management Types and Functions
export interface RoomInfo {
  roomId: string;
  wsUrl: string;
  joinToken: string;
  expiresAt: string;
}

export interface BootstrapData {
  snapshot: {
    clock?: number;
    payload?: string;
    version?: number;
    content?: string;
  };
  presence: PresenceUser[];
}

export interface PresenceUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  status: 'join' | 'leave' | 'heartbeat';
  at: number;
}

export interface CursorPosition {
  blockId: string;
  offset: number;
}

export interface SelectionRange {
  blockId: string;
  from: number;
  to: number;
}

export interface CollaborationMessage {
  type: 'presence' | 'cursor' | 'selection' | 'crdt' | 'op' | 'system';
  userId?: string;
  fileId?: string;
  status?: 'join' | 'leave' | 'heartbeat';
  pos?: CursorPosition;
  range?: SelectionRange;
  update?: string;
  clientId?: string;
  clock?: number;
  baseVersion?: number;
  ops?: Record<string, unknown>[];
  opId?: string;
  action?: 'room_closed';
  reason?: 'expired' | 'admin_closed';
  at: number;
}

// Room Management API Functions
export async function createRoom(fileId: UUID, workspaceId: UUID): Promise<RoomInfo> {
  const url = notesUrl('/rooms');
  return request<RoomInfo>(url, {
    method: 'POST',
    body: JSON.stringify({ fileId, workspaceId }),
  });
}

export async function joinRoom(roomId: string): Promise<RoomInfo> {
  const url = notesUrl(`/rooms/${roomId}/join`);
  return request<RoomInfo>(url, {
    method: 'POST',
  });
}

export async function leaveRoom(roomId: string): Promise<void> {
  const url = notesUrl(`/rooms/${roomId}/leave`);
  await request<void>(url, {
    method: 'POST',
  });
}

export async function getBootstrapData(fileId: UUID): Promise<BootstrapData> {
  const url = notesUrl(`/files/${fileId}/bootstrap`);
  return request<BootstrapData>(url);
}
