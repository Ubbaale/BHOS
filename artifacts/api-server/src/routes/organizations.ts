import { Router } from "express";
import { db } from "@workspace/db";
import { organizationsTable, subscriptionsTable, licenseEventsTable, homesTable, staffTable } from "@workspace/db";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import type { Request, Response, NextFunction } from "express";

const router = Router();

async function resolveStaffOrgId(req: Request): Promise<number | null> {
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, req.userId || "")).limit(1);
  if (!staff) return null;
  if (staff.orgId) return staff.orgId;
  const orgs = await db.select({ id: organizationsTable.id }).from(organizationsTable).limit(1);
  return orgs[0]?.id ?? null;
}

async function requireOrgAccess(req: Request, res: Response, next: NextFunction) {
  const orgId = parseInt(req.params.id);
  if (isNaN(orgId)) return res.status(400).json({ error: "Invalid org ID" });
  const staffOrgId = await resolveStaffOrgId(req);
  if (staffOrgId !== orgId && req.userRole !== "admin") {
    return res.status(403).json({ error: "Access denied to this organization" });
  }
  next();
}

const PLAN_TIERS: Record<string, { name: string; price: number; features: string[] }> = {
  starter: { name: "Starter", price: 199, features: ["Basic patient management", "Medication tracking", "Daily logs", "Incident reporting"] },
  professional: { name: "Professional", price: 299, features: ["Everything in Starter", "eMAR with 5 Rights", "Billing & Claims", "Family Portal", "Staff Messaging", "Workforce Management"] },
  enterprise: { name: "Enterprise", price: 399, features: ["Everything in Professional", "Predictive Analytics", "Custom Integrations", "Priority Support", "Multi-region", "White-label branding", "API access"] },
  unlimited: { name: "Unlimited", price: 499, features: ["Everything in Enterprise", "Unlimited homes", "Dedicated account manager", "SLA guarantees", "Custom training", "On-premise option"] },
};

router.get("/organizations/plans", async (_req, res) => {
  res.json(PLAN_TIERS);
});

router.get("/organizations/my-org", requireAuth, async (req, res) => {
  try {
    const [staff] = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, req.userId || "")).limit(1);
    if (!staff) {
      return res.json({ hasOrg: false, alreadyOnboarded: false });
    }
    if (!staff.orgId) {
      return res.json({ hasOrg: false, alreadyOnboarded: true });
    }
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, staff.orgId));
    return res.json({ hasOrg: !!org, alreadyOnboarded: true, orgId: org?.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/organizations", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const orgs = await db.select().from(organizationsTable).orderBy(organizationsTable.name);
    res.json(orgs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/organizations/:id", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id));
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const [sub] = await db.select().from(subscriptionsTable)
      .where(eq(subscriptionsTable.orgId, id))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    const [homeCount] = await db.select({ count: count() }).from(homesTable).where(eq(homesTable.orgId, id));

    res.json({ ...org, subscription: sub || null, totalHomes: homeCount?.count || 0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/organizations", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, contactName, contactEmail, contactPhone, address, city, state, zipCode, planTier, website, taxId, npi } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const tier = PLAN_TIERS[planTier || "starter"];

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    const graceEndDate = new Date(endDate);
    graceEndDate.setDate(graceEndDate.getDate() + 15);

    const result = await db.transaction(async (tx) => {
      const [org] = await tx.insert(organizationsTable).values({
        name, slug, contactName, contactEmail, contactPhone,
        address, city, state, zipCode,
        planTier: planTier || "starter",
        website, taxId, npi,
      }).returning();

      const [sub] = await tx.insert(subscriptionsTable).values({
        orgId: org.id,
        planType: planTier || "starter",
        billingCycle: "monthly",
        pricePerHome: String(tier?.price || 299),
        homeLimit: 999999,
        currentHomeCount: 0,
        startDate,
        endDate,
        graceEndDate,
        status: "active",
        autoRenew: true,
        nextBillingDate: endDate,
      }).returning();

      await tx.insert(licenseEventsTable).values({
        orgId: org.id,
        subscriptionId: sub.id,
        eventType: "subscription_created",
        details: `${tier?.name || "Starter"} plan activated. Unlimited homes. Billed at $${tier?.price || 299}/home/mo.`,
        notificationSent: true,
      });

      return { ...org, subscription: sub };
    });

    res.status(201).json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/organizations/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const updates: any = {};
    const allowed = ["name", "contactName", "contactEmail", "contactPhone", "address", "city", "state", "zipCode", "planTier", "status", "website", "taxId", "npi", "logoUrl"];
    for (const f of allowed) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }

    const [updated] = await db.update(organizationsTable).set(updates).where(eq(organizationsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Organization not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/organizations/:id/subscription", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    if (isNaN(orgId)) return res.status(400).json({ error: "Invalid ID" });

    const [sub] = await db.select().from(subscriptionsTable)
      .where(eq(subscriptionsTable.orgId, orgId))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    if (!sub) return res.status(404).json({ error: "No subscription found" });

    const now = new Date();
    let licenseStatus = "active";
    let daysRemaining = Math.ceil((new Date(sub.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    let warningLevel: string | null = null;

    if (sub.status === "cancelled") {
      licenseStatus = "cancelled";
    } else if (now > new Date(sub.endDate)) {
      if (sub.graceEndDate && now <= new Date(sub.graceEndDate)) {
        licenseStatus = "grace_period";
        daysRemaining = Math.ceil((new Date(sub.graceEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        warningLevel = "critical";
      } else {
        licenseStatus = "expired";
        daysRemaining = 0;
        warningLevel = "expired";
      }
    } else if (daysRemaining <= 7) {
      warningLevel = "urgent";
    } else if (daysRemaining <= 14) {
      warningLevel = "warning";
    } else if (daysRemaining <= 30) {
      warningLevel = "notice";
    }

    const tier = PLAN_TIERS[sub.planType] || PLAN_TIERS.starter;

    const [homeCount] = await db.select({ count: count() }).from(homesTable).where(eq(homesTable.orgId, orgId));
    const enrolledHomes = homeCount?.count || 0;

    res.json({
      ...sub,
      licenseStatus,
      daysRemaining,
      warningLevel,
      planDetails: tier,
      enrolledHomes,
      monthlyTotal: Number(sub.pricePerHome) * enrolledHomes,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/organizations/:id/subscription/renew", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    if (isNaN(orgId)) return res.status(400).json({ error: "Invalid ID" });

    const { billingCycle, planType } = req.body;

    const [currentSub] = await db.select().from(subscriptionsTable)
      .where(eq(subscriptionsTable.orgId, orgId))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    if (!currentSub) return res.status(404).json({ error: "No subscription found" });

    const newPlan = planType || currentSub.planType;
    const newCycle = billingCycle || currentSub.billingCycle;
    const tier = PLAN_TIERS[newPlan] || PLAN_TIERS.starter;

    const startDate = new Date();
    const endDate = new Date(startDate);
    if (newCycle === "annual") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    const graceEndDate = new Date(endDate);
    graceEndDate.setDate(graceEndDate.getDate() + 15);

    const [renewed] = await db.update(subscriptionsTable).set({
      planType: newPlan,
      billingCycle: newCycle,
      pricePerHome: String(tier.price),
      startDate,
      endDate,
      graceEndDate,
      status: "active",
      lastPaymentDate: new Date(),
      nextBillingDate: endDate,
    }).where(eq(subscriptionsTable.id, currentSub.id)).returning();

    await db.insert(licenseEventsTable).values({
      orgId,
      subscriptionId: currentSub.id,
      eventType: "subscription_renewed",
      details: `Renewed to ${tier.name} plan (${newCycle}). Valid until ${endDate.toLocaleDateString()}.`,
      notificationSent: true,
    });

    await db.update(organizationsTable).set({ planTier: newPlan, status: "active" }).where(eq(organizationsTable.id, orgId));

    res.json(renewed);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/organizations/:id/subscription/cancel", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    if (isNaN(orgId)) return res.status(400).json({ error: "Invalid ID" });

    const { reason } = req.body;

    const [currentSub] = await db.select().from(subscriptionsTable)
      .where(eq(subscriptionsTable.orgId, orgId))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    if (!currentSub) return res.status(404).json({ error: "No subscription found" });

    const [cancelled] = await db.update(subscriptionsTable).set({
      status: "cancelled",
      autoRenew: false,
      cancelReason: reason || null,
      cancelledAt: new Date(),
    }).where(eq(subscriptionsTable.id, currentSub.id)).returning();

    await db.insert(licenseEventsTable).values({
      orgId,
      subscriptionId: currentSub.id,
      eventType: "subscription_cancelled",
      details: `Subscription cancelled. Reason: ${reason || "Not specified"}. Access continues until ${new Date(currentSub.endDate).toLocaleDateString()}.`,
      notificationSent: true,
    });

    res.json(cancelled);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/organizations/:id/subscription/upgrade", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    if (isNaN(orgId)) return res.status(400).json({ error: "Invalid ID" });

    const { planType } = req.body;
    if (!planType || !PLAN_TIERS[planType]) return res.status(400).json({ error: "Invalid plan type" });

    const tier = PLAN_TIERS[planType];

    const [currentSub] = await db.select().from(subscriptionsTable)
      .where(eq(subscriptionsTable.orgId, orgId))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    if (!currentSub) return res.status(404).json({ error: "No subscription found" });

    const [upgraded] = await db.update(subscriptionsTable).set({
      planType,
      pricePerHome: String(tier.price),
    }).where(eq(subscriptionsTable.id, currentSub.id)).returning();

    await db.update(organizationsTable).set({ planTier: planType }).where(eq(organizationsTable.id, orgId));

    await db.insert(licenseEventsTable).values({
      orgId,
      subscriptionId: currentSub.id,
      eventType: "plan_upgraded",
      details: `Upgraded to ${tier.name} plan. Home limit: ${tier.maxHomes}. Price: $${tier.price}/home/mo.`,
      notificationSent: true,
    });

    res.json(upgraded);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/organizations/:id/license-events", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    if (isNaN(orgId)) return res.status(400).json({ error: "Invalid ID" });

    const events = await db.select().from(licenseEventsTable)
      .where(eq(licenseEventsTable.orgId, orgId))
      .orderBy(desc(licenseEventsTable.createdAt))
      .limit(50);

    res.json(events);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/organizations/:id/license-check", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    if (isNaN(orgId)) return res.status(400).json({ error: "Invalid ID" });

    const [sub] = await db.select().from(subscriptionsTable)
      .where(eq(subscriptionsTable.orgId, orgId))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    if (!sub) return res.json({ valid: false, reason: "no_subscription", readOnly: true });

    const now = new Date();
    const endDate = new Date(sub.endDate);
    const graceEnd = sub.graceEndDate ? new Date(sub.graceEndDate) : null;

    if (sub.status === "cancelled" && now > endDate) {
      if (graceEnd && now <= graceEnd) {
        return res.json({ valid: true, readOnly: false, warning: "grace_period", message: "Your subscription has ended. You have a 15-day grace period to renew.", daysLeft: Math.ceil((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) });
      }
      return res.json({ valid: false, reason: "expired", readOnly: true, message: "Your subscription has expired. Please renew to continue creating records." });
    }

    if (now > endDate) {
      if (graceEnd && now <= graceEnd) {
        return res.json({ valid: true, readOnly: false, warning: "grace_period", message: "Your subscription period has ended. Please renew within the grace period.", daysLeft: Math.ceil((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) });
      }
      return res.json({ valid: false, reason: "expired", readOnly: true, message: "Your license has expired. The system is in read-only mode. Please contact your administrator to renew." });
    }

    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    let warning = null;
    if (daysLeft <= 7) warning = "urgent";
    else if (daysLeft <= 14) warning = "warning";
    else if (daysLeft <= 30) warning = "notice";

    return res.json({ valid: true, readOnly: false, warning, daysLeft, message: warning ? `Your subscription renews in ${daysLeft} days.` : null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
