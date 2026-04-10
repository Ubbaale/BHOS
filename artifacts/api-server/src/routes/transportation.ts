import { Router } from "express";
import { db } from "@workspace/db";
import { vehiclesTable, driversTable, transportRequestsTable, staffTable, patientsTable } from "@workspace/db";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router = Router();

router.get("/transportation/vehicles", requireAuth, async (req, res) => {
  try {
    const { homeId, status } = req.query;
    const conditions: any[] = [];
    if (homeId) conditions.push(eq(vehiclesTable.homeId, Number(homeId)));
    if (status) conditions.push(eq(vehiclesTable.status, String(status)));

    const vehicles = await db
      .select()
      .from(vehiclesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(vehiclesTable.name);

    res.json(vehicles);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/transportation/vehicles", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { name, type, make, model, year, licensePlate, vin, capacity, adaAccessible, homeId, insuranceExpiry, inspectionExpiry, mileage, notes } = req.body;
    if (!name || !licensePlate) return res.status(400).json({ error: "name and licensePlate are required" });

    const [vehicle] = await db.insert(vehiclesTable).values({
      name, type: type || "sedan", make, model, year, licensePlate, vin,
      capacity: capacity || 4, adaAccessible: adaAccessible || false,
      homeId: homeId || null,
      insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
      inspectionExpiry: inspectionExpiry ? new Date(inspectionExpiry) : null,
      mileage, notes,
    }).returning();

    res.status(201).json(vehicle);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/transportation/vehicles/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const updates: any = {};
    const allowed = ["name", "type", "make", "model", "year", "licensePlate", "vin", "capacity", "adaAccessible", "homeId", "status", "insuranceExpiry", "inspectionExpiry", "mileage", "notes"];
    for (const f of allowed) {
      if (req.body[f] !== undefined) {
        if (f === "insuranceExpiry" || f === "inspectionExpiry") {
          updates[f] = req.body[f] ? new Date(req.body[f]) : null;
        } else {
          updates[f] = req.body[f];
        }
      }
    }

    const [updated] = await db.update(vehiclesTable).set(updates).where(eq(vehiclesTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Vehicle not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/transportation/drivers", requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const conditions: any[] = [];
    if (status) conditions.push(eq(driversTable.status, String(status)));

    const drivers = await db
      .select()
      .from(driversTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(driversTable.createdAt);

    const enriched = await Promise.all(
      drivers.map(async (d) => {
        const [staff] = await db.select({ firstName: staffTable.firstName, lastName: staffTable.lastName, role: staffTable.role }).from(staffTable).where(eq(staffTable.id, d.staffId));
        let vehicle = null;
        if (d.vehicleId) {
          const [v] = await db.select({ name: vehiclesTable.name, licensePlate: vehiclesTable.licensePlate }).from(vehiclesTable).where(eq(vehiclesTable.id, d.vehicleId));
          vehicle = v || null;
        }
        return { ...d, staffName: staff ? `${staff.firstName} ${staff.lastName}` : "Unknown", staffRole: staff?.role, vehicle };
      })
    );

    res.json(enriched);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/transportation/drivers", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const { staffId, licenseNumber, licenseState, licenseExpiry, licenseType, vehicleId, certifications } = req.body;
    if (!staffId || !licenseNumber || !licenseExpiry) return res.status(400).json({ error: "staffId, licenseNumber, and licenseExpiry are required" });

    const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId));
    if (!staff) return res.status(404).json({ error: "Staff not found" });

    const [driver] = await db.insert(driversTable).values({
      staffId, licenseNumber, licenseState, licenseExpiry: new Date(licenseExpiry),
      licenseType: licenseType || "standard", vehicleId: vehicleId || null,
      certifications,
    }).returning();

    res.status(201).json(driver);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/transportation/drivers/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const updates: any = {};
    const allowed = ["licenseNumber", "licenseState", "licenseExpiry", "licenseType", "vehicleId", "status", "certifications"];
    for (const f of allowed) {
      if (req.body[f] !== undefined) {
        if (f === "licenseExpiry") updates[f] = new Date(req.body[f]);
        else updates[f] = req.body[f];
      }
    }

    const [updated] = await db.update(driversTable).set(updates).where(eq(driversTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Driver not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/transportation/requests", requireAuth, async (req, res) => {
  try {
    const { homeId, status, date, patientId } = req.query;
    const conditions: any[] = [];
    if (homeId) conditions.push(eq(transportRequestsTable.homeId, Number(homeId)));
    if (status) conditions.push(eq(transportRequestsTable.status, String(status)));
    if (patientId) conditions.push(eq(transportRequestsTable.patientId, Number(patientId)));
    if (date) {
      const d = new Date(String(date));
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      conditions.push(gte(transportRequestsTable.pickupTime, d));
      conditions.push(lte(transportRequestsTable.pickupTime, next));
    }

    const requests = await db
      .select()
      .from(transportRequestsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(transportRequestsTable.pickupTime);

    res.json(requests);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/transportation/requests/today", requireAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const requests = await db
      .select()
      .from(transportRequestsTable)
      .where(and(gte(transportRequestsTable.pickupTime, today), lte(transportRequestsTable.pickupTime, tomorrow)))
      .orderBy(transportRequestsTable.pickupTime);

    res.json(requests);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/transportation/requests", requireAuth, requireRole("admin", "manager", "nurse"), async (req, res) => {
  try {
    const { patientId, appointmentId, homeId, transportType, pickupTime, returnTime, pickupLocation, dropoffLocation, driverId, vehicleId, priority, passengerCount, wheelchairRequired, specialNeeds, externalProvider, estimatedCost, notes } = req.body;

    if (!patientId || !pickupTime || !pickupLocation || !dropoffLocation) {
      return res.status(400).json({ error: "patientId, pickupTime, pickupLocation, and dropoffLocation are required" });
    }

    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    if (driverId) {
      const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, driverId));
      if (!driver) return res.status(404).json({ error: "Driver not found" });
    }

    const [request] = await db.insert(transportRequestsTable).values({
      patientId, appointmentId: appointmentId || null,
      homeId: homeId || patient.homeId,
      transportType: transportType || "company",
      pickupTime: new Date(pickupTime),
      returnTime: returnTime ? new Date(returnTime) : null,
      pickupLocation, dropoffLocation,
      driverId: driverId || null, vehicleId: vehicleId || null,
      status: driverId ? "assigned" : "requested",
      priority: priority || "normal",
      passengerCount: passengerCount || 1,
      wheelchairRequired: wheelchairRequired || false,
      specialNeeds, externalProvider, estimatedCost, notes,
      requestedBy: req.userId,
    }).returning();

    res.status(201).json(request);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/transportation/requests/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const updates: any = {};
    const allowed = ["transportType", "pickupTime", "returnTime", "pickupLocation", "dropoffLocation", "driverId", "vehicleId", "status", "priority", "passengerCount", "wheelchairRequired", "specialNeeds", "externalProvider", "externalConfirmation", "estimatedCost", "actualCost", "notes"];
    for (const f of allowed) {
      if (req.body[f] !== undefined) {
        if (f === "pickupTime" || f === "returnTime") {
          updates[f] = req.body[f] ? new Date(req.body[f]) : null;
        } else {
          updates[f] = req.body[f];
        }
      }
    }

    if (updates.status === "completed") updates.completedAt = new Date();
    if (updates.driverId && !updates.status) updates.status = "assigned";

    const [updated] = await db.update(transportRequestsTable).set(updates).where(eq(transportRequestsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Request not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/transportation/requests/:id/dispatch", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const { driverId, vehicleId } = req.body;
    if (!driverId) return res.status(400).json({ error: "driverId is required" });

    const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, driverId));
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    const [updated] = await db.update(transportRequestsTable).set({
      driverId, vehicleId: vehicleId || driver.vehicleId, status: "dispatched",
    }).where(eq(transportRequestsTable.id, id)).returning();

    if (!updated) return res.status(404).json({ error: "Request not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/transportation/dashboard", requireAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [vehicleCount] = await db.select({ count: count() }).from(vehiclesTable).where(eq(vehiclesTable.status, "available"));
    const [driverCount] = await db.select({ count: count() }).from(driversTable).where(eq(driversTable.status, "active"));
    const [todayRequests] = await db.select({ count: count() }).from(transportRequestsTable).where(and(gte(transportRequestsTable.pickupTime, today), lte(transportRequestsTable.pickupTime, tomorrow)));
    const [pendingRequests] = await db.select({ count: count() }).from(transportRequestsTable).where(eq(transportRequestsTable.status, "requested"));

    res.json({
      availableVehicles: vehicleCount?.count || 0,
      activeDrivers: driverCount?.count || 0,
      todayTrips: todayRequests?.count || 0,
      pendingRequests: pendingRequests?.count || 0,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
