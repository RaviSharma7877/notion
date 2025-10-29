import { getStoredUser } from '@/lib/auth/storage';

const NOTES_API_BASE_URL = (process.env.NEXT_PUBLIC_NOTES_API_BASE_URL ?? 'http://localhost:8089/api').replace(/\/$/, '');
const USERS_API_BASE_URL = (process.env.NEXT_PUBLIC_USERS_API_BASE_URL ?? 'http://localhost:8089/api').replace(/\/$/, '');
const AI_API_BASE_URL = (process.env.NEXT_PUBLIC_AI_API_BASE_URL ?? 'http://localhost:8089/api/ai').replace(/\/$/, '');

// 🔐 cookie name for server-side auth (set this to whatever you set your JWT cookie to)
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'token';

type UUID = string;

export interface TitleRequest {
  workspaceId: UUID;
  maxLen: number;
}

export interface SummaryRequest {
  fileId: UUID;
  maxWords: number;
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
  id: UUID;
  fullName: string | null;
  avatarUrl: string | null;
  billingAddress: Record<string, unknown> | null;
  updatedAt: string | null;
  paymentMethod: Record<string, unknown> | null;
  email: string | null;
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
  if (typeof window !== 'undefined') {
    const stored = getStoredUser<UserDto & { token?: string }>();
    const token = stored?.token;
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return;
  }

  // Server: read HTTP-only cookie
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch {
    // no-op: next/headers unavailable in some build contexts
  }
}

async function request<T>(url: string, init: RequestInit = {}, options: { skipAuth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Content-Type') && init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  await withAuthHeaders(headers, options.skipAuth);

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data === 'string') {
      return data;
    }
    if (data && typeof data === 'object' && 'message' in data && typeof (data as any).message === 'string') {
      return (data as any).message;
    }
    return JSON.stringify(data);
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

function buildUrl(base: string, path: string, query?: Record<string, unknown>): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(normalizedPath, normalizedBase);

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

export type CollaboratorCreateInput = Omit<CollaboratorDto, 'id'>;

export async function createCollaborator(dto: CollaboratorCreateInput): Promise<CollaboratorDto> {
  const url = notesUrl('/collaborators');
  return request<CollaboratorDto>(url, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function getCollaborator(id: UUID): Promise<CollaboratorDto> {
  const url = notesUrl(`/collaborators/${id}`);
  return request<CollaboratorDto>(url);
}

export async function listCollaborators(params: {
  workspaceId?: UUID;
  userId?: UUID;
} & PageRequestOptions = {}): Promise<Page<CollaboratorDto>> {
  const { workspaceId, userId, ...page } = params;
  const url = notesUrl('/collaborators', {
    workspaceId,
    userId,
    ...pageParams(page),
  });
  return request<Page<CollaboratorDto>>(url);
}

export async function deleteCollaborator(id: UUID): Promise<void> {
  const url = notesUrl(`/collaborators/${id}`);
  await request<void>(url, { method: 'DELETE' });
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
  return request<FileDto>(url);
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

export async function getUser(id: UUID): Promise<UserDto> {
  const url = usersUrl(`/users/${id}`);
  return request<UserDto>(url);
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

  const headers: HeadersInit = {};

  // Client: keep existing behavior with localStorage token
  if (typeof window !== 'undefined') {
    const stored = getStoredUser<UserDto & { token?: string }>();
    const token = stored?.token;
    if (token) (headers as any).Authorization = `Bearer ${token}`;
  } else {
    // Server: use cookie
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
      if (token) (headers as any).Authorization = `Bearer ${token}`;
    } catch {
      // no-op
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
