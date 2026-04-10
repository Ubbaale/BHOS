import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export type UserRole = "admin" | "manager" | "nurse" | "direct_care" | "billing" | "viewer";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: UserRole;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).__devTestAuth) {
    req.userId = (req as any).__devTestAuth.userId;
    req.userRole = (req as any).__devTestAuth.role;
    return next();
  }

  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.userId = userId as string;
  const role = (auth?.sessionClaims?.metadata as any)?.role as UserRole | undefined;
  req.userRole = role || "viewer";
  next();
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ error: "Forbidden: insufficient permissions" });
    }
    next();
  };
};
