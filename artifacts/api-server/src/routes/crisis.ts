import { Router, type IRouter } from "express";
import { eq, desc, and, inArray } from "drizzle-orm";
import { db, crisisPlansTable, crisisEventsTable, crisisDebriefingsTable, patientsTable, staffTable, homesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function resolveCallerStaff(userId: string) {
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, userId)).limit(1);
  return staff ?? null;
}

async function getOrgHomeIds(orgId: number): Promise<number[]> {
  const homes = await db.select({ id: homesTable.id }).from(homesTable).where(eq(homesTable.orgId, orgId));
  return homes.map(h => h.id);
}

const PLAN_CREATE_FIELDS = ["patientId", "homeId", "triggerWarnings", "deescalationSteps", "preferredHospital", "emergencyContacts", "medicationProtocol", "safetyPrecautions", "restrictionNotes"] as const;
const PLAN_UPDATE_FIELDS = ["triggerWarnings", "deescalationSteps", "preferredHospital", "emergencyContacts", "medicationProtocol", "safetyPrecautions", "restrictionNotes", "status", "nextReviewDate"] as const;
const EVENT_CREATE_FIELDS = ["patientId", "homeId", "crisisPlanId", "crisisType", "severity", "description", "interventionsUsed", "restraintUsed", "restraintType", "restraintStartTime", "restraintEndTime", "restraintJustification", "seclusionUsed", "seclusionStartTime", "seclusionEndTime", "emergencyServicesCalledAt", "hospitalTransport", "hospitalName"] as const;
const EVENT_UPDATE_FIELDS = ["status", "outcome", "resolvedAt", "interventionsUsed"] as const;
const DEBRIEF_CREATE_FIELDS = ["whatHappened", "whatWorked", "whatToImprove", "planUpdates", "followUpActions", "attendees"] as const;

function pick<T extends Record<string, any>>(obj: T, keys: readonly string[]): Partial<T> {
  const result: any = {};
  for (const k of keys) {
    if (k in obj) result[k] = obj[k];
  }
  return result;
}

router.get("/crisis/plans", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const homeIds = await getOrgHomeIds(staff.orgId);
    if (homeIds.length === 0) return res.json([]);

    const plans = await db.select({
      id: crisisPlansTable.id,
      patientId: crisisPlansTable.patientId,
      homeId: crisisPlansTable.homeId,
      triggerWarnings: crisisPlansTable.triggerWarnings,
      deescalationSteps: crisisPlansTable.deescalationSteps,
      preferredHospital: crisisPlansTable.preferredHospital,
      emergencyContacts: crisisPlansTable.emergencyContacts,
      medicationProtocol: crisisPlansTable.medicationProtocol,
      safetyPrecautions: crisisPlansTable.safetyPrecautions,
      status: crisisPlansTable.status,
      nextReviewDate: crisisPlansTable.nextReviewDate,
      lastReviewedAt: crisisPlansTable.lastReviewedAt,
      createdAt: crisisPlansTable.createdAt,
      patientFirstName: patientsTable.firstName,
      patientLastName: patientsTable.lastName,
      homeName: homesTable.name,
      createdByFirstName: staffTable.firstName,
      createdByLastName: staffTable.lastName,
    })
      .from(crisisPlansTable)
      .leftJoin(patientsTable, eq(crisisPlansTable.patientId, patientsTable.id))
      .leftJoin(homesTable, eq(crisisPlansTable.homeId, homesTable.id))
      .leftJoin(staffTable, eq(crisisPlansTable.createdBy, staffTable.id))
      .where(inArray(crisisPlansTable.homeId, homeIds))
      .orderBy(desc(crisisPlansTable.createdAt));

    res.json(plans);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/crisis/plans/:id", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const homeIds = await getOrgHomeIds(staff.orgId);

    const id = parseInt(req.params.id, 10);
    const [plan] = await db.select().from(crisisPlansTable)
      .where(and(eq(crisisPlansTable.id, id), inArray(crisisPlansTable.homeId, homeIds)));
    if (!plan) return res.status(404).json({ error: "Crisis plan not found" });
    res.json(plan);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/crisis/plans", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const homeIds = await getOrgHomeIds(staff.orgId);

    const data = pick(req.body, PLAN_CREATE_FIELDS);
    if (!data.patientId || !data.homeId) return res.status(400).json({ error: "patientId and homeId are required" });
    if (!homeIds.includes(Number(data.homeId))) return res.status(403).json({ error: "Home does not belong to your organization" });

    const [plan] = await db.insert(crisisPlansTable).values({
      ...data,
      patientId: Number(data.patientId),
      homeId: Number(data.homeId),
      createdBy: staff.id,
    }).returning();

    res.status(201).json(plan);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/crisis/plans/:id", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const homeIds = await getOrgHomeIds(staff.orgId);
    const id = parseInt(req.params.id, 10);

    const [existing] = await db.select({ homeId: crisisPlansTable.homeId }).from(crisisPlansTable).where(eq(crisisPlansTable.id, id));
    if (!existing || !homeIds.includes(existing.homeId)) return res.status(404).json({ error: "Crisis plan not found" });

    const data = pick(req.body, PLAN_UPDATE_FIELDS);
    const [updated] = await db.update(crisisPlansTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crisisPlansTable.id, id))
      .returning();
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/crisis/events", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const homeIds = await getOrgHomeIds(staff.orgId);
    if (homeIds.length === 0) return res.json([]);

    const events = await db.select({
      id: crisisEventsTable.id,
      patientId: crisisEventsTable.patientId,
      homeId: crisisEventsTable.homeId,
      crisisType: crisisEventsTable.crisisType,
      severity: crisisEventsTable.severity,
      description: crisisEventsTable.description,
      restraintUsed: crisisEventsTable.restraintUsed,
      seclusionUsed: crisisEventsTable.seclusionUsed,
      hospitalTransport: crisisEventsTable.hospitalTransport,
      status: crisisEventsTable.status,
      occurredAt: crisisEventsTable.occurredAt,
      resolvedAt: crisisEventsTable.resolvedAt,
      outcome: crisisEventsTable.outcome,
      patientFirstName: patientsTable.firstName,
      patientLastName: patientsTable.lastName,
      homeName: homesTable.name,
      reportedByFirstName: staffTable.firstName,
      reportedByLastName: staffTable.lastName,
    })
      .from(crisisEventsTable)
      .leftJoin(patientsTable, eq(crisisEventsTable.patientId, patientsTable.id))
      .leftJoin(homesTable, eq(crisisEventsTable.homeId, homesTable.id))
      .leftJoin(staffTable, eq(crisisEventsTable.reportedBy, staffTable.id))
      .where(inArray(crisisEventsTable.homeId, homeIds))
      .orderBy(desc(crisisEventsTable.occurredAt));

    res.json(events);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/crisis/events/:id", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const homeIds = await getOrgHomeIds(staff.orgId);

    const id = parseInt(req.params.id, 10);
    const [event] = await db.select().from(crisisEventsTable)
      .where(and(eq(crisisEventsTable.id, id), inArray(crisisEventsTable.homeId, homeIds)));
    if (!event) return res.status(404).json({ error: "Crisis event not found" });
    res.json(event);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/crisis/events", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const homeIds = await getOrgHomeIds(staff.orgId);

    const data = pick(req.body, EVENT_CREATE_FIELDS);
    if (!data.patientId || !data.homeId || !data.crisisType || !data.description) {
      return res.status(400).json({ error: "patientId, homeId, crisisType, and description are required" });
    }
    if (!homeIds.includes(Number(data.homeId))) return res.status(403).json({ error: "Home does not belong to your organization" });

    const [event] = await db.insert(crisisEventsTable).values({
      ...data,
      patientId: Number(data.patientId),
      homeId: Number(data.homeId),
      crisisPlanId: data.crisisPlanId ? Number(data.crisisPlanId) : null,
      reportedBy: staff.id,
    }).returning();

    res.status(201).json(event);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/crisis/events/:id", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const homeIds = await getOrgHomeIds(staff.orgId);
    const id = parseInt(req.params.id, 10);

    const [existing] = await db.select({ homeId: crisisEventsTable.homeId }).from(crisisEventsTable).where(eq(crisisEventsTable.id, id));
    if (!existing || !homeIds.includes(existing.homeId)) return res.status(404).json({ error: "Crisis event not found" });

    const data = pick(req.body, EVENT_UPDATE_FIELDS);
    const [updated] = await db.update(crisisEventsTable)
      .set(data)
      .where(eq(crisisEventsTable.id, id))
      .returning();
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/crisis/events/:id/debriefings", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const homeIds = await getOrgHomeIds(staff.orgId);

    const eventId = parseInt(req.params.id, 10);
    const [event] = await db.select({ homeId: crisisEventsTable.homeId }).from(crisisEventsTable).where(eq(crisisEventsTable.id, eventId));
    if (!event || !homeIds.includes(event.homeId)) return res.status(404).json({ error: "Crisis event not found" });

    const debriefings = await db.select({
      id: crisisDebriefingsTable.id,
      crisisEventId: crisisDebriefingsTable.crisisEventId,
      whatHappened: crisisDebriefingsTable.whatHappened,
      whatWorked: crisisDebriefingsTable.whatWorked,
      whatToImprove: crisisDebriefingsTable.whatToImprove,
      planUpdates: crisisDebriefingsTable.planUpdates,
      followUpActions: crisisDebriefingsTable.followUpActions,
      attendees: crisisDebriefingsTable.attendees,
      conductedAt: crisisDebriefingsTable.conductedAt,
      conductedByFirstName: staffTable.firstName,
      conductedByLastName: staffTable.lastName,
    })
      .from(crisisDebriefingsTable)
      .leftJoin(staffTable, eq(crisisDebriefingsTable.conductedBy, staffTable.id))
      .where(eq(crisisDebriefingsTable.crisisEventId, eventId))
      .orderBy(desc(crisisDebriefingsTable.conductedAt));

    res.json(debriefings);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/crisis/events/:id/debriefings", requireAuth, async (req: any, res) => {
  try {
    const staff = await resolveCallerStaff(req.userId);
    if (!staff?.orgId) return res.status(403).json({ error: "No organization found" });
    const homeIds = await getOrgHomeIds(staff.orgId);

    const eventId = parseInt(req.params.id, 10);
    const [event] = await db.select({ homeId: crisisEventsTable.homeId }).from(crisisEventsTable).where(eq(crisisEventsTable.id, eventId));
    if (!event || !homeIds.includes(event.homeId)) return res.status(403).json({ error: "Crisis event not found" });

    const data = pick(req.body, DEBRIEF_CREATE_FIELDS);
    const [debriefing] = await db.insert(crisisDebriefingsTable).values({
      ...data,
      crisisEventId: eventId,
      conductedBy: staff.id,
    }).returning();

    res.status(201).json(debriefing);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
