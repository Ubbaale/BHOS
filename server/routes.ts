import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertJobSchema, insertTicketSchema, insertRideSchema, insertDriverProfileSchema, rideStatuses, insertPushSubscriptionSchema, insertRideMessageSchema, insertTripShareSchema } from "@shared/schema";
import { z } from "zod";
import { sendIssueNotification, FileAttachment } from "./email";
import { saveSubscription, removeSubscription, getVapidPublicKey, notifyDriversOfNewRide, notifyPatientOfRideUpdate } from "./push";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

const FIELDHCP_API_URL = "https://admin.carehubapp.com/APIs/Employer/JobSearch";
const FIELDHCP_AUTH_TOKEN = process.env.FIELDHCP_AUTH_TOKEN || "";
const FIELDHCP_USERNAME = process.env.FIELDHCP_USERNAME || "";
const FIELDHCP_PASSWORD = process.env.FIELDHCP_PASSWORD || "";
const getFieldHcpBasicAuth = () => Buffer.from(`${FIELDHCP_USERNAME}:${FIELDHCP_PASSWORD}`).toString("base64");

const clients: Set<WebSocket> = new Set();
const rideClients: Set<WebSocket> = new Set();
const chatClients: Map<number, Set<WebSocket>> = new Map();

function broadcastJobUpdate(type: "add" | "remove" | "update", job: any) {
  const message = JSON.stringify({ type, job });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastRideUpdate(type: "new" | "update" | "status_change" | "driver_location", ride: any) {
  const message = JSON.stringify({ type, ride });
  rideClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function broadcastChatMessage(rideId: number, message: any) {
  const clients = chatClients.get(rideId);
  if (clients) {
    const messageStr = JSON.stringify({ type: "chat", message });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
}

function generateVerificationCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function generateShareCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateTrackingToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

function hashTrackingToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function validateTrackingToken(providedToken: string, storedHash: string): boolean {
  const providedHash = hashTrackingToken(providedToken);
  return crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(storedHash));
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

  // Authentication middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  // Rate limiting for tracking token validation (simple in-memory, per IP + ride)
  const tokenAttempts: Map<string, { count: number; resetAt: number }> = new Map();
  const MAX_TOKEN_ATTEMPTS = 10;
  const TOKEN_RATE_LIMIT_WINDOW = 60000; // 1 minute

  const requireTrackingToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rideId = parseInt(req.params.id);
      const token = req.query.token as string;
      
      if (!rideId || isNaN(rideId)) {
        return res.status(400).json({ message: "Invalid ride ID" });
      }
      
      if (!token) {
        return res.status(401).json({ message: "Access token required" });
      }
      
      // Rate limiting check
      const rateLimitKey = `${req.ip}-${rideId}`;
      const now = Date.now();
      const attempts = tokenAttempts.get(rateLimitKey);
      
      if (attempts) {
        if (now < attempts.resetAt) {
          if (attempts.count >= MAX_TOKEN_ATTEMPTS) {
            return res.status(429).json({ message: "Too many attempts. Please try again later." });
          }
          attempts.count++;
        } else {
          tokenAttempts.set(rateLimitKey, { count: 1, resetAt: now + TOKEN_RATE_LIMIT_WINDOW });
        }
      } else {
        tokenAttempts.set(rateLimitKey, { count: 1, resetAt: now + TOKEN_RATE_LIMIT_WINDOW });
      }
      
      const ride = await storage.getRide(rideId);
      
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      // Check if ride is in a terminal state (token should be expired)
      if (ride.status === "completed" || ride.status === "cancelled") {
        return res.status(403).json({ message: "This ride has ended. Access is no longer available." });
      }
      
      // Check if token exists and hasn't expired
      if (!ride.trackingToken) {
        return res.status(403).json({ message: "Access link is invalid or has expired" });
      }
      
      if (ride.trackingTokenExpiresAt && new Date(ride.trackingTokenExpiresAt) < new Date()) {
        return res.status(403).json({ message: "Access link has expired" });
      }
      
      // Validate token (constant-time comparison)
      try {
        if (!validateTrackingToken(token, ride.trackingToken)) {
          return res.status(403).json({ message: "Invalid access token" });
        }
      } catch (e) {
        return res.status(403).json({ message: "Invalid access token" });
      }
      
      // Clear rate limit on success
      tokenAttempts.delete(rateLimitKey);
      
      // Attach ride to request for use in handler
      (req as any).ride = ride;
      next();
    } catch (error) {
      console.error("Error validating tracking token:", error);
      res.status(500).json({ message: "Failed to validate access" });
    }
  };

  const requireDriver = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (req.session.role !== "driver" && req.session.role !== "admin") {
      return res.status(403).json({ message: "Driver access required" });
    }
    next();
  };

  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (req.session.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Get driver profile if user is a driver
      let driverId: number | undefined;
      let driverProfile = null;
      if (user.role === "driver") {
        const driver = await storage.getDriverByUserId(user.id);
        if (driver) {
          driverId = driver.id;
          driverProfile = driver;
          
          // Check if driver is approved and KYC verified
          if (driver.applicationStatus !== "approved") {
            return res.status(403).json({ 
              message: "Your driver application is pending approval",
              applicationStatus: driver.applicationStatus 
            });
          }
          if (driver.kycStatus !== "approved") {
            return res.status(403).json({ 
              message: "Please complete KYC verification",
              kycStatus: driver.kycStatus,
              redirectTo: "/driver/kyc"
            });
          }
        }
      }

      // Set session data
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role || "user";
      if (driverId) {
        req.session.driverId = driverId;
      }

      res.json({ 
        message: "Login successful",
        user: { 
          id: user.id, 
          username: user.username, 
          role: user.role 
        },
        driver: driverProfile ? {
          id: driverProfile.id,
          fullName: driverProfile.fullName,
          applicationStatus: driverProfile.applicationStatus,
          kycStatus: driverProfile.kycStatus
        } : null
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUserByUsername(req.session.username!);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    let driverProfile = null;
    if (req.session.driverId) {
      driverProfile = await storage.getDriver(req.session.driverId);
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      driver: driverProfile ? {
        id: driverProfile.id,
        fullName: driverProfile.fullName,
        applicationStatus: driverProfile.applicationStatus,
        kycStatus: driverProfile.kycStatus
      } : null
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

  // Protected: Only admins can view all rides (drivers use /api/rides/pool)
  app.get("/api/rides", requireAdmin, async (_req, res) => {
    try {
      const rides = await storage.getActiveRides();
      res.json(rides);
    } catch (error) {
      console.error("Error fetching rides:", error);
      res.status(500).json({ message: "Failed to fetch rides" });
    }
  });

  // Protected: Only admins can view all rides
  app.get("/api/rides/all", requireAdmin, async (_req, res) => {
    try {
      const rides = await storage.getAllRides();
      res.json(rides);
    } catch (error) {
      console.error("Error fetching all rides:", error);
      res.status(500).json({ message: "Failed to fetch rides" });
    }
  });

  // NOTE: /api/rides/abandoned must come BEFORE /api/rides/:id to avoid "abandoned" being parsed as ID
  // Protected: Only admins can view abandoned rides
  app.get("/api/rides/abandoned", requireAdmin, async (req, res) => {
    try {
      const staleMinutes = parseInt(req.query.staleMinutes as string) || 30;
      const abandonedRides = await storage.getAbandonedRides(staleMinutes);
      res.json(abandonedRides);
    } catch (error) {
      console.error("Error fetching abandoned rides:", error);
      res.status(500).json({ message: "Failed to fetch abandoned rides" });
    }
  });

  // NOTE: /api/rides/pool must come BEFORE /api/rides/:id to avoid "pool" being parsed as ID
  // Protected: Only authenticated drivers can view ride pool
  app.get("/api/rides/pool", requireDriver, async (req, res) => {
    try {
      const driverLat = parseFloat(req.query.driverLat as string);
      const driverLng = parseFloat(req.query.driverLng as string);
      
      const rides = await storage.getActiveRides();
      const requestedRides = rides.filter(r => r.status === "requested");
      
      const ridesWithDistance = requestedRides.map(ride => {
        let distanceToPickup: number | null = null;
        let estimatedMinutesToPickup: number | null = null;
        let estimatedFare: string | null = null;
        
        if (!isNaN(driverLat) && !isNaN(driverLng) && ride.pickupLat && ride.pickupLng) {
          distanceToPickup = calculateHaversineDistance(
            driverLat, driverLng,
            parseFloat(ride.pickupLat), parseFloat(ride.pickupLng)
          );
          estimatedMinutesToPickup = Math.round(distanceToPickup * 2);
        }
        
        // Calculate estimated trip fare based on pickup to dropoff distance
        if (ride.pickupLat && ride.pickupLng && ride.dropoffLat && ride.dropoffLng) {
          const tripDistance = calculateHaversineDistance(
            parseFloat(ride.pickupLat), parseFloat(ride.pickupLng),
            parseFloat(ride.dropoffLat), parseFloat(ride.dropoffLng)
          );
          // Fare formula: $20 base + $2.50/mile, $22 minimum
          const rawFare = 20 + (tripDistance * 2.50);
          const fare = Math.max(22, rawFare);
          estimatedFare = fare.toFixed(2);
        }
        
        return {
          ...ride,
          distanceToPickup: distanceToPickup?.toFixed(1),
          estimatedMinutesToPickup,
          estimatedFare
        };
      });
      
      if (!isNaN(driverLat) && !isNaN(driverLng)) {
        ridesWithDistance.sort((a, b) => {
          const distA = parseFloat(a.distanceToPickup || "999");
          const distB = parseFloat(b.distanceToPickup || "999");
          return distA - distB;
        });
      }
      
      res.json(ridesWithDistance);
    } catch (error) {
      console.error("Error fetching ride pool:", error);
      res.status(500).json({ message: "Failed to fetch ride pool" });
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
      const { isEmergency } = req.body;
      
      // Check patient account status before allowing booking
      const patientAccount = await storage.getPatientAccount(parsed.patientPhone);
      if (patientAccount) {
        const balance = parseFloat(patientAccount.outstandingBalance || "0");
        const isBlocked = patientAccount.accountStatus === "blocked" || balance >= 150;
        
        if (isBlocked && !isEmergency) {
          return res.status(403).json({ 
            message: "Account has high outstanding balance. Please contact billing or use emergency booking.",
            accountStatus: "blocked",
            outstandingBalance: balance,
            requiresEmergencyOverride: true
          });
        }
        
        // Record emergency override if used
        if (isBlocked && isEmergency) {
          await storage.recordEmergencyOverride(parsed.patientPhone);
        }
      }
      
      // Generate secure tracking token for patient access
      const { token: trackingToken, hash: trackingTokenHash } = generateTrackingToken();
      const appointmentTime = new Date(parsed.appointmentTime);
      const tokenExpiresAt = new Date(appointmentTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours after appointment
      
      const ride = await storage.createRide({
        ...parsed,
        trackingToken: trackingTokenHash,
        trackingTokenExpiresAt: tokenExpiresAt,
      });
      
      await storage.createRideEvent({
        rideId: ride.id,
        status: "requested",
        note: isEmergency ? "Emergency ride requested by patient (account override)" : "Ride requested by patient"
      });
      
      broadcastRideUpdate("new", ride);
      
      notifyDriversOfNewRide(ride.pickupAddress, ride.appointmentTime).catch(err => {
        console.error("Failed to send push notification:", err);
      });
      
      // Return the unhashed token to patient (only time they can get it)
      res.status(201).json({ 
        ...ride, 
        trackingToken, // Send unhashed token to patient
        emergencyOverrideUsed: isEmergency && patientAccount?.accountStatus === "blocked" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid ride data", errors: error.errors });
      }
      console.error("Error creating ride:", error);
      res.status(500).json({ message: "Failed to create ride" });
    }
  });

  // Protected: Only authenticated drivers can update ride status
  app.patch("/api/rides/:id/status", requireDriver, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, note } = req.body;
      
      if (!status || !rideStatuses.includes(status)) {
        return res.status(400).json({ 
          message: `Invalid status. Must be one of: ${rideStatuses.join(", ")}` 
        });
      }
      
      // If completing the ride, use the completeRide method with fare calculation
      if (status === "completed") {
        const existingRide = await storage.getRide(id);
        if (!existingRide) {
          return res.status(404).json({ message: "Ride not found" });
        }
        
        // Calculate distance using Haversine formula
        const R = 3959; // Earth's radius in miles
        const lat1 = parseFloat(existingRide.pickupLat!);
        const lon1 = parseFloat(existingRide.pickupLng!);
        const lat2 = parseFloat(existingRide.dropoffLat!);
        const lon2 = parseFloat(existingRide.dropoffLng!);
        
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c * 1.3; // Add 30% for road routing
        
        // Calculate fare: $20 base + $2.50/mile, $22 minimum
        const baseFare = 20;
        const perMile = 2.50;
        const surge = parseFloat(existingRide.surgeMultiplier || "1.0");
        const tolls = parseFloat(existingRide.actualTolls || existingRide.estimatedTolls || "0");
        const rawFare = baseFare + (distance * perMile);
        const fareWithSurge = rawFare * surge;
        const finalFare = Math.max(22, fareWithSurge + tolls);
        
        const ride = await storage.completeRide(id, finalFare.toFixed(2), tolls.toString(), distance.toFixed(2));
        
        // Expire tracking token when ride completes
        await storage.expireTrackingToken(id);
        
        await storage.createRideEvent({
          rideId: id,
          status: "completed",
          note: note || `Trip completed. Final fare: $${finalFare.toFixed(2)}`
        });
        
        // Update driver stats
        if (existingRide.driverId) {
          await storage.incrementDriverCompletedRides(existingRide.driverId);
        }
        
        broadcastRideUpdate("status_change", ride);
        
        notifyPatientOfRideUpdate(status).catch(err => {
          console.error("Failed to send push notification:", err);
        });
        
        return res.json(ride);
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

  // Protected: Only authenticated drivers can accept rides
  app.post("/api/rides/:id/accept", requireDriver, async (req, res) => {
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
      
      // Check if ride is still available (prevents race condition)
      const existingRide = await storage.getRide(rideId);
      if (!existingRide) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      if (existingRide.status !== "requested") {
        return res.status(409).json({ 
          message: "This ride has already been taken by another driver",
          currentStatus: existingRide.status
        });
      }
      
      if (existingRide.driverId) {
        return res.status(409).json({ 
          message: "This ride has already been assigned to another driver"
        });
      }
      
      const ride = await storage.assignDriver(rideId, driverId);
      if (!ride) {
        // This happens if another driver grabbed the ride between our check and the update
        return res.status(409).json({ 
          message: "This ride was just taken by another driver. Please try a different ride."
        });
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

  // Protected: Only authenticated users can view ride events
  app.get("/api/rides/:id/events", requireAuth, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const events = await storage.getRideEvents(rideId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching ride events:", error);
      res.status(500).json({ message: "Failed to fetch ride events" });
    }
  });

  // Cancel ride endpoint with healthcare-friendly policy enforcement
  app.post("/api/rides/:id/cancel", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { cancelledBy, reason, isMedicalEmergency } = req.body;
      
      if (!cancelledBy || !["patient", "driver", "facility"].includes(cancelledBy)) {
        return res.status(400).json({ message: "cancelledBy must be 'patient', 'driver', or 'facility'" });
      }

      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      if (ride.status === "completed" || ride.status === "cancelled") {
        return res.status(400).json({ message: "Cannot cancel a completed or already cancelled ride" });
      }

      // Healthcare-specific exemptions - NO fees for:
      // 1. Medical emergencies (patient hospitalized, condition worsened, etc.)
      // 2. Insurance-backed rides (insurance covers cancellations)
      // 3. Facility-authorized cancellations (medical appointment cancelled)
      // 4. Driver cancellations (driver penalized separately, not patient)
      const isInsuranceRide = ride.paymentType === "insurance";
      const isFacilityCancellation = cancelledBy === "facility";
      const isDriverCancellation = cancelledBy === "driver";
      const isExempt = isMedicalEmergency || isInsuranceRide || isFacilityCancellation || isDriverCancellation;

      let cancellationFee = 0;
      
      if (!isExempt) {
        const createdAt = new Date(ride.createdAt!);
        const now = new Date();
        const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);
        
        // Healthcare-friendly policy: 15 minutes free cancellation
        const freeMinutesAfterBooking = 15;
        // Reduced fee for medical transport: $5 max
        const baseCancellationFee = 5;
        const freeMinutesAfterDriverAssigned = 5;
        
        if (ride.driverId) {
          const acceptedEvent = await storage.getRideEvents(rideId);
          const acceptedAt = acceptedEvent.find(e => e.status === "accepted")?.createdAt;
          
          if (acceptedAt) {
            const minutesSinceAccepted = (now.getTime() - new Date(acceptedAt).getTime()) / (1000 * 60);
            if (minutesSinceAccepted > freeMinutesAfterDriverAssigned) {
              cancellationFee = baseCancellationFee;
            }
          }
        } else if (minutesSinceCreation > freeMinutesAfterBooking) {
          cancellationFee = 3; // Reduced fee when no driver assigned
        }
      }

      const cancelledRide = await storage.cancelRide(rideId, cancelledBy, reason, cancellationFee.toString());
      if (!cancelledRide) {
        return res.status(500).json({ message: "Failed to cancel ride" });
      }

      // Expire tracking token when ride is cancelled
      await storage.expireTrackingToken(rideId);

      let eventNote = `Cancelled by ${cancelledBy}`;
      if (reason) eventNote += `: ${reason}`;
      if (isMedicalEmergency) eventNote += " (Medical emergency - no fee)";
      else if (isInsuranceRide) eventNote += " (Insurance ride - no fee)";
      else if (cancellationFee > 0) eventNote += ` (Fee: $${cancellationFee})`;

      await storage.createRideEvent({
        rideId,
        status: "cancelled",
        note: eventNote
      });

      // Only charge fee to self-pay patients
      if (cancellationFee > 0 && !isInsuranceRide) {
        await storage.updatePatientAccountBalance(ride.patientPhone, cancellationFee);
      }

      // Track cancellations for reliability metrics
      if (isDriverCancellation && ride.driverId) {
        await storage.incrementDriverCancellations(ride.driverId);
      }

      broadcastRideUpdate("status_change", cancelledRide);
      
      res.json({
        ride: cancelledRide,
        cancellationFee,
        feeWaived: isExempt,
        waiverReason: isMedicalEmergency ? "Medical emergency" : 
                     isInsuranceRide ? "Insurance covers cancellation" :
                     isFacilityCancellation ? "Facility authorization" :
                     isDriverCancellation ? "Driver cancellation" : null,
        message: isExempt 
          ? "Ride cancelled. No fee applied."
          : cancellationFee > 0 
            ? `Ride cancelled. A fee of $${cancellationFee} will be charged.`
            : "Ride cancelled. No fee applied."
      });
    } catch (error) {
      console.error("Error cancelling ride:", error);
      res.status(500).json({ message: "Failed to cancel ride" });
    }
  });

  // Get current surge pricing with healthcare caps
  app.get("/api/surge-pricing", async (req, res) => {
    try {
      const paymentType = req.query.paymentType as string || "self_pay";
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hour = now.getHours();
      
      // Healthcare-specific surge caps:
      // - Insurance rides: NO surge pricing (flat rates required)
      // - Self-pay: Maximum 1.25x surge for medical transport
      const SURGE_CAP_INSURANCE = 1.0;
      const SURGE_CAP_SELF_PAY = 1.25;
      
      if (paymentType === "insurance") {
        return res.json({
          multiplier: 1.0,
          reason: null,
          message: "Insurance rides have flat-rate pricing",
          isCapped: true,
        });
      }
      
      const surgePricing = await storage.getActiveSurgePricing(dayOfWeek, hour);
      
      // Calculate demand-based surge
      const activeRides = await storage.getActiveRides();
      const requestedRides = activeRides.filter(r => r.status === "requested");
      const drivers = await storage.getAvailableDrivers();
      
      let demandMultiplier = 1.0;
      if (drivers.length > 0) {
        const ratio = requestedRides.length / drivers.length;
        if (ratio > 3) demandMultiplier = 1.25;  // Capped for healthcare
        else if (ratio > 2) demandMultiplier = 1.15;
        else if (ratio > 1) demandMultiplier = 1.10;
      } else if (requestedRides.length > 0) {
        demandMultiplier = 1.25; // Max surge even with no drivers
      }
      
      const scheduledMultiplier = surgePricing?.multiplier ? parseFloat(surgePricing.multiplier) : 1.0;
      let finalMultiplier = Math.max(scheduledMultiplier, demandMultiplier);
      
      // Apply healthcare cap
      const wasCapped = finalMultiplier > SURGE_CAP_SELF_PAY;
      finalMultiplier = Math.min(finalMultiplier, SURGE_CAP_SELF_PAY);
      
      res.json({
        multiplier: finalMultiplier,
        reason: finalMultiplier > 1 ? (demandMultiplier > scheduledMultiplier ? "High demand" : surgePricing?.reason || "Peak hours") : null,
        requestedRides: requestedRides.length,
        availableDrivers: drivers.length,
        isCapped: wasCapped,
        message: wasCapped ? "Surge capped at 1.25x for medical transport" : null,
      });
    } catch (error) {
      console.error("Error fetching surge pricing:", error);
      res.status(500).json({ message: "Failed to fetch surge pricing" });
    }
  });

  // Report traffic delay
  // Protected: Only authenticated drivers can report delays
  app.post("/api/rides/:id/delay", requireDriver, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { delayMinutes, reason, newEta } = req.body;
      
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      const updatedRide = await storage.updateRideDelay(rideId, delayMinutes, reason, newEta);
      
      await storage.createRideEvent({
        rideId,
        status: ride.status,
        note: `Delay reported: ${delayMinutes} minutes${reason ? ` (${reason})` : ""}`
      });

      broadcastRideUpdate("update", updatedRide);

      // Notify patient of delay
      notifyPatientOfRideUpdate("delay", `${delayMinutes} min delay`).catch(err => {
        console.error("Failed to send delay notification:", err);
      });
      
      res.json(updatedRide);
    } catch (error) {
      console.error("Error reporting delay:", error);
      res.status(500).json({ message: "Failed to report delay" });
    }
  });

  // Mark ride as potentially abandoned (for admin review)
  app.post("/api/rides/:id/mark-abandoned", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const ride = await storage.markRideAbandoned(rideId);
      
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      await storage.createRideEvent({
        rideId,
        status: ride.status,
        note: "Ride flagged as potentially abandoned - requires follow-up"
      });

      res.json(ride);
    } catch (error) {
      console.error("Error marking ride as abandoned:", error);
      res.status(500).json({ message: "Failed to mark ride as abandoned" });
    }
  });

  // Update actual tolls (driver confirms tolls paid)
  // Protected: Only authenticated drivers can update tolls
  app.patch("/api/rides/:id/tolls", requireDriver, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { actualTolls } = req.body;
      
      if (actualTolls === undefined || actualTolls === null) {
        return res.status(400).json({ message: "actualTolls is required" });
      }

      const ride = await storage.updateRideTolls(rideId, actualTolls.toString());
      
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      await storage.createRideEvent({
        rideId,
        status: ride.status,
        note: `Driver confirmed actual tolls: $${actualTolls}`
      });

      res.json(ride);
    } catch (error) {
      console.error("Error updating tolls:", error);
      res.status(500).json({ message: "Failed to update tolls" });
    }
  });

  // Report traffic conditions (affects surge pricing)
  // Protected: Only authenticated drivers can report traffic
  app.post("/api/rides/:id/traffic", requireDriver, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { trafficCondition, delayMinutes, delayReason } = req.body;
      
      if (!trafficCondition || !["normal", "moderate", "heavy"].includes(trafficCondition)) {
        return res.status(400).json({ message: "trafficCondition must be 'normal', 'moderate', or 'heavy'" });
      }

      const ride = await storage.updateRideTraffic(rideId, trafficCondition, delayMinutes || 0, delayReason);
      
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      await storage.createRideEvent({
        rideId,
        status: ride.status,
        note: `Traffic: ${trafficCondition}${delayMinutes ? `, ${delayMinutes} min delay` : ""}${delayReason ? ` (${delayReason})` : ""}`
      });

      broadcastRideUpdate("update", ride);

      res.json(ride);
    } catch (error) {
      console.error("Error reporting traffic:", error);
      res.status(500).json({ message: "Failed to report traffic" });
    }
  });

  // Calculate surge based on current conditions
  app.get("/api/surge/current", async (req, res) => {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hour = now.getHours();
      
      // Check for scheduled surge pricing
      const scheduledSurge = await storage.getActiveSurgePricing(dayOfWeek, hour);
      
      // Calculate demand-based surge (simple version: ratio of active rides to available drivers)
      const activeRides = await storage.getActiveRides();
      const inProgressRides = activeRides.filter(r => ["in_progress", "driver_enroute", "arrived"].includes(r.status));
      const availableDrivers = await storage.getAvailableDrivers();
      
      let demandMultiplier = 1.0;
      if (availableDrivers.length > 0) {
        const demandRatio = inProgressRides.length / availableDrivers.length;
        if (demandRatio > 2) demandMultiplier = 1.25; // Max 1.25x for healthcare
        else if (demandRatio > 1.5) demandMultiplier = 1.15;
        else if (demandRatio > 1) demandMultiplier = 1.10;
      } else if (inProgressRides.length > 0) {
        demandMultiplier = 1.25; // No drivers available, max surge
      }
      
      // Use the higher of scheduled or demand-based surge, capped at 1.25x for healthcare
      const scheduledMultiplier = scheduledSurge ? parseFloat(scheduledSurge.multiplier || "1.0") : 1.0;
      const effectiveMultiplier = Math.min(1.25, Math.max(scheduledMultiplier, demandMultiplier));
      
      res.json({
        surgeMultiplier: effectiveMultiplier.toFixed(2),
        scheduledMultiplier: scheduledMultiplier.toFixed(2),
        demandMultiplier: demandMultiplier.toFixed(2),
        activeRidesCount: inProgressRides.length,
        availableDriversCount: availableDrivers.length,
        reason: scheduledSurge?.reason || (demandMultiplier > 1 ? "high_demand" : null),
        isSurgeActive: effectiveMultiplier > 1,
        cap: "1.25x (healthcare cap)",
      });
    } catch (error) {
      console.error("Error calculating surge:", error);
      res.status(500).json({ message: "Failed to calculate surge" });
    }
  });

  // Complete ride with final fare calculation
  // Protected: Only authenticated drivers can complete rides
  app.post("/api/rides/:id/complete", requireDriver, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { actualTolls, actualDistanceMiles } = req.body;
      
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      if (ride.status !== "in_progress") {
        return res.status(400).json({ message: "Ride must be in progress to complete" });
      }

      // Calculate final fare
      const baseFare = parseFloat(ride.baseFare || "20");
      const distance = actualDistanceMiles || parseFloat(ride.distanceMiles || "0");
      const perMile = 2.50;
      const surge = parseFloat(ride.surgeMultiplier || "1");
      const tolls = actualTolls || parseFloat(ride.actualTolls || ride.estimatedTolls || "0");
      
      let finalFare = (baseFare + (distance * perMile)) * surge + tolls;
      finalFare = Math.max(finalFare, 22); // Minimum fare
      
      const completedRide = await storage.completeRide(rideId, finalFare.toFixed(2), tolls.toString(), distance.toString());
      
      await storage.createRideEvent({
        rideId,
        status: "completed",
        note: `Trip completed. Final fare: $${finalFare.toFixed(2)}`
      });

      // Update driver stats
      if (ride.driverId) {
        await storage.incrementDriverCompletedRides(ride.driverId);
      }

      broadcastRideUpdate("status_change", completedRide);
      
      res.json({
        ride: completedRide,
        fareBreakdown: {
          baseFare,
          distance,
          perMileRate: perMile,
          surgeMultiplier: surge,
          tolls,
          finalFare: finalFare.toFixed(2),
        }
      });
    } catch (error) {
      console.error("Error completing ride:", error);
      res.status(500).json({ message: "Failed to complete ride" });
    }
  });

  // Rate ride
  app.post("/api/rides/:id/rate", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { ratedBy, rating, comment } = req.body;
      
      if (!["patient", "driver"].includes(ratedBy)) {
        return res.status(400).json({ message: "ratedBy must be 'patient' or 'driver'" });
      }
      
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      const rideRating = await storage.createRideRating({ rideId, ratedBy, rating, comment });
      
      // Update driver average rating if patient rated
      if (ratedBy === "patient" && ride.driverId) {
        await storage.updateDriverRating(ride.driverId, rating);
      }
      
      res.json(rideRating);
    } catch (error) {
      console.error("Error rating ride:", error);
      res.status(500).json({ message: "Failed to rate ride" });
    }
  });

  // Get patient account status with healthcare-friendly tiered escalation
  app.get("/api/patient-account/:phone", async (req, res) => {
    try {
      const phone = req.params.phone;
      const isEmergency = req.query.isEmergency === "true";
      const account = await storage.getPatientAccount(phone);
      
      if (!account) {
        return res.json({
          accountStatus: "good_standing",
          outstandingBalance: "0",
          canBookRide: true,
          tier: "green",
        });
      }
      
      const outstandingBalance = parseFloat(account.outstandingBalance || "0");
      
      // Healthcare-friendly tiered system:
      // Green ($0-$25): Full access
      // Yellow ($25-$75): Warning shown, full access
      // Orange ($75-$150): Requires acknowledgment, can still book
      // Red ($150+): Blocked unless emergency or insurance ride
      let tier = "green";
      let canBookRide = true;
      let requiresAcknowledgment = false;
      let message = null;
      
      if (account.accountStatus === "blocked") {
        tier = "blocked";
        canBookRide = isEmergency; // Allow emergency rides even when blocked
        message = isEmergency 
          ? "Emergency booking allowed. Please contact billing to resolve account issues."
          : "Your account is suspended. Please contact support.";
      } else if (outstandingBalance >= 150) {
        tier = "red";
        canBookRide = isEmergency;
        message = isEmergency
          ? "Emergency booking allowed. Outstanding balance: $" + outstandingBalance.toFixed(2)
          : "High outstanding balance. Please contact billing or set up a payment plan.";
      } else if (outstandingBalance >= 75) {
        tier = "orange";
        canBookRide = true;
        requiresAcknowledgment = true;
        message = "Outstanding balance: $" + outstandingBalance.toFixed(2) + ". Payment plan available.";
      } else if (outstandingBalance >= 25) {
        tier = "yellow";
        canBookRide = true;
        message = "Outstanding balance: $" + outstandingBalance.toFixed(2);
      }
      
      res.json({
        ...account,
        tier,
        canBookRide,
        requiresAcknowledgment,
        message,
        paymentPlanAvailable: outstandingBalance >= 50,
        emergencyOverrideUsed: isEmergency && !canBookRide,
      });
    } catch (error) {
      console.error("Error fetching patient account:", error);
      res.status(500).json({ message: "Failed to fetch patient account" });
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

  // NOTE: /api/drivers/all must come BEFORE /api/drivers/:id to avoid "all" being parsed as an ID
  app.get("/api/drivers/all", async (_req, res) => {
    try {
      const drivers = await storage.getAllDrivers();
      res.json(drivers);
    } catch (error) {
      console.error("Error fetching all drivers:", error);
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

  // Protected: Only authenticated drivers can update availability
  app.patch("/api/drivers/:id/availability", requireDriver, async (req, res) => {
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

  // Update driver location - called continuously by driver app
  // Protected: Only authenticated drivers can update location
  app.patch("/api/drivers/:id/location", requireDriver, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { lat, lng } = req.body;
      
      if (lat === undefined || lng === undefined) {
        return res.status(400).json({ message: "lat and lng are required" });
      }
      
      const driver = await storage.updateDriverLocation(id, lat.toString(), lng.toString());
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      // Broadcast driver location update to ride WebSocket clients
      broadcastRideUpdate("driver_location", { driverId: id, lat, lng });
      
      res.json(driver);
    } catch (error) {
      console.error("Error updating driver location:", error);
      res.status(500).json({ message: "Failed to update driver location" });
    }
  });

  // Get ride with driver location and ETA for patient tracking
  // Protected: Requires valid tracking token from query param ?token=xxx
  app.get("/api/rides/:id/tracking", requireTrackingToken, async (req, res) => {
    try {
      const ride = (req as any).ride; // Already validated by middleware
      
      let driverInfo = null;
      let distanceToPickup: number | null = null;
      let distanceToDropoff: number | null = null;
      let estimatedMinutesToPickup: number | null = null;
      let estimatedMinutesToDropoff: number | null = null;
      
      if (ride.driverId) {
        const driver = await storage.getDriver(ride.driverId);
        if (driver) {
          driverInfo = {
            id: driver.id,
            fullName: driver.fullName,
            phone: driver.phone,
            vehicleType: driver.vehicleType,
            vehiclePlate: driver.vehiclePlate,
            vehicleColor: driver.vehicleColor,
            vehicleMake: driver.vehicleMake,
            vehicleModel: driver.vehicleModel,
            profilePhotoDoc: driver.profilePhotoDoc,
            averageRating: driver.averageRating,
            currentLat: driver.currentLat,
            currentLng: driver.currentLng
          };
          
          // Calculate distance from driver to pickup/dropoff
          if (driver.currentLat && driver.currentLng) {
            const dLat = parseFloat(driver.currentLat);
            const dLng = parseFloat(driver.currentLng);
            
            if (ride.pickupLat && ride.pickupLng && 
                ["accepted", "driver_enroute"].includes(ride.status)) {
              distanceToPickup = calculateHaversineDistance(
                dLat, dLng,
                parseFloat(ride.pickupLat), parseFloat(ride.pickupLng)
              );
              estimatedMinutesToPickup = Math.round(distanceToPickup * 2);
            }
            
            if (ride.dropoffLat && ride.dropoffLng && 
                ["arrived", "in_progress"].includes(ride.status)) {
              distanceToDropoff = calculateHaversineDistance(
                dLat, dLng,
                parseFloat(ride.dropoffLat), parseFloat(ride.dropoffLng)
              );
              estimatedMinutesToDropoff = Math.round(distanceToDropoff * 2);
            }
          }
        }
      }
      
      res.json({
        ride,
        driver: driverInfo,
        tracking: {
          distanceToPickup: distanceToPickup?.toFixed(1),
          distanceToDropoff: distanceToDropoff?.toFixed(1),
          estimatedMinutesToPickup,
          estimatedMinutesToDropoff,
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("Error fetching ride tracking:", error);
      res.status(500).json({ message: "Failed to fetch ride tracking" });
    }
  });

  app.post("/api/drivers/apply", async (req, res) => {
    try {
      const parsed = insertDriverProfileSchema.parse(req.body);
      const driver = await storage.createDriver(parsed);
      res.status(201).json(driver);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid driver data", errors: error.errors });
      }
      console.error("Error creating driver application:", error);
      res.status(500).json({ message: "Failed to submit driver application" });
    }
  });

  // Protected: Only admins can approve drivers
  app.post("/api/drivers/:id/approve", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const driver = await storage.updateDriverApplicationStatus(id, "approved");
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      console.error("Error approving driver:", error);
      res.status(500).json({ message: "Failed to approve driver" });
    }
  });

  // Protected: Only admins can reject drivers
  app.post("/api/drivers/:id/reject", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      const driver = await storage.updateDriverApplicationStatus(id, "rejected", reason);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      console.error("Error rejecting driver:", error);
      res.status(500).json({ message: "Failed to reject driver" });
    }
  });

  // KYC document upload endpoint
  const kycUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        const uploadDir = path.join(process.cwd(), "uploads", "kyc");
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + "-" + file.originalname);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type. Only PNG, JPG, and PDF files are allowed."));
      }
    },
  });

  app.post("/api/drivers/:id/kyc/upload", kycUpload.single("document"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { documentType } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      if (!["driversLicense", "vehicleRegistration", "insurance", "profilePhoto"].includes(documentType)) {
        return res.status(400).json({ message: "Invalid document type" });
      }

      const filePath = `/uploads/kyc/${file.filename}`;
      const fieldMap: Record<string, string> = {
        driversLicense: "driversLicenseDoc",
        vehicleRegistration: "vehicleRegistrationDoc",
        insurance: "insuranceDoc",
        profilePhoto: "profilePhotoDoc",
      };

      const updateData: Record<string, string> = {
        [fieldMap[documentType]]: filePath,
      };

      const driver = await storage.updateDriverKyc(id, updateData);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      res.json({ path: filePath, driver });
    } catch (error) {
      console.error("Error uploading KYC document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.patch("/api/drivers/:id/kyc", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const kycData = req.body;

      const driver = await storage.updateDriverKyc(id, kycData);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      res.json(driver);
    } catch (error) {
      console.error("Error updating driver KYC:", error);
      res.status(500).json({ message: "Failed to update KYC information" });
    }
  });

  app.post("/api/drivers/:id/kyc/submit", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const driver = await storage.getDriver(id);
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      // Check if all required documents are uploaded
      if (!driver.driversLicenseDoc || !driver.vehicleRegistrationDoc || !driver.insuranceDoc) {
        return res.status(400).json({ 
          message: "Please upload all required documents before submitting for review",
          missing: {
            driversLicense: !driver.driversLicenseDoc,
            vehicleRegistration: !driver.vehicleRegistrationDoc,
            insurance: !driver.insuranceDoc,
          }
        });
      }

      const updatedDriver = await storage.updateDriverKycStatus(id, "pending_review");
      res.json(updatedDriver);
    } catch (error) {
      console.error("Error submitting KYC for review:", error);
      res.status(500).json({ message: "Failed to submit KYC for review" });
    }
  });

  // Protected: Only admins can approve KYC
  app.post("/api/drivers/:id/kyc/approve", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { notes } = req.body;
      const driver = await storage.updateDriverKycStatus(id, "approved", notes);
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      res.json(driver);
    } catch (error) {
      console.error("Error approving KYC:", error);
      res.status(500).json({ message: "Failed to approve KYC" });
    }
  });

  // Protected: Only admins can reject KYC
  app.post("/api/drivers/:id/kyc/reject", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { notes } = req.body;
      const driver = await storage.updateDriverKycStatus(id, "rejected", notes);
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      res.json(driver);
    } catch (error) {
      console.error("Error rejecting KYC:", error);
      res.status(500).json({ message: "Failed to reject KYC" });
    }
  });

  // Serve uploaded KYC files
  app.use("/uploads/kyc", express.static(path.join(process.cwd(), "uploads", "kyc")));

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

  app.post("/api/push/register-native", async (req, res) => {
    try {
      const { token, platform, userType, driverId } = req.body;
      
      if (!token || !platform) {
        return res.status(400).json({ message: "Token and platform are required" });
      }
      
      if (!["ios", "android"].includes(platform)) {
        return res.status(400).json({ message: "Platform must be ios or android" });
      }
      
      await storage.saveNativePushToken(token, platform, userType || "user", driverId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving native push token:", error);
      res.status(500).json({ message: "Failed to save token" });
    }
  });

  // Chat WebSocket
  const chatWss = new WebSocketServer({ server: httpServer, path: "/ws/chat" });
  
  chatWss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const rideId = parseInt(url.searchParams.get("rideId") || "0");
    
    if (rideId > 0) {
      if (!chatClients.has(rideId)) {
        chatClients.set(rideId, new Set());
      }
      chatClients.get(rideId)!.add(ws);
      console.log(`Chat client connected for ride ${rideId}`);
      
      ws.on("close", () => {
        chatClients.get(rideId)?.delete(ws);
        if (chatClients.get(rideId)?.size === 0) {
          chatClients.delete(rideId);
        }
        console.log(`Chat client disconnected for ride ${rideId}`);
      });
    }
  });

  // Chat API endpoints
  // Protected: Only authenticated users can view messages
  app.get("/api/rides/:id/messages", requireAuth, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const messages = await storage.getRideMessages(rideId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Protected: Only authenticated users can send messages
  app.post("/api/rides/:id/messages", requireAuth, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { senderType, message, isQuickMessage } = req.body;
      
      const parsed = insertRideMessageSchema.parse({
        rideId,
        senderType,
        message,
        isQuickMessage: isQuickMessage || false
      });
      
      const rideMessage = await storage.createRideMessage(parsed);
      broadcastChatMessage(rideId, rideMessage);
      res.status(201).json(rideMessage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Quick messages for drivers
  // Protected: Only authenticated drivers can send quick messages
  app.post("/api/rides/:id/quick-message", requireDriver, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { messageType, senderType } = req.body;
      
      const quickMessages: Record<string, string> = {
        "arrived": "I've arrived at the pickup location.",
        "on_my_way": "I'm on my way to pick you up.",
        "running_late": "Running a few minutes late. Will be there soon.",
        "need_assistance": "Do you need any assistance getting to the vehicle?",
        "waiting": "I'm waiting outside. Take your time.",
        "at_destination": "We've arrived at your destination."
      };
      
      const message = quickMessages[messageType];
      if (!message) {
        return res.status(400).json({ message: "Invalid quick message type" });
      }
      
      const rideMessage = await storage.createRideMessage({
        rideId,
        senderType: senderType || "driver",
        message,
        isQuickMessage: true
      });
      
      broadcastChatMessage(rideId, rideMessage);
      res.status(201).json(rideMessage);
    } catch (error) {
      console.error("Error sending quick message:", error);
      res.status(500).json({ message: "Failed to send quick message" });
    }
  });

  // Trip sharing for safety
  // Protected: Only authenticated users can view ride shares
  app.get("/api/rides/:id/shares", requireAuth, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const shares = await storage.getTripShares(rideId);
      res.json(shares);
    } catch (error) {
      console.error("Error fetching trip shares:", error);
      res.status(500).json({ message: "Failed to fetch trip shares" });
    }
  });

  // Protected: Only authenticated users can share rides
  app.post("/api/rides/:id/share", requireAuth, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { contactName, contactPhone, contactEmail } = req.body;
      
      const shareCode = generateShareCode();
      const tripShare = await storage.createTripShare({
        rideId,
        contactName,
        contactPhone,
        contactEmail,
        shareCode
      });
      
      res.status(201).json(tripShare);
    } catch (error) {
      console.error("Error creating trip share:", error);
      res.status(500).json({ message: "Failed to share trip" });
    }
  });

  app.delete("/api/shares/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const share = await storage.deactivateTripShare(id);
      if (!share) {
        return res.status(404).json({ message: "Share not found" });
      }
      res.json(share);
    } catch (error) {
      console.error("Error removing trip share:", error);
      res.status(500).json({ message: "Failed to remove trip share" });
    }
  });

  // Public trip tracking (for emergency contacts)
  app.get("/api/track/:shareCode", async (req, res) => {
    try {
      const { shareCode } = req.params;
      const share = await storage.getTripShareByCode(shareCode);
      
      if (!share) {
        return res.status(404).json({ message: "Trip not found or link expired" });
      }
      
      const ride = await storage.getRide(share.rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      let driver = null;
      if (ride.driverId) {
        const driverData = await storage.getDriver(ride.driverId);
        if (driverData) {
          driver = {
            fullName: driverData.fullName,
            phone: driverData.phone,
            vehicleType: driverData.vehicleType,
            vehiclePlate: driverData.vehiclePlate,
            vehicleColor: driverData.vehicleColor,
            vehicleMake: driverData.vehicleMake,
            vehicleModel: driverData.vehicleModel,
            vehicleYear: driverData.vehicleYear,
            profilePhotoDoc: driverData.profilePhotoDoc,
            wheelchairAccessible: driverData.wheelchairAccessible,
            stretcherCapable: driverData.stretcherCapable
          };
        }
      }
      
      res.json({
        ride: {
          id: ride.id,
          status: ride.status,
          patientName: ride.patientName,
          patientPhone: ride.patientPhone,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          appointmentTime: ride.appointmentTime,
          mobilityNeeds: ride.mobilityNeeds,
          estimatedArrivalTime: ride.estimatedArrivalTime,
          verificationCode: ride.verificationCode,
          bookedByOther: ride.bookedByOther,
          bookerName: ride.bookerName,
          pickupLat: ride.pickupLat,
          pickupLng: ride.pickupLng,
          dropoffLat: ride.dropoffLat,
          dropoffLng: ride.dropoffLng
        },
        driver,
        share: {
          contactName: share.contactName,
          isActive: share.isActive
        }
      });
    } catch (error) {
      console.error("Error tracking trip:", error);
      res.status(500).json({ message: "Failed to track trip" });
    }
  });

  // Verification code for ride
  // Protected: Only authenticated drivers can generate verification codes
  app.post("/api/rides/:id/generate-code", requireDriver, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const code = generateVerificationCode();
      const ride = await storage.setRideVerificationCode(rideId, code);
      
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      res.json({ code, ride });
    } catch (error) {
      console.error("Error generating verification code:", error);
      res.status(500).json({ message: "Failed to generate code" });
    }
  });

  // Update ETA
  // Protected: Only authenticated drivers can update ETA
  app.patch("/api/rides/:id/eta", requireDriver, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { eta } = req.body;
      
      const ride = await storage.updateRideEta(rideId, new Date(eta));
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      broadcastRideUpdate("update", ride);
      res.json(ride);
    } catch (error) {
      console.error("Error updating ETA:", error);
      res.status(500).json({ message: "Failed to update ETA" });
    }
  });

  // Get driver info for patient
  // Protected: Requires valid tracking token from query param ?token=xxx
  app.get("/api/rides/:id/driver-info", requireTrackingToken, async (req, res) => {
    try {
      const ride = (req as any).ride; // Already validated by middleware
      
      if (!ride.driverId) {
        return res.json({ driver: null, message: "No driver assigned yet" });
      }
      
      const driver = await storage.getDriver(ride.driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      res.json({
        driver: {
          fullName: driver.fullName,
          phone: driver.phone,
          vehicleType: driver.vehicleType,
          vehiclePlate: driver.vehiclePlate,
          vehicleColor: driver.vehicleColor,
          vehicleMake: driver.vehicleMake,
          vehicleModel: driver.vehicleModel,
          vehicleYear: driver.vehicleYear,
          profilePhotoDoc: driver.profilePhotoDoc,
          wheelchairAccessible: driver.wheelchairAccessible,
          stretcherCapable: driver.stretcherCapable
        },
        ride: {
          verificationCode: ride.verificationCode,
          estimatedArrivalTime: ride.estimatedArrivalTime,
          status: ride.status
        }
      });
    } catch (error) {
      console.error("Error fetching driver info:", error);
      res.status(500).json({ message: "Failed to fetch driver info" });
    }
  });

  // Add tip to a completed ride
  // Protected: Only authenticated users can add tips
  app.post("/api/rides/:id/tip", requireAuth, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { tipAmount } = req.body;
      
      if (!tipAmount || parseFloat(tipAmount) <= 0) {
        return res.status(400).json({ message: "Valid tip amount is required" });
      }
      
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      if (ride.status !== "completed") {
        return res.status(400).json({ message: "Can only tip on completed rides" });
      }
      
      if (ride.tipAmount && parseFloat(ride.tipAmount) > 0) {
        return res.status(400).json({ message: "Tip already added to this ride" });
      }
      
      const updatedRide = await storage.addTip(rideId, tipAmount);
      res.json({ 
        message: "Tip added successfully",
        ride: updatedRide
      });
    } catch (error) {
      console.error("Error adding tip:", error);
      res.status(500).json({ message: "Failed to add tip" });
    }
  });
  
  // Get driver earnings summary
  // Protected: Only authenticated drivers can view earnings
  app.get("/api/drivers/:id/earnings", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      const earnings = await storage.getDriverEarnings(driverId);
      res.json(earnings);
    } catch (error) {
      console.error("Error fetching driver earnings:", error);
      res.status(500).json({ message: "Failed to fetch earnings" });
    }
  });
  
  // Get fare breakdown for a ride (shows commission)
  // Protected: Only authenticated users can view fare breakdown
  app.get("/api/rides/:id/fare-breakdown", requireAuth, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      const finalFare = parseFloat(ride.finalFare || ride.estimatedFare || "0");
      const platformFeePercent = parseFloat(ride.platformFeePercent || (ride.paymentType === "insurance" ? "10" : "15"));
      const platformFee = parseFloat(ride.platformFee || "0") || (finalFare * platformFeePercent / 100);
      const driverEarnings = parseFloat(ride.driverEarnings || "0") || (finalFare - platformFee);
      const tipAmount = parseFloat(ride.tipAmount || "0");
      const totalDriverPayout = driverEarnings + tipAmount;
      
      res.json({
        rideId,
        baseFare: ride.baseFare || "20.00",
        distanceMiles: ride.distanceMiles || ride.actualDistanceMiles,
        estimatedFare: ride.estimatedFare,
        finalFare: ride.finalFare,
        tolls: ride.actualTolls || ride.estimatedTolls,
        surgeMultiplier: ride.surgeMultiplier,
        platformFeePercent: platformFeePercent.toFixed(0) + "%",
        platformFee: platformFee.toFixed(2),
        driverEarnings: driverEarnings.toFixed(2),
        tipAmount: tipAmount.toFixed(2),
        totalDriverPayout: totalDriverPayout.toFixed(2),
        paymentType: ride.paymentType,
        paymentStatus: ride.paymentStatus
      });
    } catch (error) {
      console.error("Error fetching fare breakdown:", error);
      res.status(500).json({ message: "Failed to fetch fare breakdown" });
    }
  });

  // Contractor Onboarding API
  // Protected: Only authenticated drivers can complete contractor onboarding
  app.post("/api/drivers/:id/contractor-onboard", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      const { ssnLast4, taxClassification, businessName, taxAddress, taxCity, taxState, taxZip, agreementAccepted } = req.body;
      
      if (!ssnLast4 || ssnLast4.length !== 4) {
        return res.status(400).json({ message: "Last 4 digits of SSN required" });
      }
      
      if (!agreementAccepted) {
        return res.status(400).json({ message: "You must accept the contractor agreement" });
      }
      
      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      // Update driver with contractor info
      const updatedDriver = await storage.updateDriverContractorInfo(driverId, {
        ssnLast4,
        taxClassification: taxClassification || "individual",
        businessName,
        taxAddress,
        taxCity,
        taxState,
        taxZip,
        isContractorOnboarded: true,
        contractorAgreementSignedAt: new Date()
      });
      
      // Log the agreement acceptance
      await storage.createContractorAgreement({
        driverId,
        agreementVersion: "1.0",
        ipAddress: req.ip || req.socket.remoteAddress || "",
        userAgent: req.headers["user-agent"] || ""
      });
      
      res.json({ message: "Contractor onboarding complete", driver: updatedDriver });
    } catch (error) {
      console.error("Error onboarding contractor:", error);
      res.status(500).json({ message: "Failed to complete contractor onboarding" });
    }
  });
  
  // Get driver annual earnings summary
  // Protected: Only authenticated drivers can view annual earnings
  app.get("/api/drivers/:id/annual-earnings/:year", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      const taxYear = parseInt(req.params.year);
      
      if (isNaN(taxYear) || taxYear < 2020 || taxYear > new Date().getFullYear()) {
        return res.status(400).json({ message: "Invalid tax year" });
      }
      
      const earnings = await storage.getOrCalculateAnnualEarnings(driverId, taxYear);
      res.json(earnings);
    } catch (error) {
      console.error("Error fetching annual earnings:", error);
      res.status(500).json({ message: "Failed to fetch annual earnings" });
    }
  });
  
  // Generate 1099-NEC form data
  // Protected: Only authenticated drivers can view 1099 forms
  app.get("/api/drivers/:id/1099/:year", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      const taxYear = parseInt(req.params.year);
      
      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      if (!driver.isContractorOnboarded || !driver.ssnLast4) {
        return res.status(400).json({ message: "Driver must complete contractor onboarding first" });
      }
      
      const earnings = await storage.getOrCalculateAnnualEarnings(driverId, taxYear);
      
      // Only generate 1099 if earnings exceed $600
      const totalEarnings = parseFloat(earnings.totalGrossEarnings || "0") + parseFloat(earnings.totalTips || "0");
      const requiresForm = totalEarnings >= 600;
      
      // Mark as generated
      await storage.mark1099Generated(driverId, taxYear);
      
      res.json({
        taxYear,
        requiresForm,
        payer: {
          name: "Care hub app LLC",
          address: "123 Healthcare Way",
          city: "Phoenix",
          state: "AZ",
          zip: "85001",
          ein: "XX-XXXXXXX"
        },
        recipient: {
          name: driver.businessName || driver.fullName,
          ssnLast4: driver.ssnLast4,
          address: driver.taxAddress || "",
          city: driver.taxCity || "",
          state: driver.taxState || "",
          zip: driver.taxZip || ""
        },
        box1_nonemployeeCompensation: totalEarnings.toFixed(2),
        totalRides: earnings.totalRides,
        totalMiles: earnings.totalMiles,
        grossEarnings: earnings.totalGrossEarnings,
        tips: earnings.totalTips,
        tolls: earnings.totalTolls,
        message: requiresForm 
          ? "This is your 1099-NEC data for tax filing purposes."
          : "Your earnings were below $600. A 1099-NEC is not required, but you must still report this income."
      });
    } catch (error) {
      console.error("Error generating 1099:", error);
      res.status(500).json({ message: "Failed to generate 1099" });
    }
  });
  
  // Get available tax years for a driver
  // Protected: Only authenticated drivers can view tax years
  app.get("/api/drivers/:id/tax-years", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      const years = await storage.getDriverTaxYears(driverId);
      res.json(years);
    } catch (error) {
      console.error("Error fetching tax years:", error);
      res.status(500).json({ message: "Failed to fetch tax years" });
    }
  });

  // ============ ADMIN ROUTES ============
  
  // Get all rides for admin (with optional filters)
  // Protected: Only admins can view all rides
  app.get("/api/admin/rides", requireAdmin, async (req, res) => {
    try {
      const allRides = await storage.getAllRides();
      const { status, driverId, patientPhone } = req.query;
      
      let filteredRides = allRides;
      if (status) {
        filteredRides = filteredRides.filter(r => r.status === status);
      }
      if (driverId) {
        filteredRides = filteredRides.filter(r => r.driverId === parseInt(driverId as string));
      }
      if (patientPhone) {
        filteredRides = filteredRides.filter(r => r.patientPhone === patientPhone);
      }
      
      res.json(filteredRides);
    } catch (error) {
      console.error("Error fetching admin rides:", error);
      res.status(500).json({ message: "Failed to fetch rides" });
    }
  });
  
  // Get admin dashboard stats
  // Protected: Only admins can view stats
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const allRides = await storage.getAllRides();
      const allDrivers = await storage.getAllDrivers();
      const patientAccounts = await storage.getAllPatientAccounts();
      const incidents = await storage.getAllIncidentReports();
      
      const stats = {
        totalRides: allRides.length,
        completedRides: allRides.filter(r => r.status === "completed").length,
        activeRides: allRides.filter(r => ["accepted", "arrived", "in_progress"].includes(r.status)).length,
        cancelledRides: allRides.filter(r => r.status === "cancelled").length,
        totalDrivers: allDrivers.length,
        activeDrivers: allDrivers.filter(d => d.applicationStatus === "approved" && d.kycStatus === "approved").length,
        pendingDrivers: allDrivers.filter(d => d.applicationStatus === "pending").length,
        suspendedDrivers: allDrivers.filter(d => d.accountStatus === "suspended").length,
        totalPatients: patientAccounts.length,
        blockedPatients: patientAccounts.filter(p => p.accountStatus === "blocked").length,
        totalRevenue: allRides.filter(r => r.status === "completed").reduce((sum, r) => sum + parseFloat(r.platformFee || "0"), 0).toFixed(2),
        openIncidents: incidents.filter(i => i.status === "open" || i.status === "investigating").length,
        totalIncidents: incidents.length
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });
  
  // Get all patient accounts for admin
  // Protected: Only admins can view patients
  app.get("/api/admin/patients", requireAdmin, async (req, res) => {
    try {
      const accounts = await storage.getAllPatientAccounts();
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching patient accounts:", error);
      res.status(500).json({ message: "Failed to fetch patient accounts" });
    }
  });
  
  // Update patient account status (suspend/unsuspend/block/unblock)
  // Protected: Only admins can update patient status
  app.patch("/api/admin/patients/:phone/status", requireAdmin, async (req, res) => {
    try {
      const { phone } = req.params;
      const { status, reason } = req.body;
      
      if (!["good_standing", "warning", "restricted", "blocked"].includes(status)) {
        return res.status(400).json({ message: "Invalid account status" });
      }
      
      const updated = await storage.updatePatientAccountStatus(decodeURIComponent(phone), status, reason);
      res.json(updated);
    } catch (error) {
      console.error("Error updating patient status:", error);
      res.status(500).json({ message: "Failed to update patient status" });
    }
  });
  
  // Update driver account status (suspend/unsuspend/deactivate)
  // Protected: Only admins can update driver status
  app.patch("/api/admin/drivers/:id/status", requireAdmin, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      const { status, reason } = req.body;
      
      if (!["active", "suspended", "deactivated"].includes(status)) {
        return res.status(400).json({ message: "Invalid account status" });
      }
      
      const updated = await storage.updateDriverAccountStatus(driverId, status, reason);
      res.json(updated);
    } catch (error) {
      console.error("Error updating driver status:", error);
      res.status(500).json({ message: "Failed to update driver status" });
    }
  });
  
  // Admin cancel a ride
  // Protected: Only admins can force cancel rides
  app.post("/api/admin/rides/:id/cancel", requireAdmin, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { reason } = req.body;
      
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      const cancelled = await storage.cancelRide(rideId, "admin", reason || "Cancelled by admin", "0");
      await storage.createRideEvent({
        rideId,
        status: "cancelled",
        note: `Cancelled by admin: ${reason || "No reason provided"}`
      });
      
      broadcastRideUpdate("status_change", cancelled);
      res.json(cancelled);
    } catch (error) {
      console.error("Error cancelling ride:", error);
      res.status(500).json({ message: "Failed to cancel ride" });
    }
  });
  
  // ============ INCIDENT REPORTS ============
  
  // Configure multer for incident evidence uploads
  const incidentUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        const dir = './uploads/incidents';
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      }
    }),
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
  
  // Serve incident evidence files
  app.use('/uploads/incidents', express.static('uploads/incidents'));
  
  // Create incident report (with evidence upload)
  app.post("/api/incidents", incidentUpload.array('evidence', 5), async (req, res) => {
    try {
      const { rideId, reporterType, reporterName, reporterPhone, reporterEmail, category, severity, description, location, incidentDate } = req.body;
      
      // Validate required fields
      if (!reporterType || !reporterName || !reporterPhone || !category || !description) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Process uploaded files
      const evidenceUrls: string[] = [];
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          evidenceUrls.push(`/uploads/incidents/${file.filename}`);
        }
      }
      
      const report = await storage.createIncidentReport({
        rideId: rideId ? parseInt(rideId) : undefined,
        reporterType,
        reporterName,
        reporterPhone,
        reporterEmail,
        category,
        severity: severity || "medium",
        description,
        location,
        incidentDate: incidentDate ? new Date(incidentDate) : undefined,
        evidenceUrls
      });
      
      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating incident report:", error);
      res.status(500).json({ message: "Failed to create incident report" });
    }
  });
  
  // Get all incident reports (admin)
  // Protected: Only admins can view incidents
  app.get("/api/admin/incidents", requireAdmin, async (req, res) => {
    try {
      const incidents = await storage.getAllIncidentReports();
      res.json(incidents);
    } catch (error) {
      console.error("Error fetching incidents:", error);
      res.status(500).json({ message: "Failed to fetch incidents" });
    }
  });
  
  // Get single incident report
  // Protected: Only authenticated users can view incidents
  app.get("/api/incidents/:id", requireAuth, async (req, res) => {
    try {
      const incident = await storage.getIncidentReport(parseInt(req.params.id));
      if (!incident) {
        return res.status(404).json({ message: "Incident not found" });
      }
      res.json(incident);
    } catch (error) {
      console.error("Error fetching incident:", error);
      res.status(500).json({ message: "Failed to fetch incident" });
    }
  });
  
  // Get incidents by ride
  // Protected: Only authenticated users can view ride incidents
  app.get("/api/rides/:id/incidents", requireAuth, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const incidents = await storage.getIncidentReportsByRide(rideId);
      res.json(incidents);
    } catch (error) {
      console.error("Error fetching ride incidents:", error);
      res.status(500).json({ message: "Failed to fetch incidents" });
    }
  });
  
  // Update incident report (admin)
  // Protected: Only admins can update incidents
  app.patch("/api/admin/incidents/:id", requireAdmin, async (req, res) => {
    try {
      const incidentId = parseInt(req.params.id);
      const { status, adminNotes, assignedTo, resolution } = req.body;
      
      const updated = await storage.updateIncidentReport(incidentId, {
        status,
        adminNotes,
        assignedTo,
        resolution
      });
      
      if (!updated) {
        return res.status(404).json({ message: "Incident not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating incident:", error);
      res.status(500).json({ message: "Failed to update incident" });
    }
  });

  // ==========================================
  // STRIPE PAYMENT ROUTES
  // ==========================================

  // Get Stripe publishable key for frontend
  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe publishable key:", error);
      res.status(500).json({ message: "Payment service unavailable" });
    }
  });

  // Create payment intent for ride booking (upfront payment)
  app.post("/api/rides/create-payment-intent", async (req, res) => {
    try {
      const { estimatedFare, patientEmail, patientName, rideDetails } = req.body;
      
      if (!estimatedFare || estimatedFare <= 0) {
        return res.status(400).json({ message: "Invalid fare amount" });
      }

      const stripe = await getUncachableStripeClient();
      
      // Convert dollars to cents for Stripe
      const amountInCents = Math.round(estimatedFare * 100);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          type: 'ride_booking',
          patientName: patientName || '',
          patientEmail: patientEmail || '',
          pickupAddress: rideDetails?.pickupAddress || '',
          dropoffAddress: rideDetails?.dropoffAddress || '',
        },
        receipt_email: patientEmail || undefined,
        description: `Carehub Medical Transport - ${rideDetails?.pickupAddress || 'Ride'} to ${rideDetails?.dropoffAddress || 'Destination'}`,
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: estimatedFare,
      });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Failed to initialize payment" });
    }
  });

  // Confirm payment and update ride with payment info
  app.post("/api/rides/:id/confirm-payment", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ message: "Payment intent ID required" });
      }

      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      const stripe = await getUncachableStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ 
          message: "Payment not completed",
          paymentStatus: paymentIntent.status 
        });
      }

      // Update ride with payment info
      const updatedRide = await storage.updateRidePayment(rideId, {
        paymentStatus: 'paid',
        stripePaymentIntentId: paymentIntentId,
        paidAmount: (paymentIntent.amount / 100).toFixed(2),
      });

      await storage.createRideEvent({
        rideId,
        status: ride.status,
        note: `Payment of $${(paymentIntent.amount / 100).toFixed(2)} confirmed`
      });

      res.json(updatedRide);
    } catch (error: any) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ message: "Failed to confirm payment" });
    }
  });

  // Add tip after ride completion
  app.post("/api/rides/:id/tip-payment", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { tipAmount, patientEmail } = req.body;

      if (!tipAmount || tipAmount <= 0) {
        return res.status(400).json({ message: "Invalid tip amount" });
      }

      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      if (ride.status !== 'completed') {
        return res.status(400).json({ message: "Can only tip completed rides" });
      }

      const stripe = await getUncachableStripeClient();
      const amountInCents = Math.round(tipAmount * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          type: 'tip',
          rideId: rideId.toString(),
          driverId: ride.driverId?.toString() || '',
        },
        receipt_email: patientEmail || undefined,
        description: `Tip for Carehub ride #${rideId}`,
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: tipAmount,
      });
    } catch (error: any) {
      console.error("Error creating tip payment:", error);
      res.status(500).json({ message: "Failed to initialize tip payment" });
    }
  });

  // Confirm tip payment
  app.post("/api/rides/:id/confirm-tip", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ message: "Payment intent ID required" });
      }

      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      const stripe = await getUncachableStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ 
          message: "Tip payment not completed",
          paymentStatus: paymentIntent.status 
        });
      }

      const tipAmount = (paymentIntent.amount / 100).toFixed(2);
      
      // Update ride with tip
      const updatedRide = await storage.updateRideTip(rideId, tipAmount);

      // Update driver earnings with tip (100% goes to driver)
      if (ride.driverId) {
        await storage.addDriverTipEarnings(ride.driverId, parseFloat(tipAmount));
      }

      await storage.createRideEvent({
        rideId,
        status: 'completed',
        note: `Tip of $${tipAmount} received from patient`
      });

      res.json({ 
        success: true, 
        tipAmount,
        ride: updatedRide 
      });
    } catch (error: any) {
      console.error("Error confirming tip:", error);
      res.status(500).json({ message: "Failed to confirm tip" });
    }
  });

  return httpServer;
}
