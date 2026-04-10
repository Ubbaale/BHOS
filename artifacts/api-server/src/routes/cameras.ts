import { Router } from "express";
import { db } from "@workspace/db";
import { camerasTable, cameraEventsTable, homesTable } from "@workspace/db/schema";
import { eq, ilike, or, desc, and, sql } from "drizzle-orm";

const router = Router();

router.get("/cameras", async (req, res) => {
  try {
    const { homeId, status } = req.query;
    const conditions: any[] = [];
    if (homeId) conditions.push(eq(camerasTable.homeId, Number(homeId)));
    if (status) conditions.push(eq(camerasTable.status, String(status)));

    const cameras = await db
      .select({
        id: camerasTable.id,
        homeId: camerasTable.homeId,
        homeName: homesTable.name,
        name: camerasTable.name,
        location: camerasTable.location,
        cameraType: camerasTable.cameraType,
        brand: camerasTable.brand,
        model: camerasTable.model,
        streamUrl: camerasTable.streamUrl,
        dashboardUrl: camerasTable.dashboardUrl,
        resolution: camerasTable.resolution,
        hasNightVision: camerasTable.hasNightVision,
        hasAudio: camerasTable.hasAudio,
        hasMotionDetection: camerasTable.hasMotionDetection,
        recordingMode: camerasTable.recordingMode,
        retentionDays: camerasTable.retentionDays,
        status: camerasTable.status,
        lastOnlineAt: camerasTable.lastOnlineAt,
        installedAt: camerasTable.installedAt,
        notes: camerasTable.notes,
        createdAt: camerasTable.createdAt,
        updatedAt: camerasTable.updatedAt,
      })
      .from(camerasTable)
      .leftJoin(homesTable, eq(camerasTable.homeId, homesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(camerasTable.name);

    res.json(cameras);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/cameras/stats", async (req, res) => {
  try {
    const all = await db.select({ status: camerasTable.status }).from(camerasTable);
    const total = all.length;
    const online = all.filter(c => c.status === "online").length;
    const offline = all.filter(c => c.status === "offline").length;
    const maintenance = all.filter(c => c.status === "maintenance").length;

    const byHome = await db
      .select({
        homeId: camerasTable.homeId,
        homeName: homesTable.name,
        count: sql<number>`count(*)::int`,
        onlineCount: sql<number>`count(*) filter (where ${camerasTable.status} = 'online')::int`,
      })
      .from(camerasTable)
      .leftJoin(homesTable, eq(camerasTable.homeId, homesTable.id))
      .groupBy(camerasTable.homeId, homesTable.name);

    res.json({ total, online, offline, maintenance, byHome });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/cameras/:id", async (req, res) => {
  try {
    const [camera] = await db
      .select({
        id: camerasTable.id,
        homeId: camerasTable.homeId,
        homeName: homesTable.name,
        name: camerasTable.name,
        location: camerasTable.location,
        cameraType: camerasTable.cameraType,
        brand: camerasTable.brand,
        model: camerasTable.model,
        streamUrl: camerasTable.streamUrl,
        dashboardUrl: camerasTable.dashboardUrl,
        resolution: camerasTable.resolution,
        hasNightVision: camerasTable.hasNightVision,
        hasAudio: camerasTable.hasAudio,
        hasMotionDetection: camerasTable.hasMotionDetection,
        recordingMode: camerasTable.recordingMode,
        retentionDays: camerasTable.retentionDays,
        status: camerasTable.status,
        lastOnlineAt: camerasTable.lastOnlineAt,
        installedAt: camerasTable.installedAt,
        notes: camerasTable.notes,
        createdAt: camerasTable.createdAt,
        updatedAt: camerasTable.updatedAt,
      })
      .from(camerasTable)
      .leftJoin(homesTable, eq(camerasTable.homeId, homesTable.id))
      .where(eq(camerasTable.id, Number(req.params.id)));

    if (!camera) return res.status(404).json({ error: "Camera not found" });
    res.json(camera);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/cameras", async (req, res) => {
  try {
    const {
      homeId, name, location, cameraType, brand, model, streamUrl, dashboardUrl,
      resolution, hasNightVision, hasAudio, hasMotionDetection, recordingMode,
      retentionDays, status, installedAt, notes,
    } = req.body;

    if (!homeId || !name || !location) {
      return res.status(400).json({ error: "homeId, name, and location are required" });
    }

    const [camera] = await db.insert(camerasTable).values({
      homeId: Number(homeId),
      name,
      location,
      cameraType: cameraType || "indoor",
      brand,
      model,
      streamUrl,
      dashboardUrl,
      resolution,
      hasNightVision: hasNightVision || false,
      hasAudio: hasAudio || false,
      hasMotionDetection: hasMotionDetection || false,
      recordingMode: recordingMode || "continuous",
      retentionDays: retentionDays || 30,
      status: status || "online",
      installedAt: installedAt ? new Date(installedAt) : null,
      notes,
    }).returning();

    res.status(201).json(camera);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/cameras/:id", async (req, res) => {
  try {
    const updates: any = { updatedAt: new Date() };
    const fields = [
      "name", "location", "cameraType", "brand", "model", "streamUrl", "dashboardUrl",
      "resolution", "hasNightVision", "hasAudio", "hasMotionDetection", "recordingMode",
      "retentionDays", "status", "notes",
    ];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    if (req.body.installedAt !== undefined) {
      updates.installedAt = req.body.installedAt ? new Date(req.body.installedAt) : null;
    }
    if (req.body.status === "online") {
      updates.lastOnlineAt = new Date();
    }

    const [camera] = await db
      .update(camerasTable)
      .set(updates)
      .where(eq(camerasTable.id, Number(req.params.id)))
      .returning();

    if (!camera) return res.status(404).json({ error: "Camera not found" });
    res.json(camera);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/cameras/:id", async (req, res) => {
  try {
    await db.delete(cameraEventsTable).where(eq(cameraEventsTable.cameraId, Number(req.params.id)));
    const [deleted] = await db
      .delete(camerasTable)
      .where(eq(camerasTable.id, Number(req.params.id)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Camera not found" });
    res.json({ message: "Camera deleted" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/cameras/:id/events", async (req, res) => {
  try {
    const events = await db
      .select()
      .from(cameraEventsTable)
      .where(eq(cameraEventsTable.cameraId, Number(req.params.id)))
      .orderBy(desc(cameraEventsTable.occurredAt))
      .limit(100);

    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/cameras/:id/events", async (req, res) => {
  try {
    const { eventType, description, clipUrl, thumbnailUrl, incidentId } = req.body;
    if (!eventType) return res.status(400).json({ error: "eventType is required" });

    const [event] = await db.insert(cameraEventsTable).values({
      cameraId: Number(req.params.id),
      eventType,
      description,
      clipUrl,
      thumbnailUrl,
      incidentId: incidentId ? Number(incidentId) : null,
    }).returning();

    res.status(201).json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/camera-events/:id/review", async (req, res) => {
  try {
    const { reviewedBy } = req.body;
    const [event] = await db
      .update(cameraEventsTable)
      .set({ reviewedBy: Number(reviewedBy), reviewedAt: new Date() })
      .where(eq(cameraEventsTable.id, Number(req.params.id)))
      .returning();

    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
