import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router: IRouter = Router();

router.get("/search", async (req, res): Promise<void> => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) {
      res.json({ patients: [], staff: [], medications: [], incidents: [], homes: [] });
      return;
    }

    const term = `%${q}%`;

    const [patients, staff, medications, incidents, homes] = await Promise.all([
      db.execute(sql`
        SELECT p.id, p.first_name AS "firstName", p.last_name AS "lastName",
               p.date_of_birth AS "dateOfBirth", p.status, h.name AS "homeName"
        FROM patients p
        LEFT JOIN homes h ON p.home_id = h.id
        WHERE (p.first_name ILIKE ${term} OR p.last_name ILIKE ${term}
               OR CONCAT(p.first_name, ' ', p.last_name) ILIKE ${term})
        LIMIT 10
      `),
      db.execute(sql`
        SELECT s.id, s.first_name AS "firstName", s.last_name AS "lastName",
               s.email, s.role, s.status
        FROM staff s
        WHERE (s.first_name ILIKE ${term} OR s.last_name ILIKE ${term}
               OR s.email ILIKE ${term}
               OR CONCAT(s.first_name, ' ', s.last_name) ILIKE ${term})
        LIMIT 10
      `),
      db.execute(sql`
        SELECT m.id, m.name, m.dosage, m.frequency,
               CASE WHEN m.active THEN 'active' ELSE 'inactive' END AS status,
               p.first_name AS "patientFirstName", p.last_name AS "patientLastName"
        FROM medications m
        LEFT JOIN patients p ON m.patient_id = p.id
        WHERE (m.name ILIKE ${term} OR m.dosage ILIKE ${term})
        LIMIT 10
      `),
      db.execute(sql`
        SELECT i.id, i.title, i.category AS type, i.severity, i.status, i.created_at AS "createdAt",
               h.name AS "homeName"
        FROM incidents i
        LEFT JOIN homes h ON i.home_id = h.id
        WHERE (i.title ILIKE ${term} OR i.category ILIKE ${term} OR i.description ILIKE ${term})
        LIMIT 10
      `),
      db.execute(sql`
        SELECT h.id, h.name, h.address, h.city, h.state, h.status, h.capacity,
               h.current_occupancy AS "currentOccupancy"
        FROM homes h
        WHERE (h.name ILIKE ${term} OR h.address ILIKE ${term}
               OR h.city ILIKE ${term} OR h.state ILIKE ${term})
        LIMIT 10
      `),
    ]);

    res.json({
      patients: patients.rows,
      staff: staff.rows,
      medications: medications.rows,
      incidents: incidents.rows,
      homes: homes.rows,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
