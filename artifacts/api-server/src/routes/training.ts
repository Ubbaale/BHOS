import { Router, type IRouter } from "express";
import { eq, desc, and, lte, inArray } from "drizzle-orm";
import { db, trainingCoursesTable, staffCertificationsTable, trainingRecordsTable, staffTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function resolveCallerStaff(userId: string) {
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, userId)).limit(1);
  return staff ?? null;
}

async function getOrgStaffIds(orgId: number): Promise<number[]> {
  const staffMembers = await db.select({ id: staffTable.id }).from(staffTable).where(eq(staffTable.orgId, orgId));
  return staffMembers.map(s => s.id);
}

const COURSE_CREATE_FIELDS = ["name", "description", "category", "isRequired", "renewalMonths", "durationHours", "provider"] as const;
const COURSE_UPDATE_FIELDS = ["name", "description", "category", "isRequired", "renewalMonths", "durationHours", "provider", "status"] as const;
const CERT_CREATE_FIELDS = ["staffId", "courseId", "certificationName", "certificationNumber", "issuingOrganization", "earnedDate", "expirationDate", "notes"] as const;
const CERT_UPDATE_FIELDS = ["certificationName", "certificationNumber", "issuingOrganization", "earnedDate", "expirationDate", "status", "notes", "documentUrl"] as const;
const RECORD_CREATE_FIELDS = ["staffId", "courseId", "dueDate", "method"] as const;
const RECORD_UPDATE_FIELDS = ["status", "completedAt", "score", "passFail", "hoursCompleted", "instructor", "notes"] as const;

function pick<T extends Record<string, any>>(obj: T, keys: readonly string[]): Partial<T> {
  const result: any = {};
  for (const k of keys) {
    if (k in obj) result[k] = obj[k];
  }
  return result;
}

router.get("/training/courses", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });

    const courses = await db.select().from(trainingCoursesTable)
      .where(eq(trainingCoursesTable.orgId, staff.orgId))
      .orderBy(trainingCoursesTable.name);
    res.json(courses);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/training/courses", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });

    const data = pick(req.body, COURSE_CREATE_FIELDS);
    if (!data.name) return res.status(400).json({ error: "Course name is required" });

    const [course] = await db.insert(trainingCoursesTable).values({
      ...data,
      orgId: staff.orgId,
    }).returning();

    res.status(201).json(course);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/training/courses/:id", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const id = parseInt(req.params.id, 10);

    const [existing] = await db.select({ orgId: trainingCoursesTable.orgId }).from(trainingCoursesTable).where(eq(trainingCoursesTable.id, id));
    if (!existing || existing.orgId !== staff.orgId) return res.status(404).json({ error: "Course not found" });

    const data = pick(req.body, COURSE_UPDATE_FIELDS);
    const [updated] = await db.update(trainingCoursesTable)
      .set(data)
      .where(eq(trainingCoursesTable.id, id))
      .returning();
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/training/courses/:id", requireAuth, requireRole("admin"), async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const id = parseInt(req.params.id, 10);

    const [existing] = await db.select({ orgId: trainingCoursesTable.orgId }).from(trainingCoursesTable).where(eq(trainingCoursesTable.id, id));
    if (!existing || existing.orgId !== staff.orgId) return res.status(404).json({ error: "Course not found" });

    await db.delete(trainingCoursesTable).where(eq(trainingCoursesTable.id, id));
    res.json({ message: "Course deleted" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/training/certifications", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const orgStaffIds = await getOrgStaffIds(staff.orgId);
    if (orgStaffIds.length === 0) return res.json([]);

    const certs = await db.select({
      id: staffCertificationsTable.id,
      staffId: staffCertificationsTable.staffId,
      certificationName: staffCertificationsTable.certificationName,
      certificationNumber: staffCertificationsTable.certificationNumber,
      issuingOrganization: staffCertificationsTable.issuingOrganization,
      earnedDate: staffCertificationsTable.earnedDate,
      expirationDate: staffCertificationsTable.expirationDate,
      status: staffCertificationsTable.status,
      documentUrl: staffCertificationsTable.documentUrl,
      notes: staffCertificationsTable.notes,
      verifiedAt: staffCertificationsTable.verifiedAt,
      staffFirstName: staffTable.firstName,
      staffLastName: staffTable.lastName,
      staffRole: staffTable.role,
    })
      .from(staffCertificationsTable)
      .leftJoin(staffTable, eq(staffCertificationsTable.staffId, staffTable.id))
      .where(inArray(staffCertificationsTable.staffId, orgStaffIds))
      .orderBy(desc(staffCertificationsTable.earnedDate));

    res.json(certs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/training/certifications", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const orgStaffIds = await getOrgStaffIds(staff.orgId);

    const data = pick(req.body, CERT_CREATE_FIELDS);
    if (!data.staffId || !data.certificationName || !data.earnedDate) {
      return res.status(400).json({ error: "staffId, certificationName, and earnedDate are required" });
    }
    if (!orgStaffIds.includes(Number(data.staffId))) return res.status(403).json({ error: "Staff member not in your organization" });

    const [cert] = await db.insert(staffCertificationsTable).values({
      ...data,
      staffId: Number(data.staffId),
      courseId: data.courseId ? Number(data.courseId) : null,
    }).returning();
    res.status(201).json(cert);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/training/certifications/:id", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const orgStaffIds = await getOrgStaffIds(staff.orgId);
    const id = parseInt(req.params.id, 10);

    const [existing] = await db.select({ staffId: staffCertificationsTable.staffId }).from(staffCertificationsTable).where(eq(staffCertificationsTable.id, id));
    if (!existing || !orgStaffIds.includes(existing.staffId)) return res.status(404).json({ error: "Certification not found" });

    const data = pick(req.body, CERT_UPDATE_FIELDS);
    const [updated] = await db.update(staffCertificationsTable)
      .set(data)
      .where(eq(staffCertificationsTable.id, id))
      .returning();
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/training/certifications/:id/verify", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const orgStaffIds = await getOrgStaffIds(staff.orgId);
    const id = parseInt(req.params.id, 10);

    const [existing] = await db.select({ staffId: staffCertificationsTable.staffId }).from(staffCertificationsTable).where(eq(staffCertificationsTable.id, id));
    if (!existing || !orgStaffIds.includes(existing.staffId)) return res.status(404).json({ error: "Certification not found" });

    const [updated] = await db.update(staffCertificationsTable).set({
      verifiedBy: staff.id,
      verifiedAt: new Date(),
    }).where(eq(staffCertificationsTable.id, id)).returning();

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/training/records", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const orgStaffIds = await getOrgStaffIds(staff.orgId);
    if (orgStaffIds.length === 0) return res.json([]);

    const records = await db.select({
      id: trainingRecordsTable.id,
      staffId: trainingRecordsTable.staffId,
      courseId: trainingRecordsTable.courseId,
      completedAt: trainingRecordsTable.completedAt,
      score: trainingRecordsTable.score,
      passFail: trainingRecordsTable.passFail,
      hoursCompleted: trainingRecordsTable.hoursCompleted,
      instructor: trainingRecordsTable.instructor,
      method: trainingRecordsTable.method,
      status: trainingRecordsTable.status,
      dueDate: trainingRecordsTable.dueDate,
      staffFirstName: staffTable.firstName,
      staffLastName: staffTable.lastName,
      courseName: trainingCoursesTable.name,
      courseCategory: trainingCoursesTable.category,
    })
      .from(trainingRecordsTable)
      .leftJoin(staffTable, eq(trainingRecordsTable.staffId, staffTable.id))
      .leftJoin(trainingCoursesTable, eq(trainingRecordsTable.courseId, trainingCoursesTable.id))
      .where(inArray(trainingRecordsTable.staffId, orgStaffIds))
      .orderBy(desc(trainingRecordsTable.createdAt));

    res.json(records);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/training/records", requireAuth, requireRole("admin", "manager"), async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const orgStaffIds = await getOrgStaffIds(staff.orgId);

    const data = pick(req.body, RECORD_CREATE_FIELDS);
    if (!data.staffId || !data.courseId) return res.status(400).json({ error: "staffId and courseId are required" });
    if (!orgStaffIds.includes(Number(data.staffId))) return res.status(403).json({ error: "Staff member not in your organization" });

    const [course] = await db.select({ orgId: trainingCoursesTable.orgId }).from(trainingCoursesTable).where(eq(trainingCoursesTable.id, Number(data.courseId)));
    if (!course || course.orgId !== staff.orgId) return res.status(403).json({ error: "Course not in your organization" });

    const [record] = await db.insert(trainingRecordsTable).values({
      ...data,
      staffId: Number(data.staffId),
      courseId: Number(data.courseId),
    }).returning();
    res.status(201).json(record);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/training/records/:id", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const orgStaffIds = await getOrgStaffIds(staff.orgId);
    const id = parseInt(req.params.id, 10);

    const [existing] = await db.select({ staffId: trainingRecordsTable.staffId }).from(trainingRecordsTable).where(eq(trainingRecordsTable.id, id));
    if (!existing || !orgStaffIds.includes(existing.staffId)) return res.status(404).json({ error: "Training record not found" });

    const data = pick(req.body, RECORD_UPDATE_FIELDS);
    const [updated] = await db.update(trainingRecordsTable)
      .set(data)
      .where(eq(trainingRecordsTable.id, id))
      .returning();
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/training/expiring", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const orgStaffIds = await getOrgStaffIds(staff.orgId);
    if (orgStaffIds.length === 0) return res.json([]);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiring = await db.select({
      id: staffCertificationsTable.id,
      certificationName: staffCertificationsTable.certificationName,
      expirationDate: staffCertificationsTable.expirationDate,
      status: staffCertificationsTable.status,
      staffFirstName: staffTable.firstName,
      staffLastName: staffTable.lastName,
      staffRole: staffTable.role,
    })
      .from(staffCertificationsTable)
      .leftJoin(staffTable, eq(staffCertificationsTable.staffId, staffTable.id))
      .where(and(
        inArray(staffCertificationsTable.staffId, orgStaffIds),
        eq(staffCertificationsTable.status, "active"),
        lte(staffCertificationsTable.expirationDate, thirtyDaysFromNow)
      ))
      .orderBy(staffCertificationsTable.expirationDate);

    res.json(expiring);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
