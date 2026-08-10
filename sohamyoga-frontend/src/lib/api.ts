// Empty fallback means "use same-origin relative URLs" — bundled JS then calls
// /api/* which nginx proxies to backend. Works on localhost, behind tunnels,
// and any reverse proxy without rebuild per environment. See global policy
// §81 (portable-frontend-and-multisite-hosting.md).
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const REQUEST_TIMEOUT_MS = 30000;

export class ApiError extends Error {
  statusCode: number;
  errorCode: string;
  correlationId?: string;

  constructor(statusCode: number, message: string, errorCode: string, correlationId?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.correlationId = correlationId;
  }
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;
  const method = fetchOptions.method || 'GET';
  const maxRetries = method === 'GET' ? 2 : 0;
  let lastError: Error | null = null;

  let url = `${API_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({ detail: 'An error occurred' }));
        throw new ApiError(
          res.status,
          errorBody.detail || `HTTP ${res.status}`,
          errorBody.error_code || `HTTP_${res.status}`,
          errorBody.correlation_id,
        );
      }

      if (res.status === 204) return {} as T;
      return res.json();
    } catch (err) {
      if (err instanceof ApiError && err.statusCode >= 400 && err.statusCode < 500) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed');
}

// Home
export const homeApi = {
  getHomeData: () => fetchApi<HomePageData>('/api/home'),
  getSettings: () => fetchApi<SiteSettings>('/api/home/settings'),
};

// Services
export const servicesApi = {
  getAll: () => fetchApi<Service[]>('/api/services'),
  getFeatured: () => fetchApi<Service[]>('/api/services/featured'),
  getBySlug: (slug: string) => fetchApi<Service>(`/api/services/${slug}`),
  getByCategory: (category: string) => fetchApi<Service[]>(`/api/services/category/${category}`),
  create: (data: Partial<Service>) => fetchApi<Service>('/api/services', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Service>) => fetchApi<Service>(`/api/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => fetchApi<void>(`/api/services/${id}`, { method: 'DELETE' }),
};

// Blog
export const blogApi = {
  getPosts: (params?: { page?: number; pageSize?: number; categoryId?: number; tag?: string; search?: string }) =>
    fetchApi<{ posts: BlogPost[]; total: number; page: number; pageSize: number }>('/api/blog', { params: params as Record<string, string | number> }),
  getBySlug: (slug: string) => fetchApi<BlogPost>(`/api/blog/${slug}`),
  getRecent: (count?: number) => fetchApi<BlogPost[]>(`/api/blog/recent`, { params: { count: count || 5 } }),
  getCategories: () => fetchApi<BlogCategory[]>('/api/blog/categories'),
  create: (data: Partial<BlogPost>) => fetchApi<BlogPost>('/api/blog', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<BlogPost>) => fetchApi<BlogPost>(`/api/blog/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => fetchApi<void>(`/api/blog/${id}`, { method: 'DELETE' }),
};

// Testimonials
export const testimonialsApi = {
  getAll: () => fetchApi<Testimonial[]>('/api/testimonials'),
  create: (data: Partial<Testimonial>) => fetchApi<Testimonial>('/api/testimonials', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Testimonial>) => fetchApi<Testimonial>(`/api/testimonials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => fetchApi<void>(`/api/testimonials/${id}`, { method: 'DELETE' }),
};

// Case Studies
export const caseStudiesApi = {
  getAll: () => fetchApi<CaseStudy[]>('/api/casestudies'),
  getBySlug: (slug: string) => fetchApi<CaseStudy>(`/api/casestudies/${slug}`),
  create: (data: Partial<CaseStudy>) => fetchApi<CaseStudy>('/api/casestudies', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<CaseStudy>) => fetchApi<CaseStudy>(`/api/casestudies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => fetchApi<void>(`/api/casestudies/${id}`, { method: 'DELETE' }),
};

// Industries
export const industriesApi = {
  getAll: () => fetchApi<IndustrySolution[]>('/api/industries'),
  getBySlug: (slug: string) => fetchApi<IndustrySolution>(`/api/industries/${slug}`),
  create: (data: Partial<IndustrySolution>) => fetchApi<IndustrySolution>('/api/industries', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<IndustrySolution>) => fetchApi<IndustrySolution>(`/api/industries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => fetchApi<void>(`/api/industries/${id}`, { method: 'DELETE' }),
};

// Contact
export const contactApi = {
  submit: (data: { name: string; email: string; phone?: string; company?: string; subject: string; message: string; serviceInterest?: string }) =>
    fetchApi<ContactMessage>('/api/contact', { method: 'POST', body: JSON.stringify(data) }),
  getAll: () => fetchApi<ContactMessage[]>('/api/contact'),
  getById: (id: number) => fetchApi<ContactMessage>(`/api/contact/${id}`),
  markAsRead: (id: number) => fetchApi<void>(`/api/contact/${id}/read`, { method: 'PUT' }),
  archive: (id: number) => fetchApi<void>(`/api/contact/${id}/archive`, { method: 'PUT' }),
  getUnreadCount: () => fetchApi<{ count: number }>('/api/contact/unread-count'),
};

// Newsletter
export const newsletterApi = {
  subscribe: (data: { email: string; name?: string }) =>
    fetchApi<{ success: boolean; message: string }>('/api/newsletter/subscribe', { method: 'POST', body: JSON.stringify(data) }),
  unsubscribe: (token: string) => fetchApi<void>(`/api/newsletter/unsubscribe/${token}`, { method: 'POST' }),
  getSubscribers: () => fetchApi<NewsletterSubscriber[]>('/api/newsletter/subscribers'),
  getCount: () => fetchApi<{ count: number }>('/api/newsletter/count'),
};

// Videos
export const videosApi = {
  getAll: () => fetchApi<VideoDemo[]>('/api/videos'),
  getByCategory: (category: string) => fetchApi<VideoDemo[]>(`/api/videos/category/${category}`),
  create: (data: Partial<VideoDemo>) => fetchApi<VideoDemo>('/api/videos', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<VideoDemo>) => fetchApi<VideoDemo>(`/api/videos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => fetchApi<void>(`/api/videos/${id}`, { method: 'DELETE' }),
};

// Team
export const teamApi = {
  getAll: () => fetchApi<TeamMember[]>('/api/team'),
  create: (data: Partial<TeamMember>) => fetchApi<TeamMember>('/api/team', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<TeamMember>) => fetchApi<TeamMember>(`/api/team/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => fetchApi<void>(`/api/team/${id}`, { method: 'DELETE' }),
};

// Auth
export const authApi = {
  login: (data: { email: string; password: string }) =>
    fetchApi<{ message: string; user: { email: string; roles: string[] } }>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => fetchApi<void>('/api/auth/logout', { method: 'POST' }),
  getCurrentUser: () =>
    fetchApi<{ email: string; roles: string[] }>('/api/auth/me'),
};

// Admin Dashboard
export const adminApi = {
  getDashboard: () => fetchApi<DashboardStats>('/api/admin/dashboard'),
};

// Blog Categories (Admin CRUD)
export const blogCategoryApi = {
  getAll: () => fetchApi<BlogCategory[]>('/api/blog/categories'),
  create: (data: { name: string; slug: string; description?: string }) =>
    fetchApi<BlogCategory>('/api/blog/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { name: string; slug: string; description?: string }) =>
    fetchApi<BlogCategory>(`/api/blog/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => fetchApi<void>(`/api/blog/categories/${id}`, { method: 'DELETE' }),
};

// Monitoring (Admin)
export const monitoringApi = {
  getApiRequests: (params?: { page?: number; pageSize?: number; method?: string; statusCode?: number; path?: string }) =>
    fetchApi<PaginatedResponse<ApiRequestLog>>('/api/admin/monitoring/api-requests', { params: params as Record<string, string | number> }),
  getApiRequestStats: () => fetchApi<ApiRequestStats>('/api/admin/monitoring/api-requests/stats'),
  getAuditLogs: (params?: { page?: number; pageSize?: number; action?: string; entityType?: string; userId?: string }) =>
    fetchApi<PaginatedResponse<AuditLog>>('/api/admin/monitoring/audit-logs', { params: params as Record<string, string | number> }),
  getSystemHealth: () => fetchApi<SystemHealth>('/api/admin/monitoring/system-health'),
  getRecentLogs: (params?: { lines?: number; level?: string }) =>
    fetchApi<LogResponse>('/api/admin/monitoring/logs/recent', { params: params as Record<string, string | number> }),
};

// Users (Admin)
export const usersApi = {
  getAll: () => fetchApi<AdminUser[]>('/api/admin/users'),
  create: (data: { email: string; password: string; role: string }) =>
    fetchApi<AdminUser>('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateRoles: (id: string, roles: string[]) =>
    fetchApi<void>(`/api/admin/users/${id}/roles`, { method: 'PUT', body: JSON.stringify({ roles }) }),
  delete: (id: string) => fetchApi<void>(`/api/admin/users/${id}`, { method: 'DELETE' }),
};

// Chat Requests
export const chatRequestApi = {
  submit: (data: { name: string; email: string; phone?: string; company?: string; requestType: string; message: string; serviceInterest?: string; priority?: string }) =>
    fetchApi<ChatRequest>('/api/chat-requests', { method: 'POST', body: JSON.stringify(data) }),
  getAll: () => fetchApi<ChatRequest[]>('/api/chat-requests'),
  getById: (id: number) => fetchApi<ChatRequest>(`/api/chat-requests/${id}`),
  resolve: (id: number, notes: string) => fetchApi<void>(`/api/chat-requests/${id}/resolve`, { method: 'PUT', body: JSON.stringify({ adminNotes: notes }) }),
  assign: (id: number, assignedTo: string) => fetchApi<void>(`/api/chat-requests/${id}/assign`, { method: 'PUT', body: JSON.stringify({ assignedTo }) }),
};

// Types
export interface HomePageData {
  featuredServices: Service[];
  allServices: Service[];
  testimonials: Testimonial[];
  caseStudies: CaseStudy[];
  industries: IndustrySolution[];
  videoDemos: VideoDemo[];
  recentPosts: BlogPost[];
  teamMembers: TeamMember[];
  settings: SiteSettings;
}

export interface Service {
  id: number;
  title: string;
  shortDescription: string;
  fullDescription: string;
  iconSvg: string;
  slug: string;
  category: string;
  features: string;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content: string;
  featuredImageUrl?: string;
  categoryId: number;
  category?: BlogCategory;
  authorName: string;
  tags?: string;
  isPublished: boolean;
  publishedAt?: string;
  viewCount: number;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlogCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
}

export interface Testimonial {
  id: number;
  authorName: string;
  authorTitle: string;
  company: string;
  quote: string;
  initials: string;
  rating: number;
  isActive: boolean;
  sortOrder: number;
}

export interface CaseStudy {
  id: number;
  title: string;
  description: string;
  fullContent: string;
  tag: string;
  gradientFrom: string;
  gradientTo: string;
  iconSvg: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
}

export interface IndustrySolution {
  id: number;
  title: string;
  shortDescription: string;
  fullDescription: string;
  iconSvg: string;
  slug: string;
  challenges: string;
  solutions: string;
  sortOrder: number;
  isActive: boolean;
}

export interface TeamMember {
  id: number;
  name: string;
  title: string;
  bio: string;
  imageUrl?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
  serviceInterest?: string;
  isRead: boolean;
  isArchived: boolean;
  repliedAt?: string;
  createdAt: string;
}

export interface NewsletterSubscriber {
  id: number;
  email: string;
  name?: string;
  isActive: boolean;
  token: string;
  subscribedAt: string;
  unsubscribedAt?: string;
}

export interface VideoDemo {
  id: number;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
}

export interface SiteSettings {
  id: number;
  companyName: string;
  tagline: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  facebookUrl?: string;
  twitterUrl?: string;
  linkedInUrl?: string;
  googleMapsEmbed?: string;
  newsletterEnabled: boolean;
}

export interface DashboardStats {
  totalMessages: number;
  unreadMessages: number;
  totalSubscribers: number;
  totalBlogPosts: number;
  totalServices: number;
  totalCaseStudies: number;
  recentMessages: ContactMessage[];
}

export interface ChatRequest {
  id: number;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  requestType: string;
  message: string;
  serviceInterest?: string;
  priority?: string;
  isResolved: boolean;
  adminNotes?: string;
  resolvedAt?: string;
  assignedTo?: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  roles: string[];
  createdAt?: string;
}

// Monitoring Types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiRequestLog {
  id: number;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  clientIp?: string;
  userId?: string;
  correlationId?: string;
  createdAt: string;
}

export interface ApiRequestStats {
  totalRequests: number;
  avgDurationMs: number;
  errorCount: number;
  errorRate: number;
  topEndpoints: { method: string; path: string; count: number; avgDurationMs: number }[];
  statusDistribution: { statusCode: number; count: number }[];
  period: string;
}

export interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  entityId?: number;
  userId?: string;
  userEmail?: string;
  details?: string;
  ipAddress?: string;
  correlationId?: string;
  createdAt: string;
}

export interface SystemHealth {
  database: { sizeBytes: number; sizeMb: number; provider: string };
  recordCounts: Record<string, number>;
  runtime: { workingSetMb: number; uptime: string; environment: string; framework: string };
}

export interface LogEntry {
  lineNumber: number;
  content: string;
  level: string;
}

export interface LogResponse {
  entries: LogEntry[];
  file: string;
  totalLines: number;
}

// ─── Chat / Live Chat ────────────────────────────────────────────────────────

export interface ChatMessage {
  id: number;
  sessionId: string;
  senderName: string;
  senderEmail?: string;
  content: string;
  isFromAdmin: boolean;
  isRead: boolean;
  customerId?: string;
  createdAt: string;
}

export interface ChatSession {
  sessionId: string;
  customerName: string;
  customerEmail?: string;
  messageCount: number;
  unreadCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
  lastIsFromAdmin?: boolean;
}

export interface CustomerUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

export const customerAuthApi = {
  register: (data: { name: string; email: string; password: string }) =>
    fetchApi<{ detail: string; user: CustomerUser }>('/api/customer/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  login: (email: string, password: string) =>
    fetchApi<{ detail: string; user: CustomerUser }>('/api/customer/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => fetchApi<{ detail: string }>('/api/customer/auth/logout', { method: 'POST' }),
  me: () => fetchApi<CustomerUser>('/api/customer/auth/me'),
};

export const liveChatApi = {
  getHistory: (sessionId: string) => fetchApi<ChatMessage[]>(`/api/live-chat/history/${sessionId}`),
  getSessions: (hours?: number) =>
    fetchApi<ChatSession[]>('/api/live-chat/sessions', { params: hours ? { hours } : undefined }),
  getUnreadCount: () => fetchApi<{ count: number }>('/api/live-chat/unread-count'),
  getCustomerSessions: () => fetchApi<{ sessionId: string; messageCount: number; lastMessage?: string; lastMessageAt?: string }[]>('/api/live-chat/customer-sessions'),
};

// ─── Jobs / Careers ──────────────────────────────────────────────────────────

export interface JobPosting {
  id: number;
  title: string;
  slug: string;
  department: string;
  location: string;
  employmentType: string;
  salaryRange?: string;
  summary?: string;
  description?: string;
  requirements?: string;
  niceToHave?: string;
  isActive: boolean;
  sortOrder: number;
  applicationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobApplication {
  id: number;
  jobPostingId: number;
  jobTitle?: string;
  name: string;
  email: string;
  phone?: string;
  linkedInUrl?: string;
  portfolioUrl?: string;
  coverLetter?: string;
  adminNotes?: string;
  status: string;
  createdAt: string;
}

export interface ApplyJobRequest {
  name: string;
  email: string;
  phone?: string;
  linkedInUrl?: string;
  portfolioUrl?: string;
  coverLetter?: string;
}

export const jobsApi = {
  // Public
  getAll: (department?: string) =>
    fetchApi<JobPosting[]>('/api/jobs', { params: department ? { department } : undefined }),
  getDepartments: () => fetchApi<string[]>('/api/jobs/departments'),
  getBySlug: (slug: string) => fetchApi<JobPosting>(`/api/jobs/slug/${slug}`),
  apply: (jobId: number, data: ApplyJobRequest) =>
    fetchApi<{ detail: string; applicationId: number }>(`/api/jobs/${jobId}/apply`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Admin
  adminGetAll: () => fetchApi<JobPosting[]>('/api/jobs/admin/all'),
  adminGetById: (id: number) => fetchApi<JobPosting>(`/api/jobs/admin/${id}`),
  adminCreate: (data: Partial<JobPosting>) =>
    fetchApi<JobPosting>('/api/jobs', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdate: (id: number, data: Partial<JobPosting>) =>
    fetchApi<JobPosting>(`/api/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminDelete: (id: number) =>
    fetchApi<{ detail: string }>(`/api/jobs/${id}`, { method: 'DELETE' }),
  adminGetApplications: (jobId?: number, status?: string) =>
    fetchApi<JobApplication[]>('/api/jobs/admin/applications', {
      params: { ...(jobId && { jobId }), ...(status && { status }) },
    }),
  adminUpdateApplicationStatus: (appId: number, status: string, notes?: string) =>
    fetchApi<{ detail: string }>(`/api/jobs/admin/applications/${appId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, adminNotes: notes }),
    }),
};
