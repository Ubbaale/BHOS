import { Router } from "express";
import { db } from "@workspace/db";
import { sql, eq, and, inArray, desc } from "drizzle-orm";
import {
  dataBackupsTable, homesTable, staffTable, supportTicketsTable,
  supportTicketMessagesTable, superAdminsTable,
} from "@workspace/db/schema";

const router = Router();

async function requireSuperAdmin(req: any, res: any, next: any) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const [staff] = await db
    .select({ email: staffTable.email })
    .from(staffTable)
    .where(eq(staffTable.clerkUserId, userId))
    .limit(1);
  if (!staff) return res.status(403).json({ error: "Forbidden" });
  const [admin] = await db
    .select()
    .from(superAdminsTable)
    .where(and(eq(superAdminsTable.email, staff.email), eq(superAdminsTable.isActive, true)))
    .limit(1);
  if (!admin) return res.status(403).json({ error: "Super admin access required" });
  (req as any).superAdmin = admin;
  next();
}

const ORG_DIRECT_TABLES = [
  "homes", "staff", "organizations", "subscriptions", "support_tickets",
  "support_ticket_messages", "training_courses", "compliance_reports",
  "inspection_visits", "state_audit_log", "state_inspectors", "license_events",
];

const HOME_LINKED_TABLES = [
  "patients", "medications", "medication_administrations", "medication_counts",
  "medication_errors", "medication_inventory", "medication_refusals",
  "medication_side_effects", "medication_audit_log", "medication_changes",
  "physician_orders", "drug_interactions", "vital_signs",
  "incidents", "daily_logs", "shifts", "time_punches", "fraud_alerts",
  "cameras", "camera_events", "census_records", "bed_assignments",
  "daily_assignments", "meetings", "meeting_attendees",
  "patient_appointments", "transport_requests", "vehicles", "drivers",
  "referrals", "waitlist", "crisis_events", "crisis_plans",
  "discharge_plans", "staff_messages", "shift_posts",
];

const PATIENT_LINKED_TABLES = [
  "treatment_plans", "treatment_goals", "goal_progress", "progress_notes",
  "consent_documents", "family_members", "family_notifications",
  "care_messages", "intake_assessments", "aftercare_followups",
  "behavior_trends", "predictive_risk_scores",
];

const STAFF_LINKED_TABLES = [
  "staff_certifications", "staff_availability", "training_records",
  "staff_invitations", "med_pass_pins", "med_access_challenges",
  "device_enrollments", "push_tokens", "onboarding_progress",
  "pin_attempt_logs", "active_sessions",
];

async function getStaffContext(req: any) {
  const userId = req.userId;
  if (!userId) return null;
  const [staff] = await db
    .select({ id: staffTable.id, orgId: staffTable.orgId, firstName: staffTable.firstName, lastName: staffTable.lastName, email: staffTable.email })
    .from(staffTable)
    .where(eq(staffTable.clerkUserId, userId))
    .limit(1);
  return staff || null;
}

async function tableExists(tableName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) as exists
  `);
  return (result as any).rows?.[0]?.exists === true;
}

async function hasColumn(tableName: string, columnName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName} AND column_name = ${columnName}
    ) as exists
  `);
  return (result as any).rows?.[0]?.exists === true;
}

async function exportOrgData(orgId: number) {
  const data: Record<string, any[]> = {};
  let totalRecords = 0;
  let tableCount = 0;

  const homeRows = await db.execute(sql`SELECT id FROM homes WHERE org_id = ${orgId}`);
  const homeIds = (homeRows as any).rows?.map((r: any) => r.id) || [];

  const staffRows = await db.execute(sql`SELECT id FROM staff WHERE org_id = ${orgId}`);
  const staffIds = (staffRows as any).rows?.map((r: any) => r.id) || [];

  const patientRows = homeIds.length > 0
    ? await db.execute(sql.raw(`SELECT id FROM patients WHERE home_id IN (${homeIds.join(",")})`))
    : { rows: [] };
  const patientIds = (patientRows as any).rows?.map((r: any) => r.id) || [];

  for (const table of ORG_DIRECT_TABLES) {
    if (!(await tableExists(table))) continue;
    const col = (await hasColumn(table, "org_id")) ? "org_id" : null;
    if (!col) continue;
    try {
      const rows = await db.execute(sql.raw(`SELECT * FROM "${table}" WHERE org_id = ${orgId}`));
      const records = (rows as any).rows || [];
      if (records.length > 0) {
        data[table] = records;
        totalRecords += records.length;
        tableCount++;
      }
    } catch {}
  }

  if (homeIds.length > 0) {
    const homeIdList = homeIds.join(",");
    for (const table of HOME_LINKED_TABLES) {
      if (!(await tableExists(table))) continue;
      if (!(await hasColumn(table, "home_id"))) continue;
      try {
        const rows = await db.execute(sql.raw(`SELECT * FROM "${table}" WHERE home_id IN (${homeIdList})`));
        const records = (rows as any).rows || [];
        if (records.length > 0) {
          data[table] = records;
          totalRecords += records.length;
          tableCount++;
        }
      } catch {}
    }
  }

  if (patientIds.length > 0) {
    const patientIdList = patientIds.join(",");
    for (const table of PATIENT_LINKED_TABLES) {
      if (!(await tableExists(table))) continue;
      const col = (await hasColumn(table, "patient_id")) ? "patient_id" : null;
      if (!col) continue;
      try {
        const rows = await db.execute(sql.raw(`SELECT * FROM "${table}" WHERE patient_id IN (${patientIdList})`));
        const records = (rows as any).rows || [];
        if (records.length > 0) {
          data[table] = records;
          totalRecords += records.length;
          tableCount++;
        }
      } catch {}
    }
  }

  if (staffIds.length > 0) {
    const staffIdList = staffIds.join(",");
    for (const table of STAFF_LINKED_TABLES) {
      if (!(await tableExists(table))) continue;
      const col = (await hasColumn(table, "staff_id")) ? "staff_id" : null;
      if (!col) continue;
      try {
        const rows = await db.execute(sql.raw(`SELECT * FROM "${table}" WHERE staff_id IN (${staffIdList})`));
        const records = (rows as any).rows || [];
        if (records.length > 0) {
          data[table] = records;
          totalRecords += records.length;
          tableCount++;
        }
      } catch {}
    }
  }

  return { data, totalRecords, tableCount };
}

router.get("/backups", async (req: any, res) => {
  try {
    const staff = await getStaffContext(req);
    if (!staff?.orgId) return res.status(400).json({ error: "Organization required" });

    const backups = await db
      .select()
      .from(dataBackupsTable)
      .where(eq(dataBackupsTable.orgId, staff.orgId))
      .orderBy(desc(dataBackupsTable.createdAt));

    res.json(backups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/backups", async (req: any, res) => {
  try {
    const staff = await getStaffContext(req);
    if (!staff?.orgId) return res.status(400).json({ error: "Organization required" });

    const staffName = `${staff.firstName} ${staff.lastName}`;

    const [backup] = await db.insert(dataBackupsTable).values({
      orgId: staff.orgId,
      backupType: req.body.backupType || "full",
      status: "in_progress",
      initiatedBy: staffName,
      initiatedByType: "user",
      platformCopy: true,
      notes: req.body.notes || null,
    }).returning();

    try {
      const { data: orgData, totalRecords, tableCount } = await exportOrgData(staff.orgId);

      const jsonStr = JSON.stringify(orgData, null, 2);
      const fileSizeBytes = Buffer.byteLength(jsonStr, "utf-8");
      const fileName = `backup_org${staff.orgId}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      const [updated] = await db
        .update(dataBackupsTable)
        .set({
          status: "completed",
          fileName,
          fileSizeBytes,
          tableCount,
          recordCount: totalRecords,
          completedAt: new Date(),
          expiresAt,
        })
        .where(eq(dataBackupsTable.id, backup.id))
        .returning();

      res.status(201).json(updated);
    } catch (exportErr: any) {
      await db
        .update(dataBackupsTable)
        .set({ status: "failed", notes: exportErr.message })
        .where(eq(dataBackupsTable.id, backup.id));

      res.status(500).json({ error: "Backup failed: " + exportErr.message });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/backups/:id/download", async (req: any, res) => {
  try {
    const staff = await getStaffContext(req);
    if (!staff?.orgId) return res.status(400).json({ error: "Organization required" });

    const [backup] = await db
      .select()
      .from(dataBackupsTable)
      .where(and(
        eq(dataBackupsTable.id, Number(req.params.id)),
        eq(dataBackupsTable.orgId, staff.orgId)
      ));

    if (!backup) return res.status(404).json({ error: "Backup not found" });
    if (backup.status !== "completed") return res.status(400).json({ error: "Backup not ready" });

    const { data: orgData } = await exportOrgData(staff.orgId);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${backup.fileName}"`);
    res.send(JSON.stringify(orgData, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/backups", requireSuperAdmin, async (req: any, res) => {
  try {
    const backups = await db
      .select()
      .from(dataBackupsTable)
      .orderBy(desc(dataBackupsTable.createdAt));

    res.json(backups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/backups", requireSuperAdmin, async (req: any, res) => {
  try {
    const admin = (req as any).superAdmin;
    const { orgId, notes } = req.body;
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const [backup] = await db.insert(dataBackupsTable).values({
      orgId: Number(orgId),
      backupType: "full",
      status: "in_progress",
      initiatedBy: admin?.name || "Platform Admin",
      initiatedByType: "admin",
      platformCopy: true,
      notes: notes || "Platform-initiated backup",
    }).returning();

    try {
      const { data: orgData, totalRecords, tableCount } = await exportOrgData(Number(orgId));

      const jsonStr = JSON.stringify(orgData, null, 2);
      const fileSizeBytes = Buffer.byteLength(jsonStr, "utf-8");
      const fileName = `backup_org${orgId}_admin_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 365);

      const [updated] = await db
        .update(dataBackupsTable)
        .set({
          status: "completed",
          fileName,
          fileSizeBytes,
          tableCount,
          recordCount: totalRecords,
          completedAt: new Date(),
          expiresAt,
        })
        .where(eq(dataBackupsTable.id, backup.id))
        .returning();

      res.status(201).json(updated);
    } catch (exportErr: any) {
      await db
        .update(dataBackupsTable)
        .set({ status: "failed", notes: exportErr.message })
        .where(eq(dataBackupsTable.id, backup.id));

      res.status(500).json({ error: "Backup failed: " + exportErr.message });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/backups/:id/download", requireSuperAdmin, async (req: any, res) => {
  try {
    const [backup] = await db
      .select()
      .from(dataBackupsTable)
      .where(eq(dataBackupsTable.id, Number(req.params.id)));

    if (!backup) return res.status(404).json({ error: "Backup not found" });
    if (backup.status !== "completed") return res.status(400).json({ error: "Backup not ready" });

    const { data: orgData } = await exportOrgData(backup.orgId);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${backup.fileName}"`);
    res.send(JSON.stringify(orgData, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
