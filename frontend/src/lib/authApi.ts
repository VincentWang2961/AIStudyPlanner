import { API_BASE_URL } from "./apiBaseUrl";

export interface AuthUser {
  id: string;
  email: string;
}

export type AuthMode = "login" | "register";

function buildBackendUnavailableMessage(action: string): string {
  return `Unable to ${action}. Make sure the backend is running at ${API_BASE_URL}.`;
}

function logAuthWarning(message: string, error: unknown): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn(message, error);
  }
}

async function requestAuth(path: string, email: string, password: string): Promise<AuthUser> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    throw new Error(buildBackendUnavailableMessage("authenticate"), {
      cause: error,
    });
  }

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
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    return payload?.user ?? null;
  } catch (error) {
    logAuthWarning("Unable to fetch the current user session.", error);
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    throw new Error(buildBackendUnavailableMessage("sign out"), {
      cause: error,
    });
  }
}

export async function createGuestSession(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/guest`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to start a guest session.");
  }
}
