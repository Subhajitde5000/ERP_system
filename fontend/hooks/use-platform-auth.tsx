"use client";

/**
 * Platform Authentication Hook — `usePlatformAuth`
 *
 * Provides reactive access to platform staff authentication state:
 * - `user`: current PlatformUser profile ({ id, name, email, role, lastLoginAt }) or null
 * - `role`: PlatformRole ("SUPER_ADMIN" | "SUPPORT_STAFF" | "SALES_EXECUTIVE" | "FINANCE_MANAGER") or null
 * - `isAuthenticated`: boolean
 * - `isLoading`: boolean
 * - `error`: string | null
 * - `login`: (credentials) => Promise<PlatformLoginResponse>
 * - `logout`: () => Promise<void>
 * - `refresh`: () => Promise<string | null>
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import {
  platformLogin,
  platformLogout,
  refreshPlatformToken,
  getPlatformMe,
  getAccessToken,
} from "@/lib/auth";
import type {
  PlatformLoginCredentials,
  PlatformLoginResponse,
  PlatformRole,
} from "@/types/auth";

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  lastLoginAt: string | null;
}

interface PlatformAuthContextType {
  user: PlatformUser | null;
  role: PlatformRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: PlatformLoginCredentials) => Promise<PlatformLoginResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
}

/**
 * Exported so `usePlatformSession` can read the session without throwing when
 * no provider is mounted (shared chrome, `?role=` previews). Consumers that
 * need login/logout should use `usePlatformAuth` instead.
 */
export const PlatformAuthContext = createContext<
  PlatformAuthContextType | undefined
>(undefined);

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [role, setRole] = useState<PlatformRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize and check current authentication state
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const token = getAccessToken();
        if (token) {
          const me = await getPlatformMe();
          if (me && isMounted) {
            setUser({
              id: me.id,
              name: me.name,
              email: me.email,
              role: me.role,
              lastLoginAt: me.lastLoginAt,
            });
            setRole(me.role);
          }
        }
      } catch {
        // Token invalid or network issue
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = useCallback(
    async (credentials: PlatformLoginCredentials): Promise<PlatformLoginResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await platformLogin(credentials);
        setUser({
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          role: res.role,
          lastLoginAt: res.user.lastLoginAt,
        });
        setRole(res.role);
        setIsLoading(false);
        return res;
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "Platform authentication failed";
        setError(errMsg);
        setIsLoading(false);
        throw err;
      }
    },
    []
  );

  const handleLogout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await platformLogout();
    } finally {
      setUser(null);
      setRole(null);
      setError(null);
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async (): Promise<string | null> => {
    try {
      const token = await refreshPlatformToken();
      if (token) {
        const me = await getPlatformMe();
        if (me) {
          setUser({
            id: me.id,
            name: me.name,
            email: me.email,
            role: me.role,
            lastLoginAt: me.lastLoginAt,
          });
          setRole(me.role);
        }
      }
      return token;
    } catch {
      setUser(null);
      setRole(null);
      return null;
    }
  }, []);

  return (
    <PlatformAuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        isLoading,
        error,
        login: handleLogin,
        logout: handleLogout,
        refresh: handleRefresh,
      }}
    >
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth(): PlatformAuthContextType {
  const context = useContext(PlatformAuthContext);
  if (!context) {
    throw new Error(
      "usePlatformAuth must be used within a PlatformAuthProvider"
    );
  }
  return context;
}
