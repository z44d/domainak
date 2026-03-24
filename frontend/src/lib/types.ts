export interface User {
  id: number;
  name: string;
  email: string;
  githubId: number;
  isAdmin: boolean;
}

export interface Domain {
  id: number;
  subdomain: string;
  hostname: string;
  port: number;
  user?: User;
}

export interface Stats {
  daily: number;
  weekly: number;
  monthly: number;
  total: number;
  chartData: { name: string; visitors: number }[];
}
