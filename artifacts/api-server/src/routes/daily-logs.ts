import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, dailyLogsTable, patientsTable, staffTable, homesTable } from "@workspace/db";
import {
  CreateDailyLogBody,
  ListDailyLogsResponse,
  ListDailyLogsQueryParams,
} from "@workspace/api-zod";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const dailyLogSelect = {
  id: dailyLogsTable.id,
  patientId: dailyLogsTable.patientId,
  patientName: sql<string>`concat(${patientsTable.firstName}, ' ', ${patientsTable.lastName})`,
  staffId: dailyLogsTable.staffId,
  staffName: sql<string>`concat(${staffTable.firstName}, ' ', ${staffTable.lastName})`,
  homeId: dailyLogsTable.homeId,
  date: dailyLogsTable.date,
  mood: dailyLogsTable.mood,
  appetite: dailyLogsTable.appetite,
  sleep: dailyLogsTable.sleep,
  activities: dailyLogsTable.activities,
  behaviors: dailyLogsTable.behaviors,
  notes: dailyLogsTable.notes,
  createdAt: dailyLogsTable.createdAt,
};

router.get("/daily-logs", async (req, res): Promise<void> => {
  const queryParams = ListDailyLogsQueryParams.safeParse(req.query);

  let query = db
    .select(dailyLogSelect)
    .from(dailyLogsTable)
    .leftJoin(patientsTable, eq(dailyLogsTable.patientId, patientsTable.id))
    .leftJoin(staffTable, eq(dailyLogsTable.staffId, staffTable.id))
    .orderBy(dailyLogsTable.date)
    .$dynamic();

  if (queryParams.success && queryParams.data.patientId) {
    query = query.where(eq(dailyLogsTable.patientId, queryParams.data.patientId));
  }
  if (queryParams.success && queryParams.data.homeId) {
    query = query.where(eq(dailyLogsTable.homeId, queryParams.data.homeId));
  }

  const logs = await query;
  res.json(ListDailyLogsResponse.parse(logs));
});

router.post("/daily-logs", async (req, res): Promise<void> => {
  const parsed = CreateDailyLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [log] = await db.insert(dailyLogsTable).values(parsed.data).returning();

  const [result] = await db
    .select(dailyLogSelect)
    .from(dailyLogsTable)
    .leftJoin(patientsTable, eq(dailyLogsTable.patientId, patientsTable.id))
    .leftJoin(staffTable, eq(dailyLogsTable.staffId, staffTable.id))
    .where(eq(dailyLogsTable.id, log.id));

  res.status(201).json(result);
});

export default router;
