export type Role = 'owner' | 'editor' | 'viewer';

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface DocSummary {
  id: string;
  title: string;
  updated_at: string;
  owner_name: string;
  role: Role;
}

export interface Doc extends DocSummary {
  owner_id: number;
  content_html: string;
  version: number;
  created_at: string;
}

export interface Share {
  user_id: number;
  email: string;
  name: string;
  role: 'viewer' | 'editor';
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(`/api${url}`, init);
  } catch {
    throw new ApiError(0, 'Network error. Check your connection and try again.');
  }
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

function uploadForm(file: File) {
  const form = new FormData();
  form.append('file', file);
  return form;
}

export const api = {
  me: () => request<{ user: User }>('GET', '/auth/me'),
  login: (email: string, password: string) => request<{ user: User }>('POST', '/auth/login', { email, password }),
  logout: () => request<void>('POST', '/auth/logout'),
  users: () => request<{ users: User[] }>('GET', '/users'),

  listDocs: () => request<{ owned: DocSummary[]; shared: DocSummary[] }>('GET', '/documents'),
  createDoc: () => request<{ document: Doc }>('POST', '/documents', {}),
  getDoc: (id: string) => request<{ document: Doc }>('GET', `/documents/${id}`),
  updateDoc: (id: string, body: { title?: string; content_html?: string; version: number }) =>
    request<{ document: Doc }>('PATCH', `/documents/${id}`, body),
  deleteDoc: (id: string) => request<void>('DELETE', `/documents/${id}`),

  importAsNewDoc: (file: File) => request<{ document: Doc }>('POST', '/uploads/import', uploadForm(file)),
  importIntoDoc: (id: string, file: File) =>
    request<{ document: Doc }>('POST', `/documents/${id}/import`, uploadForm(file)),

  listShares: (id: string) => request<{ shares: Share[] }>('GET', `/documents/${id}/shares`),
  share: (id: string, email: string, role: 'viewer' | 'editor') =>
    request<{ shares: Share[] }>('POST', `/documents/${id}/shares`, { email, role }),
  unshare: (id: string, userId: number) => request<{ shares: Share[] }>('DELETE', `/documents/${id}/shares/${userId}`),
};

/** Client-side mirror of the server's upload rules, so users get instant feedback. */
export const UPLOAD_ACCEPT = '.txt,.md,.docx';
export const UPLOAD_HINT = 'Supports .txt, .md and .docx up to 2 MB';
export function checkUpload(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!['.txt', '.md', '.docx'].includes(ext)) return `“${file.name}” isn't supported. ${UPLOAD_HINT}.`;
  if (file.size > 2 * 1024 * 1024) return `“${file.name}” is larger than 2 MB.`;
  return null;
}

export function formatRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
