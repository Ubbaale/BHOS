import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertJobSchema, insertTicketSchema, insertRideSchema, insertDriverProfileSchema, rideStatuses, insertPushSubscriptionSchema } from "@shared/schema";
import { z } from "zod";
import { sendIssueNotification, FileAttachment } from "./email";
import { saveSubscription, removeSubscription, getVapidPublicKey, notifyDriversOfNewRide, notifyPatientOfRideUpdate } from "./push";
import multer from "multer";
import path from "path";

const FIELDHCP_API_URL = "https://admin.carehubapp.com/APIs/Employer/JobSearch";
const FIELDHCP_AUTH_TOKEN = process.env.FIELDHCP_AUTH_TOKEN || "";
const FIELDHCP_USERNAME = process.env.FIELDHCP_USERNAME || "";
const FIELDHCP_PASSWORD = process.env.FIELDHCP_PASSWORD || "";
const getFieldHcpBasicAuth = () => Buffer.from(`${FIELDHCP_USERNAME}:${FIELDHCP_PASSWORD}`).toString("base64");

const clients: Set<WebSocket> = new Set();
const rideClients: Set<WebSocket> = new Set();

function broadcastJobUpdate(type: "add" | "remove" | "update", job: any) {
  const message = JSON.stringify({ type, job });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastRideUpdate(type: "new" | "update" | "status_change", ride: any) {
  const message = JSON.stringify({ type, ride });
  rideClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, and PDF files are allowed.'));
    }
  }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/jobs" });
  
  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log("WebSocket client connected");
    
    ws.on("close", () => {
      clients.delete(ws);
      console.log("WebSocket client disconnected");
    });
  });
  
  app.get("/api/jobs", async (_req, res) => {
    try {
      const jobs = await storage.getAvailableJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  app.post("/api/external-jobs", async (req, res) => {
    try {
      const { latitude = 39.8283, longitude = -98.5795, pageSize = 100 } = req.body;
      
      const basicAuth = getFieldHcpBasicAuth();
      console.log("Calling FieldHCP API...");
      
      const response = await fetch(FIELDHCP_API_URL, {
        method: "POST",
        headers: {
          "accept": "*/*",
          "Authorization": `Basic ${basicAuth}`,
          "content-type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          currentPage: 1,
          pageSize: pageSize,
          Saved: false,
          filters: {
            SubcategoryIDs: null,
            HourlyRates: null,
            SearchString: null,
            RadiusKm: null,
            Latitude: latitude,
            Longitude: longitude
          }
        })
      });

      const data = await response.json();
      
      if (data.Code === "401") {
        console.error("FieldHCP Auth failed:", data.Status);
        return res.status(401).json({ message: data.Status });
      }

      console.log(`FieldHCP API returned ${data.Body?.TotalRecords || 0} jobs`);
      res.json(data);
    } catch (error) {
      console.error("Error fetching external jobs:", error);
      res.status(500).json({ message: "Failed to fetch external jobs", error: String(error) });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  app.post("/api/jobs", async (req, res) => {
    try {
      const parsed = insertJobSchema.parse(req.body);
      const job = await storage.createJob(parsed);
      broadcastJobUpdate("add", job);
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid job data", errors: error.errors });
      }
      console.error("Error creating job:", error);
      res.status(500).json({ message: "Failed to create job" });
    }
  });

  app.patch("/api/jobs/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status || !["available", "filled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'available' or 'filled'" });
      }
      
      const job = await storage.updateJobStatus(id, status);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      if (status === "filled") {
        broadcastJobUpdate("remove", job);
      } else {
        broadcastJobUpdate("add", job);
      }
      
      res.json(job);
    } catch (error) {
      console.error("Error updating job status:", error);
      res.status(500).json({ message: "Failed to update job status" });
    }
  });

  app.get("/api/tickets", async (_req, res) => {
    try {
      const tickets = await storage.getAllTickets();
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.post("/api/tickets", upload.single('attachment'), async (req, res) => {
    try {
      const parsed = insertTicketSchema.parse(req.body);
      const ticketId = "CH" + Math.random().toString(36).substring(2, 7).toUpperCase();
      const ticket = await storage.createTicket({ ...parsed, id: ticketId });
      
      let attachment: FileAttachment | undefined;
      if (req.file) {
        attachment = {
          content: req.file.buffer.toString('base64'),
          filename: path.basename(req.file.originalname),
          type: req.file.mimetype,
          disposition: 'attachment'
        };
      }
      
      sendIssueNotification({
        ticketId: ticketId,
        category: parsed.category,
        priority: parsed.priority,
        description: parsed.description,
        email: parsed.email
      }, attachment);
      
      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid ticket data", errors: error.errors });
      }
      console.error("Error creating ticket:", error);
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  const rideWss = new WebSocketServer({ server: httpServer, path: "/ws/rides" });
  
  rideWss.on("connection", (ws) => {
    rideClients.add(ws);
    console.log("Ride WebSocket client connected");
    
    ws.on("close", () => {
      rideClients.delete(ws);
      console.log("Ride WebSocket client disconnected");
    });
  });

  app.get("/api/rides", async (_req, res) => {
    try {
      const rides = await storage.getActiveRides();
      res.json(rides);
    } catch (error) {
      console.error("Error fetching rides:", error);
      res.status(500).json({ message: "Failed to fetch rides" });
    }
  });

  app.get("/api/rides/all", async (_req, res) => {
    try {
      const rides = await storage.getAllRides();
      res.json(rides);
    } catch (error) {
      console.error("Error fetching all rides:", error);
      res.status(500).json({ message: "Failed to fetch rides" });
    }
  });

  app.get("/api/rides/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ride = await storage.getRide(id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      res.json(ride);
    } catch (error) {
      console.error("Error fetching ride:", error);
      res.status(500).json({ message: "Failed to fetch ride" });
    }
  });

  app.post("/api/rides", async (req, res) => {
    try {
      const parsed = insertRideSchema.parse(req.body);
      const ride = await storage.createRide(parsed);
      
      await storage.createRideEvent({
        rideId: ride.id,
        status: "requested",
        note: "Ride requested by patient"
      });
      
      broadcastRideUpdate("new", ride);
      
      notifyDriversOfNewRide(ride.pickupAddress, ride.appointmentTime).catch(err => {
        console.error("Failed to send push notification:", err);
      });
      
      res.status(201).json(ride);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid ride data", errors: error.errors });
      }
      console.error("Error creating ride:", error);
      res.status(500).json({ message: "Failed to create ride" });
    }
  });

  app.patch("/api/rides/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, note } = req.body;
      
      if (!status || !rideStatuses.includes(status)) {
        return res.status(400).json({ 
          message: `Invalid status. Must be one of: ${rideStatuses.join(", ")}` 
        });
      }
      
      const ride = await storage.updateRideStatus(id, status);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      await storage.createRideEvent({
        rideId: id,
        status,
        note: note || `Status changed to ${status}`
      });
      
      broadcastRideUpdate("status_change", ride);
      
      notifyPatientOfRideUpdate(status).catch(err => {
        console.error("Failed to send push notification:", err);
      });
      
      res.json(ride);
    } catch (error) {
      console.error("Error updating ride status:", error);
      res.status(500).json({ message: "Failed to update ride status" });
    }
  });

  app.post("/api/rides/:id/accept", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { driverId } = req.body;
      
      if (!driverId) {
        return res.status(400).json({ message: "Driver ID is required" });
      }
      
      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      const ride = await storage.assignDriver(rideId, driverId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      await storage.createRideEvent({
        rideId,
        status: "accepted",
        note: `Accepted by driver: ${driver.fullName}`
      });
      
      broadcastRideUpdate("status_change", ride);
      
      notifyPatientOfRideUpdate("accepted", driver.fullName).catch(err => {
        console.error("Failed to send push notification:", err);
      });
      
      res.json(ride);
    } catch (error) {
      console.error("Error accepting ride:", error);
      res.status(500).json({ message: "Failed to accept ride" });
    }
  });

  app.get("/api/rides/:id/events", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const events = await storage.getRideEvents(rideId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching ride events:", error);
      res.status(500).json({ message: "Failed to fetch ride events" });
    }
  });

  app.get("/api/drivers", async (_req, res) => {
    try {
      const drivers = await storage.getAvailableDrivers();
      res.json(drivers);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      res.status(500).json({ message: "Failed to fetch drivers" });
    }
  });

  app.get("/api/drivers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const driver = await storage.getDriver(id);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      console.error("Error fetching driver:", error);
      res.status(500).json({ message: "Failed to fetch driver" });
    }
  });

  app.post("/api/drivers", async (req, res) => {
    try {
      const parsed = insertDriverProfileSchema.parse(req.body);
      const driver = await storage.createDriver(parsed);
      res.status(201).json(driver);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid driver data", errors: error.errors });
      }
      console.error("Error creating driver:", error);
      res.status(500).json({ message: "Failed to create driver" });
    }
  });

  app.patch("/api/drivers/:id/availability", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isAvailable } = req.body;
      
      if (typeof isAvailable !== "boolean") {
        return res.status(400).json({ message: "isAvailable must be a boolean" });
      }
      
      const driver = await storage.updateDriverAvailability(id, isAvailable);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      res.json(driver);
    } catch (error) {
      console.error("Error updating driver availability:", error);
      res.status(500).json({ message: "Failed to update driver availability" });
    }
  });

  app.get("/api/push/vapid-public-key", (_req, res) => {
    res.json({ publicKey: getVapidPublicKey() });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { subscription, userType, driverId } = req.body;
      
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ message: "Invalid subscription data" });
      }
      
      await saveSubscription(
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth,
        userType || "user",
        driverId
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving push subscription:", error);
      res.status(500).json({ message: "Failed to save subscription" });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      
      if (!endpoint) {
        return res.status(400).json({ message: "Endpoint is required" });
      }
      
      await removeSubscription(endpoint);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing push subscription:", error);
      res.status(500).json({ message: "Failed to remove subscription" });
    }
  });

  return httpServer;
}
