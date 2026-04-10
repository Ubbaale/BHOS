import { Router, type IRouter } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  db,
  payersTable,
  billableServicesTable,
  claimsTable,
  paymentsTable,
  patientsTable,
  staffTable,
} from "@workspace/db";
import {
  CreatePayerBody,
  CreateBillableServiceBody,
  CreateClaimBody,
  UpdateClaimBody,
  CreatePaymentBody,
  ListBillableServicesQueryParams,
  ListClaimsQueryParams,
  ListPaymentsQueryParams,
  GetClaimParams,
  UpdateClaimParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/billing/payers", async (_req, res): Promise<void> => {
  const payers = await db
    .select()
    .from(payersTable)
    .orderBy(payersTable.name);
  res.json(payers);
});

router.post("/billing/payers", async (req, res): Promise<void> => {
  const parsed = CreatePayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [payer] = await db.insert(payersTable).values(parsed.data).returning();
  res.status(201).json(payer);
});

const serviceSelect = {
  id: billableServicesTable.id,
  patientId: billableServicesTable.patientId,
  patientName: sql<string>`concat(${patientsTable.firstName}, ' ', ${patientsTable.lastName})`,
  staffId: billableServicesTable.staffId,
  staffName: sql<string>`COALESCE(concat(${staffTable.firstName}, ' ', ${staffTable.lastName}), '')`,
  serviceDate: billableServicesTable.serviceDate,
  serviceType: billableServicesTable.serviceType,
  cptCode: billableServicesTable.cptCode,
  hcpcsCode: billableServicesTable.hcpcsCode,
  revenueCode: billableServicesTable.revenueCode,
  modifiers: billableServicesTable.modifiers,
  units: sql<number>`${billableServicesTable.units}::float`,
  unitRate: sql<number>`${billableServicesTable.unitRate}::float`,
  totalCharge: sql<number>`${billableServicesTable.totalCharge}::float`,
  diagnosisCode: billableServicesTable.diagnosisCode,
  placeOfService: billableServicesTable.placeOfService,
  description: billableServicesTable.description,
  status: billableServicesTable.status,
  claimId: billableServicesTable.claimId,
  notes: billableServicesTable.notes,
  createdAt: billableServicesTable.createdAt,
};

router.get("/billing/services", async (req, res): Promise<void> => {
  const queryParams = ListBillableServicesQueryParams.safeParse(req.query);
  const conditions = [];
  if (queryParams.success && queryParams.data.patientId) {
    conditions.push(eq(billableServicesTable.patientId, queryParams.data.patientId));
  }
  if (queryParams.success && queryParams.data.status) {
    conditions.push(eq(billableServicesTable.status, queryParams.data.status));
  }

  let query = db
    .select(serviceSelect)
    .from(billableServicesTable)
    .leftJoin(patientsTable, eq(billableServicesTable.patientId, patientsTable.id))
    .leftJoin(staffTable, eq(billableServicesTable.staffId, staffTable.id))
    .orderBy(desc(billableServicesTable.serviceDate))
    .$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const services = await query;
  res.json(services);
});

router.post("/billing/services", async (req, res): Promise<void> => {
  const parsed = CreateBillableServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [service] = await db.insert(billableServicesTable).values(parsed.data).returning();
  res.status(201).json(service);
});

const claimSelect = {
  id: claimsTable.id,
  claimNumber: claimsTable.claimNumber,
  patientId: claimsTable.patientId,
  patientName: sql<string>`concat(${patientsTable.firstName}, ' ', ${patientsTable.lastName})`,
  payerId: claimsTable.payerId,
  payerName: payersTable.name,
  serviceStartDate: claimsTable.serviceStartDate,
  serviceEndDate: claimsTable.serviceEndDate,
  totalCharged: sql<number>`${claimsTable.totalCharged}::float`,
  totalAllowed: sql<number>`${claimsTable.totalAllowed}::float`,
  totalPaid: sql<number>`${claimsTable.totalPaid}::float`,
  patientResponsibility: sql<number>`${claimsTable.patientResponsibility}::float`,
  status: claimsTable.status,
  claimType: claimsTable.claimType,
  primaryDiagnosisCode: claimsTable.primaryDiagnosisCode,
  secondaryDiagnosisCodes: claimsTable.secondaryDiagnosisCodes,
  renderingProvider: claimsTable.renderingProvider,
  referringProvider: claimsTable.referringProvider,
  authorizationNumber: claimsTable.authorizationNumber,
  submittedAt: claimsTable.submittedAt,
  paidAt: claimsTable.paidAt,
  denialReason: claimsTable.denialReason,
  denialCode: claimsTable.denialCode,
  appealDeadline: claimsTable.appealDeadline,
  notes: claimsTable.notes,
  createdAt: claimsTable.createdAt,
  updatedAt: claimsTable.updatedAt,
  serviceCount: sql<number>`(SELECT COUNT(*) FROM billable_services WHERE claim_id = ${claimsTable.id})::int`,
};

router.get("/billing/claims", async (req, res): Promise<void> => {
  const queryParams = ListClaimsQueryParams.safeParse(req.query);
  const conditions = [];
  if (queryParams.success && queryParams.data.status) {
    conditions.push(eq(claimsTable.status, queryParams.data.status));
  }
  if (queryParams.success && queryParams.data.payerId) {
    conditions.push(eq(claimsTable.payerId, queryParams.data.payerId));
  }
  if (queryParams.success && queryParams.data.patientId) {
    conditions.push(eq(claimsTable.patientId, queryParams.data.patientId));
  }

  let query = db
    .select(claimSelect)
    .from(claimsTable)
    .leftJoin(patientsTable, eq(claimsTable.patientId, patientsTable.id))
    .leftJoin(payersTable, eq(claimsTable.payerId, payersTable.id))
    .orderBy(desc(claimsTable.createdAt))
    .$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const claims = await query;
  res.json(claims);
});

router.post("/billing/claims", async (req, res): Promise<void> => {
  const parsed = CreateClaimBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const claimNumber = `CLM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const [claim] = await db
    .insert(claimsTable)
    .values({ ...parsed.data, claimNumber })
    .returning();

  const result = await db
    .select(claimSelect)
    .from(claimsTable)
    .leftJoin(patientsTable, eq(claimsTable.patientId, patientsTable.id))
    .leftJoin(payersTable, eq(claimsTable.payerId, payersTable.id))
    .where(eq(claimsTable.id, claim.id));

  res.status(201).json(result[0]);
});

router.get("/billing/claims/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const result = await db
    .select(claimSelect)
    .from(claimsTable)
    .leftJoin(patientsTable, eq(claimsTable.patientId, patientsTable.id))
    .leftJoin(payersTable, eq(claimsTable.payerId, payersTable.id))
    .where(eq(claimsTable.id, id));

  if (result.length === 0) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  res.json(result[0]);
});

router.put("/billing/claims/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const parsed = UpdateClaimBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const updateData: any = { ...parsed.data, updatedAt: new Date() };

  if (parsed.data.status === "submitted" && !updateData.submittedAt) {
    updateData.submittedAt = new Date();
  }
  if (parsed.data.status === "paid" && !updateData.paidAt) {
    updateData.paidAt = new Date();
  }

  await db.update(claimsTable).set(updateData).where(eq(claimsTable.id, id));

  const result = await db
    .select(claimSelect)
    .from(claimsTable)
    .leftJoin(patientsTable, eq(claimsTable.patientId, patientsTable.id))
    .leftJoin(payersTable, eq(claimsTable.payerId, payersTable.id))
    .where(eq(claimsTable.id, id));

  res.json(result[0]);
});

const paymentSelect = {
  id: paymentsTable.id,
  claimId: paymentsTable.claimId,
  claimNumber: claimsTable.claimNumber,
  payerId: paymentsTable.payerId,
  payerName: payersTable.name,
  paymentDate: paymentsTable.paymentDate,
  amount: sql<number>`${paymentsTable.amount}::float`,
  paymentMethod: paymentsTable.paymentMethod,
  checkNumber: paymentsTable.checkNumber,
  eftTraceNumber: paymentsTable.eftTraceNumber,
  adjustmentAmount: sql<number>`${paymentsTable.adjustmentAmount}::float`,
  adjustmentReason: paymentsTable.adjustmentReason,
  remarkCode: paymentsTable.remarkCode,
  notes: paymentsTable.notes,
  createdAt: paymentsTable.createdAt,
};

router.get("/billing/payments", async (req, res): Promise<void> => {
  const queryParams = ListPaymentsQueryParams.safeParse(req.query);
  const conditions = [];
  if (queryParams.success && queryParams.data.claimId) {
    conditions.push(eq(paymentsTable.claimId, queryParams.data.claimId));
  }

  let query = db
    .select(paymentSelect)
    .from(paymentsTable)
    .leftJoin(claimsTable, eq(paymentsTable.claimId, claimsTable.id))
    .leftJoin(payersTable, eq(paymentsTable.payerId, payersTable.id))
    .orderBy(desc(paymentsTable.paymentDate))
    .$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const payments = await query;
  res.json(payments);
});

router.post("/billing/payments", async (req, res): Promise<void> => {
  const parsed = CreatePaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const [payment] = await db.insert(paymentsTable).values(parsed.data).returning();

  await db
    .update(claimsTable)
    .set({
      totalPaid: sql`${claimsTable.totalPaid} + ${parsed.data.amount}`,
      updatedAt: new Date(),
    })
    .where(eq(claimsTable.id, parsed.data.claimId));

  res.status(201).json(payment);
});

router.get("/billing/summary", async (_req, res): Promise<void> => {
  const summaryResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(total_charged), 0)::float as total_charged,
      COALESCE(SUM(total_paid), 0)::float as total_paid,
      COALESCE(SUM(total_charged) - SUM(total_paid), 0)::float as total_outstanding,
      COALESCE(SUM(CASE WHEN status = 'denied' THEN total_charged ELSE 0 END), 0)::float as total_denied
    FROM claims
  `);

  const statusResult = await db.execute(sql`
    SELECT status, COUNT(*)::int as count FROM claims GROUP BY status
  `);
  const claimsByStatus: Record<string, number> = {};
  for (const row of statusResult.rows as any[]) {
    claimsByStatus[row.status] = row.count;
  }

  const payerResult = await db.execute(sql`
    SELECT
      p.name as payer_name,
      COALESCE(SUM(c.total_charged), 0)::float as total_charged,
      COALESCE(SUM(c.total_paid), 0)::float as total_paid,
      COUNT(c.id)::int as claim_count
    FROM payers p
    LEFT JOIN claims c ON c.payer_id = p.id
    GROUP BY p.id, p.name
    ORDER BY total_charged DESC
  `);

  const now = new Date();
  const agingResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN submitted_at >= ${new Date(now.getTime() - 30 * 86400000)} THEN total_charged - total_paid ELSE 0 END), 0)::float as current_amount,
      COALESCE(SUM(CASE WHEN submitted_at < ${new Date(now.getTime() - 30 * 86400000)} AND submitted_at >= ${new Date(now.getTime() - 60 * 86400000)} THEN total_charged - total_paid ELSE 0 END), 0)::float as thirty_days,
      COALESCE(SUM(CASE WHEN submitted_at < ${new Date(now.getTime() - 60 * 86400000)} AND submitted_at >= ${new Date(now.getTime() - 90 * 86400000)} THEN total_charged - total_paid ELSE 0 END), 0)::float as sixty_days,
      COALESCE(SUM(CASE WHEN submitted_at < ${new Date(now.getTime() - 90 * 86400000)} AND submitted_at >= ${new Date(now.getTime() - 120 * 86400000)} THEN total_charged - total_paid ELSE 0 END), 0)::float as ninety_days,
      COALESCE(SUM(CASE WHEN submitted_at < ${new Date(now.getTime() - 120 * 86400000)} THEN total_charged - total_paid ELSE 0 END), 0)::float as over_ninety
    FROM claims
    WHERE status NOT IN ('draft', 'void', 'paid')
  `);

  const monthlyResult = await db.execute(sql`
    SELECT
      to_char(created_at, 'YYYY-MM') as month,
      COALESCE(SUM(total_charged), 0)::float as charged,
      COALESCE(SUM(total_paid), 0)::float as paid
    FROM claims
    GROUP BY to_char(created_at, 'YYYY-MM')
    ORDER BY month DESC
    LIMIT 12
  `);

  const summary = summaryResult.rows[0] as any;
  const aging = agingResult.rows[0] as any;

  res.json({
    totalCharged: summary.total_charged,
    totalPaid: summary.total_paid,
    totalOutstanding: summary.total_outstanding,
    totalDenied: summary.total_denied,
    claimsByStatus,
    revenueByPayer: (payerResult.rows as any[]).map((r) => ({
      payerName: r.payer_name,
      totalCharged: r.total_charged,
      totalPaid: r.total_paid,
      claimCount: r.claim_count,
    })),
    agingBuckets: {
      current: aging.current_amount,
      thirtyDays: aging.thirty_days,
      sixtyDays: aging.sixty_days,
      ninetyDays: aging.ninety_days,
      overNinety: aging.over_ninety,
    },
    monthlyRevenue: (monthlyResult.rows as any[]).map((r) => ({
      month: r.month,
      charged: r.charged,
      paid: r.paid,
    })),
  });
});

export default router;
