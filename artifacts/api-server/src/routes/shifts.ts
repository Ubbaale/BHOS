import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, shiftsTable, staffTable, homesTable } from "@workspace/db";
import {
  CreateShiftBody,
  UpdateShiftParams,
  UpdateShiftBody,
  UpdateShiftResponse,
  ListShiftsResponse,
  ListShiftsQueryParams,
} from "@workspace/api-zod";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const shiftSelect = {
  id: shiftsTable.id,
  staffId: shiftsTable.staffId,
  staffName: sql<string>`concat(${staffTable.firstName}, ' ', ${staffTable.lastName})`,
  homeId: shiftsTable.homeId,
  homeName: homesTable.name,
  startTime: shiftsTable.startTime,
  endTime: shiftsTable.endTime,
  status: shiftsTable.status,
  notes: shiftsTable.notes,
  createdAt: shiftsTable.createdAt,
};

router.get("/shifts", async (req, res): Promise<void> => {
  const queryParams = ListShiftsQueryParams.safeParse(req.query);

  let query = db
    .select(shiftSelect)
    .from(shiftsTable)
    .leftJoin(staffTable, eq(shiftsTable.staffId, staffTable.id))
    .leftJoin(homesTable, eq(shiftsTable.homeId, homesTable.id))
    .orderBy(shiftsTable.startTime)
    .$dynamic();

  if (queryParams.success && queryParams.data.homeId) {
    query = query.where(eq(shiftsTable.homeId, queryParams.data.homeId));
  }
  if (queryParams.success && queryParams.data.staffId) {
    query = query.where(eq(shiftsTable.staffId, queryParams.data.staffId));
  }

  const shifts = await query;
  res.json(ListShiftsResponse.parse(shifts));
});

router.post("/shifts", async (req, res): Promise<void> => {
  const parsed = CreateShiftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [shift] = await db.insert(shiftsTable).values(parsed.data).returning();

  const [result] = await db
    .select(shiftSelect)
    .from(shiftsTable)
    .leftJoin(staffTable, eq(shiftsTable.staffId, staffTable.id))
    .leftJoin(homesTable, eq(shiftsTable.homeId, homesTable.id))
    .where(eq(shiftsTable.id, shift.id));

  res.status(201).json(result);
});

router.patch("/shifts/:id", async (req, res): Promise<void> => {
  const params = UpdateShiftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateShiftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(shiftsTable)
    .set(parsed.data)
    .where(eq(shiftsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Shift not found" });
    return;
  }

  const [result] = await db
    .select(shiftSelect)
    .from(shiftsTable)
    .leftJoin(staffTable, eq(shiftsTable.staffId, staffTable.id))
    .leftJoin(homesTable, eq(shiftsTable.homeId, homesTable.id))
    .where(eq(shiftsTable.id, updated.id));

  res.json(UpdateShiftResponse.parse(result));
});

export default router;
