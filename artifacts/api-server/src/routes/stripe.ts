import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, organizationsTable, subscriptionsTable, staffTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { stripeService } from "../stripeService";
import { stripeStorage } from "../stripeStorage";
import { getStripePublishableKey } from "../stripeClient";

async function getUserOrgId(clerkUserId: string): Promise<number | null> {
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, clerkUserId));
  return staff?.orgId ?? null;
}

const router: IRouter = Router();

router.get("/stripe/publishable-key", async (_req, res) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (e: any) {
    res.status(500).json({ error: "Stripe not configured" });
  }
});

router.get("/stripe/plans", async (_req, res) => {
  try {
    const rows = await stripeStorage.listProductsWithPrices();
    const productsMap = new Map();
    for (const row of rows as any[]) {
      if (!productsMap.has(row.product_id)) {
        productsMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          active: row.product_active,
          metadata: row.product_metadata,
          prices: []
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id).prices.push({
          id: row.price_id,
          unitAmount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
          active: row.price_active,
        });
      }
    }
    res.json(Array.from(productsMap.values()));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/stripe/checkout", requireAuth, async (req: any, res) => {
  try {
    const { priceId, orgId } = req.body;
    if (!priceId || !orgId) {
      return res.status(400).json({ error: "priceId and orgId required" });
    }

    const userOrgId = await getUserOrgId(req.auth.userId);
    if (userOrgId !== orgId) {
      return res.status(403).json({ error: "Not authorized for this organization" });
    }

    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));
    if (!org) return res.status(404).json({ error: "Organization not found" });

    let customerId = "";
    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.orgId, orgId));
    if (sub?.stripeCustomerId) {
      customerId = sub.stripeCustomerId;
    } else {
      const customer = await stripeService.createCustomer(
        req.body.email || "",
        orgId.toString(),
        org.name
      );
      customerId = customer.id;

      if (sub) {
        await db.update(subscriptionsTable)
          .set({ stripeCustomerId: customerId })
          .where(eq(subscriptionsTable.orgId, orgId));
      }
    }

    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const session = await stripeService.createCheckoutSession(
      customerId,
      priceId,
      `${baseUrl}/subscription?success=true`,
      `${baseUrl}/subscription?canceled=true`,
      orgId.toString()
    );

    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/stripe/portal", requireAuth, async (req: any, res) => {
  try {
    const { orgId } = req.body;
    if (!orgId) return res.status(400).json({ error: "orgId required" });

    const userOrgId = await getUserOrgId(req.auth.userId);
    if (userOrgId !== orgId) {
      return res.status(403).json({ error: "Not authorized for this organization" });
    }

    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.orgId, orgId));
    if (!sub?.stripeCustomerId) {
      return res.status(400).json({ error: "No Stripe customer found for this organization" });
    }

    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const session = await stripeService.createCustomerPortalSession(
      sub.stripeCustomerId,
      `${baseUrl}/subscription`
    );

    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/stripe/subscription/:orgId", requireAuth, async (req: any, res) => {
  try {
    const orgId = parseInt(req.params.orgId, 10);

    const userOrgId = await getUserOrgId(req.auth.userId);
    if (userOrgId !== orgId) {
      return res.status(403).json({ error: "Not authorized for this organization" });
    }

    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.orgId, orgId));
    if (!sub) return res.json({ subscription: null });

    let stripeSubscription = null;
    if (sub.stripeSubscriptionId) {
      stripeSubscription = await stripeStorage.getSubscription(sub.stripeSubscriptionId);
    }

    res.json({
      subscription: sub,
      stripeSubscription,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
