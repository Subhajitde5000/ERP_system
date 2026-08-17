/**
 * Session context — mobile port of fontend/hooks/use-institution-auth.tsx.
 *
 * Uses the tenant JWT from lib/auth.ts (in-memory access token, refresh token
 * in the secure store) and `/tenant/auth/me` to load the signed-in user.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  API_BASE_URL,
  getAccessToken,
  refreshAccessToken,
  logout as tenantLogout,
} from "./auth";

export interface InstitutionUser {
  id: string;
  name: string;
  email: string | null;
  tenantId: string;
  roles: string[];
}

interface InstitutionAuthContextType {
  user: InstitutionUser | null;
  isAuthenticated: boolean;
  hasRole: (role: string) => boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
  /** Re-fetch `/tenant/auth/me` — used right after a successful login. */
  refresh: () => Promise<void>;
  /** Apply the user payload from the login response directly. */
  setUserFromLogin: (user: InstitutionUser | null) => void;
}

const InstitutionAuthContext = createContext<InstitutionAuthContextType | undefined>(undefined);

async function fetchMe(): Promise<InstitutionUser | null> {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/tenant/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const env = await res.json();
    const d = env?.data;
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      email: d.email,
      tenantId: d.tenant_id,
      roles: d.roles ?? [],
    };
  } catch {
    return null;
  }
}

export function InstitutionAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<InstitutionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrate = useCallback(async () => {
    try {
      if (!getAccessToken()) await refreshAccessToken();
      const me = await fetchMe();
      setUser(me);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Re-run hydration with a fresh access token (post-login). */
  const refresh = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
  }, []);

  /** Apply the user returned by the login call itself — no extra round trip. */
  const setUserFromLogin = useCallback((next: InstitutionUser | null) => {
    setUser(next);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const logout = useCallback(async () => {
    try {
      await tenantLogout();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <InstitutionAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        hasRole: (role: string) => !!user && user.roles.includes(role),
        isLoading,
        logout,
        refresh,
        setUserFromLogin,
      }}
    >
      {children}
    </InstitutionAuthContext.Provider>
  );
}

export function useInstitutionAuth(): InstitutionAuthContextType {
  const ctx = useContext(InstitutionAuthContext);
  if (!ctx) throw new Error("useInstitutionAuth must be used within an InstitutionAuthProvider");
  return ctx;
}
