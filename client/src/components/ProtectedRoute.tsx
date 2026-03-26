import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "driver" | "admin";
  redirectTo?: string;
}

export default function ProtectedRoute({ 
  children, 
  requiredRole,
  redirectTo = "/login" 
}: ProtectedRouteProps) {
  const { user, driver, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setLocation(redirectTo);
        return;
      }

      if (requiredRole === "driver" && user?.role !== "driver" && user?.role !== "admin") {
        setLocation(redirectTo);
        return;
      }

      if (requiredRole === "admin" && user?.role !== "admin") {
        setLocation(redirectTo);
        return;
      }

      if (requiredRole === "driver" && user?.role === "driver") {
        if (!driver) {
          setLocation("/driver/apply");
          return;
        }
        if (driver.applicationStatus !== "approved") {
          setLocation("/driver/apply");
          return;
        }
        if (driver.kycStatus !== "approved") {
          setLocation("/driver/kyc");
          return;
        }
      }
    }
  }, [isLoading, isAuthenticated, user, driver, requiredRole, setLocation, redirectTo]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredRole === "driver" && user?.role !== "driver" && user?.role !== "admin") {
    return null;
  }

  if (requiredRole === "admin" && user?.role !== "admin") {
    return null;
  }

  return <>{children}</>;
}
