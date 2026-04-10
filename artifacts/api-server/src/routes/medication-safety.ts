import { Router, type IRouter } from "express";
import { eq, and, sql, desc, gte, lte, inArray } from "drizzle-orm";
import {
  db, medicationsTable, patientsTable, staffTable, homesTable,
  medicationCountsTable, medicationErrorsTable,
  medicationInventoryTable, physicianOrdersTable,
  drugInteractionsTable, medicationAdministrationsTable,
  medicationAuditLogTable,
} from "@workspace/db";
import {
  CreateMedicationCountBody,
  CreateMedicationErrorBody,
  CreateMedicationInventoryChangeBody as CreateMedicationInventoryBody,
  CreatePhysicianOrderBody,
  UpdatePhysicianOrderBody,
} from "@workspace/api-zod";

async function resolveCallerStaff(req: any) {
  const userId = req.userId;
  if (!userId) return null;
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, userId)).limit(1);
  return staff ?? null;
}

async function getOrgHomeIds(orgId: number): Promise<number[]> {
  const homes = await db.select({ id: homesTable.id }).from(homesTable).where(eq(homesTable.orgId, orgId));
  return homes.map(h => h.id);
}

function parseScheduleTimes(frequency: string, scheduleTimesJson: string | null): string[] {
  if (scheduleTimesJson) {
    try {
      const parsed = JSON.parse(scheduleTimesJson);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  const lower = frequency.toLowerCase();
  if (lower.includes("twice daily") || lower.includes("bid") || lower.includes("2x")) return ["08:00", "20:00"];
  if (lower.includes("three times") || lower.includes("tid") || lower.includes("3x")) return ["08:00", "14:00", "20:00"];
  if (lower.includes("four times") || lower.includes("qid") || lower.includes("4x")) return ["08:00", "12:00", "16:00", "20:00"];
  if (lower.includes("bedtime") || lower.includes("hs") || lower.includes("at night")) return ["21:00"];
  if (lower.includes("morning")) return ["08:00"];
  return ["08:00"];
}

const router: IRouter = Router();

const countSelect = {
  id: medicationCountsTable.id,
  medicationId: medicationCountsTable.medicationId,
  medicationName: medicationsTable.name,
  staffId: medicationCountsTable.staffId,
  staffName: sql<string>`concat(s1."first_name", ' ', s1."last_name")`,
  witnessStaffId: medicationCountsTable.witnessStaffId,
  witnessName: sql<string | null>`concat(s2."first_name", ' ', s2."last_name")`,
  shiftId: medicationCountsTable.shiftId,
  countBefore: medicationCountsTable.countBefore,
  countAfter: medicationCountsTable.countAfter,
  discrepancy: medicationCountsTable.discrepancy,
  countedAt: medicationCountsTable.countedAt,
  notes: medicationCountsTable.notes,
  createdAt: medicationCountsTable.createdAt,
};

router.get("/medication-counts", async (req, res): Promise<void> => {
  const medicationId = req.query.medicationId ? Number(req.query.medicationId) : undefined;

  const s1 = staffTable;
  let results = await db.execute(sql`
    SELECT mc.id, mc.medication_id as "medicationId", m.name as "medicationName",
      mc.staff_id as "staffId", concat(s1.first_name, ' ', s1.last_name) as "staffName",
      mc.witness_staff_id as "witnessStaffId",
      CASE WHEN mc.witness_staff_id IS NOT NULL THEN concat(s2.first_name, ' ', s2.last_name) ELSE NULL END as "witnessName",
      mc.shift_id as "shiftId", mc.count_before as "countBefore", mc.count_after as "countAfter",
      mc.discrepancy, mc.counted_at as "countedAt", mc.notes, mc.created_at as "createdAt"
    FROM medication_counts mc
    LEFT JOIN medications m ON mc.medication_id = m.id
    LEFT JOIN staff s1 ON mc.staff_id = s1.id
    LEFT JOIN staff s2 ON mc.witness_staff_id = s2.id
    ${medicationId ? sql`WHERE mc.medication_id = ${medicationId}` : sql``}
    ORDER BY mc.counted_at DESC
  `);

  res.json(results.rows);
});

router.post("/medication-counts", async (req, res): Promise<void> => {
  const parsed = CreateMedicationCountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const discrepancy = parsed.data.countAfter - parsed.data.countBefore;

  const [count] = await db.insert(medicationCountsTable).values({
    ...parsed.data,
    discrepancy: Math.abs(discrepancy),
  }).returning();

  if (parsed.data.countAfter !== parsed.data.countBefore) {
    await db.update(medicationsTable)
      .set({ quantityOnHand: parsed.data.countAfter })
      .where(eq(medicationsTable.id, parsed.data.medicationId));
  }

  const results = await db.execute(sql`
    SELECT mc.id, mc.medication_id as "medicationId", m.name as "medicationName",
      mc.staff_id as "staffId", concat(s1.first_name, ' ', s1.last_name) as "staffName",
      mc.witness_staff_id as "witnessStaffId",
      CASE WHEN mc.witness_staff_id IS NOT NULL THEN concat(s2.first_name, ' ', s2.last_name) ELSE NULL END as "witnessName",
      mc.shift_id as "shiftId", mc.count_before as "countBefore", mc.count_after as "countAfter",
      mc.discrepancy, mc.counted_at as "countedAt", mc.notes, mc.created_at as "createdAt"
    FROM medication_counts mc
    LEFT JOIN medications m ON mc.medication_id = m.id
    LEFT JOIN staff s1 ON mc.staff_id = s1.id
    LEFT JOIN staff s2 ON mc.witness_staff_id = s2.id
    WHERE mc.id = ${count.id}
  `);

  res.status(201).json(results.rows[0]);
});

router.get("/medication-errors", async (req, res): Promise<void> => {
  const status = req.query.status as string | undefined;

  const results = await db.execute(sql`
    SELECT me.id, me.medication_id as "medicationId", m.name as "medicationName",
      me.patient_id as "patientId", concat(p.first_name, ' ', p.last_name) as "patientName",
      me.staff_id as "staffId", concat(s.first_name, ' ', s.last_name) as "staffName",
      me.error_type as "errorType", me.severity, me.description, me.action_taken as "actionTaken",
      me.status, me.occurred_at as "occurredAt", me.resolved_at as "resolvedAt", me.created_at as "createdAt"
    FROM medication_errors me
    LEFT JOIN medications m ON me.medication_id = m.id
    LEFT JOIN patients p ON me.patient_id = p.id
    LEFT JOIN staff s ON me.staff_id = s.id
    ${status ? sql`WHERE me.status = ${status}` : sql``}
    ORDER BY me.occurred_at DESC
  `);

  res.json(results.rows);
});

router.post("/medication-errors", async (req, res): Promise<void> => {
  const parsed = CreateMedicationErrorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [error] = await db.insert(medicationErrorsTable).values(parsed.data).returning();

  const results = await db.execute(sql`
    SELECT me.id, me.medication_id as "medicationId", m.name as "medicationName",
      me.patient_id as "patientId", concat(p.first_name, ' ', p.last_name) as "patientName",
      me.staff_id as "staffId", concat(s.first_name, ' ', s.last_name) as "staffName",
      me.error_type as "errorType", me.severity, me.description, me.action_taken as "actionTaken",
      me.status, me.occurred_at as "occurredAt", me.resolved_at as "resolvedAt", me.created_at as "createdAt"
    FROM medication_errors me
    LEFT JOIN medications m ON me.medication_id = m.id
    LEFT JOIN patients p ON me.patient_id = p.id
    LEFT JOIN staff s ON me.staff_id = s.id
    WHERE me.id = ${error.id}
  `);

  res.status(201).json(results.rows[0]);
});

router.get("/medication-inventory", async (req, res): Promise<void> => {
  const medicationId = req.query.medicationId ? Number(req.query.medicationId) : undefined;

  const results = await db.execute(sql`
    SELECT mi.id, mi.medication_id as "medicationId", m.name as "medicationName",
      mi.change_type as "changeType", mi.quantity, mi.previous_quantity as "previousQuantity",
      mi.new_quantity as "newQuantity", mi.performed_by as "performedBy",
      concat(s1.first_name, ' ', s1.last_name) as "performedByName",
      mi.witnessed_by as "witnessedBy",
      CASE WHEN mi.witnessed_by IS NOT NULL THEN concat(s2.first_name, ' ', s2.last_name) ELSE NULL END as "witnessName",
      mi.notes, mi.created_at as "createdAt"
    FROM medication_inventory mi
    LEFT JOIN medications m ON mi.medication_id = m.id
    LEFT JOIN staff s1 ON mi.performed_by = s1.id
    LEFT JOIN staff s2 ON mi.witnessed_by = s2.id
    ${medicationId ? sql`WHERE mi.medication_id = ${medicationId}` : sql``}
    ORDER BY mi.created_at DESC
  `);

  res.json(results.rows);
});

router.post("/medication-inventory", async (req, res): Promise<void> => {
  const parsed = CreateMedicationInventoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [med] = await db.select({ quantityOnHand: medicationsTable.quantityOnHand })
    .from(medicationsTable).where(eq(medicationsTable.id, parsed.data.medicationId));

  const previousQuantity = med?.quantityOnHand ?? 0;
  let newQuantity = previousQuantity;

  if (parsed.data.changeType === "received") {
    newQuantity = previousQuantity + parsed.data.quantity;
  } else if (parsed.data.changeType === "administered" || parsed.data.changeType === "wasted") {
    newQuantity = Math.max(0, previousQuantity - parsed.data.quantity);
  } else if (parsed.data.changeType === "returned") {
    newQuantity = previousQuantity + parsed.data.quantity;
  } else if (parsed.data.changeType === "adjustment") {
    newQuantity = parsed.data.quantity;
  }

  const [record] = await db.insert(medicationInventoryTable).values({
    ...parsed.data,
    previousQuantity,
    newQuantity,
  }).returning();

  await db.update(medicationsTable)
    .set({ quantityOnHand: newQuantity })
    .where(eq(medicationsTable.id, parsed.data.medicationId));

  const results = await db.execute(sql`
    SELECT mi.id, mi.medication_id as "medicationId", m.name as "medicationName",
      mi.change_type as "changeType", mi.quantity, mi.previous_quantity as "previousQuantity",
      mi.new_quantity as "newQuantity", mi.performed_by as "performedBy",
      concat(s1.first_name, ' ', s1.last_name) as "performedByName",
      mi.witnessed_by as "witnessedBy",
      CASE WHEN mi.witnessed_by IS NOT NULL THEN concat(s2.first_name, ' ', s2.last_name) ELSE NULL END as "witnessName",
      mi.notes, mi.created_at as "createdAt"
    FROM medication_inventory mi
    LEFT JOIN medications m ON mi.medication_id = m.id
    LEFT JOIN staff s1 ON mi.performed_by = s1.id
    LEFT JOIN staff s2 ON mi.witnessed_by = s2.id
    WHERE mi.id = ${record.id}
  `);

  res.status(201).json(results.rows[0]);
});

router.get("/medication-inventory/refill-alerts", async (req, res): Promise<void> => {
  const results = await db.execute(sql`
    SELECT m.id as "medicationId", m.name as "medicationName",
      concat(p.first_name, ' ', p.last_name) as "patientName",
      m.dosage, m.quantity_on_hand as "quantityOnHand", m.refill_threshold as "refillThreshold",
      m.pharmacy_name as "pharmacyName", m.pharmacy_phone as "pharmacyPhone", m.rx_number as "rxNumber",
      CASE
        WHEN m.quantity_on_hand > 0 AND m.frequency IS NOT NULL THEN
          CASE
            WHEN m.frequency ILIKE '%twice%' OR m.frequency ILIKE '%bid%' THEN m.quantity_on_hand / 2
            WHEN m.frequency ILIKE '%three%' OR m.frequency ILIKE '%tid%' THEN m.quantity_on_hand / 3
            WHEN m.frequency ILIKE '%four%' OR m.frequency ILIKE '%qid%' THEN m.quantity_on_hand / 4
            ELSE m.quantity_on_hand
          END
        ELSE NULL
      END as "daysRemaining"
    FROM medications m
    LEFT JOIN patients p ON m.patient_id = p.id
    WHERE m.active = true
      AND m.refill_threshold IS NOT NULL
      AND m.quantity_on_hand IS NOT NULL
      AND m.quantity_on_hand <= m.refill_threshold
    ORDER BY m.quantity_on_hand ASC
  `);

  res.json(results.rows);
});

router.get("/physician-orders", async (req, res): Promise<void> => {
  const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;
  const status = req.query.status as string | undefined;

  let conditions = sql`1=1`;
  if (patientId) conditions = sql`${conditions} AND po.patient_id = ${patientId}`;
  if (status) conditions = sql`${conditions} AND po.status = ${status}`;

  const results = await db.execute(sql`
    SELECT po.id, po.patient_id as "patientId",
      concat(p.first_name, ' ', p.last_name) as "patientName",
      po.medication_id as "medicationId", m.name as "medicationName",
      po.order_type as "orderType", po.ordered_by as "orderedBy",
      po.details, po.effective_date as "effectiveDate", po.status,
      po.processed_by as "processedBy", po.processed_at as "processedAt",
      po.created_at as "createdAt"
    FROM physician_orders po
    LEFT JOIN patients p ON po.patient_id = p.id
    LEFT JOIN medications m ON po.medication_id = m.id
    WHERE ${conditions}
    ORDER BY po.created_at DESC
  `);

  res.json(results.rows);
});

router.post("/physician-orders", async (req, res): Promise<void> => {
  const parsed = CreatePhysicianOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [order] = await db.insert(physicianOrdersTable).values(parsed.data).returning();

  const results = await db.execute(sql`
    SELECT po.id, po.patient_id as "patientId",
      concat(p.first_name, ' ', p.last_name) as "patientName",
      po.medication_id as "medicationId", m.name as "medicationName",
      po.order_type as "orderType", po.ordered_by as "orderedBy",
      po.details, po.effective_date as "effectiveDate", po.status,
      po.processed_by as "processedBy", po.processed_at as "processedAt",
      po.created_at as "createdAt"
    FROM physician_orders po
    LEFT JOIN patients p ON po.patient_id = p.id
    LEFT JOIN medications m ON po.medication_id = m.id
    WHERE po.id = ${order.id}
  `);

  res.status(201).json(results.rows[0]);
});

router.patch("/physician-orders/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = UpdatePhysicianOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: any = {};
  if (parsed.data.status) updates.status = parsed.data.status;
  if (parsed.data.processedBy !== undefined) {
    updates.processedBy = parsed.data.processedBy;
    updates.processedAt = new Date();
  }

  await db.update(physicianOrdersTable).set(updates).where(eq(physicianOrdersTable.id, id));

  const results = await db.execute(sql`
    SELECT po.id, po.patient_id as "patientId",
      concat(p.first_name, ' ', p.last_name) as "patientName",
      po.medication_id as "medicationId", m.name as "medicationName",
      po.order_type as "orderType", po.ordered_by as "orderedBy",
      po.details, po.effective_date as "effectiveDate", po.status,
      po.processed_by as "processedBy", po.processed_at as "processedAt",
      po.created_at as "createdAt"
    FROM physician_orders po
    LEFT JOIN patients p ON po.patient_id = p.id
    LEFT JOIN medications m ON po.medication_id = m.id
    WHERE po.id = ${id}
  `);

  res.json(results.rows[0]);
});

router.get("/drug-interactions/check", async (req, res): Promise<void> => {
  const patientId = Number(req.query.patientId);
  if (!patientId) {
    res.status(400).json({ error: "patientId is required" });
    return;
  }

  const patientMeds = await db.select({ name: medicationsTable.name })
    .from(medicationsTable)
    .where(and(eq(medicationsTable.patientId, patientId), eq(medicationsTable.active, true)));

  const medNames = patientMeds.map(m => m.name.toLowerCase());

  if (medNames.length < 2) {
    res.json([]);
    return;
  }

  const interactions = await db.select().from(drugInteractionsTable);

  const matches = interactions.filter(i =>
    medNames.some(n => n.includes(i.drugA.toLowerCase()) || i.drugA.toLowerCase().includes(n)) &&
    medNames.some(n => n.includes(i.drugB.toLowerCase()) || i.drugB.toLowerCase().includes(n))
  );

  res.json(matches);
});

router.get("/dashboard/medication-safety", async (req, res): Promise<void> => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const todayStatsResult = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'given') as "todayAdministrations",
      COUNT(*) FILTER (WHERE status = 'missed') as "todayMissed",
      COUNT(*) as total_count
    FROM medication_administrations
    WHERE administered_at >= ${todayStart} AND administered_at <= ${todayEnd}
  `);
  const todayStats = todayStatsResult.rows[0] as any;

  const total = Number(todayStats?.total_count) || 0;
  const given = Number(todayStats?.todayAdministrations) || 0;
  const complianceRate = total > 0 ? Math.round((given / total) * 100) : 100;

  const discrepanciesResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM medication_counts WHERE discrepancy > 0
    AND counted_at >= ${todayStart}
  `);
  const discrepancies = discrepanciesResult.rows[0] as any;

  const openErrorsResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM medication_errors WHERE status = 'open'
  `);
  const openErrors = openErrorsResult.rows[0] as any;

  const refillsRes = await db.execute(sql`
    SELECT COUNT(*) as count FROM medications
    WHERE active = true AND refill_threshold IS NOT NULL
    AND quantity_on_hand IS NOT NULL AND quantity_on_hand <= refill_threshold
  `);
  const refillsResult = refillsRes.rows[0] as any;

  const pendingOrdersRes = await db.execute(sql`
    SELECT COUNT(*) as count FROM physician_orders WHERE status = 'pending'
  `);
  const pendingOrdersResult = pendingOrdersRes.rows[0] as any;

  const activeMeds = await db.select().from(medicationsTable).where(
    and(eq(medicationsTable.active, true), eq(medicationsTable.medicationType, "scheduled"))
  );

  let overdueMedications = 0;
  for (const med of activeMeds) {
    const scheduleTimesJson = med.scheduleTimesJson;
    const frequency = med.frequency;
    let times: string[] = ["08:00"];
    if (scheduleTimesJson) {
      try { times = JSON.parse(scheduleTimesJson); } catch {}
    }
    for (const t of times) {
      const [h, m] = t.split(":").map(Number);
      const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
      const windowEnd = new Date(scheduled.getTime() + 60 * 60 * 1000);
      if (now > windowEnd) {
        const admins = await db.select().from(medicationAdministrationsTable).where(
          and(
            eq(medicationAdministrationsTable.medicationId, med.id),
            gte(medicationAdministrationsTable.administeredAt, new Date(scheduled.getTime() - 30 * 60 * 1000)),
            lte(medicationAdministrationsTable.administeredAt, windowEnd)
          )
        );
        if (admins.length === 0) overdueMedications++;
      }
    }
  }

  res.json({
    overallComplianceRate: complianceRate,
    overdueMedications,
    controlledSubstanceDiscrepancies: Number(discrepancies?.count) || 0,
    openMedicationErrors: Number(openErrors?.count) || 0,
    refillsNeeded: Number(refillsResult?.count) || 0,
    pendingOrders: Number(pendingOrdersResult?.count) || 0,
    todayAdministrations: Number(todayStats?.todayAdministrations) || 0,
    todayMissed: Number(todayStats?.todayMissed) || 0,
  });
});

router.patch("/medication-errors/:id/resolve", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid error ID" }); return; }

  const staff = await resolveCallerStaff(req);
  if (!staff?.orgId) { res.status(403).json({ error: "No organization found" }); return; }

  const { actionTaken, notes } = req.body;
  if (!actionTaken) { res.status(400).json({ error: "actionTaken is required" }); return; }

  const homeIds = await getOrgHomeIds(staff.orgId!);
  const errorCheck = await db.execute(sql`
    SELECT me.id, me.status FROM medication_errors me
    INNER JOIN patients p ON me.patient_id = p.id
    WHERE me.id = ${id}
  `);
  const existing = errorCheck.rows[0] as any;
  if (!existing) { res.status(404).json({ error: "Medication error not found" }); return; }

  const ownerCheck = await db.execute(sql`
    SELECT me.id FROM medication_errors me
    INNER JOIN patients p ON me.patient_id = p.id
    WHERE me.id = ${id} AND p.home_id = ANY(ARRAY[${sql.join(homeIds.map(h => sql`${h}`), sql`, `)}]::int[])
  `);
  if (ownerCheck.rows.length === 0) { res.status(403).json({ error: "Error belongs to different organization" }); return; }
  if (existing.status === "resolved") { res.status(400).json({ error: "Error already resolved" }); return; }

  await db.update(medicationErrorsTable).set({
    status: "resolved",
    actionTaken: actionTaken + (notes ? ` | Notes: ${notes}` : ""),
    resolvedAt: new Date(),
    resolvedBy: staff.id,
  }).where(eq(medicationErrorsTable.id, id));

  await db.insert(medicationAuditLogTable).values({
    entityType: "medication_error",
    entityId: id,
    action: "resolved",
    performedBy: staff.id,
    performedByName: `${staff.firstName} ${staff.lastName}`,
    details: `Error #${id} resolved. Action: ${actionTaken}`,
  });

  const results = await db.execute(sql`
    SELECT me.id, me.medication_id as "medicationId", m.name as "medicationName",
      me.patient_id as "patientId", concat(p.first_name, ' ', p.last_name) as "patientName",
      me.staff_id as "staffId", concat(s.first_name, ' ', s.last_name) as "staffName",
      me.error_type as "errorType", me.severity, me.description, me.action_taken as "actionTaken",
      me.status, me.occurred_at as "occurredAt", me.resolved_at as "resolvedAt", me.created_at as "createdAt"
    FROM medication_errors me
    LEFT JOIN medications m ON me.medication_id = m.id
    LEFT JOIN patients p ON me.patient_id = p.id
    LEFT JOIN staff s ON me.staff_id = s.id
    WHERE me.id = ${id}
  `);

  res.json(results.rows[0]);
});

router.post("/medication-errors/auto-detect", async (req, res): Promise<void> => {
  const staff = await resolveCallerStaff(req);
  if (!staff?.orgId) { res.status(403).json({ error: "No organization found" }); return; }

  const homeIds = await getOrgHomeIds(staff.orgId);
  if (homeIds.length === 0) { res.json({ detected: [], created: 0, scannedDate: new Date().toISOString().split("T")[0] }); return; }

  const dateStr = req.body?.date as string | undefined;
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const day = targetDate.getDate();
  const dayStart = new Date(year, month, day, 0, 0, 0);
  const dayEnd = new Date(year, month, day, 23, 59, 59);
  const now = new Date();

  const activeMeds = await db.select({
    id: medicationsTable.id,
    patientId: medicationsTable.patientId,
    name: medicationsTable.name,
    dosage: medicationsTable.dosage,
    frequency: medicationsTable.frequency,
    scheduleTimesJson: medicationsTable.scheduleTimesJson,
    medicationType: medicationsTable.medicationType,
    homeId: patientsTable.homeId,
    patientFirstName: patientsTable.firstName,
    patientLastName: patientsTable.lastName,
  })
    .from(medicationsTable)
    .innerJoin(patientsTable, eq(medicationsTable.patientId, patientsTable.id))
    .where(and(
      eq(medicationsTable.active, true),
      eq(medicationsTable.medicationType, "scheduled"),
      inArray(patientsTable.homeId, homeIds)
    ));

  const admins = await db.select()
    .from(medicationAdministrationsTable)
    .where(and(
      gte(medicationAdministrationsTable.administeredAt, dayStart),
      lte(medicationAdministrationsTable.administeredAt, dayEnd)
    ));

  const detected: Array<{
    errorType: string; severity: string; medicationName: string;
    patientName: string; staffName: string | null; description: string;
    occurredAt: string; autoCreated: boolean;
    medicationId: number; patientId: number; staffId: number | null;
  }> = [];

  for (const med of activeMeds) {
    const scheduleTimes = parseScheduleTimes(med.frequency, med.scheduleTimesJson);
    const patientName = `${med.patientFirstName} ${med.patientLastName}`;
    const medAdmins = admins.filter(a => a.medicationId === med.id);

    for (const timeStr of scheduleTimes) {
      const [h, m] = timeStr.split(":").map(Number);
      const scheduledAt = new Date(year, month, day, h, m, 0);
      const windowStart = new Date(scheduledAt.getTime() - 30 * 60 * 1000);
      const windowEnd = new Date(scheduledAt.getTime() + 60 * 60 * 1000);
      const lateWindowEnd = new Date(scheduledAt.getTime() + 4 * 60 * 60 * 1000);

      if (scheduledAt > now) continue;

      const onTimeAdmins = medAdmins.filter(a => {
        const aTime = new Date(a.administeredAt).getTime();
        return aTime >= windowStart.getTime() && aTime <= windowEnd.getTime();
      });

      const lateAdmins = medAdmins.filter(a => {
        const aTime = new Date(a.administeredAt).getTime();
        return aTime > windowEnd.getTime() && aTime <= lateWindowEnd.getTime() && a.status === "given";
      });

      const allRelevantAdmins = [...onTimeAdmins, ...lateAdmins];

      if (allRelevantAdmins.length === 0 && now > windowEnd) {
        detected.push({
          errorType: "omission",
          severity: "high",
          medicationName: `${med.name} ${med.dosage}`,
          patientName,
          staffName: null,
          description: `Missed dose: ${med.name} ${med.dosage} was scheduled at ${timeStr} but not administered within the allowed window (${med.frequency}).`,
          occurredAt: scheduledAt.toISOString(),
          autoCreated: true,
          medicationId: med.id,
          patientId: med.patientId,
          staffId: null,
        });
      }

      if (onTimeAdmins.length > 1) {
        const dupeAdmin = onTimeAdmins[1];
        const dupeStaff = await db.select({ firstName: staffTable.firstName, lastName: staffTable.lastName })
          .from(staffTable).where(eq(staffTable.id, dupeAdmin.staffId)).limit(1);
        const dupeStaffName = dupeStaff[0] ? `${dupeStaff[0].firstName} ${dupeStaff[0].lastName}` : "Unknown";

        detected.push({
          errorType: "wrong_dose",
          severity: "critical",
          medicationName: `${med.name} ${med.dosage}`,
          patientName,
          staffName: dupeStaffName,
          description: `Double administration detected: ${med.name} ${med.dosage} was given ${onTimeAdmins.length} times in the ${timeStr} window. This may indicate a duplicate dose.`,
          occurredAt: new Date(dupeAdmin.administeredAt).toISOString(),
          autoCreated: true,
          medicationId: med.id,
          patientId: med.patientId,
          staffId: dupeAdmin.staffId,
        });
      }

      for (const admin of lateAdmins) {
        const adminTime = new Date(admin.administeredAt).getTime();
        const lateMinutes = Math.floor((adminTime - windowEnd.getTime()) / 60000);
        if (lateMinutes > 0) {
          const lateStaff = await db.select({ firstName: staffTable.firstName, lastName: staffTable.lastName })
            .from(staffTable).where(eq(staffTable.id, admin.staffId)).limit(1);
          const lateStaffName = lateStaff[0] ? `${lateStaff[0].firstName} ${lateStaff[0].lastName}` : "Unknown";

          detected.push({
            errorType: "wrong_time",
            severity: lateMinutes > 120 ? "high" : "medium",
            medicationName: `${med.name} ${med.dosage}`,
            patientName,
            staffName: lateStaffName,
            description: `Late administration: ${med.name} ${med.dosage} scheduled at ${timeStr} was given ${lateMinutes} minutes late by ${lateStaffName}.`,
            occurredAt: new Date(admin.administeredAt).toISOString(),
            autoCreated: true,
            medicationId: med.id,
            patientId: med.patientId,
            staffId: admin.staffId,
          });
        }
      }
    }

    const allDayAdmins = medAdmins.filter(a => a.status === "given");
    const expectedDosesPerDay = scheduleTimes.length;
    if (allDayAdmins.length > expectedDosesPerDay && now.getTime() > dayEnd.getTime()) {
      detected.push({
        errorType: "wrong_dose",
        severity: "high",
        medicationName: `${med.name} ${med.dosage}`,
        patientName,
        staffName: null,
        description: `Excess administrations: ${med.name} ${med.dosage} was given ${allDayAdmins.length} times but only ${expectedDosesPerDay} doses were scheduled for the day.`,
        occurredAt: dayEnd.toISOString(),
        autoCreated: true,
        medicationId: med.id,
        patientId: med.patientId,
        staffId: null,
      });
    }
  }

  let createdCount = 0;
  for (const err of detected) {
    const existingCheck = await db.execute(sql`
      SELECT id FROM medication_errors
      WHERE medication_id = ${err.medicationId}
        AND patient_id = ${err.patientId}
        AND error_type = ${err.errorType}
        AND occurred_at >= ${dayStart}
        AND occurred_at <= ${dayEnd}
        AND description LIKE ${"%" + err.description.substring(0, 30) + "%"}
      LIMIT 1
    `);

    if (existingCheck.rows.length === 0 && err.staffId) {
      await db.insert(medicationErrorsTable).values({
        medicationId: err.medicationId,
        patientId: err.patientId,
        staffId: err.staffId,
        errorType: err.errorType,
        severity: err.severity,
        description: `[Auto-detected] ${err.description}`,
        status: "open",
        occurredAt: new Date(err.occurredAt),
      });
      createdCount++;
    } else if (existingCheck.rows.length === 0 && !err.staffId) {
      const anyStaff = await db.select({ id: staffTable.id }).from(staffTable)
        .where(eq(staffTable.orgId, staff.orgId!)).limit(1);
      if (anyStaff.length > 0) {
        await db.insert(medicationErrorsTable).values({
          medicationId: err.medicationId,
          patientId: err.patientId,
          staffId: anyStaff[0].id,
          errorType: err.errorType,
          severity: err.severity,
          description: `[Auto-detected] ${err.description}`,
          status: "open",
          occurredAt: new Date(err.occurredAt),
        });
        createdCount++;
      }
    }
  }

  res.json({
    detected: detected.map(d => ({
      errorType: d.errorType,
      severity: d.severity,
      medicationName: d.medicationName,
      patientName: d.patientName,
      staffName: d.staffName,
      description: d.description,
      occurredAt: d.occurredAt,
      autoCreated: true,
    })),
    created: createdCount,
    scannedDate: targetDate.toISOString().split("T")[0],
  });
});

export default router;
