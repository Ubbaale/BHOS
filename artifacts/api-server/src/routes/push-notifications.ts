import { Router } from "express";
import { db } from "@workspace/db";
import { staffTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router = Router();

router.post("/push/register", requireAuth, async (req, res) => {
  try {
    const { expoPushToken, deviceType } = req.body;
    if (!expoPushToken) return res.status(400).json({ error: "expoPushToken is required" });

    let staffId: number | null = null;
    try {
      const { clerkClient } = await import("@clerk/express");
      const user = await clerkClient.users.getUser(req.userId!);
      const email = user.emailAddresses?.[0]?.emailAddress;
      if (email) {
        const [staff] = await db.select().from(staffTable).where(eq(staffTable.email, email));
        if (staff) staffId = staff.id;
      }
    } catch {}

    await db.execute(sql`
      INSERT INTO push_tokens (staff_id, clerk_user_id, expo_push_token, device_type, is_active, updated_at)
      VALUES (${staffId}, ${req.userId}, ${expoPushToken}, ${deviceType || "mobile"}, true, NOW())
      ON CONFLICT (expo_push_token) DO UPDATE SET
        staff_id = ${staffId},
        clerk_user_id = ${req.userId},
        is_active = true,
        updated_at = NOW()
    `);

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/push/unregister", requireAuth, async (req, res) => {
  try {
    const { expoPushToken } = req.body;
    if (!expoPushToken) return res.status(400).json({ error: "expoPushToken is required" });

    await db.execute(sql`
      UPDATE push_tokens SET is_active = false, updated_at = NOW()
      WHERE expo_push_token = ${expoPushToken} AND clerk_user_id = ${req.userId}
    `);

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/push/send", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { title, body, data, targetUserIds, targetStaffIds } = req.body;
    if (!title || !body) return res.status(400).json({ error: "title and body are required" });

    let tokens: string[] = [];

    if (targetStaffIds && targetStaffIds.length > 0) {
      for (const staffId of targetStaffIds) {
        const result = await db.execute(sql`
          SELECT expo_push_token FROM push_tokens WHERE staff_id = ${staffId} AND is_active = true
        `);
        for (const row of result.rows) {
          tokens.push((row as any).expo_push_token);
        }
      }
    } else if (targetUserIds && targetUserIds.length > 0) {
      for (const userId of targetUserIds) {
        const result = await db.execute(sql`
          SELECT expo_push_token FROM push_tokens WHERE clerk_user_id = ${userId} AND is_active = true
        `);
        for (const row of result.rows) {
          tokens.push((row as any).expo_push_token);
        }
      }
    } else {
      const result = await db.execute(sql`SELECT expo_push_token FROM push_tokens WHERE is_active = true`);
      for (const row of result.rows) {
        tokens.push((row as any).expo_push_token);
      }
    }

    if (tokens.length === 0) {
      return res.json({ sent: 0, message: "No active push tokens found" });
    }

    const messages = tokens.map(token => ({
      to: token,
      sound: "default",
      title,
      body,
      data: data || {},
      priority: "high" as const,
      channelId: "default",
    }));

    const chunks = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    let totalSent = 0;
    for (const chunk of chunks) {
      try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chunk),
        });
        if (response.ok) totalSent += chunk.length;
      } catch {}
    }

    res.json({ sent: totalSent, total: tokens.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/push/tokens", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT pt.*, s.first_name, s.last_name
      FROM push_tokens pt
      LEFT JOIN staff s ON pt.staff_id = s.id
      WHERE pt.is_active = true
      ORDER BY pt.updated_at DESC
    `);
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
