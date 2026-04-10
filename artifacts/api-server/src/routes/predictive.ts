import { Router } from "express";
import {
  db,
  behaviorTrendsTable,
  predictiveRiskScoresTable,
  patientsTable,
  incidentsTable,
  medicationAdministrationsTable,
  medicationRefusalsTable,
  dailyLogsTable,
} from "@workspace/db";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router = Router();

// ── BEHAVIOR TRENDS ──

router.get("/predictive/behavior-trends", requireAuth, async (req, res) => {
  try {
    const { patientId, days } = req.query;
    const conditions: any[] = [];
    if (patientId) conditions.push(eq(behaviorTrendsTable.patientId, parseInt(patientId as string)));

    const lookback = parseInt(days as string) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookback);
    conditions.push(gte(behaviorTrendsTable.recordDate, cutoff));

    const trends = await db
      .select({
        id: behaviorTrendsTable.id,
        patientId: behaviorTrendsTable.patientId,
        patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
        recordDate: behaviorTrendsTable.recordDate,
        moodScore: behaviorTrendsTable.moodScore,
        agitationLevel: behaviorTrendsTable.agitationLevel,
        sleepQuality: behaviorTrendsTable.sleepQuality,
        appetiteLevel: behaviorTrendsTable.appetiteLevel,
        socialEngagement: behaviorTrendsTable.socialEngagement,
        anxietyLevel: behaviorTrendsTable.anxietyLevel,
        cooperationLevel: behaviorTrendsTable.cooperationLevel,
        selfCareScore: behaviorTrendsTable.selfCareScore,
        triggers: behaviorTrendsTable.triggers,
        interventionsUsed: behaviorTrendsTable.interventionsUsed,
        notes: behaviorTrendsTable.notes,
        shiftType: behaviorTrendsTable.shiftType,
        createdAt: behaviorTrendsTable.createdAt,
      })
      .from(behaviorTrendsTable)
      .leftJoin(patientsTable, eq(behaviorTrendsTable.patientId, patientsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(behaviorTrendsTable.recordDate);

    res.json(trends);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/predictive/behavior-trends", requireAuth, async (req, res) => {
  try {
    const {
      patientId, recordDate, moodScore, agitationLevel, sleepQuality,
      appetiteLevel, socialEngagement, anxietyLevel, cooperationLevel,
      selfCareScore, triggers, interventionsUsed, notes, shiftType
    } = req.body;

    if (!patientId) return res.status(400).json({ error: "patientId is required" });

    const scores = [moodScore, agitationLevel, sleepQuality, appetiteLevel, socialEngagement, anxietyLevel, cooperationLevel, selfCareScore];
    for (const s of scores) {
      if (s !== undefined && s !== null && (s < 1 || s > 10)) {
        return res.status(400).json({ error: "All scores must be between 1 and 10" });
      }
    }

    const [trend] = await db.insert(behaviorTrendsTable).values({
      patientId,
      recordDate: recordDate ? new Date(recordDate) : new Date(),
      moodScore, agitationLevel, sleepQuality, appetiteLevel,
      socialEngagement, anxietyLevel, cooperationLevel, selfCareScore,
      triggers, interventionsUsed, notes, shiftType,
      recordedBy: req.userId,
    }).returning();

    res.status(201).json(trend);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── RISK SCORES ──

router.get("/predictive/risk-scores", requireAuth, async (req, res) => {
  try {
    const { patientId, activeOnly } = req.query;
    const conditions: any[] = [];
    if (patientId) conditions.push(eq(predictiveRiskScoresTable.patientId, parseInt(patientId as string)));
    if (activeOnly !== "false") conditions.push(eq(predictiveRiskScoresTable.isActive, true));

    const scores = await db
      .select({
        id: predictiveRiskScoresTable.id,
        patientId: predictiveRiskScoresTable.patientId,
        patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
        riskType: predictiveRiskScoresTable.riskType,
        score: predictiveRiskScoresTable.score,
        severity: predictiveRiskScoresTable.severity,
        factors: predictiveRiskScoresTable.factors,
        recommendation: predictiveRiskScoresTable.recommendation,
        dataPoints: predictiveRiskScoresTable.dataPoints,
        isActive: predictiveRiskScoresTable.isActive,
        acknowledgedBy: predictiveRiskScoresTable.acknowledgedBy,
        calculatedAt: predictiveRiskScoresTable.calculatedAt,
        createdAt: predictiveRiskScoresTable.createdAt,
      })
      .from(predictiveRiskScoresTable)
      .leftJoin(patientsTable, eq(predictiveRiskScoresTable.patientId, patientsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sql`${predictiveRiskScoresTable.score}::float`));

    res.json(scores);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/predictive/calculate", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const patients = await db.select().from(patientsTable).where(eq(patientsTable.status, "active"));
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const results: any[] = [];

    for (const patient of patients) {
      const incidents = await db
        .select()
        .from(incidentsTable)
        .where(and(eq(incidentsTable.patientId, patient.id), gte(incidentsTable.createdAt, thirtyDaysAgo)));

      const refusals = await db
        .select()
        .from(medicationRefusalsTable)
        .where(and(eq(medicationRefusalsTable.patientId, patient.id), gte(medicationRefusalsTable.createdAt, thirtyDaysAgo)));

      const recentAdmins = await db
        .select()
        .from(medicationAdministrationsTable)
        .where(and(eq(medicationAdministrationsTable.patientId, patient.id), gte(medicationAdministrationsTable.administeredAt, thirtyDaysAgo)));

      const behaviorData = await db
        .select()
        .from(behaviorTrendsTable)
        .where(and(eq(behaviorTrendsTable.patientId, patient.id), gte(behaviorTrendsTable.recordDate, thirtyDaysAgo)))
        .orderBy(desc(behaviorTrendsTable.recordDate));

      await db
        .update(predictiveRiskScoresTable)
        .set({ isActive: false })
        .where(eq(predictiveRiskScoresTable.patientId, patient.id));

      // Incident escalation risk
      const incidentScore = calculateIncidentRisk(incidents);
      if (incidentScore.score > 0) {
        const [saved] = await db.insert(predictiveRiskScoresTable).values({
          patientId: patient.id,
          riskType: "incident_escalation",
          score: incidentScore.score.toFixed(2),
          severity: incidentScore.severity,
          factors: incidentScore.factors,
          recommendation: incidentScore.recommendation,
          dataPoints: incidents.length,
          isActive: true,
        }).returning();
        results.push(saved);
      }

      // Medication non-adherence risk
      const medScore = calculateMedRisk(recentAdmins, refusals);
      if (medScore.score > 0) {
        const [saved] = await db.insert(predictiveRiskScoresTable).values({
          patientId: patient.id,
          riskType: "medication_nonadherence",
          score: medScore.score.toFixed(2),
          severity: medScore.severity,
          factors: medScore.factors,
          recommendation: medScore.recommendation,
          dataPoints: recentAdmins.length + refusals.length,
          isActive: true,
        }).returning();
        results.push(saved);
      }

      // Behavioral decline risk
      const behaviorScore = calculateBehaviorRisk(behaviorData);
      if (behaviorScore.score > 0) {
        const [saved] = await db.insert(predictiveRiskScoresTable).values({
          patientId: patient.id,
          riskType: "behavioral_decline",
          score: behaviorScore.score.toFixed(2),
          severity: behaviorScore.severity,
          factors: behaviorScore.factors,
          recommendation: behaviorScore.recommendation,
          dataPoints: behaviorData.length,
          isActive: true,
        }).returning();
        results.push(saved);
      }
    }

    res.json({ patientsAnalyzed: patients.length, risksIdentified: results.length, risks: results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/predictive/risk-scores/:id/acknowledge", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid risk score ID" });

    const [updated] = await db
      .update(predictiveRiskScoresTable)
      .set({ acknowledgedBy: req.userId, acknowledgedAt: new Date() })
      .where(eq(predictiveRiskScoresTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Risk score not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── PREDICTIVE DASHBOARD ──

router.get("/predictive/dashboard", requireAuth, async (_req, res) => {
  try {
    const activeRisks = await db
      .select({
        severity: predictiveRiskScoresTable.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(predictiveRiskScoresTable)
      .where(eq(predictiveRiskScoresTable.isActive, true))
      .groupBy(predictiveRiskScoresTable.severity);

    const risksByType = await db
      .select({
        riskType: predictiveRiskScoresTable.riskType,
        count: sql<number>`count(*)::int`,
        avgScore: sql<number>`AVG(${predictiveRiskScoresTable.score}::float)::float`,
      })
      .from(predictiveRiskScoresTable)
      .where(eq(predictiveRiskScoresTable.isActive, true))
      .groupBy(predictiveRiskScoresTable.riskType);

    const highRiskPatients = await db
      .select({
        patientId: predictiveRiskScoresTable.patientId,
        patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
        maxScore: sql<number>`MAX(${predictiveRiskScoresTable.score}::float)::float`,
        riskCount: sql<number>`count(*)::int`,
      })
      .from(predictiveRiskScoresTable)
      .leftJoin(patientsTable, eq(predictiveRiskScoresTable.patientId, patientsTable.id))
      .where(and(
        eq(predictiveRiskScoresTable.isActive, true),
        sql`${predictiveRiskScoresTable.score}::float >= 60`
      ))
      .groupBy(predictiveRiskScoresTable.patientId, patientsTable.firstName, patientsTable.lastName)
      .orderBy(desc(sql`MAX(${predictiveRiskScoresTable.score}::float)`));

    const severityMap: Record<string, number> = {};
    for (const r of activeRisks) severityMap[r.severity] = r.count;

    res.json({
      totalActiveRisks: activeRisks.reduce((sum, r) => sum + r.count, 0),
      critical: severityMap["critical"] || 0,
      high: severityMap["high"] || 0,
      moderate: severityMap["moderate"] || 0,
      low: severityMap["low"] || 0,
      risksByType,
      highRiskPatients,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── RISK CALCULATION FUNCTIONS ──

function calculateIncidentRisk(incidents: any[]) {
  if (incidents.length === 0) return { score: 0, severity: "low", factors: "", recommendation: "" };

  let score = 0;
  const factors: string[] = [];

  score += Math.min(incidents.length * 15, 50);
  if (incidents.length >= 3) factors.push(`${incidents.length} incidents in 30 days`);
  if (incidents.length >= 1) factors.push(`Recent incident activity detected`);

  const severeCounts = incidents.filter((i) => i.severity === "critical" || i.severity === "high").length;
  if (severeCounts > 0) {
    score += severeCounts * 20;
    factors.push(`${severeCounts} high/critical severity incidents`);
  }

  const recentIncidents = incidents.filter((i) => {
    const daysSince = (Date.now() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  });
  if (recentIncidents.length >= 2) {
    score += 20;
    factors.push(`${recentIncidents.length} incidents in last 7 days (accelerating pattern)`);
  }

  score = Math.min(score, 100);
  const severity = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 40 ? "moderate" : "low";

  let recommendation = "";
  if (score >= 80) recommendation = "Immediate clinical review required. Consider care plan revision and increased observation.";
  else if (score >= 60) recommendation = "Schedule care team meeting. Review triggers and update behavioral intervention plan.";
  else if (score >= 40) recommendation = "Monitor closely. Document all incidents and review for emerging patterns.";
  else recommendation = "Continue standard monitoring protocols.";

  return { score, severity, factors: factors.join("; "), recommendation };
}

function calculateMedRisk(admins: any[], refusals: any[]) {
  if (admins.length === 0 && refusals.length === 0) return { score: 0, severity: "low", factors: "", recommendation: "" };

  let score = 0;
  const factors: string[] = [];

  const totalDoses = admins.length;
  const givenDoses = admins.filter((a) => a.status === "given").length;
  const missedDoses = admins.filter((a) => a.status === "missed").length;

  if (totalDoses > 0) {
    const adherenceRate = (givenDoses / totalDoses) * 100;
    if (adherenceRate < 80) {
      score += Math.round((100 - adherenceRate) * 0.8);
      factors.push(`Medication adherence at ${adherenceRate.toFixed(0)}% (${givenDoses}/${totalDoses} doses)`);
    }
  }

  if (refusals.length > 0) {
    score += Math.min(refusals.length * 10, 40);
    factors.push(`${refusals.length} medication refusals in 30 days`);
  }

  if (missedDoses > 0) {
    score += Math.min(missedDoses * 5, 25);
    factors.push(`${missedDoses} missed doses recorded`);
  }

  const recentRefusals = refusals.filter((r) => {
    const daysSince = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  });
  if (recentRefusals.length >= 3) {
    score += 15;
    factors.push(`${recentRefusals.length} refusals in last 7 days (escalating)`);
  }

  score = Math.min(score, 100);
  const severity = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 40 ? "moderate" : "low";

  let recommendation = "";
  if (score >= 80) recommendation = "Critical non-adherence. Contact prescriber immediately. Assess for adverse effects or patient concerns.";
  else if (score >= 60) recommendation = "Schedule medication review with prescriber. Explore barriers to adherence with patient.";
  else if (score >= 40) recommendation = "Monitor refusal patterns. Consider medication education session with patient.";
  else recommendation = "Continue standard medication monitoring.";

  return { score, severity, factors: factors.join("; "), recommendation };
}

function calculateBehaviorRisk(behaviorData: any[]) {
  if (behaviorData.length < 3) return { score: 0, severity: "low", factors: "", recommendation: "" };

  let score = 0;
  const factors: string[] = [];

  const recentWeek = behaviorData.filter((b) => {
    const daysSince = (Date.now() - new Date(b.recordDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  });
  const olderWeek = behaviorData.filter((b) => {
    const daysSince = (Date.now() - new Date(b.recordDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 7 && daysSince <= 14;
  });

  if (recentWeek.length > 0 && olderWeek.length > 0) {
    const recentMood = avg(recentWeek.map((b) => b.moodScore).filter(Boolean));
    const olderMood = avg(olderWeek.map((b) => b.moodScore).filter(Boolean));
    if (recentMood && olderMood && recentMood < olderMood - 1.5) {
      score += 25;
      factors.push(`Mood declining: ${olderMood.toFixed(1)} → ${recentMood.toFixed(1)}`);
    }

    const recentAgitation = avg(recentWeek.map((b) => b.agitationLevel).filter(Boolean));
    const olderAgitation = avg(olderWeek.map((b) => b.agitationLevel).filter(Boolean));
    if (recentAgitation && olderAgitation && recentAgitation > olderAgitation + 1.5) {
      score += 25;
      factors.push(`Agitation increasing: ${olderAgitation.toFixed(1)} → ${recentAgitation.toFixed(1)}`);
    }

    const recentSleep = avg(recentWeek.map((b) => b.sleepQuality).filter(Boolean));
    const olderSleep = avg(olderWeek.map((b) => b.sleepQuality).filter(Boolean));
    if (recentSleep && olderSleep && recentSleep < olderSleep - 2) {
      score += 20;
      factors.push(`Sleep quality declining: ${olderSleep.toFixed(1)} → ${recentSleep.toFixed(1)}`);
    }

    const recentAnxiety = avg(recentWeek.map((b) => b.anxietyLevel).filter(Boolean));
    if (recentAnxiety && recentAnxiety >= 7) {
      score += 15;
      factors.push(`High anxiety levels: avg ${recentAnxiety.toFixed(1)}/10`);
    }

    const recentSocial = avg(recentWeek.map((b) => b.socialEngagement).filter(Boolean));
    if (recentSocial && recentSocial <= 3) {
      score += 15;
      factors.push(`Low social engagement: avg ${recentSocial.toFixed(1)}/10`);
    }
  }

  if (score === 0 && behaviorData.length > 0) {
    const allMoods = behaviorData.map((b) => b.moodScore).filter(Boolean);
    const avgMood = avg(allMoods);
    if (avgMood && avgMood <= 4) {
      score = 30;
      factors.push(`Persistently low mood: avg ${avgMood.toFixed(1)}/10`);
    }
  }

  score = Math.min(score, 100);
  const severity = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 40 ? "moderate" : "low";

  let recommendation = "";
  if (score >= 80) recommendation = "Significant behavioral decline detected. Initiate crisis prevention protocol and contact treatment team.";
  else if (score >= 60) recommendation = "Behavioral concerns escalating. Schedule clinical review and update behavioral support plan.";
  else if (score >= 40) recommendation = "Emerging behavioral patterns detected. Increase observation frequency and document triggers.";
  else recommendation = "Continue routine behavioral monitoring.";

  return { score, severity, factors: factors.join("; "), recommendation };
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export default router;
