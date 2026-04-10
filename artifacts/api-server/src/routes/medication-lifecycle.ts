import { Router, type IRouter } from "express";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import {
  db, medicationsTable, patientsTable, staffTable, homesTable,
  physicianOrdersTable, medicationChangesTable, refillRequestsTable,
  medicationInventoryTable, medicationAuditLogTable,
} from "@workspace/db";

const router: IRouter = Router();

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

async function getOrgPatientIds(homeIds: number[]): Promise<number[]> {
  if (homeIds.length === 0) return [];
  const patients = await db.select({ id: patientsTable.id }).from(patientsTable).where(inArray(patientsTable.homeId, homeIds));
  return patients.map(p => p.id);
}

function sqlInList(ids: number[]) {
  if (ids.length === 0) return sql`(0)`;
  return sql.join(ids.map(id => sql`${id}`), sql`, `);
}

const VALID_REFILL_STATUSES = ["pending", "contacted", "received", "cancelled"];

router.post("/physician-orders/:id/process", async (req, res): Promise<void> => {
  const orderId = Number(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const staff = await resolveCallerStaff(req);
  if (!staff?.orgId) { res.status(403).json({ error: "No organization found" }); return; }
  const staffId = staff.id;
  const staffName = `${staff.firstName} ${staff.lastName}`;

  const homeIds = await getOrgHomeIds(staff.orgId);
  const patientIds = await getOrgPatientIds(homeIds);

  const [order] = await db.select().from(physicianOrdersTable).where(eq(physicianOrdersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (!patientIds.includes(order.patientId)) { res.status(403).json({ error: "Order belongs to different organization" }); return; }
  if (order.status !== "pending") { res.status(400).json({ error: "Order already processed" }); return; }

  const orderType = order.orderType;
  let oldMed: any = null;
  let newMed: any = null;

  if (order.medicationId) {
    const [m] = await db.select().from(medicationsTable).where(eq(medicationsTable.id, order.medicationId));
    oldMed = m;
  }

  if ((orderType === "discontinue" || orderType === "change") && !oldMed) {
    res.status(400).json({ error: `Cannot process ${orderType} order: medication not found` });
    return;
  }

  await db.transaction(async (tx) => {
    if (orderType === "discontinue" && oldMed) {
      await tx.update(medicationsTable).set({
        active: false,
        endDate: new Date(),
      }).where(eq(medicationsTable.id, oldMed.id));

      await tx.insert(medicationChangesTable).values({
        patientId: order.patientId,
        oldMedicationId: oldMed.id,
        newMedicationId: null,
        changeType: "discontinue",
        reason: order.details || "Physician order",
        orderedBy: order.orderedBy,
        physicianOrderId: orderId,
        oldDetails: JSON.stringify({ name: oldMed.name, dosage: oldMed.dosage, frequency: oldMed.frequency }),
        newDetails: null,
        effectiveDate: order.effectiveDate,
        processedBy: staffId,
        processedAt: new Date(),
      });

      await tx.insert(medicationAuditLogTable).values({
        entityType: "medication",
        entityId: oldMed.id,
        action: "discontinued",
        performedBy: staffId,
        performedByName: staffName,
        details: `Discontinued per physician order #${orderId} by ${order.orderedBy}. Reason: ${order.details || "N/A"}`,
        previousValue: JSON.stringify({ active: true, name: oldMed.name, dosage: oldMed.dosage }),
        newValue: JSON.stringify({ active: false, endDate: new Date().toISOString() }),
      });

    } else if (orderType === "change" && oldMed) {
      let parsedDetails: any = {};
      try { parsedDetails = JSON.parse(order.details || "{}"); } catch {}

      const newDosage = parsedDetails.newDosage || oldMed.dosage;
      const newFrequency = parsedDetails.newFrequency || oldMed.frequency;
      const newName = parsedDetails.newName || oldMed.name;
      const isSameMed = newName === oldMed.name;

      if (isSameMed) {
        await tx.update(medicationsTable).set({
          dosage: newDosage,
          frequency: newFrequency,
          ...(parsedDetails.newRoute ? { route: parsedDetails.newRoute } : {}),
          ...(parsedDetails.newInstructions ? { instructions: parsedDetails.newInstructions } : {}),
        }).where(eq(medicationsTable.id, oldMed.id));

        await tx.insert(medicationChangesTable).values({
          patientId: order.patientId,
          oldMedicationId: oldMed.id,
          newMedicationId: oldMed.id,
          changeType: "dose_change",
          reason: parsedDetails.reason || order.details || "Physician order",
          orderedBy: order.orderedBy,
          physicianOrderId: orderId,
          oldDetails: JSON.stringify({ name: oldMed.name, dosage: oldMed.dosage, frequency: oldMed.frequency }),
          newDetails: JSON.stringify({ name: newName, dosage: newDosage, frequency: newFrequency }),
          effectiveDate: order.effectiveDate,
          processedBy: staffId,
          processedAt: new Date(),
        });

        await tx.insert(medicationAuditLogTable).values({
          entityType: "medication",
          entityId: oldMed.id,
          action: "dose_changed",
          performedBy: staffId,
          performedByName: staffName,
          details: `Dose changed per physician order #${orderId} by ${order.orderedBy}: ${oldMed.dosage} → ${newDosage}`,
          previousValue: JSON.stringify({ dosage: oldMed.dosage, frequency: oldMed.frequency }),
          newValue: JSON.stringify({ dosage: newDosage, frequency: newFrequency }),
        });

      } else {
        await tx.update(medicationsTable).set({
          active: false,
          endDate: new Date(),
        }).where(eq(medicationsTable.id, oldMed.id));

        const [createdMed] = await tx.insert(medicationsTable).values({
          patientId: order.patientId,
          name: newName,
          dosage: newDosage,
          frequency: newFrequency,
          route: parsedDetails.newRoute || oldMed.route,
          prescribedBy: order.orderedBy,
          startDate: order.effectiveDate,
          active: true,
          instructions: parsedDetails.newInstructions || oldMed.instructions,
          controlledSubstance: parsedDetails.controlledSubstance ?? oldMed.controlledSubstance,
          deaSchedule: parsedDetails.deaSchedule || oldMed.deaSchedule,
          medicationType: parsedDetails.medicationType || oldMed.medicationType,
          pharmacyName: oldMed.pharmacyName,
          pharmacyPhone: oldMed.pharmacyPhone,
          quantityOnHand: parsedDetails.newQuantity || null,
          refillThreshold: oldMed.refillThreshold,
          quantityPerRefill: oldMed.quantityPerRefill,
        }).returning();

        newMed = createdMed;

        await tx.insert(medicationChangesTable).values({
          patientId: order.patientId,
          oldMedicationId: oldMed.id,
          newMedicationId: createdMed.id,
          changeType: "switch",
          reason: parsedDetails.reason || order.details || "Physician order",
          orderedBy: order.orderedBy,
          physicianOrderId: orderId,
          oldDetails: JSON.stringify({ name: oldMed.name, dosage: oldMed.dosage, frequency: oldMed.frequency }),
          newDetails: JSON.stringify({ name: newName, dosage: newDosage, frequency: newFrequency }),
          effectiveDate: order.effectiveDate,
          processedBy: staffId,
          processedAt: new Date(),
        });

        await tx.insert(medicationAuditLogTable).values({
          entityType: "medication",
          entityId: oldMed.id,
          action: "switched",
          performedBy: staffId,
          performedByName: staffName,
          details: `Switched from ${oldMed.name} ${oldMed.dosage} to ${newName} ${newDosage} per physician order #${orderId} by ${order.orderedBy}`,
          previousValue: JSON.stringify({ name: oldMed.name, dosage: oldMed.dosage, active: true }),
          newValue: JSON.stringify({ active: false, replacedBy: createdMed.id }),
        });

        await tx.insert(medicationAuditLogTable).values({
          entityType: "medication",
          entityId: createdMed.id,
          action: "started",
          performedBy: staffId,
          performedByName: staffName,
          details: `New medication started as replacement for ${oldMed.name} ${oldMed.dosage}. Order #${orderId} by ${order.orderedBy}`,
          previousValue: null,
          newValue: JSON.stringify({ name: newName, dosage: newDosage, frequency: newFrequency }),
        });
      }

    } else if (orderType === "new") {
      let parsedDetails: any = {};
      try { parsedDetails = JSON.parse(order.details || "{}"); } catch {
        parsedDetails = { name: order.details };
      }

      const [createdMed] = await tx.insert(medicationsTable).values({
        patientId: order.patientId,
        name: parsedDetails.name || order.details || "Unknown",
        dosage: parsedDetails.dosage || "",
        frequency: parsedDetails.frequency || "",
        route: parsedDetails.route || "oral",
        prescribedBy: order.orderedBy,
        startDate: order.effectiveDate,
        active: true,
        instructions: parsedDetails.instructions || null,
        controlledSubstance: parsedDetails.controlledSubstance || false,
        medicationType: parsedDetails.medicationType || "scheduled",
        pharmacyName: parsedDetails.pharmacyName || null,
        pharmacyPhone: parsedDetails.pharmacyPhone || null,
        quantityOnHand: parsedDetails.quantityOnHand || null,
        refillThreshold: parsedDetails.refillThreshold || null,
      }).returning();

      newMed = createdMed;

      await tx.insert(medicationChangesTable).values({
        patientId: order.patientId,
        oldMedicationId: null,
        newMedicationId: createdMed.id,
        changeType: "new",
        reason: parsedDetails.reason || "New prescription",
        orderedBy: order.orderedBy,
        physicianOrderId: orderId,
        oldDetails: null,
        newDetails: JSON.stringify({ name: createdMed.name, dosage: createdMed.dosage, frequency: createdMed.frequency }),
        effectiveDate: order.effectiveDate,
        processedBy: staffId,
        processedAt: new Date(),
      });

      await tx.insert(medicationAuditLogTable).values({
        entityType: "medication",
        entityId: createdMed.id,
        action: "started",
        performedBy: staffId,
        performedByName: staffName,
        details: `New medication started per physician order #${orderId} by ${order.orderedBy}`,
        previousValue: null,
        newValue: JSON.stringify({ name: createdMed.name, dosage: createdMed.dosage, frequency: createdMed.frequency }),
      });
    }

    await tx.update(physicianOrdersTable).set({
      status: "processed",
      processedBy: staffId,
      processedAt: new Date(),
    }).where(eq(physicianOrdersTable.id, orderId));
  });

  res.json({
    success: true,
    orderType,
    oldMedication: oldMed ? { id: oldMed.id, name: oldMed.name, dosage: oldMed.dosage } : null,
    newMedication: newMed ? { id: newMed.id, name: newMed.name, dosage: newMed.dosage } : null,
    message: `Order processed: ${orderType}`,
  });
});

router.get("/medication-changes/:patientId", async (req, res): Promise<void> => {
  const patientId = Number(req.params.patientId);
  if (isNaN(patientId)) { res.status(400).json({ error: "Invalid patient ID" }); return; }

  const staff = await resolveCallerStaff(req);
  if (!staff?.orgId) { res.status(403).json({ error: "No organization found" }); return; }
  const homeIds = await getOrgHomeIds(staff.orgId);
  const patientIds = await getOrgPatientIds(homeIds);
  if (!patientIds.includes(patientId)) { res.status(403).json({ error: "Patient belongs to different organization" }); return; }

  const results = await db.execute(sql`
    SELECT mc.id, mc.patient_id as "patientId",
      mc.old_medication_id as "oldMedicationId",
      mc.new_medication_id as "newMedicationId",
      mc.change_type as "changeType",
      mc.reason,
      mc.ordered_by as "orderedBy",
      mc.physician_order_id as "physicianOrderId",
      mc.old_details as "oldDetails",
      mc.new_details as "newDetails",
      mc.effective_date as "effectiveDate",
      mc.processed_by as "processedBy",
      concat(s.first_name, ' ', s.last_name) as "processedByName",
      mc.processed_at as "processedAt",
      mc.notes,
      mc.created_at as "createdAt",
      m1.name as "oldMedicationName",
      m2.name as "newMedicationName"
    FROM medication_changes mc
    LEFT JOIN medications m1 ON mc.old_medication_id = m1.id
    LEFT JOIN medications m2 ON mc.new_medication_id = m2.id
    LEFT JOIN staff s ON mc.processed_by = s.id
    WHERE mc.patient_id = ${patientId}
    ORDER BY mc.effective_date DESC
  `);

  res.json(results.rows);
});

router.get("/medication-timeline/:patientId", async (req, res): Promise<void> => {
  const patientId = Number(req.params.patientId);
  if (isNaN(patientId)) { res.status(400).json({ error: "Invalid patient ID" }); return; }

  const staff = await resolveCallerStaff(req);
  if (!staff?.orgId) { res.status(403).json({ error: "No organization found" }); return; }
  const homeIds = await getOrgHomeIds(staff.orgId);
  const patientIds = await getOrgPatientIds(homeIds);
  if (!patientIds.includes(patientId)) { res.status(403).json({ error: "Patient belongs to different organization" }); return; }

  const medsResult = await db.execute(sql`
    SELECT id, name, dosage, frequency, route, prescribed_by as "prescribedBy",
      start_date as "startDate", end_date as "endDate", active,
      medication_type as "medicationType", controlled_substance as "controlledSubstance",
      created_at as "createdAt"
    FROM medications WHERE patient_id = ${patientId}
    ORDER BY start_date DESC
  `);

  const changesResult = await db.execute(sql`
    SELECT mc.id, mc.change_type as "changeType", mc.reason,
      mc.ordered_by as "orderedBy", mc.old_details as "oldDetails",
      mc.new_details as "newDetails", mc.effective_date as "effectiveDate",
      m1.name as "oldMedName", m2.name as "newMedName",
      concat(s.first_name, ' ', s.last_name) as "processedByName"
    FROM medication_changes mc
    LEFT JOIN medications m1 ON mc.old_medication_id = m1.id
    LEFT JOIN medications m2 ON mc.new_medication_id = m2.id
    LEFT JOIN staff s ON mc.processed_by = s.id
    WHERE mc.patient_id = ${patientId}
    ORDER BY mc.effective_date DESC
  `);

  const auditResult = await db.execute(sql`
    SELECT mal.id, mal.entity_type as "entityType", mal.entity_id as "entityId",
      mal.action, mal.performed_by_name as "performedByName",
      mal.details, mal.previous_value as "previousValue",
      mal.new_value as "newValue", mal.created_at as "createdAt"
    FROM medication_audit_log mal
    INNER JOIN medications m ON mal.entity_id = m.id AND mal.entity_type = 'medication'
    WHERE m.patient_id = ${patientId}
    ORDER BY mal.created_at DESC
    LIMIT 50
  `);

  res.json({
    medications: medsResult.rows,
    changes: changesResult.rows,
    auditTrail: auditResult.rows,
  });
});

router.post("/refill-requests", async (req, res): Promise<void> => {
  const staff = await resolveCallerStaff(req);
  if (!staff?.orgId) { res.status(403).json({ error: "No organization found" }); return; }
  const staffId = staff.id;
  const staffName = `${staff.firstName} ${staff.lastName}`;

  const { medicationId, notes, quantityRequested } = req.body;
  if (!medicationId || isNaN(Number(medicationId))) { res.status(400).json({ error: "medicationId is required" }); return; }
  if (quantityRequested !== undefined && (typeof quantityRequested !== "number" || quantityRequested < 1)) {
    res.status(400).json({ error: "quantityRequested must be a positive number" }); return;
  }

  const homeIds = await getOrgHomeIds(staff.orgId);
  const patientIds = await getOrgPatientIds(homeIds);

  const [med] = await db.select().from(medicationsTable).where(eq(medicationsTable.id, Number(medicationId)));
  if (!med) { res.status(404).json({ error: "Medication not found" }); return; }
  if (!patientIds.includes(med.patientId)) { res.status(403).json({ error: "Medication belongs to different organization" }); return; }

  const [request] = await db.insert(refillRequestsTable).values({
    medicationId: Number(medicationId),
    patientId: med.patientId,
    requestedBy: staffId,
    pharmacyName: med.pharmacyName,
    pharmacyPhone: med.pharmacyPhone,
    rxNumber: med.rxNumber,
    quantityRequested: quantityRequested || med.quantityPerRefill,
    status: "pending",
    notes,
  }).returning();

  await db.insert(medicationAuditLogTable).values({
    entityType: "refill_request",
    entityId: request.id,
    action: "created",
    performedBy: staffId,
    performedByName: staffName,
    details: `Refill request created for ${med.name} (Rx# ${med.rxNumber || "N/A"})`,
  });

  const result = await db.execute(sql`
    SELECT rr.id, rr.medication_id as "medicationId", m.name as "medicationName",
      concat(p.first_name, ' ', p.last_name) as "patientName",
      m.dosage, rr.pharmacy_name as "pharmacyName", rr.pharmacy_phone as "pharmacyPhone",
      rr.rx_number as "rxNumber", rr.quantity_requested as "quantityRequested",
      rr.status, rr.notes, rr.created_at as "createdAt",
      concat(s.first_name, ' ', s.last_name) as "requestedByName"
    FROM refill_requests rr
    LEFT JOIN medications m ON rr.medication_id = m.id
    LEFT JOIN patients p ON rr.patient_id = p.id
    LEFT JOIN staff s ON rr.requested_by = s.id
    WHERE rr.id = ${request.id}
  `);

  res.status(201).json(result.rows[0]);
});

router.get("/refill-requests", async (req, res): Promise<void> => {
  const staff = await resolveCallerStaff(req);
  if (!staff?.orgId) { res.status(403).json({ error: "No organization found" }); return; }
  const homeIds = await getOrgHomeIds(staff.orgId);

  const status = req.query.status as string | undefined;
  if (status && !VALID_REFILL_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_REFILL_STATUSES.join(", ")}` }); return;
  }

  let statusFilter = sql`1=1`;
  if (status) statusFilter = sql`rr.status = ${status}`;

  const results = await db.execute(sql`
    SELECT rr.id, rr.medication_id as "medicationId", m.name as "medicationName",
      concat(p.first_name, ' ', p.last_name) as "patientName",
      m.dosage, rr.pharmacy_name as "pharmacyName", rr.pharmacy_phone as "pharmacyPhone",
      rr.rx_number as "rxNumber", rr.quantity_requested as "quantityRequested",
      rr.status, rr.pharmacy_contacted_at as "pharmacyContactedAt",
      rr.expected_fill_date as "expectedFillDate",
      rr.received_at as "receivedAt", rr.notes, rr.created_at as "createdAt",
      concat(s.first_name, ' ', s.last_name) as "requestedByName",
      m.quantity_on_hand as "currentQuantity", m.refill_threshold as "refillThreshold"
    FROM refill_requests rr
    LEFT JOIN medications m ON rr.medication_id = m.id
    LEFT JOIN patients p ON rr.patient_id = p.id
    LEFT JOIN staff s ON rr.requested_by = s.id
    WHERE p.home_id IN (${sqlInList(homeIds)}) AND ${statusFilter}
    ORDER BY rr.created_at DESC
  `);

  res.json(results.rows);
});

router.patch("/refill-requests/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid request ID" }); return; }

  const staff = await resolveCallerStaff(req);
  if (!staff?.orgId) { res.status(403).json({ error: "No organization found" }); return; }
  const staffId = staff.id;
  const staffName = `${staff.firstName} ${staff.lastName}`;

  const homeIds = await getOrgHomeIds(staff.orgId);
  const patientIds = await getOrgPatientIds(homeIds);

  const [existing] = await db.select().from(refillRequestsTable).where(eq(refillRequestsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Refill request not found" }); return; }
  if (!patientIds.includes(existing.patientId)) { res.status(403).json({ error: "Refill request belongs to different organization" }); return; }

  const { status, expectedFillDate, notes, quantityReceived } = req.body;

  if (status && !VALID_REFILL_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_REFILL_STATUSES.join(", ")}` }); return;
  }
  if (quantityReceived !== undefined && (typeof quantityReceived !== "number" || quantityReceived < 1)) {
    res.status(400).json({ error: "quantityReceived must be a positive number" }); return;
  }

  const updates: any = {};
  if (status) updates.status = status;
  if (notes) updates.notes = notes;

  if (status === "contacted") {
    updates.pharmacyContactedAt = new Date();
  }
  if (expectedFillDate) {
    updates.expectedFillDate = new Date(expectedFillDate);
  }

  if (status === "received") {
    updates.receivedBy = staffId;
    updates.receivedAt = new Date();

    if (quantityReceived && quantityReceived > 0) {
      await db.transaction(async (tx) => {
        const [med] = await tx.select().from(medicationsTable).where(eq(medicationsTable.id, existing.medicationId));
        if (med) {
          const prevQty = med.quantityOnHand || 0;
          const newQty = prevQty + quantityReceived;
          await tx.update(medicationsTable).set({ quantityOnHand: newQty }).where(eq(medicationsTable.id, med.id));

          await tx.insert(medicationInventoryTable).values({
            medicationId: med.id,
            changeType: "refill_received",
            quantity: quantityReceived,
            previousQuantity: prevQty,
            newQuantity: newQty,
            performedBy: staffId,
            notes: `Refill received (Request #${id})`,
          });

          await tx.insert(medicationAuditLogTable).values({
            entityType: "medication",
            entityId: med.id,
            action: "refill_received",
            performedBy: staffId,
            performedByName: staffName,
            details: `Refill received: +${quantityReceived} units (${prevQty} → ${newQty})`,
            previousValue: JSON.stringify({ quantityOnHand: prevQty }),
            newValue: JSON.stringify({ quantityOnHand: newQty }),
          });
        }

        await tx.update(refillRequestsTable).set(updates).where(eq(refillRequestsTable.id, id));
      });

      res.json({ success: true, id, status: updates.status || existing.status });
      return;
    }
  }

  await db.update(refillRequestsTable).set(updates).where(eq(refillRequestsTable.id, id));
  res.json({ success: true, id, status: updates.status || existing.status });
});

router.get("/medication-reconciliation", async (req, res): Promise<void> => {
  const staff = await resolveCallerStaff(req);
  if (!staff?.orgId) { res.status(403).json({ error: "No organization found" }); return; }
  const homeIds = await getOrgHomeIds(staff.orgId);
  if (homeIds.length === 0) {
    res.json({ pendingOrders: [], refillAlerts: [], pendingRefills: [], recentChanges: [], summary: { pendingOrderCount: 0, refillAlertCount: 0, pendingRefillCount: 0, recentChangeCount: 0 } });
    return;
  }

  const pendingOrdersResult = await db.execute(sql`
    SELECT po.id, po.patient_id as "patientId",
      concat(p.first_name, ' ', p.last_name) as "patientName",
      po.medication_id as "medicationId", m.name as "medicationName",
      po.order_type as "orderType", po.ordered_by as "orderedBy",
      po.details, po.effective_date as "effectiveDate",
      po.status, po.created_at as "createdAt"
    FROM physician_orders po
    LEFT JOIN patients p ON po.patient_id = p.id
    LEFT JOIN medications m ON po.medication_id = m.id
    WHERE po.status = 'pending' AND p.home_id IN (${sqlInList(homeIds)})
    ORDER BY po.effective_date ASC
  `);

  const refillAlertsResult = await db.execute(sql`
    SELECT m.id as "medicationId", m.name as "medicationName",
      concat(p.first_name, ' ', p.last_name) as "patientName",
      m.dosage, m.quantity_on_hand as "quantityOnHand", m.refill_threshold as "refillThreshold",
      m.pharmacy_name as "pharmacyName", m.pharmacy_phone as "pharmacyPhone",
      m.rx_number as "rxNumber", m.frequency,
      CASE
        WHEN m.quantity_on_hand > 0 THEN
          CASE
            WHEN m.frequency ILIKE '%twice%' OR m.frequency ILIKE '%bid%' THEN m.quantity_on_hand / 2
            WHEN m.frequency ILIKE '%three%' OR m.frequency ILIKE '%tid%' THEN m.quantity_on_hand / 3
            WHEN m.frequency ILIKE '%four%' OR m.frequency ILIKE '%qid%' THEN m.quantity_on_hand / 4
            ELSE m.quantity_on_hand
          END
        ELSE 0
      END as "daysRemaining",
      CASE
        WHEN m.quantity_on_hand = 0 THEN 'out_of_stock'
        WHEN m.quantity_on_hand <= (m.refill_threshold / 2) THEN 'critical'
        WHEN m.quantity_on_hand <= m.refill_threshold THEN 'low'
        ELSE 'ok'
      END as "urgency"
    FROM medications m
    LEFT JOIN patients p ON m.patient_id = p.id
    WHERE m.active = true
      AND m.refill_threshold IS NOT NULL
      AND m.quantity_on_hand IS NOT NULL
      AND m.quantity_on_hand <= m.refill_threshold
      AND p.home_id IN (${sqlInList(homeIds)})
    ORDER BY m.quantity_on_hand ASC
  `);

  const pendingRefillsResult = await db.execute(sql`
    SELECT rr.id, m.name as "medicationName",
      concat(p.first_name, ' ', p.last_name) as "patientName",
      rr.status, rr.pharmacy_name as "pharmacyName",
      rr.expected_fill_date as "expectedFillDate",
      rr.created_at as "createdAt"
    FROM refill_requests rr
    LEFT JOIN medications m ON rr.medication_id = m.id
    LEFT JOIN patients p ON rr.patient_id = p.id
    WHERE rr.status IN ('pending', 'contacted')
      AND p.home_id IN (${sqlInList(homeIds)})
    ORDER BY rr.created_at ASC
  `);

  const recentChangesResult = await db.execute(sql`
    SELECT mc.id, mc.change_type as "changeType",
      mc.reason, mc.ordered_by as "orderedBy",
      mc.old_details as "oldDetails", mc.new_details as "newDetails",
      mc.effective_date as "effectiveDate",
      concat(p.first_name, ' ', p.last_name) as "patientName",
      m1.name as "oldMedName", m2.name as "newMedName",
      concat(s.first_name, ' ', s.last_name) as "processedByName"
    FROM medication_changes mc
    LEFT JOIN patients p ON mc.patient_id = p.id
    LEFT JOIN medications m1 ON mc.old_medication_id = m1.id
    LEFT JOIN medications m2 ON mc.new_medication_id = m2.id
    LEFT JOIN staff s ON mc.processed_by = s.id
    WHERE p.home_id IN (${sqlInList(homeIds)})
    ORDER BY mc.effective_date DESC
    LIMIT 20
  `);

  res.json({
    pendingOrders: pendingOrdersResult.rows,
    refillAlerts: refillAlertsResult.rows,
    pendingRefills: pendingRefillsResult.rows,
    recentChanges: recentChangesResult.rows,
    summary: {
      pendingOrderCount: pendingOrdersResult.rows.length,
      refillAlertCount: refillAlertsResult.rows.length,
      pendingRefillCount: pendingRefillsResult.rows.length,
      recentChangeCount: recentChangesResult.rows.length,
    },
  });
});

export default router;
