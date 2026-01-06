import type { Express } from "express";
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

function broadcastRideUpdate(type: "new" | "update" | "status_change", ride: any) {
  const message = JSON.stringify({ type, ride });
  rideClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
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
      
      const ride = await storage.createRide(parsed);
      
      await storage.createRideEvent({
        rideId: ride.id,
        status: "requested",
        note: isEmergency ? "Emergency ride requested by patient (account override)" : "Ride requested by patient"
      });
      
      broadcastRideUpdate("new", ride);
      
      notifyDriversOfNewRide(ride.pickupAddress, ride.appointmentTime).catch(err => {
        console.error("Failed to send push notification:", err);
      });
      
      res.status(201).json({ ...ride, emergencyOverrideUsed: isEmergency && patientAccount?.accountStatus === "blocked" });
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
  app.post("/api/rides/:id/delay", async (req, res) => {
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

  // Complete ride with final fare calculation
  app.post("/api/rides/:id/complete", async (req, res) => {
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

  app.get("/api/drivers/all", async (_req, res) => {
    try {
      const drivers = await storage.getAllDrivers();
      res.json(drivers);
    } catch (error) {
      console.error("Error fetching all drivers:", error);
      res.status(500).json({ message: "Failed to fetch drivers" });
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

  app.post("/api/drivers/:id/approve", async (req, res) => {
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

  app.post("/api/drivers/:id/reject", async (req, res) => {
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

  app.post("/api/drivers/:id/kyc/approve", async (req, res) => {
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

  app.post("/api/drivers/:id/kyc/reject", async (req, res) => {
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
  app.get("/api/rides/:id/messages", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const messages = await storage.getRideMessages(rideId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/rides/:id/messages", async (req, res) => {
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
  app.post("/api/rides/:id/quick-message", async (req, res) => {
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
  app.get("/api/rides/:id/shares", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const shares = await storage.getTripShares(rideId);
      res.json(shares);
    } catch (error) {
      console.error("Error fetching trip shares:", error);
      res.status(500).json({ message: "Failed to fetch trip shares" });
    }
  });

  app.post("/api/rides/:id/share", async (req, res) => {
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
        driver = await storage.getDriver(ride.driverId);
        if (driver) {
          driver = {
            fullName: driver.fullName,
            vehicleType: driver.vehicleType,
            vehiclePlate: driver.vehiclePlate,
            vehicleColor: driver.vehicleColor,
            vehicleMake: driver.vehicleMake,
            vehicleModel: driver.vehicleModel,
            profilePhotoDoc: driver.profilePhotoDoc
          };
        }
      }
      
      res.json({
        ride: {
          id: ride.id,
          status: ride.status,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          estimatedArrivalTime: ride.estimatedArrivalTime,
          pickupLat: ride.pickupLat,
          pickupLng: ride.pickupLng,
          dropoffLat: ride.dropoffLat,
          dropoffLng: ride.dropoffLng
        },
        driver,
        sharedWith: share.contactName
      });
    } catch (error) {
      console.error("Error tracking trip:", error);
      res.status(500).json({ message: "Failed to track trip" });
    }
  });

  // Verification code for ride
  app.post("/api/rides/:id/generate-code", async (req, res) => {
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
  app.patch("/api/rides/:id/eta", async (req, res) => {
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
  app.get("/api/rides/:id/driver-info", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
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

  return httpServer;
}
