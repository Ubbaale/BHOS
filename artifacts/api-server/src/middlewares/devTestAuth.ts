import type { Request, Response, NextFunction } from "express";
import { db, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const TEST_EMAILS: Record<string, boolean> = {
  "admin@test.bhos.app": true,
  "manager@test.bhos.app": true,
  "nurse@test.bhos.app": true,
  "caregiver@test.bhos.app": true,
};

const staffCache = new Map<string, { clerkUserId: string; role: string }>();

export function devTestAuth(req: Request, _res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "production") return next();

  const testEmail = req.headers["x-test-user-email"] as string | undefined;
  if (!testEmail || !TEST_EMAILS[testEmail]) return next();

  const cached = staffCache.get(testEmail);
  if (cached) {
    (req as any).__devTestAuth = { userId: cached.clerkUserId, role: cached.role };
    return next();
  }

  db.select({ clerkUserId: staffTable.clerkUserId, role: staffTable.role })
    .from(staffTable)
    .where(eq(staffTable.email, testEmail))
    .limit(1)
    .then(([staff]) => {
      if (staff?.clerkUserId) {
        staffCache.set(testEmail, { clerkUserId: staff.clerkUserId, role: staff.role });
        (req as any).__devTestAuth = { userId: staff.clerkUserId, role: staff.role };
      }
      next();
    })
    .catch(() => next());
}
