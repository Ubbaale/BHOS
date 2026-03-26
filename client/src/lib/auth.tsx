import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest } from "./queryClient";

interface User {
  id: string;
  username: string;
  role: string;
}

interface Driver {
  id: number;
  fullName: string;
  applicationStatus: string;
  kycStatus: string;
}

interface AuthContextType {
  user: User | null;
  driver: Driver | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string; redirectTo?: string; requiresVerification?: boolean; email?: string }>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAuthState = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setDriver(data.driver);
      } else {
        setUser(null);
        setDriver(null);
      }
    } catch (error) {
      setUser(null);
      setDriver(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthState();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { 
          success: false, 
          message: data.message,
          redirectTo: data.redirectTo,
          requiresVerification: data.requiresVerification,
          email: data.email,
        };
      }

      setUser(data.user);
      setDriver(data.driver);
      let redirectTo = "/";
      if (data.user?.role === "admin") redirectTo = "/admin";
      else if (data.user?.role === "driver") redirectTo = data.redirectTo || "/driver";
      return { success: true, redirectTo };
    } catch (error) {
      return { success: false, message: "Login failed. Please try again." };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setDriver(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        driver,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refetch: fetchAuthState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
