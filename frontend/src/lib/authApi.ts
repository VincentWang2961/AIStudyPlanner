export interface AuthUser {
  id: string;
  email: string;
}

export type AuthMode = "login" | "register";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

async function requestAuth(path: string, email: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? "Authentication failed.");
  }

  if (!payload?.user) {
    throw new Error("The authentication response was incomplete.");
  }

  return payload.user;
}

export function login(email: string, password: string): Promise<AuthUser> {
  return requestAuth("/api/auth/login", email, password);
}

export function register(email: string, password: string): Promise<AuthUser> {
  return requestAuth("/api/auth/register", email, password);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  return payload?.user ?? null;
}
