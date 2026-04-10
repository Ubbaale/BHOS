import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, fraudAlertsTable, staffTable, homesTable } from "@workspace/db";
import {
  ListFraudAlertsQueryParams,
  ListFraudAlertsResponse,
  UpdateFraudAlertParams,
  UpdateFraudAlertBody,
  UpdateFraudAlertResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const alertSelect = {
  id: fraudAlertsTable.id,
  staffId: fraudAlertsTable.staffId,
  staffName: sql<string>`concat(${staffTable.firstName}, ' ', ${staffTable.lastName})`,
  homeId: fraudAlertsTable.homeId,
  homeName: homesTable.name,
  timePunchId: fraudAlertsTable.timePunchId,
  alertType: fraudAlertsTable.alertType,
  severity: fraudAlertsTable.severity,
  description: fraudAlertsTable.description,
  status: fraudAlertsTable.status,
  reviewedBy: fraudAlertsTable.reviewedBy,
  reviewedAt: fraudAlertsTable.reviewedAt,
  createdAt: fraudAlertsTable.createdAt,
};

router.get("/fraud-alerts", async (req, res): Promise<void> => {
  const queryParams = ListFraudAlertsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  let query = db
    .select(alertSelect)
    .from(fraudAlertsTable)
    .leftJoin(staffTable, eq(fraudAlertsTable.staffId, staffTable.id))
    .leftJoin(homesTable, eq(fraudAlertsTable.homeId, homesTable.id))
    .orderBy(desc(fraudAlertsTable.createdAt))
    .$dynamic();

  if (queryParams.data.status) {
    query = query.where(eq(fraudAlertsTable.status, queryParams.data.status));
  }
  if (queryParams.data.staffId) {
    query = query.where(eq(fraudAlertsTable.staffId, queryParams.data.staffId));
  }

  const alerts = await query;
  res.json(ListFraudAlertsResponse.parse(alerts));
});

router.patch("/fraud-alerts/:id", async (req, res): Promise<void> => {
  const params = UpdateFraudAlertParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateFraudAlertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: any = { status: parsed.data.status };
  if (parsed.data.status === "reviewed" || parsed.data.status === "dismissed") {
    updateData.reviewedAt = new Date();
    if (parsed.data.reviewedBy) {
      updateData.reviewedBy = parsed.data.reviewedBy;
    }
  }

  const [updated] = await db
    .update(fraudAlertsTable)
    .set(updateData)
    .where(eq(fraudAlertsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Fraud alert not found" });
    return;
  }

  const [result] = await db
    .select(alertSelect)
    .from(fraudAlertsTable)
    .leftJoin(staffTable, eq(fraudAlertsTable.staffId, staffTable.id))
    .leftJoin(homesTable, eq(fraudAlertsTable.homeId, homesTable.id))
    .where(eq(fraudAlertsTable.id, updated.id));

  res.json(UpdateFraudAlertResponse.parse(result));
});

export default router;
