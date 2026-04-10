import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, incidentsTable, homesTable, patientsTable, staffTable } from "@workspace/db";
import {
  CreateIncidentBody,
  GetIncidentParams,
  GetIncidentResponse,
  UpdateIncidentParams,
  UpdateIncidentBody,
  UpdateIncidentResponse,
  ListIncidentsResponse,
  ListIncidentsQueryParams,
} from "@workspace/api-zod";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const incidentSelect = {
  id: incidentsTable.id,
  homeId: incidentsTable.homeId,
  homeName: homesTable.name,
  patientId: incidentsTable.patientId,
  patientName: sql<string>`concat(${patientsTable.firstName}, ' ', ${patientsTable.lastName})`,
  reportedBy: incidentsTable.reportedBy,
  reporterName: sql<string>`concat(${staffTable.firstName}, ' ', ${staffTable.lastName})`,
  title: incidentsTable.title,
  description: incidentsTable.description,
  severity: incidentsTable.severity,
  category: incidentsTable.category,
  status: incidentsTable.status,
  occurredAt: incidentsTable.occurredAt,
  resolvedAt: incidentsTable.resolvedAt,
  resolution: incidentsTable.resolution,
  createdAt: incidentsTable.createdAt,
};

router.get("/incidents", async (req, res): Promise<void> => {
  const queryParams = ListIncidentsQueryParams.safeParse(req.query);

  const conditions = [];
  if (queryParams.success && queryParams.data.homeId) {
    conditions.push(eq(incidentsTable.homeId, queryParams.data.homeId));
  }
  if (queryParams.success && queryParams.data.severity) {
    conditions.push(eq(incidentsTable.severity, queryParams.data.severity));
  }

  let query = db
    .select(incidentSelect)
    .from(incidentsTable)
    .leftJoin(homesTable, eq(incidentsTable.homeId, homesTable.id))
    .leftJoin(patientsTable, eq(incidentsTable.patientId, patientsTable.id))
    .leftJoin(staffTable, eq(incidentsTable.reportedBy, staffTable.id))
    .orderBy(incidentsTable.createdAt)
    .$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const incidents = await query;
  res.json(ListIncidentsResponse.parse(incidents));
});

router.post("/incidents", async (req, res): Promise<void> => {
  const parsed = CreateIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [incident] = await db.insert(incidentsTable).values(parsed.data).returning();

  const [result] = await db
    .select(incidentSelect)
    .from(incidentsTable)
    .leftJoin(homesTable, eq(incidentsTable.homeId, homesTable.id))
    .leftJoin(patientsTable, eq(incidentsTable.patientId, patientsTable.id))
    .leftJoin(staffTable, eq(incidentsTable.reportedBy, staffTable.id))
    .where(eq(incidentsTable.id, incident.id));

  res.status(201).json(GetIncidentResponse.parse(result));
});

router.get("/incidents/:id", async (req, res): Promise<void> => {
  const params = GetIncidentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [incident] = await db
    .select(incidentSelect)
    .from(incidentsTable)
    .leftJoin(homesTable, eq(incidentsTable.homeId, homesTable.id))
    .leftJoin(patientsTable, eq(incidentsTable.patientId, patientsTable.id))
    .leftJoin(staffTable, eq(incidentsTable.reportedBy, staffTable.id))
    .where(eq(incidentsTable.id, params.data.id));

  if (!incident) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }

  res.json(GetIncidentResponse.parse(incident));
});

router.patch("/incidents/:id", async (req, res): Promise<void> => {
  const params = UpdateIncidentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(incidentsTable)
    .set(parsed.data)
    .where(eq(incidentsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }

  const [result] = await db
    .select(incidentSelect)
    .from(incidentsTable)
    .leftJoin(homesTable, eq(incidentsTable.homeId, homesTable.id))
    .leftJoin(patientsTable, eq(incidentsTable.patientId, patientsTable.id))
    .leftJoin(staffTable, eq(incidentsTable.reportedBy, staffTable.id))
    .where(eq(incidentsTable.id, updated.id));

  res.json(UpdateIncidentResponse.parse(result));
});

export default router;
