import { Router, type IRouter } from "express";
import { eq, sql, isNull } from "drizzle-orm";
import { db, homesTable, organizationsTable } from "@workspace/db";
import {
  CreateHomeBody,
  GetHomeParams,
  GetHomeResponse,
  UpdateHomeParams,
  UpdateHomeBody,
  UpdateHomeResponse,
  ListHomesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const homeSelect = {
  id: homesTable.id,
  orgId: homesTable.orgId,
  name: homesTable.name,
  address: homesTable.address,
  city: homesTable.city,
  state: homesTable.state,
  region: homesTable.region,
  capacity: homesTable.capacity,
  currentOccupancy: homesTable.currentOccupancy,
  status: homesTable.status,
  phone: homesTable.phone,
  latitude: sql<number | null>`${homesTable.latitude}::float`,
  longitude: sql<number | null>`${homesTable.longitude}::float`,
  geofenceRadiusMeters: homesTable.geofenceRadiusMeters,
  createdAt: homesTable.createdAt,
};

router.get("/homes", async (_req, res): Promise<void> => {
  const homes = await db.select(homeSelect).from(homesTable).orderBy(homesTable.name);
  res.json(homes);
});

router.post("/homes", async (req, res): Promise<void> => {
  const parsed = CreateHomeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const orgId = req.body.orgId ? Number(req.body.orgId) : null;
  let resolvedOrgId = orgId;
  if (!resolvedOrgId) {
    const [org] = await db.select({ id: organizationsTable.id }).from(organizationsTable).limit(1);
    resolvedOrgId = org?.id ?? null;
  }

  const [home] = await db.insert(homesTable).values({ ...parsed.data, orgId: resolvedOrgId }).returning();

  const [result] = await db.select(homeSelect).from(homesTable).where(eq(homesTable.id, home.id));
  res.status(201).json(result);
});

router.get("/homes/:id", async (req, res): Promise<void> => {
  const params = GetHomeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [home] = await db.select(homeSelect).from(homesTable).where(eq(homesTable.id, params.data.id));
  if (!home) {
    res.status(404).json({ error: "Home not found" });
    return;
  }

  res.json(home);
});

router.patch("/homes/:id", async (req, res): Promise<void> => {
  const params = UpdateHomeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateHomeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(homesTable)
    .set(parsed.data)
    .where(eq(homesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Home not found" });
    return;
  }

  const [result] = await db.select(homeSelect).from(homesTable).where(eq(homesTable.id, updated.id));
  res.json(result);
});

export default router;
