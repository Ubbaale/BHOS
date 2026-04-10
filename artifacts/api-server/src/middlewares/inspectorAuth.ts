import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { stateInspectorsTable, stateAuditLogTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

declare global {
  namespace Express {
    interface Request {
      inspector?: {
        id: number;
        orgId: number;
        name: string;
        email: string;
        stateAgency: string;
        accessScope: number[] | null;
      };
    }
  }
}

export const requireInspectorAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing inspector access token" });
  }

  const token = authHeader.slice(7);
  const tokenHash = hashToken(token);
  const [inspector] = await db
    .select()
    .from(stateInspectorsTable)
    .where(and(eq(stateInspectorsTable.accessToken, tokenHash), eq(stateInspectorsTable.status, "active")))
    .limit(1);

  if (!inspector) {
    return res.status(401).json({ error: "Invalid or revoked access token" });
  }

  if (inspector.expiresAt && new Date(inspector.expiresAt) < new Date()) {
    return res.status(401).json({ error: "Access token has expired" });
  }

  await db.update(stateInspectorsTable).set({ lastLoginAt: new Date() }).where(eq(stateInspectorsTable.id, inspector.id));

  req.inspector = {
    id: inspector.id,
    orgId: inspector.orgId,
    name: inspector.name,
    email: inspector.email,
    stateAgency: inspector.stateAgency,
    accessScope: inspector.accessScope as number[] | null,
  };

  next();
};

export async function logInspectorAccess(
  inspectorId: number,
  orgId: number,
  action: string,
  resourceType: string,
  resourceId: number | null,
  req: Request
) {
  await db.insert(stateAuditLogTable).values({
    inspectorId,
    orgId,
    action,
    resourceType,
    resourceId,
    ipAddress: req.ip || req.socket.remoteAddress || null,
    userAgent: req.headers["user-agent"] || null,
    details: `${req.method} ${req.originalUrl}`,
  });
}
