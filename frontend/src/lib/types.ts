export interface User {
  id: number;
  name: string;
  email: string;
  githubId: number;
  isAdmin: boolean;
  isBanned: boolean;
}

export interface Domain {
  id: number;
  subdomain: string;
  hostname: string;
  port: number;
  createdAt?: string;
  user?: User | null;
}

export interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  githubId: number;
  isBanned: boolean;
  domainCount: number;
}

export interface BannedDomain {
  id: number;
  domain: string;
  reason: string | null;
  createdAt: string;
}

export interface BannedIp {
  id: number;
  ip: string;
  reason: string | null;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface Stats {
  daily: number;
  weekly: number;
  monthly: number;
  total: number;
  chartData: { name: string; visitors: number }[];
}
