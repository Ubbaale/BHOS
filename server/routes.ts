import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertJobSchema, insertTicketSchema, insertRideSchema, insertDriverProfileSchema, rideStatuses, insertPushSubscriptionSchema, insertRideMessageSchema, insertTripShareSchema, users, auditLogs, legalAgreements, insertFacilitySchema, insertFacilityStaffSchema, insertCaregiverPatientSchema, passwordResetCodes, emailVerificationCodes, itCompanies, itServiceTickets, itTicketNotes, insertItCompanySchema, insertItServiceTicketSchema, insertItTicketNoteSchema, itTechProfiles, insertItTechProfileSchema, itTalentPools, itTalentPoolMembers, insertItTalentPoolSchema, itWorkOrderTemplates, insertItWorkOrderTemplateSchema, itTechAnnualEarnings, itTechContractorAgreements, itTechComplaints, itTechEnforcementLog, driverProfiles, driverComplaints, driverEnforcementLog, courierCompanies, courierDeliveries, insertCourierCompanySchema, insertCourierDeliverySchema, courierDeliveryStatuses, courierChainOfCustodyLog, courierFareConfig, courierCustodyEventTypes, userDocuments, insertUserDocumentSchema } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { sendIssueNotification, sendRideBookedForPatientEmail, sendPasswordResetCode, sendEmailVerificationCode, sendContactFormEmail, FileAttachment } from "./email";
import { saveSubscription, removeSubscription, getVapidPublicKey, notifyDriversOfNewRide, notifyPatientOfRideUpdate, notifyItTechsOfNewTicket, notifyItCompanyOfTicketUpdate } from "./push";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

// JWT configuration for mobile apps
const JWT_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_ACCESS_EXPIRY = '15m';
const JWT_REFRESH_EXPIRY = '7d';

// Store refresh tokens (in production, use Redis or database)
const refreshTokens: Map<string, { userId: number; deviceId: string; expiresAt: number }> = new Map();

interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  driverId?: number;
  deviceId?: string;
  type: 'access' | 'refresh';
}

function generateAccessToken(payload: Omit<JwtPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'access' }, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRY });
}

function generateRefreshToken(payload: Omit<JwtPayload, 'type'>): string {
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });
  const decoded = jwt.decode(refreshToken) as jwt.JwtPayload;
  refreshTokens.set(refreshToken, {
    userId: payload.userId,
    deviceId: payload.deviceId || 'unknown',
    expiresAt: (decoded.exp || 0) * 1000
  });
  return refreshToken;
}

function verifyToken(token: string, type: 'access' | 'refresh'): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (decoded.type !== type) return null;
    if (type === 'refresh' && !refreshTokens.has(token)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// Mobile auth middleware
function mobileAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return mobileError(res, 401, "Authorization token required", "AUTH_REQUIRED");
  }
  
  const token = authHeader.substring(7);
  const payload = verifyToken(token, 'access');
  
  if (!payload) {
    return mobileError(res, 401, "Invalid or expired token", "TOKEN_INVALID");
  }
  
  // Attach user info to request
  (req as any).mobileUser = payload;
  next();
}

function mobileSuccess(res: Response, data: Record<string, any>, statusCode: number = 200, meta?: Record<string, any>) {
  return res.status(statusCode).json({
    status: "success",
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: "2.0",
      ...meta,
    },
  });
}

function mobileError(res: Response, statusCode: number, message: string, code?: string, errors?: any[]) {
  return res.status(statusCode).json({
    status: "error",
    error: {
      message,
      code: code || `ERR_${statusCode}`,
      ...(errors ? { details: errors } : {}),
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: "2.0",
    },
  });
}

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

// WebSocket session tokens for secure connections (short-lived, tied to session)
const wsTokens: Map<string, { userId: string; role: string; expiresAt: number }> = new Map();
const WS_TOKEN_EXPIRY = 60 * 1000; // 1 minute - tokens are short-lived

function generateWsToken(userId: string, role: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  wsTokens.set(token, { userId, role, expiresAt: Date.now() + WS_TOKEN_EXPIRY });
  return token;
}

function validateWsToken(token: string): { userId: string; role: string } | null {
  const data = wsTokens.get(token);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    wsTokens.delete(token);
    return null;
  }
  // Token is single-use for security
  wsTokens.delete(token);
  return { userId: data.userId, role: data.role };
}

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  wsTokens.forEach((data, token) => {
    if (now > data.expiresAt) {
      wsTokens.delete(token);
    }
  });
}, 60000); // Every minute

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Jobs WebSocket - public feed for job listings (no auth required)
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

  // Rate limiting for login attempts (per IP) - prevent brute force attacks
  const loginAttempts: Map<string, { count: number; resetAt: number; blockedUntil?: number }> = new Map();
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOGIN_RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  const LOGIN_BLOCK_DURATION = 30 * 60 * 1000; // 30 minutes block after max attempts

  const loginRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const attempts = loginAttempts.get(ip);

    if (attempts) {
      // Check if IP is blocked
      if (attempts.blockedUntil && now < attempts.blockedUntil) {
        const remainingMinutes = Math.ceil((attempts.blockedUntil - now) / 60000);
        return res.status(429).json({ 
          message: `Too many login attempts. Please try again in ${remainingMinutes} minutes.` 
        });
      }

      // Reset if window has passed
      if (now >= attempts.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_RATE_LIMIT_WINDOW });
      } else if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
        // Block the IP
        attempts.blockedUntil = now + LOGIN_BLOCK_DURATION;
        return res.status(429).json({ 
          message: "Too many login attempts. Your IP has been temporarily blocked." 
        });
      } else {
        attempts.count++;
      }
    } else {
      loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_RATE_LIMIT_WINDOW });
    }

    // Store reference to clear on successful login
    (req as any).loginRateLimitKey = ip;
    next();
  };

  const clearLoginAttempts = (ip: string) => {
    loginAttempts.delete(ip);
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

  const requirePermission = (...perms: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (req.session.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const userPerms = req.session.permissions || [];
      if (userPerms.length === 0) {
        return next();
      }
      const hasPermission = perms.some(p => userPerms.includes(p));
      if (!hasPermission) {
        return res.status(403).json({ message: "You don't have permission to access this resource" });
      }
      next();
    };
  };

  // Seed test accounts endpoint (one-time setup, admin only in production)
  app.get("/api/setup/seed-test-accounts", async (req, res) => {
    try {
      // Security: Only allow in development or if user is admin
      const isProduction = process.env.NODE_ENV === "production";
      const isAdmin = req.session?.role === "admin";
      
      if (isProduction && !isAdmin) {
        return res.status(403).json({ 
          message: "This endpoint requires admin authentication in production",
          hint: "Login as admin first, then visit this URL"
        });
      }
      
      // Check if test accounts already exist
      const existingDriver = await storage.getUserByUsername("driver@test.com");
      const existingPatient = await storage.getUserByUsername("patient@test.com");
      
      const results: string[] = [];
      
      if (!existingDriver) {
        const driverHash = await bcrypt.hash("TestDriver123!", 10);
        const driverUser = await storage.createUser({
          username: "driver@test.com",
          password: driverHash,
          role: "driver"
        });
        const [driverProfile] = await db.insert(driverProfiles).values({
          userId: driverUser.id,
          fullName: "Test Driver",
          phone: "555-000-0002",
          email: "driver@test.com",
          vehicleType: "sedan",
          vehiclePlate: "TEST-DRV",
          wheelchairAccessible: false,
          stretcherCapable: false,
          isAvailable: true,
          patientTransportEnabled: true,
          medicalCourierEnabled: false,
          applicationStatus: "approved",
          kycStatus: "verified",
        }).returning();
        results.push("Driver account + profile created: driver@test.com / TestDriver123!");
      } else {
        const [existingProfile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, existingDriver.id));
        if (!existingProfile) {
          await db.insert(driverProfiles).values({
            userId: existingDriver.id,
            fullName: "Test Driver",
            phone: "555-000-0002",
            email: "driver@test.com",
            vehicleType: "sedan",
            vehiclePlate: "TEST-DRV",
            wheelchairAccessible: false,
            stretcherCapable: false,
            isAvailable: true,
            patientTransportEnabled: true,
            medicalCourierEnabled: false,
            applicationStatus: "approved",
            kycStatus: "verified",
          });
          results.push("Driver profile created for existing driver@test.com");
        } else {
          results.push("Driver account already exists: driver@test.com");
        }
      }
      
      if (!existingPatient) {
        const patientHash = await bcrypt.hash("TestPatient123!", 10);
        await storage.createUser({
          username: "patient@test.com",
          password: patientHash,
          role: "patient"
        });
        results.push("Patient account created: patient@test.com / TestPatient123!");
      } else {
        results.push("Patient account already exists: patient@test.com");
      }

      const existingAdmin = await storage.getUserByUsername("admin@carehubapp.com");
      if (!existingAdmin) {
        const adminHash = await bcrypt.hash("Admin123!", 10);
        await storage.createUser({
          username: "admin@carehubapp.com",
          password: adminHash,
          role: "admin"
        });
        results.push("Admin account created: admin@carehubapp.com");
      } else {
        results.push("Admin account already exists: admin@carehubapp.com");
      }
      
      const existingItCompany = await storage.getUserByUsername("itcompany@test.com");
      if (!existingItCompany) {
        const companyHash = await bcrypt.hash("TestCompany123!", 10);
        const companyUser = await storage.createUser({
          username: "itcompany@test.com",
          password: companyHash,
          role: "user"
        });
        await db.update(users).set({ emailVerified: true }).where(eq(users.id, companyUser.id));
        await db.insert(itCompanies).values({
          ownerId: companyUser.id,
          companyName: "Test Healthcare IT Solutions",
          contactEmail: "itcompany@test.com",
          contactPhone: "555-100-2000",
          address: "123 Medical Center Dr",
          city: "Chicago",
          state: "IL",
          zipCode: "60601",
          industry: "healthcare",
          companySize: "11-50",
        });
        results.push("IT Company account created: itcompany@test.com / TestCompany123!");
      } else {
        results.push("IT Company account already exists: itcompany@test.com");
      }

      const existingItTech = await storage.getUserByUsername("ittech@test.com");
      if (!existingItTech) {
        const techHash = await bcrypt.hash("TestTech123!", 10);
        const techUser = await storage.createUser({
          username: "ittech@test.com",
          password: techHash,
          role: "it_tech"
        });
        await db.update(users).set({ emailVerified: true }).where(eq(users.id, techUser.id));
        await db.insert(itTechProfiles).values({
          userId: techUser.id,
          fullName: "Test Technician",
          email: "ittech@test.com",
          phone: "555-200-3000",
          city: "Chicago",
          state: "IL",
          zipCode: "60601",
          skills: ["Network", "Hardware", "EHR System", "Printer"],
          certifications: ["CompTIA A+", "Network+"],
          experienceYears: "3-5",
          bio: "Experienced healthcare IT technician",
          hourlyRate: "45",
          applicationStatus: "approved",
          backgroundCheckStatus: "passed",
        });
        results.push("IT Tech account created: ittech@test.com / TestTech123!");
      } else {
        results.push("IT Tech account already exists: ittech@test.com");
      }

      res.json({ 
        success: true, 
        message: "Test accounts setup complete",
        results,
        credentials: {
          admin: { username: "admin@carehubapp.com", password: "Admin123!" },
          driver: { username: "driver@test.com", password: "TestDriver123!" },
          patient: { username: "patient@test.com", password: "TestPatient123!" },
          itCompany: { username: "itcompany@test.com", password: "TestCompany123!" },
          itTech: { username: "ittech@test.com", password: "TestTech123!" }
        }
      });
    } catch (error) {
      console.error("Error seeding test accounts:", error);
      res.status(500).json({ message: "Failed to seed test accounts", error: String(error) });
    }
  });

  app.post("/api/auth/register", loginRateLimiter, async (req, res) => {
    try {
      const { fullName, email, password, confirmPassword, role } = req.body;

      if (!fullName || !email || !password) {
        return res.status(400).json({ message: "Full name, email, and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one uppercase letter" });
      }
      if (!/[a-z]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one lowercase letter" });
      }
      if (!/[0-9]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one number" });
      }
      if (confirmPassword && password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords don't match" });
      }

      const existingUser = await storage.getUserByUsername(email);
      if (existingUser) {
        return res.status(400).json({ message: "An account with this email already exists. Please sign in instead." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const validRoles = ["user", "patient", "employer"];
      const userRole = validRoles.includes(role) ? role : "user";
      const user = await storage.createUser({
        username: email,
        password: hashedPassword,
        role: userRole,
      });

      if (userRole === "user" || userRole === "patient") {
        try {
          await storage.createPatient({
            userId: user.id,
            fullName: fullName,
            phone: "",
            email: email,
            mobilityNeeds: [],
            emergencyContactName: null,
            emergencyContactPhone: null,
            savedAddresses: [],
          });
        } catch (e) {
          console.error("Failed to create patient profile during registration:", e);
        }
      }

      const verificationCode = crypto.randomInt(10000, 100000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db.insert(emailVerificationCodes).values({
        userId: user.id,
        email: email,
        code: verificationCode,
        expiresAt,
      });

      try {
        await sendEmailVerificationCode(email, verificationCode, fullName);
      } catch (emailErr) {
        console.error("Email verification send failed, code still valid:", emailErr);
      }

      console.log(`Email verification code generated for ${email}`);

      return res.status(201).json({
        message: "Account created! Please check your email for a verification code.",
        requiresVerification: true,
        email: email,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post("/api/auth/verify-email", loginRateLimiter, async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ message: "Email and verification code are required" });
      }

      const user = await storage.getUserByUsername(email);
      if (!user || user.emailVerified) {
        return res.status(400).json({ message: "Invalid or expired verification code" });
      }

      const [verifyEntry] = await db.select().from(emailVerificationCodes)
        .where(and(
          eq(emailVerificationCodes.userId, user.id),
          eq(emailVerificationCodes.email, email)
        ))
        .orderBy(desc(emailVerificationCodes.createdAt))
        .limit(1);

      if (!verifyEntry || verifyEntry.code !== code || verifyEntry.used || new Date() > verifyEntry.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired verification code" });
      }

      await db.update(emailVerificationCodes).set({ used: true }).where(eq(emailVerificationCodes.id, verifyEntry.id));
      await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));

      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role || "user";

      req.session.save((err) => {
        if (err) {
          console.error("Session save error after verification:", err);
          return res.status(500).json({ message: "Verification succeeded but login failed. Please sign in." });
        }
        console.log(`Email verified for ${email}`);
        res.json({
          message: "Email verified successfully!",
          verified: true,
          user: { id: user.id, username: user.username, role: user.role },
        });
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Verification failed. Please try again." });
    }
  });

  app.post("/api/auth/resend-verification", loginRateLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByUsername(email);
      if (!user || user.emailVerified) {
        return res.json({ message: "If an account exists with an unverified email, a new code has been sent." });
      }

      const newCode = crypto.randomInt(10000, 100000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db.insert(emailVerificationCodes).values({
        userId: user.id,
        email: email,
        code: newCode,
        expiresAt,
      });

      try {
        await sendEmailVerificationCode(email, newCode);
      } catch (emailErr) {
        console.error("Resend verification email failed:", emailErr);
      }

      console.log(`Verification code resent for ${email}`);
      res.json({ message: "A new verification code has been sent to your email." });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Auth routes with rate limiting protection
  app.post("/api/auth/login", loginRateLimiter, async (req, res) => {
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

      if (!user.emailVerified) {
        const newCode = crypto.randomInt(10000, 100000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await db.insert(emailVerificationCodes).values({
          userId: user.id,
          email: username,
          code: newCode,
          expiresAt,
        });
        try {
          await sendEmailVerificationCode(username, newCode);
        } catch (e) {
          console.error("Failed to send verification on login:", e);
        }
        return res.status(403).json({
          message: "Please verify your email first. A new code has been sent.",
          requiresVerification: true,
          email: username,
        });
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

      let redirectTo: string | undefined;
      let hasItCompany = false;
      let hasCourierCompany = false;
      if (user.role === "user") {
        const [itCo] = await db.select().from(itCompanies).where(eq(itCompanies.ownerId, user.id)).limit(1);
        if (itCo) {
          hasItCompany = true;
          redirectTo = "/it-services";
        }
        const [courierCo] = await db.select().from(courierCompanies).where(eq(courierCompanies.ownerId, user.id)).limit(1);
        if (courierCo) {
          hasCourierCompany = true;
          redirectTo = "/courier";
        }
      }

      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role || "user";
      req.session.permissions = user.permissions || [];
      if (driverId) {
        req.session.driverId = driverId;
      }

      if ((req as any).loginRateLimitKey) {
        clearLoginAttempts((req as any).loginRateLimitKey);
      }

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Login failed" });
        }

        res.json({ 
          message: "Login successful",
          user: { 
            id: user.id, 
            username: user.username, 
            role: user.role,
            permissions: user.permissions || [],
            hasItCompany,
            hasCourierCompany,
          },
          driver: driverProfile ? {
            id: driverProfile.id,
            fullName: driverProfile.fullName,
            applicationStatus: driverProfile.applicationStatus,
            kycStatus: driverProfile.kycStatus
          } : null,
          redirectTo,
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/forgot-password", loginRateLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByUsername(email);
      if (!user) {
        return res.json({ message: "If an account exists with that email, a reset code has been sent." });
      }

      const code = crypto.randomInt(10000, 100000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.insert(passwordResetCodes).values({
        userId: user.id,
        code,
        expiresAt,
      });

      try {
        await sendPasswordResetCode(email, code);
      } catch (emailErr) {
        console.error("Email sending failed, code still valid:", emailErr);
      }

      console.log(`Password reset code generated for ${email}`);
      res.json({ message: "If an account exists with that email, a reset code has been sent." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/verify-reset-code", loginRateLimiter, async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ message: "Email and code are required" });
      }

      const user = await storage.getUserByUsername(email);
      if (!user) {
        return res.status(400).json({ message: "Invalid code" });
      }

      const [resetEntry] = await db.select().from(passwordResetCodes)
        .where(eq(passwordResetCodes.userId, user.id))
        .orderBy(desc(passwordResetCodes.createdAt))
        .limit(1);

      if (!resetEntry || resetEntry.code !== code || resetEntry.used || new Date() > resetEntry.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired code" });
      }

      res.json({ message: "Code verified", verified: true });
    } catch (error) {
      console.error("Verify reset code error:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/reset-password", loginRateLimiter, async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        return res.status(400).json({ message: "Email, code, and new password are required" });
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{6,}$/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ message: "Password must be at least 6 characters with uppercase, lowercase, number, and special character" });
      }

      const user = await storage.getUserByUsername(email);
      if (!user) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const [resetEntry] = await db.select().from(passwordResetCodes)
        .where(eq(passwordResetCodes.userId, user.id))
        .orderBy(desc(passwordResetCodes.createdAt))
        .limit(1);

      if (!resetEntry || resetEntry.code !== code || resetEntry.used || new Date() > resetEntry.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired code. Please request a new one." });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(user.id, hash);

      await db.update(passwordResetCodes).set({ used: true }).where(eq(passwordResetCodes.id, resetEntry.id));

      console.log(`Password reset successful for ${email}`);
      res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
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

    let hasItCompany = false;
    let hasCourierCompany = false;
    if (user.role === "user") {
      const [itCo] = await db.select().from(itCompanies).where(eq(itCompanies.ownerId, user.id)).limit(1);
      if (itCo) hasItCompany = true;
      const [courierCo] = await db.select().from(courierCompanies).where(eq(courierCompanies.ownerId, user.id)).limit(1);
      if (courierCo) hasCourierCompany = true;
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions || [],
        hasItCompany,
        hasCourierCompany,
      },
      driver: driverProfile ? {
        id: driverProfile.id,
        fullName: driverProfile.fullName,
        applicationStatus: driverProfile.applicationStatus,
        kycStatus: driverProfile.kycStatus
      } : null
    });
  });

  app.post("/api/auth/accept-tos", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      await db.update(users).set({
        tosAcceptedAt: new Date(),
        tosVersion: "1.0",
        privacyPolicyAcceptedAt: new Date(),
      }).where(eq(users.id, userId));
      res.json({ message: "Terms of Service and Privacy Policy accepted" });
    } catch (error) {
      console.error("Error accepting TOS:", error);
      res.status(500).json({ message: "Failed to accept Terms of Service" });
    }
  });

  // ============================================
  // MOBILE API ENDPOINTS (Token-based auth)
  // ============================================
  
  // Mobile login - returns JWT access and refresh tokens
  app.post("/api/mobile/auth/login", loginRateLimiter, async (req, res) => {
    try {
      const { username, password, deviceId } = req.body;
      
      if (!username || !password) {
        return mobileError(res, 400, "Username and password are required", "MISSING_CREDENTIALS");
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return mobileError(res, 401, "Invalid username or password", "INVALID_CREDENTIALS");
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return mobileError(res, 401, "Invalid username or password", "INVALID_CREDENTIALS");
      }

      // Get driver profile if user is a driver
      let driverId: number | undefined;
      let driverProfile = null;
      if (user.role === "driver") {
        const driver = await storage.getDriverByUserId(user.id);
        if (driver) {
          driverId = driver.id;
          driverProfile = driver;
        }
      }

      const tokenPayload = {
        userId: typeof user.id === 'string' ? parseInt(user.id) : user.id,
        username: user.username,
        role: user.role || "user",
        driverId,
        deviceId: deviceId || 'unknown'
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshTokenValue = generateRefreshToken(tokenPayload);

      // Clear rate limit on successful login
      clearLoginAttempts((req as any).loginRateLimitKey);

      mobileSuccess(res, {
        accessToken,
        refreshToken: refreshTokenValue,
        expiresIn: 900,
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
      console.error("Mobile login error:", error);
      mobileError(res, 500, "Login failed", "AUTH_FAILED");
    }
  });

  // Mobile token refresh
  app.post("/api/mobile/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return mobileError(res, 400, "Refresh token required", "MISSING_TOKEN");
      }

      const payload = verifyToken(refreshToken, 'refresh');
      if (!payload) {
        return mobileError(res, 401, "Invalid or expired refresh token", "TOKEN_EXPIRED");
      }

      refreshTokens.delete(refreshToken);

      const tokenPayload = {
        userId: payload.userId,
        username: payload.username,
        role: payload.role,
        driverId: payload.driverId,
        deviceId: payload.deviceId
      };

      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      mobileSuccess(res, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      mobileError(res, 500, "Token refresh failed", "REFRESH_FAILED");
    }
  });

  // Mobile logout - invalidate refresh token
  app.post("/api/mobile/auth/logout", async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
      refreshTokens.delete(refreshToken);
    }
    mobileSuccess(res, { message: "Logged out successfully" });
  });

  // Mobile - delete account
  app.post("/api/mobile/auth/delete-account", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const { password, reason } = req.body;

      if (!password) {
        return mobileError(res, 400, "Password is required", "MISSING_PASSWORD");
      }

      const user = await storage.getUserByUsername(mobileUser.username);
      if (!user) {
        return mobileError(res, 404, "User not found", "USER_NOT_FOUND");
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return mobileError(res, 401, "Incorrect password", "INVALID_PASSWORD");
      }

      // Log the deletion request
      console.log(`Account deletion requested: userId=${user.id}, username=${user.username}, reason=${reason || 'none'}`);

      // Delete the user account
      await storage.deleteUser(user.id);

      mobileSuccess(res, { message: "Account deleted successfully" });
    } catch (error: any) {
      console.error("Account deletion error:", error);
      mobileError(res, 500, "Failed to delete account", "DELETE_FAILED");
    }
  });

  // Mobile - get current user (using JWT)
  app.get("/api/mobile/auth/me", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      
      const user = await storage.getUserByUsername(mobileUser.username);
      if (!user) {
        return mobileError(res, 401, "User not found", "USER_NOT_FOUND");
      }

      let driverProfile = null;
      if (mobileUser.driverId) {
        driverProfile = await storage.getDriver(mobileUser.driverId);
      }

      mobileSuccess(res, {
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
      console.error("Mobile auth me error:", error);
      mobileError(res, 500, "Failed to get user info", "FETCH_FAILED");
    }
  });

  // Mobile - register device for push notifications (FCM/APNs)
  app.post("/api/mobile/push/register", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const { deviceToken, platform, deviceId } = req.body;
      
      if (!deviceToken || !platform) {
        return mobileError(res, 400, "Device token and platform are required", "MISSING_FIELDS");
      }
      
      if (!['fcm', 'apns', 'ios', 'android'].includes(platform.toLowerCase())) {
        return mobileError(res, 400, "Platform must be 'fcm', 'apns', 'ios', or 'android'", "INVALID_PLATFORM");
      }
      
      const endpoint = `mobile://${platform.toLowerCase()}/${deviceToken}`;
      const p256dh = deviceId || 'mobile-device';
      const auth = `user-${mobileUser.userId}`;
      
      await saveSubscription(endpoint, p256dh, auth, mobileUser.role, mobileUser.driverId);
      
      mobileSuccess(res, { 
        registered: true,
        platform: platform.toLowerCase()
      });
    } catch (error) {
      console.error("Mobile push registration error:", error);
      mobileError(res, 500, "Failed to register device", "REGISTRATION_FAILED");
    }
  });

  // Mobile - get WebSocket token (using JWT auth)
  app.get("/api/mobile/auth/ws-token", mobileAuthMiddleware, (req, res) => {
    const mobileUser = (req as any).mobileUser as JwtPayload;
    const token = generateWsToken(String(mobileUser.userId), mobileUser.role);
    mobileSuccess(res, { token, expiresIn: 60 });
  });

  // Mobile - get available rides (for drivers)
  app.get("/api/mobile/rides", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const { status, limit = 50 } = req.query;
      
      let rides = await storage.getAllRides();
      
      if (mobileUser.role === 'driver' && mobileUser.driverId) {
        rides = rides.filter((r: any) => r.driverId === mobileUser.driverId);
      } else {
        rides = rides.filter((r: any) => String(r.patientId) === String(mobileUser.userId));
      }
      
      if (status && typeof status === 'string') {
        rides = rides.filter((r: any) => r.status === status);
      }
      
      const total = rides.length;
      rides = rides.slice(0, Number(limit));
      
      mobileSuccess(res, { rides }, 200, { total, limit: Number(limit) });
    } catch (error) {
      console.error("Mobile get rides error:", error);
      mobileError(res, 500, "Failed to get rides", "FETCH_FAILED");
    }
  });

  // Mobile - update ride status
  app.patch("/api/mobile/rides/:id/status", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const { status, latitude, longitude } = req.body;
      
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return mobileError(res, 404, "Ride not found", "RIDE_NOT_FOUND");
      }
      
      if (mobileUser.role === 'driver' && ride.driverId !== mobileUser.driverId) {
        return mobileError(res, 403, "Not authorized for this ride", "UNAUTHORIZED");
      }
      
      const updatedRide = await storage.updateRideStatus(rideId, status);
      if (!updatedRide) {
        return mobileError(res, 500, "Failed to update ride", "UPDATE_FAILED");
      }
      broadcastRideUpdate("status_change", updatedRide);

      try {
        const driver = mobileUser.driverId ? await storage.getDriver(mobileUser.driverId) : null;
        await notifyPatientOfRideUpdate(status, driver?.fullName, {
          rideId,
          driverName: driver?.fullName,
          driverPhone: driver?.phone || undefined,
          vehicleInfo: driver?.vehicleMake && driver?.vehicleModel ? `${driver.vehicleMake} ${driver.vehicleModel}` : undefined,
          licensePlate: driver?.licensePlate || undefined,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          fare: ride.estimatedFare ? Number(ride.estimatedFare) : undefined,
        });
      } catch (e) {
        console.error("Failed to send rich notification:", e);
      }
      
      mobileSuccess(res, { ride: updatedRide });
    } catch (error) {
      console.error("Mobile update ride status error:", error);
      mobileError(res, 500, "Failed to update ride status", "STATUS_UPDATE_FAILED");
    }
  });

  // Mobile - update driver location
  app.post("/api/mobile/driver/location", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      
      if (!mobileUser.driverId) {
        return mobileError(res, 403, "Not a driver account", "NOT_DRIVER");
      }
      
      const { latitude, longitude, rideId } = req.body;
      
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return mobileError(res, 400, "Valid latitude and longitude required", "INVALID_COORDS");
      }
      
      await storage.updateDriverLocation(mobileUser.driverId, latitude, longitude);
      
      if (rideId) {
        const ride = await storage.getRide(rideId);
        if (ride && ride.driverId === mobileUser.driverId) {
          broadcastRideUpdate("driver_location", { ...ride, driverLatitude: latitude, driverLongitude: longitude });
        }
      }
      
      mobileSuccess(res, { updated: true, latitude, longitude });
    } catch (error) {
      console.error("Mobile driver location update error:", error);
      mobileError(res, 500, "Failed to update location", "LOCATION_UPDATE_FAILED");
    }
  });

  // ============================================
  // MOBILE API - USER REGISTRATION
  // ============================================

  app.post("/api/mobile/auth/register", loginRateLimiter, async (req, res) => {
    try {
      const { username, password, confirmPassword, role, fullName, phone } = req.body;

      if (!username || !password) {
        return mobileError(res, 400, "Username (email) and password are required", "MISSING_CREDENTIALS");
      }

      if (password.length < 8) {
        return mobileError(res, 400, "Password must be at least 8 characters", "WEAK_PASSWORD");
      }
      if (!/[A-Z]/.test(password)) {
        return mobileError(res, 400, "Password must contain at least one uppercase letter", "WEAK_PASSWORD");
      }
      if (!/[a-z]/.test(password)) {
        return mobileError(res, 400, "Password must contain at least one lowercase letter", "WEAK_PASSWORD");
      }
      if (!/[0-9]/.test(password)) {
        return mobileError(res, 400, "Password must contain at least one number", "WEAK_PASSWORD");
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        return mobileError(res, 400, "Password must contain at least one special character", "WEAK_PASSWORD");
      }

      if (confirmPassword && password !== confirmPassword) {
        return mobileError(res, 400, "Passwords don't match", "PASSWORD_MISMATCH");
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return mobileError(res, 400, "Email is already registered. Please use a different email or login.", "EMAIL_EXISTS");
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const validRoles = ["user", "driver", "employer", "healthcare_worker", "patient"];
      const userRole = validRoles.includes(role) ? role : "user";
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role: userRole,
      });

      if (req.body.tosAccepted) {
        await db.update(users).set({
          tosAcceptedAt: new Date(),
          tosVersion: "1.0",
          privacyPolicyAcceptedAt: new Date(),
        }).where(eq(users.id, user.id));
      }

      if ((userRole === "user" || userRole === "patient") && (fullName || phone)) {
        try {
          await storage.createPatient({
            userId: user.id,
            fullName: fullName || username,
            phone: phone || "",
            email: username,
            mobilityNeeds: [],
            emergencyContactName: null,
            emergencyContactPhone: null,
            savedAddresses: [],
          });
        } catch (e) {
          console.error("Failed to create patient profile during registration:", e);
        }
      }

      const tokenPayload = {
        userId: typeof user.id === 'string' ? parseInt(user.id) : user.id,
        username: user.username,
        role: user.role || "user",
        deviceId: req.body.deviceId || 'unknown'
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshTokenValue = generateRefreshToken(tokenPayload);

      mobileSuccess(res, {
        accessToken,
        refreshToken: refreshTokenValue,
        expiresIn: 900,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      }, 201);
    } catch (error) {
      console.error("Mobile registration error:", error);
      mobileError(res, 500, "Registration failed", "REGISTRATION_FAILED");
    }
  });

  // ============================================
  // MOBILE API - JOBS
  // ============================================

  app.get("/api/mobile/jobs", async (req, res) => {
    try {
      const { state, zipCode, shift, search, limit = "50" } = req.query;
      let jobs = await storage.getAvailableJobs();

      if (state && typeof state === 'string') {
        jobs = jobs.filter((j: any) => j.state?.toLowerCase() === state.toLowerCase());
      }
      if (zipCode && typeof zipCode === 'string') {
        jobs = jobs.filter((j: any) => j.zipCode === zipCode);
      }
      if (shift && typeof shift === 'string') {
        jobs = jobs.filter((j: any) => j.shift?.toLowerCase() === shift.toLowerCase());
      }
      if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        jobs = jobs.filter((j: any) =>
          j.title?.toLowerCase().includes(q) ||
          j.facility?.toLowerCase().includes(q) ||
          j.location?.toLowerCase().includes(q)
        );
      }

      const total = jobs.length;
      jobs = jobs.slice(0, Number(limit));
      mobileSuccess(res, { jobs }, 200, { total, limit: Number(limit) });
    } catch (error) {
      console.error("Mobile get jobs error:", error);
      mobileError(res, 500, "Failed to get jobs", "FETCH_FAILED");
    }
  });

  app.get("/api/mobile/jobs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getJob(id);
      if (!job) {
        return mobileError(res, 404, "Job not found", "JOB_NOT_FOUND");
      }
      mobileSuccess(res, { job });
    } catch (error) {
      console.error("Mobile get job error:", error);
      mobileError(res, 500, "Failed to get job", "FETCH_FAILED");
    }
  });

  app.post("/api/mobile/jobs", mobileAuthMiddleware, async (req, res) => {
    try {
      const parsed = insertJobSchema.parse(req.body);
      const job = await storage.createJob(parsed);
      broadcastJobUpdate("add", job);
      mobileSuccess(res, { job }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return mobileError(res, 400, "Invalid job data", "VALIDATION_ERROR", error.errors);
      }
      console.error("Mobile create job error:", error);
      mobileError(res, 500, "Failed to create job", "CREATE_FAILED");
    }
  });

  // ============================================
  // MOBILE API - RIDES (Extended)
  // ============================================

  app.post("/api/mobile/rides", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideData = {
        ...req.body,
        patientId: mobileUser.userId,
        status: "requested",
      };

      const parsed = insertRideSchema.parse(rideData);
      const ride = await storage.createRide(parsed);

      const trackingData = generateTrackingToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      broadcastRideUpdate("new", ride);

      try {
        await notifyDriversOfNewRide(ride.pickupAddress, new Date(ride.appointmentTime), {
          rideId: ride.id,
          dropoffAddress: ride.dropoffAddress,
          distanceMiles: ride.distanceMiles ? Number(ride.distanceMiles) : undefined,
          estimatedFare: ride.estimatedFare ? Number(ride.estimatedFare) : undefined,
          vehicleType: ride.vehicleType || undefined,
        });
      } catch (e) {
        console.error("Failed to notify drivers:", e);
      }

      if (parsed.bookedByOther && parsed.patientEmail && parsed.bookerName) {
        sendRideBookedForPatientEmail({
          patientName: parsed.patientName,
          patientEmail: parsed.patientEmail,
          bookerName: parsed.bookerName,
          bookerRelation: parsed.bookerRelation || 'other',
          pickupAddress: parsed.pickupAddress,
          dropoffAddress: parsed.dropoffAddress,
          appointmentTime: new Date(parsed.appointmentTime),
          estimatedFare: req.body.estimatedFare,
          rideId: ride.id,
        }).catch(err => {
          console.error("Failed to send patient notification email:", err);
        });
      }

      mobileSuccess(res, { ride }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return mobileError(res, 400, "Invalid ride data", "VALIDATION_ERROR", error.errors);
      }
      console.error("Mobile create ride error:", error);
      mobileError(res, 500, "Failed to create ride", "CREATE_FAILED");
    }
  });

  app.get("/api/mobile/rides/pool", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      if (mobileUser.role !== 'driver') {
        return mobileError(res, 403, "Only drivers can view the ride pool", "NOT_DRIVER");
      }

      let rides = await storage.getAllRides();
      rides = rides.filter((r: any) => r.status === "requested" && !r.driverId);
      mobileSuccess(res, { rides }, 200, { total: rides.length });
    } catch (error) {
      console.error("Mobile ride pool error:", error);
      mobileError(res, 500, "Failed to get ride pool", "FETCH_FAILED");
    }
  });

  app.get("/api/mobile/rides/:id", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return mobileError(res, 404, "Ride not found", "RIDE_NOT_FOUND");
      }
      const isPatient = String(ride.patientId) === String(mobileUser.userId);
      const isDriver = mobileUser.driverId && ride.driverId === mobileUser.driverId;
      if (!isPatient && !isDriver) {
        return mobileError(res, 403, "Not authorized for this ride", "UNAUTHORIZED");
      }
      mobileSuccess(res, { ride });
    } catch (error) {
      console.error("Mobile get ride error:", error);
      mobileError(res, 500, "Failed to get ride", "FETCH_FAILED");
    }
  });

  app.post("/api/mobile/rides/:id/accept", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      if (!mobileUser.driverId) {
        return mobileError(res, 403, "Only drivers can accept rides", "NOT_DRIVER");
      }

      const [driverProfile] = await db.select().from(driverProfiles).where(eq(driverProfiles.id, mobileUser.driverId));
      if (driverProfile && driverProfile.patientTransportEnabled === false) {
        return mobileError(res, 403, "Patient transportation is not enabled on your profile", "SERVICE_DISABLED");
      }

      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return mobileError(res, 404, "Ride not found", "RIDE_NOT_FOUND");
      }
      if (ride.status !== "requested") {
        return mobileError(res, 400, "Ride is no longer available", "RIDE_UNAVAILABLE");
      }

      const updatedRide = await storage.assignDriver(rideId, mobileUser.driverId);
      if (updatedRide) {
        await storage.updateRideStatus(rideId, "accepted");
        const finalRide = await storage.getRide(rideId);
        broadcastRideUpdate("status_change", finalRide);

        try {
          const driver = await storage.getDriver(mobileUser.driverId);
          if (finalRide) await notifyPatientOfRideUpdate("accepted", driver?.fullName, {
            rideId,
            driverName: driver?.fullName,
            driverPhone: driver?.phone || undefined,
            vehicleInfo: driver?.vehicleMake && driver?.vehicleModel ? `${driver.vehicleMake} ${driver.vehicleModel}` : undefined,
            licensePlate: driver?.licensePlate || undefined,
            pickupAddress: ride.pickupAddress,
            dropoffAddress: ride.dropoffAddress,
          });
        } catch (e) {
          console.error("Failed to notify patient:", e);
        }

        mobileSuccess(res, { ride: finalRide });
      } else {
        mobileError(res, 500, "Failed to accept ride", "ACCEPT_FAILED");
      }
    } catch (error) {
      console.error("Mobile accept ride error:", error);
      mobileError(res, 500, "Failed to accept ride", "ACCEPT_FAILED");
    }
  });

  app.post("/api/mobile/rides/:id/complete", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return mobileError(res, 404, "Ride not found", "RIDE_NOT_FOUND");
      }
      if (mobileUser.role === 'driver' && ride.driverId !== mobileUser.driverId) {
        return mobileError(res, 403, "Not authorized for this ride", "UNAUTHORIZED");
      }

      const { actualDistanceMiles } = req.body;
      const updatedRide = await storage.completeRide(rideId, {
        actualPickupTime: ride.actualPickupTime || new Date(),
        actualDropoffTime: new Date(),
        actualDistanceMiles: actualDistanceMiles || ride.distanceMiles,
      });

      if (updatedRide) {
        broadcastRideUpdate("status_change", updatedRide);
        if (mobileUser.driverId) {
          await storage.incrementDriverCompletedRides(mobileUser.driverId);
        }
        try {
          await notifyPatientOfRideUpdate("completed", undefined, {
            rideId,
            dropoffAddress: ride.dropoffAddress,
            fare: updatedRide.estimatedFare ? Number(updatedRide.estimatedFare) : undefined,
          });
        } catch (e) {
          console.error("Failed to notify patient:", e);
        }
      }

      mobileSuccess(res, { ride: updatedRide });
    } catch (error) {
      console.error("Mobile complete ride error:", error);
      mobileError(res, 500, "Failed to complete ride", "COMPLETE_FAILED");
    }
  });

  app.post("/api/mobile/rides/:id/cancel", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return mobileError(res, 404, "Ride not found", "RIDE_NOT_FOUND");
      }

      const { reason } = req.body;
      const cancelledBy = mobileUser.role === 'driver' ? 'driver' : 'patient';
      const updatedRide = await storage.cancelRide(rideId, cancelledBy, reason || "Cancelled via mobile app");

      if (updatedRide) {
        broadcastRideUpdate("status_change", updatedRide);
        if (cancelledBy === 'driver' && mobileUser.driverId) {
          await storage.incrementDriverCancellations(mobileUser.driverId);
        }
        try {
          await notifyPatientOfRideUpdate("cancelled", undefined, { rideId });
        } catch (e) {
          console.error("Failed to notify patient:", e);
        }
      }

      mobileSuccess(res, { ride: updatedRide });
    } catch (error) {
      console.error("Mobile cancel ride error:", error);
      mobileError(res, 500, "Failed to cancel ride", "CANCEL_FAILED");
    }
  });

  app.get("/api/mobile/rides/:id/messages", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return mobileError(res, 404, "Ride not found", "RIDE_NOT_FOUND");
      }
      const isPatient = String(ride.patientId) === String(mobileUser.userId);
      const isDriver = mobileUser.driverId && ride.driverId === mobileUser.driverId;
      if (!isPatient && !isDriver) {
        return mobileError(res, 403, "Not authorized for this ride", "UNAUTHORIZED");
      }
      const messages = await storage.getRideMessages(rideId);
      mobileSuccess(res, { messages }, 200, { total: messages.length });
    } catch (error) {
      console.error("Mobile get messages error:", error);
      mobileError(res, 500, "Failed to get messages", "FETCH_FAILED");
    }
  });

  app.post("/api/mobile/rides/:id/messages", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const { message: messageText } = req.body;

      if (!messageText || typeof messageText !== 'string' || messageText.trim().length === 0) {
        return mobileError(res, 400, "Message text is required", "MISSING_MESSAGE");
      }

      const ride = await storage.getRide(rideId);
      if (!ride) {
        return mobileError(res, 404, "Ride not found", "RIDE_NOT_FOUND");
      }
      const isPatient = String(ride.patientId) === String(mobileUser.userId);
      const isDriver = mobileUser.driverId && ride.driverId === mobileUser.driverId;
      if (!isPatient && !isDriver) {
        return mobileError(res, 403, "Not authorized for this ride", "UNAUTHORIZED");
      }

      const senderType = mobileUser.role === 'driver' ? 'driver' : 'patient';
      const msg = await storage.createRideMessage({
        rideId,
        senderType,
        message: messageText.trim(),
        isQuickMessage: false,
      });

      broadcastChatMessage(rideId, msg);
      mobileSuccess(res, { message: msg }, 201);
    } catch (error) {
      console.error("Mobile send message error:", error);
      mobileError(res, 500, "Failed to send message", "SEND_FAILED");
    }
  });

  app.get("/api/mobile/rides/:id/events", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return mobileError(res, 404, "Ride not found", "RIDE_NOT_FOUND");
      }
      const isPatient = String(ride.patientId) === String(mobileUser.userId);
      const isDriver = mobileUser.driverId && ride.driverId === mobileUser.driverId;
      if (!isPatient && !isDriver) {
        return mobileError(res, 403, "Not authorized for this ride", "UNAUTHORIZED");
      }
      const events = await storage.getRideEvents(rideId);
      mobileSuccess(res, { events }, 200, { total: events.length });
    } catch (error) {
      console.error("Mobile get events error:", error);
      mobileError(res, 500, "Failed to get ride events", "FETCH_FAILED");
    }
  });

  app.post("/api/mobile/rides/:id/rate", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const { rating, comment } = req.body;

      if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return mobileError(res, 400, "Rating must be a number between 1 and 5", "INVALID_RATING");
      }

      const ride = await storage.getRide(rideId);
      if (!ride) {
        return mobileError(res, 404, "Ride not found", "RIDE_NOT_FOUND");
      }
      const isPatient = String(ride.patientId) === String(mobileUser.userId);
      const isDriver = mobileUser.driverId && ride.driverId === mobileUser.driverId;
      if (!isPatient && !isDriver) {
        return mobileError(res, 403, "Not authorized for this ride", "UNAUTHORIZED");
      }

      const rideRating = await storage.createRideRating({
        rideId,
        ratedBy: mobileUser.role,
        rating,
        comment: comment || null,
      });

      if (ride.driverId && mobileUser.role !== 'driver') {
        await storage.updateDriverRating(ride.driverId, rating);
      }

      mobileSuccess(res, { rating: rideRating }, 201);
    } catch (error) {
      console.error("Mobile rate ride error:", error);
      mobileError(res, 500, "Failed to rate ride", "RATE_FAILED");
    }
  });

  // ============================================
  // MOBILE API - DRIVER PROFILE & MANAGEMENT
  // ============================================

  app.get("/api/mobile/driver/profile", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      if (!mobileUser.driverId) {
        const driverByUser = await storage.getDriverByUserId(mobileUser.userId);
        if (!driverByUser) {
          return mobileError(res, 404, "No driver profile found", "DRIVER_NOT_FOUND");
        }
        return mobileSuccess(res, { driver: driverByUser });
      }
      const driver = await storage.getDriver(mobileUser.driverId);
      if (!driver) {
        return mobileError(res, 404, "Driver not found", "DRIVER_NOT_FOUND");
      }
      mobileSuccess(res, { driver });
    } catch (error) {
      console.error("Mobile get driver profile error:", error);
      mobileError(res, 500, "Failed to get driver profile", "FETCH_FAILED");
    }
  });

  app.patch("/api/mobile/driver/availability", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      if (!mobileUser.driverId) {
        return mobileError(res, 403, "Not a driver account", "NOT_DRIVER");
      }
      const { isAvailable } = req.body;
      if (typeof isAvailable !== 'boolean') {
        return mobileError(res, 400, "isAvailable must be a boolean", "INVALID_INPUT");
      }
      const driver = await storage.updateDriverAvailability(mobileUser.driverId, isAvailable);
      mobileSuccess(res, { driver });
    } catch (error) {
      console.error("Mobile update availability error:", error);
      mobileError(res, 500, "Failed to update availability", "UPDATE_FAILED");
    }
  });

  app.get("/api/mobile/driver/earnings", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      if (!mobileUser.driverId) {
        return mobileError(res, 403, "Not a driver account", "NOT_DRIVER");
      }
      const earnings = await storage.getDriverEarnings(mobileUser.driverId);
      const driver = await storage.getDriver(mobileUser.driverId);
      mobileSuccess(res, {
        earnings,
        balance: {
          available: driver?.availableBalance || "0",
          pending: driver?.pendingBalance || "0",
          total: driver?.totalEarnings || "0",
        }
      });
    } catch (error) {
      console.error("Mobile get earnings error:", error);
      mobileError(res, 500, "Failed to get earnings", "FETCH_FAILED");
    }
  });

  app.get("/api/mobile/driver/payouts", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      if (!mobileUser.driverId) {
        return mobileError(res, 403, "Not a driver account", "NOT_DRIVER");
      }
      const payouts = await storage.getDriverPayouts(mobileUser.driverId);
      mobileSuccess(res, { payouts }, 200, { total: payouts.length });
    } catch (error) {
      console.error("Mobile get payouts error:", error);
      mobileError(res, 500, "Failed to get payouts", "FETCH_FAILED");
    }
  });

  app.post("/api/mobile/driver/apply", async (req, res) => {
    try {
      const { email, password, confirmPassword, ...driverData } = req.body;

      if (!email || !password) {
        return mobileError(res, 400, "Email and password are required", "MISSING_CREDENTIALS");
      }
      if (password.length < 8) {
        return mobileError(res, 400, "Password must be at least 8 characters", "WEAK_PASSWORD");
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        return mobileError(res, 400, "Password must contain uppercase, lowercase, number, and special character", "WEAK_PASSWORD");
      }
      if (confirmPassword && password !== confirmPassword) {
        return mobileError(res, 400, "Passwords don't match", "PASSWORD_MISMATCH");
      }

      const existingUser = await storage.getUserByUsername(email);
      if (existingUser) {
        return mobileError(res, 400, "Email is already registered", "EMAIL_EXISTS");
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username: email, password: hashedPassword, role: "driver" });

      const parsed = insertDriverProfileSchema.parse({
        ...driverData,
        email,
        userId: user.id,
      });
      const driver = await storage.createDriver(parsed);

      const tokenPayload = {
        userId: typeof user.id === 'string' ? parseInt(user.id) : user.id,
        username: user.username,
        role: "driver",
        driverId: driver.id,
        deviceId: req.body.deviceId || 'unknown'
      };
      const accessToken = generateAccessToken(tokenPayload);
      const refreshTokenValue = generateRefreshToken(tokenPayload);

      mobileSuccess(res, {
        accessToken,
        refreshToken: refreshTokenValue,
        expiresIn: 900,
        user: { id: user.id, username: user.username, role: "driver" },
        driver: { id: driver.id, fullName: driver.fullName, applicationStatus: driver.applicationStatus }
      }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return mobileError(res, 400, "Invalid driver data", "VALIDATION_ERROR", error.errors);
      }
      console.error("Mobile driver apply error:", error);
      mobileError(res, 500, "Failed to submit driver application", "APPLY_FAILED");
    }
  });

  // ============================================
  // MOBILE API - PATIENT PROFILE
  // ============================================

  app.get("/api/mobile/patient/profile", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const patient = await storage.getPatient(mobileUser.userId);
      if (!patient) {
        return mobileError(res, 404, "Patient profile not found", "PATIENT_NOT_FOUND");
      }
      mobileSuccess(res, { patient });
    } catch (error) {
      console.error("Mobile get patient profile error:", error);
      mobileError(res, 500, "Failed to get patient profile", "FETCH_FAILED");
    }
  });

  app.post("/api/mobile/patient/profile", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const existing = await storage.getPatient(mobileUser.userId);
      if (existing) {
        return mobileSuccess(res, { patient: existing });
      }

      const { fullName, phone, email, mobilityNeeds, emergencyContactName, emergencyContactPhone } = req.body;
      const patient = await storage.createPatient({
        userId: mobileUser.userId,
        fullName: fullName || mobileUser.username,
        phone: phone || "",
        email: email || mobileUser.username,
        mobilityNeeds: mobilityNeeds || [],
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        savedAddresses: [],
      });

      mobileSuccess(res, { patient }, 201);
    } catch (error) {
      console.error("Mobile create patient profile error:", error);
      mobileError(res, 500, "Failed to create patient profile", "CREATE_FAILED");
    }
  });

  // ============================================
  // MOBILE API - SURGE PRICING
  // ============================================

  app.get("/api/mobile/surge/current", async (_req, res) => {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay();

      const activeSurge = await storage.getActiveSurgePricing(currentDay, currentHour);

      mobileSuccess(res, {
        isActive: !!activeSurge,
        multiplier: activeSurge ? activeSurge.multiplier : 1.0,
        reason: activeSurge ? activeSurge.reason : null,
      });
    } catch (error) {
      console.error("Mobile surge pricing error:", error);
      mobileError(res, 500, "Failed to get surge pricing", "FETCH_FAILED");
    }
  });

  // ============================================
  // MOBILE API - INCIDENTS
  // ============================================

  app.post("/api/mobile/incidents", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const incidentData = {
        ...req.body,
        reporterId: mobileUser.userId,
        reporterType: mobileUser.role,
      };

      const incident = await storage.createIncidentReport(incidentData);
      mobileSuccess(res, { incident }, 201);
    } catch (error) {
      console.error("Mobile create incident error:", error);
      mobileError(res, 500, "Failed to report incident", "CREATE_FAILED");
    }
  });

  // ============================================
  // MOBILE API - PAYMENTS (Stripe)
  // ============================================

  app.post("/api/mobile/rides/:id/payment-intent", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return mobileError(res, 404, "Ride not found", "RIDE_NOT_FOUND");
      }

      const isPatient = String(ride.patientId) === String(mobileUser.userId);
      if (!isPatient) {
        return mobileError(res, 403, "Only the ride patient can create a payment", "UNAUTHORIZED");
      }

      const fare = parseFloat(ride.estimatedFare || "0");
      if (fare <= 0) {
        return mobileError(res, 400, "Invalid fare amount", "INVALID_FARE");
      }

      const stripeClient = getUncachableStripeClient();
      if (!stripeClient) {
        return mobileError(res, 500, "Payment service unavailable", "PAYMENT_UNAVAILABLE");
      }

      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(fare * 100),
        currency: "usd",
        metadata: { rideId: String(rideId), type: "ride_payment" },
      });

      mobileSuccess(res, {
        clientSecret: paymentIntent.client_secret,
        publishableKey: getStripePublishableKey(),
        amount: fare,
        currency: "usd",
      });
    } catch (error) {
      console.error("Mobile payment intent error:", error);
      mobileError(res, 500, "Failed to create payment", "PAYMENT_FAILED");
    }
  });

  app.post("/api/mobile/rides/:id/tip", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const { amount } = req.body;

      if (!amount || typeof amount !== 'number' || amount <= 0 || amount > 500) {
        return mobileError(res, 400, "Tip amount must be a number between $0.01 and $500", "INVALID_TIP");
      }

      const ride = await storage.getRide(rideId);
      if (!ride) {
        return mobileError(res, 404, "Ride not found", "RIDE_NOT_FOUND");
      }

      const isPatient = String(ride.patientId) === String(mobileUser.userId);
      if (!isPatient) {
        return mobileError(res, 403, "Only the ride patient can tip", "UNAUTHORIZED");
      }

      const stripeClient = getUncachableStripeClient();
      if (!stripeClient) {
        return mobileError(res, 500, "Payment service unavailable", "PAYMENT_UNAVAILABLE");
      }

      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: "usd",
        metadata: { rideId: String(rideId), type: "tip" },
      });

      mobileSuccess(res, {
        clientSecret: paymentIntent.client_secret,
        publishableKey: getStripePublishableKey(),
        amount,
        currency: "usd",
      });
    } catch (error) {
      console.error("Mobile tip payment error:", error);
      mobileError(res, 500, "Failed to create tip payment", "TIP_FAILED");
    }
  });

  // ============================================
  // MOBILE API DOCUMENTATION (Complete)
  // ============================================

  app.get("/api/mobile/docs", (_req, res) => {
    res.json({
      apiVersion: "2.0.0",
      baseUrl: "/api/mobile",
      flutterIntegration: {
        note: "This API is designed for the Flutter app (com.fieldhcp.app) to connect to the CareHub backend",
        authentication: "Use Bearer token in Authorization header for all authenticated requests",
        firebasePush: "Register your FCM token via POST /api/mobile/push/register after login",
        webSockets: "Get a ws-token via GET /api/mobile/auth/ws-token, then connect to wss://<host>/ws/rides?token=<ws-token>",
      },
      authentication: {
        type: "Bearer Token (JWT)",
        loginEndpoint: "POST /api/mobile/auth/login",
        registerEndpoint: "POST /api/mobile/auth/register",
        refreshEndpoint: "POST /api/mobile/auth/refresh",
        logoutEndpoint: "POST /api/mobile/auth/logout",
        tokenExpiry: "15 minutes (access), 7 days (refresh)",
        passwordRequirements: "Min 8 chars, uppercase, lowercase, number, special character"
      },
      endpoints: {
        auth: [
          { method: "POST", path: "/auth/register", description: "Register new user account with role selection", requiresAuth: false, body: { username: "email", password: "string", role: "employer|healthcare_worker|patient|driver", fullName: "string (optional)", phone: "string (optional)" } },
          { method: "POST", path: "/auth/login", description: "Login with username/password, returns access and refresh tokens", requiresAuth: false, body: { username: "email", password: "string", deviceId: "string (optional)" } },
          { method: "POST", path: "/auth/refresh", description: "Refresh access token using refresh token", requiresAuth: false, body: { refreshToken: "string" } },
          { method: "POST", path: "/auth/logout", description: "Invalidate refresh token", requiresAuth: false },
          { method: "GET", path: "/auth/me", description: "Get current user info and driver profile if applicable", requiresAuth: true },
          { method: "GET", path: "/auth/ws-token", description: "Get WebSocket authentication token", requiresAuth: true }
        ],
        push: [
          { method: "POST", path: "/push/register", description: "Register device for push notifications (FCM/APNs)", requiresAuth: true, body: { deviceToken: "string", platform: "fcm|apns|ios|android", deviceId: "string (optional)" } }
        ],
        jobs: [
          { method: "GET", path: "/jobs", description: "List available jobs with optional filters", requiresAuth: false, query: { state: "string", zipCode: "string", shift: "string", search: "string", limit: "number" } },
          { method: "GET", path: "/jobs/:id", description: "Get job details", requiresAuth: false },
          { method: "POST", path: "/jobs", description: "Create a new job posting", requiresAuth: true }
        ],
        rides: [
          { method: "GET", path: "/rides", description: "Get user's rides (filtered by driver for driver accounts)", requiresAuth: true, query: { status: "string", limit: "number" } },
          { method: "POST", path: "/rides", description: "Book a new ride", requiresAuth: true },
          { method: "GET", path: "/rides/pool", description: "Get available rides for drivers to claim", requiresAuth: true },
          { method: "GET", path: "/rides/:id", description: "Get ride details", requiresAuth: true },
          { method: "PATCH", path: "/rides/:id/status", description: "Update ride status", requiresAuth: true },
          { method: "POST", path: "/rides/:id/accept", description: "Driver accepts a ride", requiresAuth: true },
          { method: "POST", path: "/rides/:id/complete", description: "Mark ride as completed", requiresAuth: true },
          { method: "POST", path: "/rides/:id/cancel", description: "Cancel a ride", requiresAuth: true, body: { reason: "string (optional)" } },
          { method: "GET", path: "/rides/:id/messages", description: "Get chat messages for a ride", requiresAuth: true },
          { method: "POST", path: "/rides/:id/messages", description: "Send chat message", requiresAuth: true, body: { message: "string" } },
          { method: "GET", path: "/rides/:id/events", description: "Get ride event history", requiresAuth: true },
          { method: "POST", path: "/rides/:id/rate", description: "Rate a completed ride", requiresAuth: true, body: { rating: "1-5", comment: "string (optional)" } },
          { method: "POST", path: "/rides/:id/payment-intent", description: "Create Stripe payment intent for ride", requiresAuth: true },
          { method: "POST", path: "/rides/:id/tip", description: "Create payment intent for driver tip", requiresAuth: true, body: { amount: "number" } }
        ],
        driver: [
          { method: "GET", path: "/driver/profile", description: "Get driver profile", requiresAuth: true },
          { method: "PATCH", path: "/driver/availability", description: "Toggle driver availability", requiresAuth: true, body: { isAvailable: "boolean" } },
          { method: "POST", path: "/driver/location", description: "Update driver GPS location", requiresAuth: true, body: { latitude: "number", longitude: "number", rideId: "number (optional)" } },
          { method: "GET", path: "/driver/earnings", description: "Get driver earnings summary", requiresAuth: true },
          { method: "GET", path: "/driver/payouts", description: "Get payout history", requiresAuth: true },
          { method: "POST", path: "/driver/apply", description: "Apply as a new driver (creates account)", requiresAuth: false }
        ],
        patient: [
          { method: "GET", path: "/patient/profile", description: "Get patient profile", requiresAuth: true },
          { method: "POST", path: "/patient/profile", description: "Create patient profile", requiresAuth: true }
        ],
        surge: [
          { method: "GET", path: "/surge/current", description: "Get current surge pricing status", requiresAuth: false }
        ],
        incidents: [
          { method: "POST", path: "/incidents", description: "Report a safety incident", requiresAuth: true }
        ]
      },
      websocket: {
        jobsUrl: "wss://<host>/ws/jobs?token=<ws-token>",
        ridesUrl: "wss://<host>/ws/rides?token=<ws-token>",
        chatUrl: "wss://<host>/ws/chat/:rideId?token=<ws-token>",
        note: "Get ws-token from GET /api/mobile/auth/ws-token endpoint. Tokens are single-use and expire after 60 seconds."
      },
      requestFormat: {
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer <access_token>"
        }
      },
      responseFormat: {
        success: "{ status: 'success', data: { ... }, meta: { timestamp, version } }",
        error: "{ status: 'error', error: { message, code, details? }, meta: { timestamp, version } }",
        note: "All responses include a status field and meta object with timestamp and API version"
      },
      rideStatuses: ["requested", "accepted", "en_route", "arrived", "in_progress", "completed", "cancelled"],
      paymentTypes: ["self_pay", "insurance"],
    });
  });

  // Get a short-lived token for WebSocket authentication
  app.get("/api/auth/ws-token", requireAuth, (req, res) => {
    const token = generateWsToken(req.session.userId!, req.session.role!);
    res.json({ token });
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

  app.post("/api/jobs", requireAuth, async (req, res) => {
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

  // Rides WebSocket - requires authentication for driver/admin access
  const rideWss = new WebSocketServer({ server: httpServer, path: "/ws/rides" });
  
  rideWss.on("connection", (ws, req) => {
    // Parse token from query string for authentication
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    
    // Validate authentication token - required for ride updates
    if (!token) {
      console.warn("Security: Rejected ride WebSocket connection - no token provided");
      ws.close(4401, "Authentication required");
      return;
    }
    
    const userInfo = validateWsToken(token);
    if (!userInfo) {
      console.warn("Security: Rejected ride WebSocket connection - invalid/expired token");
      ws.close(4401, "Invalid or expired token");
      return;
    }
    
    // Only drivers and admins can receive ride updates
    if (userInfo.role !== "driver" && userInfo.role !== "admin") {
      console.warn(`Security: Rejected ride WebSocket connection - unauthorized role: ${userInfo.role}`);
      ws.close(4403, "Unauthorized role");
      return;
    }
    
    console.log(`Authenticated ride WebSocket connection for user ${userInfo.userId} (${userInfo.role})`);
    rideClients.add(ws);
    
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

  // Ride history by phone number (public - patients look up their rides)
  app.get("/api/rides/history", async (req, res) => {
    try {
      const phone = req.query.phone as string;
      if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
      }
      const rides = await storage.getRidesByPhone(phone);
      res.json(rides);
    } catch (error) {
      console.error("Error fetching ride history:", error);
      res.status(500).json({ message: "Failed to fetch ride history" });
    }
  });

  // Ride history for authenticated users
  app.get("/api/rides/my-rides", requireAuth, async (req, res) => {
    try {
      const allRides = await storage.getAllRides();
      const userRides = allRides.filter(r => {
        if (req.session.role === "driver" && req.session.driverId) {
          return r.driverId === req.session.driverId;
        }
        return false;
      });
      res.json(userRides);
    } catch (error) {
      console.error("Error fetching my rides:", error);
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
      if (ride.medicalNotes && req.session?.userId) {
        logAudit(req.session.userId, "view_ride_with_phi", "ride", String(id), { hasMedicalNotes: true }, req);
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
      
      notifyDriversOfNewRide(ride.pickupAddress, ride.appointmentTime, {
        rideId: ride.id,
        dropoffAddress: ride.dropoffAddress,
        distanceMiles: ride.distanceMiles ? Number(ride.distanceMiles) : undefined,
        estimatedFare: ride.estimatedFare ? Number(ride.estimatedFare) : undefined,
        vehicleType: ride.vehicleType || undefined,
      }).catch(err => {
        console.error("Failed to send push notification:", err);
      });

      if (parsed.bookedByOther && parsed.patientEmail && parsed.bookerName) {
        sendRideBookedForPatientEmail({
          patientName: parsed.patientName,
          patientEmail: parsed.patientEmail,
          bookerName: parsed.bookerName,
          bookerRelation: parsed.bookerRelation || 'other',
          pickupAddress: parsed.pickupAddress,
          dropoffAddress: parsed.dropoffAddress,
          appointmentTime: new Date(parsed.appointmentTime),
          estimatedFare: req.body.estimatedFare,
          rideId: ride.id,
        }).catch(err => {
          console.error("Failed to send patient notification email:", err);
        });
      }
      
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
        // Wait time charges: $0.50/min after 15 min grace
        const waitMin = existingRide.waitTimeMinutes || 0;
        const billableWait = Math.max(0, waitMin - 15);
        const waitCharge = billableWait * 0.50;
        const finalFare = Math.max(22, fareWithSurge + tolls + waitCharge);
        
        const ride = await storage.completeRide(id, finalFare.toFixed(2), tolls.toString(), distance.toFixed(2));
        
        // Expire tracking token when ride completes
        await storage.expireTrackingToken(id);
        
        // Update payment status to completed (payment was already captured at booking)
        if (existingRide.stripePaymentIntentId && existingRide.paymentType === 'self_pay') {
          await storage.updateRidePayment(id, { 
            paymentStatus: 'completed',
            stripePaymentIntentId: existingRide.stripePaymentIntentId,
            paidAmount: existingRide.paidAmount || finalFare.toString()
          });
        }
        
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

  const ACTIVE_RIDE_STATUSES = ["accepted", "driver_enroute", "arrived", "in_progress"];
  const ACTIVE_DELIVERY_STATUSES = ["accepted", "en_route_pickup", "picked_up", "in_transit", "arrived"];

  async function checkDriverHasActiveTask(driverId: number): Promise<{ hasActiveRide: boolean; hasActiveDelivery: boolean }> {
    const driverRides = await db.select().from(rides).where(eq(rides.driverId, driverId));
    const hasActiveRide = driverRides.some(r => ACTIVE_RIDE_STATUSES.includes(r.status));

    const driverDeliveries = await db.select().from(courierDeliveries).where(eq(courierDeliveries.driverId, driverId));
    const hasActiveDelivery = driverDeliveries.some(d => ACTIVE_DELIVERY_STATUSES.includes(d.status));

    return { hasActiveRide, hasActiveDelivery };
  }

  const DRIVER_COMPLAINT_CATEGORIES = ["reckless_driving", "no_show", "unprofessional", "vehicle_condition", "safety_violation", "overcharging", "harassment", "intoxication", "route_deviation", "other"];
  const DRIVER_AUTO_HOLD_THRESHOLD = 3;

  async function checkDriverCompliance(driverId: number): Promise<{ compliant: boolean; issues: string[] }> {
    const driver = await storage.getDriver(driverId);
    if (!driver) return { compliant: false, issues: ["Driver not found"] };

    const issues: string[] = [];

    if (driver.accountStatus === "suspended") {
      if (driver.suspendedUntil && new Date(driver.suspendedUntil) > new Date()) {
        issues.push(`Account suspended until ${new Date(driver.suspendedUntil).toLocaleDateString()}`);
      } else if (driver.suspendedUntil && new Date(driver.suspendedUntil) <= new Date()) {
        await db.update(driverProfiles)
          .set({ accountStatus: "active", suspendedAt: null, suspendedUntil: null, suspensionReason: null })
          .where(eq(driverProfiles.id, driverId));
      } else {
        issues.push("Account is suspended. Please contact support.");
      }
    }

    if (driver.accountStatus === "deactivated") {
      issues.push("Account has been permanently deactivated.");
    }

    if (driver.accountStatus === "on_hold") {
      issues.push("Account is on hold pending complaint review. You cannot accept rides until the review is complete.");
    }

    if (driver.applicationStatus !== "approved") {
      issues.push("Application has not been approved yet.");
    }

    const now = new Date();
    if (driver.driversLicenseExpiry) {
      const expiry = new Date(driver.driversLicenseExpiry);
      if (expiry < now) issues.push("Driver's license has expired.");
    }
    if (driver.insuranceExpiry) {
      const expiry = new Date(driver.insuranceExpiry);
      if (expiry < now) issues.push("Insurance has expired.");
    }
    if (driver.vehicleInspectionExpiry) {
      const expiry = new Date(driver.vehicleInspectionExpiry);
      if (expiry < now) issues.push("Vehicle inspection has expired.");
    }
    if (driver.backgroundCheckStatus === "failed") {
      issues.push("Background check failed.");
    }

    return { compliant: issues.length === 0, issues };
  }

  // Protected: Only authenticated drivers can accept rides
  app.post("/api/rides/:id/accept", requireDriver, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const userId = (req as any).session?.userId;
      const [driverProfile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, userId));
      if (!driverProfile) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const driverId = driverProfile.id;
      
      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      if (driverProfile.patientTransportEnabled === false) {
        return res.status(403).json({ message: "Patient transportation is not enabled on your profile. Enable it in your dashboard settings." });
      }

      const compliance = await checkDriverCompliance(driverId);
      if (!compliance.compliant) {
        return res.status(403).json({ 
          message: "Cannot accept rides due to compliance issues",
          issues: compliance.issues
        });
      }

      const activeTask = await checkDriverHasActiveTask(driverId);
      if (activeTask.hasActiveRide) {
        return res.status(409).json({ message: "You already have an active ride. Complete it before accepting another." });
      }
      if (activeTask.hasActiveDelivery) {
        return res.status(409).json({ message: "You have an active medical courier delivery. Complete it before accepting a ride." });
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

      logAudit(req.session.userId || null, "accept_ride", "ride", rideId.toString(), { driverId }, req);
      
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

      // Note: Payment was captured at booking. Refunds for cancelled rides 
      // should be processed via the admin refund endpoint if needed.
      
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

  app.get("/api/surge/zones", async (_req, res) => {
    try {
      const activeRides = await storage.getActiveRides();
      const requestedRides = activeRides.filter(r => r.status === "requested");
      const inProgressRides = activeRides.filter(r => ["in_progress", "driver_enroute", "arrived"].includes(r.status));
      const allDemandRides = [...requestedRides, ...inProgressRides];
      const availableDrivers = await storage.getAvailableDrivers();

      const zones: { lat: number; lng: number; demandCount: number; multiplier: number; label: string; radius: number }[] = [];

      if (allDemandRides.length > 0) {
        const clusters: { lat: number; lng: number; rides: typeof allDemandRides }[] = [];
        const CLUSTER_RADIUS = 0.15;

        for (const ride of allDemandRides) {
          const lat = parseFloat(ride.pickupLat);
          const lng = parseFloat(ride.pickupLng);
          if (isNaN(lat) || isNaN(lng)) continue;

          let added = false;
          for (const cluster of clusters) {
            const dist = Math.sqrt(Math.pow(cluster.lat - lat, 2) + Math.pow(cluster.lng - lng, 2));
            if (dist < CLUSTER_RADIUS) {
              cluster.rides.push(ride);
              cluster.lat = (cluster.lat * (cluster.rides.length - 1) + lat) / cluster.rides.length;
              cluster.lng = (cluster.lng * (cluster.rides.length - 1) + lng) / cluster.rides.length;
              added = true;
              break;
            }
          }
          if (!added) {
            clusters.push({ lat, lng, rides: [ride] });
          }
        }

        for (const cluster of clusters) {
          const count = cluster.rides.length;
          let multiplier = 1.0;
          if (count >= 5) multiplier = 1.25;
          else if (count >= 3) multiplier = 1.15;
          else if (count >= 2) multiplier = 1.10;

          if (availableDrivers.length === 0 && count > 0) {
            multiplier = 1.25;
          }

          zones.push({
            lat: cluster.lat,
            lng: cluster.lng,
            demandCount: count,
            multiplier: Math.min(1.25, multiplier),
            label: count >= 5 ? "Very High Demand" : count >= 3 ? "High Demand" : count >= 2 ? "Moderate Demand" : "Active",
            radius: Math.min(5000, 1500 + count * 800),
          });
        }
      }

      const now = new Date();
      const scheduledSurge = await storage.getActiveSurgePricing(now.getDay(), now.getHours());

      res.json({
        zones,
        globalMultiplier: Math.min(1.25, Math.max(
          scheduledSurge ? parseFloat(scheduledSurge.multiplier || "1.0") : 1.0,
          allDemandRides.length > 0 && availableDrivers.length === 0 ? 1.25 :
          allDemandRides.length / Math.max(1, availableDrivers.length) > 2 ? 1.25 :
          allDemandRides.length / Math.max(1, availableDrivers.length) > 1.5 ? 1.15 :
          allDemandRides.length / Math.max(1, availableDrivers.length) > 1 ? 1.10 : 1.0
        )).toFixed(2),
        totalDemand: allDemandRides.length,
        availableDrivers: availableDrivers.length,
        scheduledSurge: scheduledSurge ? { reason: scheduledSurge.reason, multiplier: scheduledSurge.multiplier } : null,
      });
    } catch (error) {
      console.error("Error calculating surge zones:", error);
      res.status(500).json({ message: "Failed to calculate surge zones" });
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
      
      // Wait time charges: $0.50/min after 15 min free grace
      const waitMinutes = ride.waitTimeMinutes || 0;
      const billableWaitMinutes = Math.max(0, waitMinutes - 15);
      const waitTimeCharge = billableWaitMinutes * 0.50;

      let finalFare = (baseFare + (distance * perMile)) * surge + tolls + waitTimeCharge;
      finalFare = Math.max(finalFare, 22); // Minimum fare
      
      const completedRide = await storage.completeRide(rideId, finalFare.toFixed(2), tolls.toString(), distance.toString());
      
      await storage.createRideEvent({
        rideId,
        status: "completed",
        note: `Trip completed. Final fare: $${finalFare.toFixed(2)}${waitTimeCharge > 0 ? ` (includes $${waitTimeCharge.toFixed(2)} wait time)` : ''}`
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
          waitTimeMinutes: waitMinutes,
          billableWaitMinutes,
          waitTimeCharge,
          finalFare: finalFare.toFixed(2),
        }
      });
    } catch (error) {
      console.error("Error completing ride:", error);
      res.status(500).json({ message: "Failed to complete ride" });
    }
  });

  // Rate ride
  app.get("/api/rides/:id/rating", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const ratedBy = (req.query.ratedBy as string) || "patient";
      const rating = await storage.getRideRating(rideId, ratedBy);
      res.json(rating || null);
    } catch (error) {
      console.error("Error fetching ride rating:", error);
      res.status(500).json({ message: "Failed to fetch rating" });
    }
  });

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

      if (isAvailable) {
        const compliance = await checkDriverCompliance(id);
        if (!compliance.compliant) {
          return res.status(403).json({ 
            message: "Cannot go online due to compliance issues",
            issues: compliance.issues
          });
        }
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

  app.patch("/api/drivers/:id/services", requireDriver, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req as any).session?.userId;
      const { patientTransportEnabled, medicalCourierEnabled } = req.body;

      const [existing] = await db.select().from(driverProfiles).where(eq(driverProfiles.id, id));
      if (!existing) return res.status(404).json({ message: "Driver not found" });

      if (existing.userId !== userId && (req as any).session?.role !== "admin") {
        return res.status(403).json({ message: "You can only update your own service preferences" });
      }

      const finalPT = typeof patientTransportEnabled === "boolean" ? patientTransportEnabled : existing.patientTransportEnabled;
      const finalMC = typeof medicalCourierEnabled === "boolean" ? medicalCourierEnabled : existing.medicalCourierEnabled;

      if (!finalPT && !finalMC) {
        return res.status(400).json({ message: "At least one service must be enabled" });
      }

      const updates: Record<string, boolean> = {};
      if (typeof patientTransportEnabled === "boolean") updates.patientTransportEnabled = patientTransportEnabled;
      if (typeof medicalCourierEnabled === "boolean") updates.medicalCourierEnabled = medicalCourierEnabled;

      const [updated] = await db.update(driverProfiles).set(updates).where(eq(driverProfiles.id, id)).returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating driver services:", error);
      res.status(500).json({ message: "Failed to update driver services" });
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
      const { password, confirmPassword, ...driverData } = req.body;
      
      // Validate strong password
      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one uppercase letter" });
      }
      if (!/[a-z]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one lowercase letter" });
      }
      if (!/[0-9]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one number" });
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one special character" });
      }
      
      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords don't match" });
      }
      
      // Check if email is already in use
      const existingUser = await storage.getUserByUsername(driverData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email is already registered. Please use a different email or login." });
      }
      
      // Hash password and create user account
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username: driverData.email,
        password: hashedPassword,
        role: "driver",
      });
      
      if (driverData.tosAccepted) {
        await db.update(users).set({
          tosAcceptedAt: new Date(),
          tosVersion: "1.0",
          privacyPolicyAcceptedAt: new Date(),
        }).where(eq(users.id, user.id));
      }

      const { tosAccepted, ...profileData } = driverData;
      const parsed = insertDriverProfileSchema.parse({
        ...profileData,
        userId: user.id,
      });
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
  app.use("/uploads/it-certs", express.static(path.join(process.cwd(), "uploads", "it-certs")));

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

  // Chat WebSocket - requires authentication for private ride chats
  const chatWss = new WebSocketServer({ server: httpServer, path: "/ws/chat" });
  
  chatWss.on("connection", async (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const rideId = parseInt(url.searchParams.get("rideId") || "0");
    const token = url.searchParams.get("token");
    
    // Validate authentication token - required for chat
    if (!token) {
      console.warn(`Security: Rejected chat WebSocket for ride ${rideId} - no token`);
      ws.close(4401, "Authentication required");
      return;
    }
    
    const userInfo = validateWsToken(token);
    if (!userInfo) {
      console.warn(`Security: Rejected chat WebSocket for ride ${rideId} - invalid/expired token`);
      ws.close(4401, "Invalid or expired token");
      return;
    }
    
    if (rideId <= 0) {
      console.warn(`Security: Rejected chat WebSocket - invalid ride ID: ${rideId}`);
      ws.close(4400, "Invalid ride ID");
      return;
    }
    
    // Verify user is authorized for this ride (driver, dispatcher, or admin)
    try {
      const ride = await storage.getRide(rideId);
      if (!ride) {
        console.warn(`Security: Rejected chat WebSocket - ride ${rideId} not found`);
        ws.close(4404, "Ride not found");
        return;
      }
      
      const userId = parseInt(userInfo.userId);
      const isAdmin = userInfo.role === "admin";
      const isDispatcher = userInfo.role === "dispatcher";
      
      // Check if user is the assigned driver
      let isDriver = false;
      if (ride.driverId) {
        const driverProfile = await storage.getDriver(ride.driverId);
        if (driverProfile && driverProfile.userId !== null && parseInt(String(driverProfile.userId)) === userId) {
          isDriver = true;
        }
      }
      
      if (!isAdmin && !isDispatcher && !isDriver) {
        console.warn(`Security: Rejected chat WebSocket - user ${userId} not authorized for ride ${rideId}`);
        ws.close(4403, "Not authorized for this ride");
        return;
      }
      
      console.log(`Authorized chat WebSocket for ride ${rideId} by user ${userInfo.userId} (${userInfo.role})`);
    } catch (error) {
      console.error(`Error verifying ride access for chat WebSocket:`, error);
      ws.close(4500, "Authorization check failed");
      return;
    }
    
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

  // Add tip to a completed ride (with optional Stripe verification)
  app.post("/api/rides/:id/tip", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { tipAmount, paymentIntentId } = req.body;
      
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
      
      // If a payment intent ID is provided, verify the payment succeeded
      if (paymentIntentId) {
        try {
          const stripe = await getUncachableStripeClient();
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          
          if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ 
              message: "Payment not completed",
              paymentStatus: paymentIntent.status
            });
          }
          
          // Verify the payment intent is for this ride
          if (paymentIntent.metadata.rideId !== rideId.toString()) {
            return res.status(400).json({ message: "Payment intent does not match this ride" });
          }
        } catch (stripeError) {
          console.error("Error verifying payment:", stripeError);
          return res.status(400).json({ message: "Could not verify payment" });
        }
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
  
  app.get("/api/drivers/:id/trip-history", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      if (req.session.role !== "admin" && req.session.driverId !== driverId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const allRides = await storage.getRides();
      const driverRides = allRides
        .filter(r => r.driverId === driverId && r.status === "completed")
        .sort((a, b) => {
          const dateA = a.actualDropoffTime ? new Date(a.actualDropoffTime).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
          const dateB = b.actualDropoffTime ? new Date(b.actualDropoffTime).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
          return dateB - dateA;
        });
      
      const paginatedRides = driverRides.slice(offset, offset + limit);
      const trips = paginatedRides.map(ride => {
        const finalFare = parseFloat(ride.finalFare || ride.estimatedFare || "0");
        const tip = parseFloat(ride.tipAmount || "0");
        const driverNet = parseFloat(ride.driverEarnings || "0");
        const baseFare = parseFloat(ride.baseFare || "5");
        const distance = parseFloat(ride.distanceMiles || "0");
        const perMileRate = 2.50;
        const distanceFee = distance * perMileRate;
        const tolls = parseFloat(ride.actualTolls || ride.estimatedTolls || "0");
        const platformFee = finalFare - driverNet;
        
        return {
          id: ride.id,
          date: ride.actualDropoffTime || ride.appointmentTime,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          patientName: ride.patientName,
          distanceMiles: distance.toFixed(1),
          fareBreakdown: {
            baseFare: baseFare.toFixed(2),
            distanceFee: distanceFee.toFixed(2),
            tolls: tolls.toFixed(2),
            totalFare: finalFare.toFixed(2),
            tip: tip.toFixed(2),
            platformFee: platformFee.toFixed(2),
            driverNet: driverNet.toFixed(2),
            totalWithTip: (driverNet + tip).toFixed(2),
          },
          status: ride.status,
          paymentType: ride.paymentType,
        };
      });
      
      res.json({ trips, total: driverRides.length, hasMore: offset + limit < driverRides.length });
    } catch (error) {
      console.error("Error fetching trip history:", error);
      res.status(500).json({ message: "Failed to fetch trip history" });
    }
  });

  app.get("/api/drivers/:id/weekly-summary", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      if (req.session.role !== "admin" && req.session.driverId !== driverId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const allRides = await storage.getRides();
      const driverRides = allRides.filter(r => r.driverId === driverId && r.status === "completed");
      
      const now = new Date();
      const weeks: Array<{ weekStart: string; weekEnd: string; earnings: number; tips: number; trips: number }> = [];
      
      for (let w = 0; w < 5; w++) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - (w * 7));
        weekEnd.setHours(23, 59, 59, 999);
        
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        
        const weekRides = driverRides.filter(r => {
          const rideDate = new Date(r.completedAt || r.appointmentTime || "");
          return rideDate >= weekStart && rideDate <= weekEnd;
        });
        
        const earnings = weekRides.reduce((sum, r) => sum + parseFloat(r.driverEarnings || "0"), 0);
        const tips = weekRides.reduce((sum, r) => sum + parseFloat(r.tipAmount || "0"), 0);
        
        weeks.push({
          weekStart: weekStart.toISOString().split("T")[0],
          weekEnd: weekEnd.toISOString().split("T")[0],
          earnings: parseFloat(earnings.toFixed(2)),
          tips: parseFloat(tips.toFixed(2)),
          trips: weekRides.length,
        });
      }
      
      res.json({ weeks });
    } catch (error) {
      console.error("Error fetching weekly summary:", error);
      res.status(500).json({ message: "Failed to fetch weekly summary" });
    }
  });

  app.get("/api/drivers/:id/document-alerts", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      if (req.session.role !== "admin" && req.session.driverId !== driverId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const driver = await storage.getDriverProfile(driverId);
      if (!driver) return res.status(404).json({ message: "Driver not found" });
      
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const alerts: Array<{ type: string; document: string; expiryDate: string; status: "expired" | "expiring_soon" | "valid" }> = [];
      
      const checkExpiry = (name: string, dateStr: string | null) => {
        if (!dateStr) return;
        const expiry = new Date(dateStr);
        if (expiry < now) {
          alerts.push({ type: "error", document: name, expiryDate: dateStr, status: "expired" });
        } else if (expiry < thirtyDaysFromNow) {
          alerts.push({ type: "warning", document: name, expiryDate: dateStr, status: "expiring_soon" });
        } else {
          alerts.push({ type: "info", document: name, expiryDate: dateStr, status: "valid" });
        }
      };
      
      checkExpiry("Driver's License", driver.driversLicenseExpiry);
      checkExpiry("Insurance", driver.insuranceExpiry);
      checkExpiry("Vehicle Inspection", driver.vehicleInspectionExpiry);
      
      res.json({ alerts, backgroundCheckStatus: driver.backgroundCheckStatus || "not_started" });
    } catch (error) {
      console.error("Error fetching document alerts:", error);
      res.status(500).json({ message: "Failed to fetch document alerts" });
    }
  });

  app.patch("/api/admin/drivers/:id/background-check", requireAdmin, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      const { status, provider } = req.body;
      
      if (!["not_started", "pending", "passed", "failed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const driver = await storage.getDriverProfile(driverId);
      if (!driver) return res.status(404).json({ message: "Driver not found" });
      
      await storage.updateDriverKyc(driverId, {
        backgroundCheckStatus: status,
        backgroundCheckDate: new Date().toISOString().split("T")[0],
        backgroundCheckProvider: provider || undefined,
      } as any);

      logAudit(req.session.userId || null, "update_background_check", "driver", driverId.toString(), { status, provider }, req);
      
      res.json({ message: "Background check status updated" });
    } catch (error) {
      console.error("Error updating background check:", error);
      res.status(500).json({ message: "Failed to update background check" });
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
  
  // IC Agreement Digital Signature
  const IC_AGREEMENT_VERSION = "1.0";
  const IC_AGREEMENT_TEXT = `INDEPENDENT CONTRACTOR AGREEMENT

This Independent Contractor Agreement ("Agreement") is entered into between CareHub ("Company") and the undersigned independent contractor ("Contractor").

1. INDEPENDENT CONTRACTOR RELATIONSHIP
Contractor acknowledges that they are an independent contractor and not an employee of the Company. Nothing in this Agreement shall be construed to create an employer-employee, partnership, or joint venture relationship.

2. SERVICES
Contractor agrees to provide non-emergency medical transportation (NEMT) services through the CareHub platform. Contractor retains full discretion over when, where, and how to perform services.

3. WORK SCHEDULE
Contractor has complete freedom to set their own schedule, accept or decline ride requests, and work for competing platforms simultaneously.

4. EQUIPMENT AND EXPENSES
Contractor is responsible for providing and maintaining their own vehicle, insurance, fuel, and all other equipment necessary to perform services. Company shall not reimburse Contractor for these expenses.

5. INSURANCE REQUIREMENTS
Contractor must maintain valid auto insurance meeting or exceeding state minimum requirements, plus any additional coverage required by applicable NEMT regulations. Contractor must provide proof of insurance upon request.

6. COMPENSATION
Contractor will be compensated per completed ride based on the fare schedule published on the platform. Contractor is responsible for all taxes, including self-employment tax. Company will issue a 1099-NEC form for annual earnings exceeding $600.

7. BACKGROUND CHECK AND COMPLIANCE
Contractor consents to background checks and must maintain a valid driver's license, vehicle registration, and vehicle inspection. Failure to maintain compliance may result in immediate deactivation.

8. CONFIDENTIALITY
Contractor agrees to keep confidential all patient information, ride details, and proprietary Company information encountered during the performance of services, in compliance with HIPAA and applicable privacy laws.

9. INDEMNIFICATION
Contractor agrees to indemnify and hold harmless the Company from any claims, damages, or liabilities arising from Contractor's performance of services, including traffic violations, accidents, or injury.

10. TERMINATION
Either party may terminate this Agreement at any time, with or without cause, by providing written notice. Company may immediately deactivate Contractor's account for safety violations or compliance failures.

11. DISPUTE RESOLUTION
Any disputes arising under this Agreement shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.

12. GOVERNING LAW
This Agreement shall be governed by the laws of the state in which Contractor primarily operates.

[NOTE: This is a template agreement. Consult with a licensed attorney before use in production.]`;

  app.get("/api/drivers/ic-agreement-text", requireDriver, (_req, res) => {
    res.json({ version: IC_AGREEMENT_VERSION, content: IC_AGREEMENT_TEXT });
  });

  app.post("/api/drivers/:id/sign-ic-agreement", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      const { fullLegalName } = req.body;

      if (!fullLegalName || fullLegalName.trim().length < 2) {
        return res.status(400).json({ message: "Full legal name is required for digital signature" });
      }

      if (req.session.driverId !== driverId && req.session.role !== "admin") {
        return res.status(403).json({ message: "You can only sign agreements for your own account" });
      }

      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      if (!driver.userId) {
        return res.status(400).json({ message: "Driver profile has no associated user" });
      }

      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const crypto = await import("crypto");
      const contentHash = crypto.createHash("sha256").update(IC_AGREEMENT_TEXT).digest("hex");

      const { db } = await import("./db");
      const { legalAgreements, driverProfiles } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      await db.insert(legalAgreements).values({
        userId: driver.userId,
        agreementType: "ic_agreement",
        version: IC_AGREEMENT_VERSION,
        ipAddress,
        userAgent,
        content: IC_AGREEMENT_TEXT,
        signerName: fullLegalName.trim(),
        contentHash,
      });

      await db.update(driverProfiles)
        .set({
          contractorAgreementSignedAt: new Date(),
          isContractorOnboarded: true,
        })
        .where(eq(driverProfiles.id, driverId));

      await storage.createContractorAgreement({
        driverId,
        agreementVersion: IC_AGREEMENT_VERSION,
        ipAddress,
        userAgent,
      });

      logAudit(driver.userId, "sign_ic_agreement", "legal_agreement", String(driverId), { version: IC_AGREEMENT_VERSION, signerName: fullLegalName.trim() }, req);

      res.json({ message: "Independent Contractor Agreement signed successfully" });
    } catch (error) {
      console.error("Error signing IC agreement:", error);
      res.status(500).json({ message: "Failed to sign agreement" });
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

  // ============ DRIVER PAYOUT ROUTES ============

  // Get driver payout balance and info
  // Protected: Only authenticated drivers can view their own balance
  app.get("/api/drivers/:id/payout-balance", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      
      // Security: Verify driver can only access their own data (admins can access any)
      if (req.session.role !== "admin" && req.session.driverId !== driverId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const driver = await storage.getDriver(driverId);
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      // Calculate available balance from completed rides
      const earnings = await storage.getDriverEarnings(driverId);
      const payouts = await storage.getDriverPayouts(driverId);
      
      const totalEarned = parseFloat(earnings.totalEarnings || "0");
      const totalPaidOut = payouts
        .filter((p: any) => p.status === "completed")
        .reduce((sum: number, p: any) => sum + parseFloat(p.netAmount || "0"), 0);
      const pendingPayouts = payouts
        .filter((p: any) => p.status === "pending" || p.status === "processing")
        .reduce((sum: number, p: any) => sum + parseFloat(p.amount || "0"), 0);
      
      const availableBalance = Math.max(0, totalEarned - totalPaidOut - pendingPayouts);
      
      res.json({
        availableBalance: availableBalance.toFixed(2),
        pendingBalance: pendingPayouts.toFixed(2),
        totalEarnings: totalEarned.toFixed(2),
        totalPaidOut: totalPaidOut.toFixed(2),
        stripeConnectOnboarded: driver.stripeConnectOnboarded || false,
        payoutPreference: driver.payoutPreference || "manual",
        bankLinked: !!driver.stripeConnectAccountId
      });
    } catch (error) {
      console.error("Error fetching payout balance:", error);
      res.status(500).json({ message: "Failed to fetch payout balance" });
    }
  });

  // Create Stripe Connect onboarding link for driver
  // Protected: Only authenticated drivers can start their own onboarding
  app.post("/api/drivers/:id/stripe-connect-onboard", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      
      // Security: Verify driver can only onboard themselves
      if (req.session.role !== "admin" && req.session.driverId !== driverId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const driver = await storage.getDriver(driverId);
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      let accountId = driver.stripeConnectAccountId;

      // Create Stripe Connect Express account if not exists
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: "express",
          country: "US",
          email: driver.email || undefined,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: "individual",
          metadata: {
            driverId: driverId.toString(),
            driverName: driver.fullName
          }
        });
        
        accountId = account.id;
        await storage.updateDriverStripeConnect(driverId, accountId);
      }

      // Get the base URL for redirects with domain validation
      const allowedDomains = [
        "carehubapp.com",
        "www.carehubapp.com",
        "carehubapp.replit.app",
        "app.carehubapp.com",
        "localhost:5000",
        "127.0.0.1:5000"
      ];
      
      // Add Replit dev domains if available
      if (process.env.REPLIT_DOMAINS) {
        allowedDomains.push(...process.env.REPLIT_DOMAINS.split(','));
      }
      
      const requestHost = (req.headers["x-forwarded-host"] || req.headers.host || req.get("host") || "") as string;
      const isAllowedHost = allowedDomains.some(domain => 
        requestHost === domain || requestHost.endsWith(`.${domain}`)
      );
      
      let baseUrl: string;
      if (isAllowedHost) {
        const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
        baseUrl = `${protocol}://${requestHost}`;
      } else {
        // Fallback to Replit domain or localhost
        const replitDomain = process.env.REPLIT_DOMAINS?.split(',')[0];
        baseUrl = replitDomain ? `https://${replitDomain}` : "http://localhost:5000";
      }

      // Create account link for onboarding
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${baseUrl}/driver-payouts?refresh=true`,
        return_url: `${baseUrl}/driver-payouts?onboarding=complete`,
        type: "account_onboarding",
      });

      res.json({ url: accountLink.url });
    } catch (error) {
      console.error("Error creating Stripe Connect onboarding:", error);
      res.status(500).json({ message: "Failed to start bank account setup" });
    }
  });

  // Check Stripe Connect onboarding status
  // Protected: Only authenticated drivers can check their own status
  app.get("/api/drivers/:id/stripe-connect-status", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      
      // Security: Verify driver can only check their own status
      if (req.session.role !== "admin" && req.session.driverId !== driverId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const driver = await storage.getDriver(driverId);
      
      if (!driver || !driver.stripeConnectAccountId) {
        return res.json({ 
          hasAccount: false,
          onboarded: false,
          payoutsEnabled: false
        });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      const account = await stripe.accounts.retrieve(driver.stripeConnectAccountId);
      
      const isOnboarded = account.details_submitted && account.payouts_enabled;
      
      // Update driver status if newly onboarded
      if (isOnboarded && !driver.stripeConnectOnboarded) {
        await storage.updateDriverStripeConnectOnboarded(driverId, true);
      }

      res.json({
        hasAccount: true,
        onboarded: account.details_submitted || false,
        payoutsEnabled: account.payouts_enabled || false,
        chargesEnabled: account.charges_enabled || false,
        bankLast4: account.external_accounts?.data?.[0]?.last4 || null
      });
    } catch (error) {
      console.error("Error checking Stripe Connect status:", error);
      res.status(500).json({ message: "Failed to check account status" });
    }
  });

  // Request a payout (Uber-style cash out)
  // Protected: Only authenticated drivers can request their own payouts
  app.post("/api/drivers/:id/request-payout", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      
      // Security: Verify driver can only request their own payouts
      if (req.session.role !== "admin" && req.session.driverId !== driverId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { amount, method = "standard" } = req.body;
      
      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Invalid payout amount" });
      }

      const driver = await storage.getDriver(driverId);
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      if (!driver.stripeConnectAccountId || !driver.stripeConnectOnboarded) {
        return res.status(400).json({ message: "Please set up your bank account first" });
      }

      // Check available balance
      const earnings = await storage.getDriverEarnings(driverId);
      const payouts = await storage.getDriverPayouts(driverId);
      
      const totalEarned = parseFloat(earnings.totalEarnings || "0");
      const totalPaidOut = payouts
        .filter((p: any) => p.status === "completed")
        .reduce((sum: number, p: any) => sum + parseFloat(p.netAmount || "0"), 0);
      const pendingPayouts = payouts
        .filter((p: any) => p.status === "pending" || p.status === "processing")
        .reduce((sum: number, p: any) => sum + parseFloat(p.amount || "0"), 0);
      
      const availableBalance = totalEarned - totalPaidOut - pendingPayouts;
      
      if (parseFloat(amount) > availableBalance) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Calculate fee (instant = 1.5%, standard = free)
      const payoutAmount = parseFloat(amount);
      const fee = method === "instant" ? payoutAmount * 0.015 : 0;
      const netAmount = payoutAmount - fee;

      // Create payout record
      const payout = await storage.createDriverPayout({
        driverId,
        amount: payoutAmount.toFixed(2),
        fee: fee.toFixed(2),
        netAmount: netAmount.toFixed(2),
        method,
        status: "pending"
      });

      // In production, this would create a Stripe transfer
      // For now, mark as processing and simulate
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      try {
        // Create transfer to connected account
        const transfer = await stripe.transfers.create({
          amount: Math.round(netAmount * 100), // cents
          currency: "usd",
          destination: driver.stripeConnectAccountId,
          metadata: {
            payoutId: payout.id.toString(),
            driverId: driverId.toString(),
            method
          }
        });

        // Update payout with transfer ID
        await storage.updateDriverPayoutStatus(payout.id, "processing", transfer.id);

        logAudit(req.session.userId || null, "request_payout", "payout", payout.id.toString(), { driverId, amount: payoutAmount, method, netAmount }, req);

        res.json({ 
          message: method === "instant" 
            ? "Instant payout initiated - funds arriving within 30 minutes"
            : "Payout initiated - funds arriving in 1-2 business days",
          payout: {
            id: payout.id,
            amount: payoutAmount.toFixed(2),
            fee: fee.toFixed(2),
            netAmount: netAmount.toFixed(2),
            method,
            status: "processing"
          }
        });
      } catch (stripeError: any) {
        console.error("Stripe transfer error:", stripeError);
        await storage.updateDriverPayoutStatus(payout.id, "failed", undefined, stripeError.message);
        res.status(500).json({ message: "Payout failed: " + stripeError.message });
      }
    } catch (error) {
      console.error("Error requesting payout:", error);
      res.status(500).json({ message: "Failed to request payout" });
    }
  });

  // Get driver payout history
  // Protected: Only authenticated drivers can view their own payouts
  app.get("/api/drivers/:id/payouts", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      
      // Security: Verify driver can only view their own payouts
      if (req.session.role !== "admin" && req.session.driverId !== driverId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const payouts = await storage.getDriverPayouts(driverId);
      res.json(payouts);
    } catch (error) {
      console.error("Error fetching payouts:", error);
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  // Update payout preference
  // Protected: Only authenticated drivers can update their own preference
  app.patch("/api/drivers/:id/payout-preference", requireDriver, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      
      // Security: Verify driver can only update their own preference
      if (req.session.role !== "admin" && req.session.driverId !== driverId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { preference } = req.body;
      
      if (!["manual", "weekly", "daily"].includes(preference)) {
        return res.status(400).json({ message: "Invalid payout preference" });
      }

      await storage.updateDriverPayoutPreference(driverId, preference);
      res.json({ message: "Payout preference updated", preference });
    } catch (error) {
      console.error("Error updating payout preference:", error);
      res.status(500).json({ message: "Failed to update preference" });
    }
  });

  // ============ ADMIN ROUTES ============
  
  // Get all rides for admin (with optional filters)
  // Protected: Only admins can view all rides
  app.get("/api/admin/rides", requireAdmin, requirePermission("rides", "dispatch"), async (req, res) => {
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

      logAudit(req.session.userId || null, "admin_view_rides", "rides", null, { filters: { status, driverId, patientPhone }, count: filteredRides.length }, req);
      
      res.json(filteredRides);
    } catch (error) {
      console.error("Error fetching admin rides:", error);
      res.status(500).json({ message: "Failed to fetch rides" });
    }
  });
  
  app.get("/api/admin/audit-logs", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
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
  
  app.get("/api/admin/earnings", requireAdmin, requirePermission("earnings"), async (req, res) => {
    try {
      const allRides = await storage.getAllRides();
      const completedRides = allRides.filter(r => r.status === "completed");
      const cancelledRides = allRides.filter(r => r.status === "cancelled");

      const totalRevenue = completedRides.reduce((sum, r) => sum + parseFloat(r.platformFee || "0"), 0);
      const totalFares = completedRides.reduce((sum, r) => sum + parseFloat(r.finalFare || r.estimatedFare || "0"), 0);
      const totalDriverPayouts = completedRides.reduce((sum, r) => sum + parseFloat(r.driverEarnings || "0"), 0);
      const totalTips = completedRides.reduce((sum, r) => sum + parseFloat(r.tipAmount || "0"), 0);
      const totalTolls = completedRides.reduce((sum, r) => sum + parseFloat(r.actualTolls || r.estimatedTolls || "0"), 0);
      const totalCancellationFees = cancelledRides.reduce((sum, r) => sum + parseFloat(r.cancellationFee || "0"), 0);
      const refundedRides = allRides.filter(r => r.paymentStatus === "refunded");
      const totalRefunds = refundedRides.reduce((sum, r) => sum + parseFloat(r.paidAmount || "0"), 0);

      const ridesByMonth: Record<string, { rides: number; revenue: number; fares: number; driverPayouts: number }> = {};
      completedRides.forEach(r => {
        const month = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 7) : "unknown";
        if (!ridesByMonth[month]) ridesByMonth[month] = { rides: 0, revenue: 0, fares: 0, driverPayouts: 0 };
        ridesByMonth[month].rides++;
        ridesByMonth[month].revenue += parseFloat(r.platformFee || "0");
        ridesByMonth[month].fares += parseFloat(r.finalFare || r.estimatedFare || "0");
        ridesByMonth[month].driverPayouts += parseFloat(r.driverEarnings || "0");
      });

      const paymentStatusBreakdown = {
        pending: allRides.filter(r => r.paymentStatus === "pending").length,
        paid: allRides.filter(r => r.paymentStatus === "paid" || r.paymentStatus === "completed").length,
        failed: allRides.filter(r => r.paymentStatus === "failed").length,
        refunded: refundedRides.length,
      };

      res.json({
        totalRevenue: totalRevenue.toFixed(2),
        totalFares: totalFares.toFixed(2),
        totalDriverPayouts: totalDriverPayouts.toFixed(2),
        totalTips: totalTips.toFixed(2),
        totalTolls: totalTolls.toFixed(2),
        totalCancellationFees: totalCancellationFees.toFixed(2),
        totalRefunds: totalRefunds.toFixed(2),
        completedRides: completedRides.length,
        cancelledRides: cancelledRides.length,
        totalRides: allRides.length,
        averageFare: completedRides.length > 0 ? (totalFares / completedRides.length).toFixed(2) : "0",
        ridesByMonth,
        paymentStatusBreakdown,
      });
    } catch (error) {
      console.error("Error fetching earnings:", error);
      res.status(500).json({ message: "Failed to fetch earnings" });
    }
  });

  app.get("/api/admin/users", requireAdmin, requirePermission("accounts"), async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const safeUsers = allUsers.map(({ password, ...u }) => u);
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/create-account", requireAdmin, requirePermission("accounts"), async (req, res) => {
    try {
      const { email, fullName, password, role, permissions } = req.body;
      if (!email || !fullName || !password || !role) {
        return res.status(400).json({ message: "Email, full name, password, and role are required" });
      }
      const validRoles = ["user", "patient", "employer", "driver", "admin", "it_company", "it_tech"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const existingUser = await storage.getUserByUsername(email);
      if (existingUser) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const userPermissions = role === "admin" && Array.isArray(permissions) ? permissions : [];
      const user = await storage.createUser({ username: email, password: hashedPassword, role, permissions: userPermissions });

      if (role === "user" || role === "patient") {
        try {
          await storage.createPatient({ userId: user.id, fullName, phone: "", email, mobilityNeeds: [], emergencyContactName: null, emergencyContactPhone: null, savedAddresses: [] });
        } catch (e) { console.error("Failed to create patient profile:", e); }
      }
      if (role === "driver") {
        try {
          await storage.createDriver({ userId: user.id, fullName, phone: "", email, vehicleType: "sedan", vehiclePlate: "PENDING" });
        } catch (e) { console.error("Failed to create driver profile:", e); }
      }

      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error creating account:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.patch("/api/admin/users/:id/role", requireAdmin, requirePermission("accounts"), async (req, res) => {
    try {
      const { role } = req.body;
      const validRoles = ["user", "patient", "employer", "driver", "admin", "it_company", "it_tech"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const user = await storage.updateUserRole(req.params.id, role);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.patch("/api/admin/users/:id/verify-email", requireAdmin, requirePermission("accounts"), async (req, res) => {
    try {
      const { id } = req.params;
      const [user] = await db.update(users).set({ emailVerified: true }).where(eq(users.id, id)).returning();
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error verifying email:", error);
      res.status(500).json({ message: "Failed to verify email" });
    }
  });

  app.patch("/api/admin/users/:id/permissions", requireAdmin, requirePermission("accounts"), async (req, res) => {
    try {
      const { id } = req.params;
      const { permissions: newPermissions } = req.body;
      if (!Array.isArray(newPermissions)) {
        return res.status(400).json({ message: "Permissions must be an array" });
      }
      const [user] = await db.update(users).set({ permissions: newPermissions }).where(eq(users.id, id)).returning();
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating permissions:", error);
      res.status(500).json({ message: "Failed to update permissions" });
    }
  });

  app.get("/api/admin/patients", requireAdmin, requirePermission("patients"), async (req, res) => {
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
  app.patch("/api/admin/patients/:phone/status", requireAdmin, requirePermission("patients"), async (req, res) => {
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
  app.patch("/api/admin/drivers/:id/status", requireAdmin, requirePermission("drivers", "dispatch"), async (req, res) => {
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
  
  // ============ DRIVER COMPLAINT & ENFORCEMENT SYSTEM ============

  app.post("/api/drivers/:driverId/report", requireAuth, async (req, res) => {
    try {
      const reporterId = (req as any).session?.userId;
      const driverProfileId = parseInt(req.params.driverId);
      const { rideId, category, description, evidence } = req.body;

      if (!category || !description) {
        return res.status(400).json({ message: "Category and description are required" });
      }
      if (!DRIVER_COMPLAINT_CATEGORIES.includes(category)) {
        return res.status(400).json({ message: `Invalid category. Must be one of: ${DRIVER_COMPLAINT_CATEGORIES.join(", ")}` });
      }

      const driver = await storage.getDriver(driverProfileId);
      if (!driver) return res.status(404).json({ message: "Driver not found" });

      if (reporterId === driver.userId) {
        return res.status(400).json({ message: "You cannot report yourself" });
      }

      if (!rideId) {
        return res.status(400).json({ message: "A ride ID is required to file a complaint" });
      }

      const ride = await storage.getRide(parseInt(rideId));
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      const [reporterUser] = await db.select().from(users).where(eq(users.id, reporterId));
      const isRideParticipant = ride.driverId === driverProfileId && (
        ride.userId === reporterId ||
        (reporterUser?.role === "admin")
      );
      if (!isRideParticipant) {
        return res.status(403).json({ message: "You can only report drivers on your own rides" });
      }

      const [complaint] = await db.insert(driverComplaints).values({
        driverProfileId,
        driverUserId: driver.userId,
        rideId: rideId ? parseInt(rideId) : null,
        reportedBy: reporterId,
        reason: category,
        category,
        description,
        evidence: evidence || null,
        status: "pending",
      }).returning();

      const newComplaintCount = (driver.complaintCount || 0) + 1;
      const updateData: any = { complaintCount: newComplaintCount };

      if (newComplaintCount >= DRIVER_AUTO_HOLD_THRESHOLD && driver.accountStatus === "active") {
        updateData.accountStatus = "on_hold";
        updateData.suspendedAt = new Date();
        updateData.suspensionReason = `Auto-hold: ${newComplaintCount} complaints received (threshold: ${DRIVER_AUTO_HOLD_THRESHOLD})`;

        await db.insert(driverEnforcementLog).values({
          driverProfileId,
          driverUserId: driver.userId,
          action: "auto_hold",
          reason: `Auto-hold triggered: ${newComplaintCount} complaints reached threshold of ${DRIVER_AUTO_HOLD_THRESHOLD}`,
          previousStatus: driver.accountStatus || "active",
          newStatus: "on_hold",
          performedBy: null,
          performedBySystem: true,
          complaintId: complaint.id,
        });
      }

      await db.update(driverProfiles)
        .set(updateData)
        .where(eq(driverProfiles.id, driverProfileId));

      res.json({ message: "Complaint submitted successfully", complaint });
    } catch (error) {
      console.error("Error reporting driver:", error);
      res.status(500).json({ message: "Failed to submit complaint" });
    }
  });

  app.get("/api/admin/driver-complaints", requireAdmin, requirePermission("drivers"), async (_req, res) => {
    try {
      const allComplaints = await db.select().from(driverComplaints).orderBy(desc(driverComplaints.createdAt));

      const enriched = await Promise.all(allComplaints.map(async (c) => {
        const [reporter] = await db.select().from(users).where(eq(users.id, c.reportedBy));
        const driver = c.driverProfileId ? await storage.getDriver(c.driverProfileId) : null;
        return {
          ...c,
          reporterName: reporter?.username || "Unknown",
          driverName: driver?.fullName || "Unknown",
          driverAccountStatus: driver?.accountStatus || "unknown",
        };
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Error getting driver complaints:", error);
      res.status(500).json({ message: "Failed to get complaints" });
    }
  });

  app.post("/api/admin/driver-complaints/:id/review", requireAdmin, requirePermission("drivers"), async (req, res) => {
    try {
      const adminId = (req as any).session?.userId;
      const { status, adminNotes, adminAction } = req.body;

      if (!status || !["verified", "dismissed", "investigating"].includes(status)) {
        return res.status(400).json({ message: "Status must be verified, dismissed, or investigating" });
      }

      const [complaint] = await db.select().from(driverComplaints).where(eq(driverComplaints.id, req.params.id));
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      await db.update(driverComplaints)
        .set({
          status,
          adminReviewedBy: adminId,
          adminNotes: adminNotes || null,
          adminAction: adminAction || null,
          reviewedAt: new Date(),
        })
        .where(eq(driverComplaints.id, req.params.id));

      if (status === "verified" && complaint.status !== "verified") {
        const driver = await storage.getDriver(complaint.driverProfileId);
        if (driver) {
          const newVerified = (driver.verifiedComplaintCount || 0) + 1;
          await db.update(driverProfiles)
            .set({ verifiedComplaintCount: newVerified })
            .where(eq(driverProfiles.id, complaint.driverProfileId));
        }
      }

      const [updated] = await db.select().from(driverComplaints).where(eq(driverComplaints.id, req.params.id));
      res.json({ message: "Complaint reviewed", complaint: updated });
    } catch (error) {
      console.error("Error reviewing driver complaint:", error);
      res.status(500).json({ message: "Failed to review complaint" });
    }
  });

  app.post("/api/admin/drivers/:id/enforce", requireAdmin, requirePermission("drivers"), async (req, res) => {
    try {
      const adminId = (req as any).session?.userId;
      const driverProfileId = parseInt(req.params.id);
      const { action, reason, suspendDays, notes } = req.body;

      if (!action || !["warn", "suspend", "ban", "reinstate", "remove_hold"].includes(action)) {
        return res.status(400).json({ message: "Invalid action. Must be warn, suspend, ban, reinstate, or remove_hold" });
      }
      if (!reason) return res.status(400).json({ message: "Reason is required" });

      const driver = await storage.getDriver(driverProfileId);
      if (!driver) return res.status(404).json({ message: "Driver not found" });

      const previousStatus = driver.accountStatus || "active";
      let newStatus = previousStatus;
      const updateData: any = {};

      if (action === "warn") {
        newStatus = "warning";
        updateData.accountStatus = "warning";
      } else if (action === "suspend") {
        newStatus = "suspended";
        updateData.accountStatus = "suspended";
        updateData.suspendedAt = new Date();
        updateData.suspensionReason = reason;
        if (suspendDays) {
          const until = new Date();
          until.setDate(until.getDate() + parseInt(suspendDays));
          updateData.suspendedUntil = until;
        }
      } else if (action === "ban") {
        newStatus = "deactivated";
        updateData.accountStatus = "deactivated";
        updateData.bannedAt = new Date();
        updateData.banReason = reason;
        updateData.isAvailable = false;
      } else if (action === "reinstate" || action === "remove_hold") {
        newStatus = "active";
        updateData.accountStatus = "active";
        updateData.suspendedAt = null;
        updateData.suspendedUntil = null;
        updateData.suspensionReason = null;
      }

      await db.update(driverProfiles)
        .set(updateData)
        .where(eq(driverProfiles.id, driverProfileId));

      await db.insert(driverEnforcementLog).values({
        driverProfileId,
        driverUserId: driver.userId,
        action,
        reason,
        previousStatus,
        newStatus,
        performedBy: adminId,
        notes: notes || null,
      });

      const updatedDriver = await storage.getDriver(driverProfileId);
      res.json({ message: `Driver ${action} action applied`, driver: updatedDriver });
    } catch (error) {
      console.error("Error enforcing driver:", error);
      res.status(500).json({ message: "Failed to enforce action" });
    }
  });

  app.get("/api/admin/drivers/:id/enforcement-history", requireAdmin, requirePermission("drivers"), async (req, res) => {
    try {
      const driverProfileId = parseInt(req.params.id);
      const driver = await storage.getDriver(driverProfileId);
      if (!driver) return res.status(404).json({ message: "Driver not found" });

      const history = await db.select().from(driverEnforcementLog)
        .where(eq(driverEnforcementLog.driverProfileId, driverProfileId))
        .orderBy(desc(driverEnforcementLog.createdAt));

      const complaints = await db.select().from(driverComplaints)
        .where(eq(driverComplaints.driverProfileId, driverProfileId))
        .orderBy(desc(driverComplaints.createdAt));

      res.json({ history, complaints, driver });
    } catch (error) {
      console.error("Error getting driver enforcement history:", error);
      res.status(500).json({ message: "Failed to get enforcement history" });
    }
  });

  app.get("/api/drivers/:id/account-status", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const driverProfileId = parseInt(req.params.id);
      const driver = await storage.getDriver(driverProfileId);
      if (!driver) return res.status(404).json({ message: "Driver not found" });

      const [callerUser] = await db.select().from(users).where(eq(users.id, userId));
      if (driver.userId !== userId && callerUser?.role !== "admin") {
        return res.status(403).json({ message: "You can only view your own account status" });
      }

      const complaints = await db.select().from(driverComplaints)
        .where(eq(driverComplaints.driverProfileId, driverProfileId))
        .orderBy(desc(driverComplaints.createdAt));

      res.json({
        accountStatus: driver.accountStatus || "active",
        complaintCount: driver.complaintCount || 0,
        verifiedComplaintCount: driver.verifiedComplaintCount || 0,
        suspensionReason: driver.suspensionReason,
        suspendedUntil: driver.suspendedUntil,
        complaints: complaints.map(c => ({
          id: c.id,
          category: c.category,
          status: c.status,
          createdAt: c.createdAt,
        })),
      });
    } catch (error) {
      console.error("Error getting driver account status:", error);
      res.status(500).json({ message: "Failed to get account status" });
    }
  });

  // Admin cancel a ride
  // Protected: Only admins can force cancel rides
  app.post("/api/admin/rides/:id/cancel", requireAdmin, requirePermission("rides", "dispatch"), async (req, res) => {
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
  app.get("/api/admin/incidents", requireAdmin, requirePermission("incidents"), async (req, res) => {
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
  app.patch("/api/admin/incidents/:id", requireAdmin, requirePermission("incidents"), async (req, res) => {
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
      
      // Capture payment immediately at booking
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

  // Admin endpoint to refund a completed ride (for disputes)
  app.post("/api/admin/rides/:id/refund", requireAdmin, requirePermission("rides", "earnings"), async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const { reason, refundAmount } = req.body;
      
      if (!reason) {
        return res.status(400).json({ message: "Refund reason is required" });
      }
      
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      if (!ride.stripePaymentIntentId) {
        return res.status(400).json({ message: "No payment found for this ride" });
      }
      
      const stripe = await getUncachableStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(ride.stripePaymentIntentId);
      
      // Can only refund if payment was captured
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ 
          message: "Payment was not captured. Cannot refund.",
          paymentStatus: paymentIntent.status
        });
      }
      
      // Calculate refund amount (full or partial)
      const maxRefundCents = paymentIntent.amount_received;
      const requestedRefundCents = refundAmount 
        ? Math.round(parseFloat(refundAmount) * 100) 
        : maxRefundCents;
      
      if (requestedRefundCents > maxRefundCents) {
        return res.status(400).json({ 
          message: `Refund amount cannot exceed ${(maxRefundCents / 100).toFixed(2)}`
        });
      }
      
      // Process the refund
      const refund = await stripe.refunds.create({
        payment_intent: ride.stripePaymentIntentId,
        amount: requestedRefundCents,
        reason: 'requested_by_customer',
        metadata: {
          rideId: rideId.toString(),
          adminReason: reason,
          refundedBy: 'admin'
        }
      });
      
      // Update ride payment status
      await storage.updateRidePayment(rideId, {
        paymentStatus: requestedRefundCents === maxRefundCents ? 'refunded' : 'partially_refunded',
        stripePaymentIntentId: ride.stripePaymentIntentId,
        paidAmount: ((maxRefundCents - requestedRefundCents) / 100).toFixed(2)
      });
      
      // Log the event
      await storage.createRideEvent({
        rideId,
        status: 'completed',
        note: `Refund of $${(requestedRefundCents / 100).toFixed(2)} processed. Reason: ${reason}`
      });
      
      res.json({ 
        success: true,
        refundId: refund.id,
        refundAmount: (requestedRefundCents / 100).toFixed(2),
        status: refund.status
      });
    } catch (error: any) {
      console.error("Error processing refund:", error);
      res.status(500).json({ 
        message: "Failed to process refund",
        error: error.message 
      });
    }
  });

  // ==========================================
  // Facility Management Routes
  // ==========================================

  app.post("/api/admin/facilities", requireAdmin, async (req, res) => {
    try {
      const parsed = insertFacilitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid facility data", errors: parsed.error.errors });
      }
      const facility = await storage.createFacility(parsed.data);
      res.status(201).json(facility);
    } catch (error) {
      console.error("Error creating facility:", error);
      res.status(500).json({ message: "Failed to create facility" });
    }
  });

  app.get("/api/facilities", async (_req, res) => {
    try {
      const allFacilities = await storage.getFacilities();
      res.json(allFacilities);
    } catch (error) {
      console.error("Error fetching facilities:", error);
      res.status(500).json({ message: "Failed to fetch facilities" });
    }
  });

  app.post("/api/admin/facilities/:id/staff", requireAdmin, async (req, res) => {
    try {
      const facilityId = parseInt(req.params.id);
      const facility = await storage.getFacility(facilityId);
      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }
      const parsed = insertFacilityStaffSchema.safeParse({ ...req.body, facilityId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid staff data", errors: parsed.error.errors });
      }
      const staff = await storage.createFacilityStaff(parsed.data);
      res.status(201).json(staff);
    } catch (error) {
      console.error("Error adding facility staff:", error);
      res.status(500).json({ message: "Failed to add facility staff" });
    }
  });

  const requireFacilityStaff = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const staff = await storage.getStaffByUserId(req.session.userId);
    if (!staff) {
      return res.status(403).json({ message: "Facility staff access required" });
    }
    (req as any).facilityStaff = staff;
    next();
  };

  app.get("/api/facility/dashboard", requireFacilityStaff, async (req, res) => {
    try {
      const staff = (req as any).facilityStaff;
      const facilityRides = await storage.getRidesByFacility(staff.facilityId);
      res.json({ facility: staff.facility, rides: facilityRides, staff });
    } catch (error) {
      console.error("Error fetching facility dashboard:", error);
      res.status(500).json({ message: "Failed to fetch facility dashboard" });
    }
  });

  app.get("/api/facility/staff-check", requireAuth, async (req, res) => {
    try {
      const staff = await storage.getStaffByUserId(req.session.userId!);
      res.json({ isFacilityStaff: !!staff, staff: staff || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to check facility staff status" });
    }
  });

  app.post("/api/facility/book-ride", requireFacilityStaff, async (req, res) => {
    try {
      const staff = (req as any).facilityStaff;
      const facility = staff.facility;

      const parsed = insertRideSchema.safeParse({
        ...req.body,
        facilityId: facility.id,
        bookedByOther: true,
        bookerName: `${facility.name} Staff`,
        bookerPhone: facility.phone || "",
        bookerEmail: facility.email || "",
        bookerRelation: "caregiver",
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid ride data", errors: parsed.error.errors });
      }

      const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const trackingToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const ride = await storage.createRide({
        ...parsed.data,
        trackingToken,
        trackingTokenExpiresAt: tokenExpiry,
      });

      await storage.setRideVerificationCode(ride.id, verificationCode);

      await storage.createRideEvent({
        rideId: ride.id,
        status: "requested",
        note: `Ride booked by ${facility.name} (facility staff)`,
      });

      broadcastRideUpdate("new_ride", ride);

      res.status(201).json(ride);
    } catch (error) {
      console.error("Error booking facility ride:", error);
      res.status(500).json({ message: "Failed to book ride" });
    }
  });

  // ==========================================
  // Caregiver Portal Routes
  // ==========================================

  app.get("/api/caregiver/patients", requireAuth, async (req, res) => {
    try {
      const patients = await storage.getCaregiverPatients(req.session.userId!);
      res.json(patients);
    } catch (error) {
      console.error("Error fetching caregiver patients:", error);
      res.status(500).json({ message: "Failed to fetch patients" });
    }
  });

  app.post("/api/caregiver/patients", requireAuth, async (req, res) => {
    try {
      const parsed = insertCaregiverPatientSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid patient data", errors: parsed.error.errors });
      }
      const patient = await storage.addCaregiverPatient(req.session.userId!, parsed.data);
      res.status(201).json(patient);
    } catch (error) {
      console.error("Error adding caregiver patient:", error);
      res.status(500).json({ message: "Failed to add patient" });
    }
  });

  app.put("/api/caregiver/patients/:id", requireAuth, async (req, res) => {
    try {
      const patientId = parseInt(req.params.id);
      const existing = await storage.getCaregiverPatient(patientId);
      if (!existing || existing.caregiverId !== req.session.userId) {
        return res.status(404).json({ message: "Patient not found" });
      }
      const parsed = insertCaregiverPatientSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid update data", errors: parsed.error.errors });
      }
      const updated = await storage.updateCaregiverPatient(patientId, parsed.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating caregiver patient:", error);
      res.status(500).json({ message: "Failed to update patient" });
    }
  });

  app.delete("/api/caregiver/patients/:id", requireAuth, async (req, res) => {
    try {
      const patientId = parseInt(req.params.id);
      const existing = await storage.getCaregiverPatient(patientId);
      if (!existing || existing.caregiverId !== req.session.userId) {
        return res.status(404).json({ message: "Patient not found" });
      }
      await storage.removeCaregiverPatient(patientId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing caregiver patient:", error);
      res.status(500).json({ message: "Failed to remove patient" });
    }
  });

  app.get("/api/caregiver/dashboard", requireAuth, async (req, res) => {
    try {
      const patients = await storage.getCaregiverPatients(req.session.userId!);
      const patientPhones = patients.map(p => p.patientPhone);
      let allRides: any[] = [];
      for (const phone of patientPhones) {
        const rides = await storage.getRidesByPhone(phone);
        allRides = allRides.concat(rides);
      }
      allRides.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
      res.json({ patients, rides: allRides });
    } catch (error) {
      console.error("Error fetching caregiver dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard" });
    }
  });

  app.post("/api/caregiver/book-ride", requireAuth, async (req, res) => {
    try {
      const { patientId: caregiverPatientId, ...rideData } = req.body;

      let patientInfo: any = {};
      if (caregiverPatientId) {
        const patient = await storage.getCaregiverPatient(parseInt(caregiverPatientId));
        if (!patient || patient.caregiverId !== req.session.userId) {
          return res.status(404).json({ message: "Patient not found" });
        }
        patientInfo = {
          patientName: patient.patientName,
          patientPhone: patient.patientPhone,
          patientEmail: patient.patientEmail || undefined,
          mobilityNeeds: patient.mobilityNeeds || [],
          medicalNotes: patient.medicalNotes || undefined,
        };
      }

      const user = await storage.getUser(req.session.userId!);
      const driverProfile = user ? await storage.getDriverByUserId(user.id) : null;
      const parsed = insertRideSchema.safeParse({
        ...patientInfo,
        ...rideData,
        bookedByOther: true,
        bookerName: user?.username || "Caregiver",
        bookerPhone: driverProfile?.phone || patientInfo.patientPhone || "",
        bookerEmail: driverProfile?.email || patientInfo.patientEmail || "",
        bookerRelation: "caregiver",
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid ride data", errors: parsed.error.errors });
      }

      const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const trackingToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const ride = await storage.createRide({
        ...parsed.data,
        trackingToken,
        trackingTokenExpiresAt: tokenExpiry,
      });

      await storage.setRideVerificationCode(ride.id, verificationCode);

      await storage.createRideEvent({
        rideId: ride.id,
        status: "requested",
        note: `Ride booked by caregiver for ${parsed.data.patientName}`,
      });

      broadcastRideUpdate("new_ride", ride);

      res.status(201).json(ride);
    } catch (error) {
      console.error("Error booking caregiver ride:", error);
      res.status(500).json({ message: "Failed to book ride" });
    }
  });

  // ==========================================
  // Wait Time Routes
  // ==========================================

  app.post("/api/rides/:id/wait-start", requireDriver, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      const driverProfile = await storage.getDriverByUserId(req.session.userId!);
      if (!driverProfile || ride.driverId !== driverProfile.id) {
        return res.status(403).json({ message: "Not authorized for this ride" });
      }
      if (ride.waitStartedAt) {
        return res.status(400).json({ message: "Wait already started" });
      }
      const updated = await storage.startRideWait(rideId);
      await storage.createRideEvent({
        rideId,
        status: ride.status,
        note: "Driver started waiting at appointment location",
      });
      broadcastRideUpdate("status_change", updated);
      res.json(updated);
    } catch (error) {
      console.error("Error starting wait:", error);
      res.status(500).json({ message: "Failed to start wait" });
    }
  });

  app.post("/api/rides/:id/wait-end", requireDriver, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      const driverProfile = await storage.getDriverByUserId(req.session.userId!);
      if (!driverProfile || ride.driverId !== driverProfile.id) {
        return res.status(403).json({ message: "Not authorized for this ride" });
      }
      if (!ride.waitStartedAt) {
        return res.status(400).json({ message: "Wait not started" });
      }
      if (ride.waitEndedAt) {
        return res.status(400).json({ message: "Wait already ended" });
      }
      const updated = await storage.endRideWait(rideId);
      const waitMinutes = updated?.waitTimeMinutes || 0;
      await storage.createRideEvent({
        rideId,
        status: ride.status,
        note: `Patient ready. Wait time: ${waitMinutes} minutes`,
      });
      broadcastRideUpdate("status_change", updated);
      res.json(updated);
    } catch (error) {
      console.error("Error ending wait:", error);
      res.status(500).json({ message: "Failed to end wait" });
    }
  });

  // ==================== Toll Zone Routes ====================
  
  app.get("/api/toll-zones", async (_req, res) => {
    try {
      const zones = await storage.getTollZones();
      res.json(zones);
    } catch (error) {
      console.error("Error fetching toll zones:", error);
      res.status(500).json({ message: "Failed to fetch toll zones" });
    }
  });

  app.post("/api/toll-zones/estimate", async (req, res) => {
    try {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body;
      
      const pLat = parseFloat(pickupLat);
      const pLng = parseFloat(pickupLng);
      const dLat = parseFloat(dropoffLat);
      const dLng = parseFloat(dropoffLng);

      if (isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) {
        return res.status(400).json({ message: "Valid numeric coordinates are required" });
      }
      if (pLat < -90 || pLat > 90 || dLat < -90 || dLat > 90 || pLng < -180 || pLng > 180 || dLng < -180 || dLng > 180) {
        return res.status(400).json({ message: "Coordinates out of valid range" });
      }

      const zones = await storage.getTollZones();
      const matchedZones: Array<{ name: string; amount: number }> = [];
      let totalTolls = 0;

      for (const zone of zones) {
        const zLat = parseFloat(zone.lat);
        const zLng = parseFloat(zone.lng);
        const radius = parseFloat(zone.radiusMiles);
        const amount = parseFloat(zone.tollAmount);

        if (isPointNearSegment(pLat, pLng, dLat, dLng, zLat, zLng, radius)) {
          matchedZones.push({ name: zone.name, amount });
          totalTolls += amount;
        }
      }

      res.json({
        estimatedTolls: totalTolls.toFixed(2),
        tollZones: matchedZones,
        hasTolls: matchedZones.length > 0,
      });
    } catch (error) {
      console.error("Error estimating tolls:", error);
      res.status(500).json({ message: "Failed to estimate tolls" });
    }
  });

  // Seed toll zones on startup
  seedTollZonesData().catch(err => console.error("Failed to seed toll zones:", err));

  // ==========================================
  // IT SERVICES - TICKETING & DISPATCH SYSTEM
  // ==========================================

  const US_CITY_COORDS: Record<string, { lat: string; lng: string }> = {
    "new york,ny": { lat: "40.7128", lng: "-74.0060" },
    "los angeles,ca": { lat: "34.0522", lng: "-118.2437" },
    "chicago,il": { lat: "41.8781", lng: "-87.6298" },
    "houston,tx": { lat: "29.7604", lng: "-95.3698" },
    "phoenix,az": { lat: "33.4484", lng: "-112.0740" },
    "philadelphia,pa": { lat: "39.9526", lng: "-75.1652" },
    "san antonio,tx": { lat: "29.4241", lng: "-98.4936" },
    "san diego,ca": { lat: "32.7157", lng: "-117.1611" },
    "dallas,tx": { lat: "32.7767", lng: "-96.7970" },
    "san jose,ca": { lat: "37.3382", lng: "-121.8863" },
    "austin,tx": { lat: "30.2672", lng: "-97.7431" },
    "jacksonville,fl": { lat: "30.3322", lng: "-81.6557" },
    "san francisco,ca": { lat: "37.7749", lng: "-122.4194" },
    "columbus,oh": { lat: "39.9612", lng: "-82.9988" },
    "indianapolis,in": { lat: "39.7684", lng: "-86.1581" },
    "charlotte,nc": { lat: "35.2271", lng: "-80.8431" },
    "seattle,wa": { lat: "47.6062", lng: "-122.3321" },
    "denver,co": { lat: "39.7392", lng: "-104.9903" },
    "washington,dc": { lat: "38.9072", lng: "-77.0369" },
    "nashville,tn": { lat: "36.1627", lng: "-86.7816" },
    "boston,ma": { lat: "42.3601", lng: "-71.0589" },
    "atlanta,ga": { lat: "33.7490", lng: "-84.3880" },
    "miami,fl": { lat: "25.7617", lng: "-80.1918" },
    "tampa,fl": { lat: "27.9506", lng: "-82.4572" },
    "orlando,fl": { lat: "28.5383", lng: "-81.3792" },
    "detroit,mi": { lat: "42.3314", lng: "-83.0458" },
    "minneapolis,mn": { lat: "44.9778", lng: "-93.2650" },
    "cleveland,oh": { lat: "41.4993", lng: "-81.6944" },
    "portland,or": { lat: "45.5152", lng: "-122.6784" },
    "las vegas,nv": { lat: "36.1699", lng: "-115.1398" },
    "memphis,tn": { lat: "35.1495", lng: "-90.0490" },
    "louisville,ky": { lat: "38.2527", lng: "-85.7585" },
    "baltimore,md": { lat: "39.2904", lng: "-76.6122" },
    "milwaukee,wi": { lat: "43.0389", lng: "-87.9065" },
    "albuquerque,nm": { lat: "35.0844", lng: "-106.6504" },
    "tucson,az": { lat: "32.2226", lng: "-110.9747" },
    "fresno,ca": { lat: "36.7378", lng: "-119.7871" },
    "sacramento,ca": { lat: "38.5816", lng: "-121.4944" },
    "kansas city,mo": { lat: "39.0997", lng: "-94.5786" },
    "raleigh,nc": { lat: "35.7796", lng: "-78.6382" },
    "omaha,ne": { lat: "41.2565", lng: "-95.9345" },
    "pittsburgh,pa": { lat: "40.4406", lng: "-79.9959" },
    "cincinnati,oh": { lat: "39.1031", lng: "-84.5120" },
    "st. louis,mo": { lat: "38.6270", lng: "-90.1994" },
    "buffalo,ny": { lat: "42.8864", lng: "-78.8784" },
  };

  const US_STATE_COORDS: Record<string, { lat: string; lng: string }> = {
    "al": { lat: "32.3182", lng: "-86.9023" }, "ak": { lat: "64.2008", lng: "-152.4937" },
    "az": { lat: "34.0489", lng: "-111.0937" }, "ar": { lat: "35.2010", lng: "-91.8318" },
    "ca": { lat: "36.7783", lng: "-119.4179" }, "co": { lat: "39.5501", lng: "-105.7821" },
    "ct": { lat: "41.6032", lng: "-73.0877" }, "de": { lat: "38.9108", lng: "-75.5277" },
    "fl": { lat: "27.6648", lng: "-81.5158" }, "ga": { lat: "32.1656", lng: "-82.9001" },
    "hi": { lat: "19.8968", lng: "-155.5828" }, "id": { lat: "44.0682", lng: "-114.7420" },
    "il": { lat: "40.6331", lng: "-89.3985" }, "in": { lat: "40.2672", lng: "-86.1349" },
    "ia": { lat: "41.8780", lng: "-93.0977" }, "ks": { lat: "39.0119", lng: "-98.4842" },
    "ky": { lat: "37.8393", lng: "-84.2700" }, "la": { lat: "30.9843", lng: "-91.9623" },
    "me": { lat: "45.2538", lng: "-69.4455" }, "md": { lat: "39.0458", lng: "-76.6413" },
    "ma": { lat: "42.4072", lng: "-71.3824" }, "mi": { lat: "44.3148", lng: "-85.6024" },
    "mn": { lat: "46.7296", lng: "-94.6859" }, "ms": { lat: "32.3547", lng: "-89.3985" },
    "mo": { lat: "37.9643", lng: "-91.8318" }, "mt": { lat: "46.8797", lng: "-110.3626" },
    "ne": { lat: "41.4925", lng: "-99.9018" }, "nv": { lat: "38.8026", lng: "-116.4194" },
    "nh": { lat: "43.1939", lng: "-71.5724" }, "nj": { lat: "40.0583", lng: "-74.4057" },
    "nm": { lat: "34.5199", lng: "-105.8701" }, "ny": { lat: "40.7128", lng: "-74.0060" },
    "nc": { lat: "35.7596", lng: "-79.0193" }, "nd": { lat: "47.5515", lng: "-101.0020" },
    "oh": { lat: "40.4173", lng: "-82.9071" }, "ok": { lat: "35.0078", lng: "-97.0929" },
    "or": { lat: "43.8041", lng: "-120.5542" }, "pa": { lat: "41.2033", lng: "-77.1945" },
    "ri": { lat: "41.5801", lng: "-71.4774" }, "sc": { lat: "33.8361", lng: "-81.1637" },
    "sd": { lat: "43.9695", lng: "-99.9018" }, "tn": { lat: "35.5175", lng: "-86.5804" },
    "tx": { lat: "31.9686", lng: "-99.9018" }, "ut": { lat: "39.3210", lng: "-111.0937" },
    "vt": { lat: "44.5588", lng: "-72.5778" }, "va": { lat: "37.4316", lng: "-78.6569" },
    "wa": { lat: "47.7511", lng: "-120.7401" }, "wv": { lat: "38.5976", lng: "-80.4549" },
    "wi": { lat: "43.7844", lng: "-88.7879" }, "wy": { lat: "43.0760", lng: "-107.2903" },
    "dc": { lat: "38.9072", lng: "-77.0369" },
  };

  function geocodeCityState(city?: string | null, state?: string | null): { lat: string; lng: string } | null {
    if (city && state) {
      const key = `${city.toLowerCase().trim()},${state.toLowerCase().trim()}`;
      if (US_CITY_COORDS[key]) return US_CITY_COORDS[key];
    }
    if (state) {
      const stateKey = state.toLowerCase().trim();
      if (US_STATE_COORDS[stateKey]) return US_STATE_COORDS[stateKey];
    }
    return null;
  }

  app.get("/api/it/tickets/map", async (_req, res) => {
    try {
      const openTickets = await db.select({
        id: itServiceTickets.id,
        title: itServiceTickets.title,
        category: itServiceTickets.category,
        priority: itServiceTickets.priority,
        status: itServiceTickets.status,
        siteCity: itServiceTickets.siteCity,
        siteState: itServiceTickets.siteState,
        siteLat: itServiceTickets.siteLat,
        siteLng: itServiceTickets.siteLng,
        payType: itServiceTickets.payType,
        payRate: itServiceTickets.payRate,
        scheduledDate: itServiceTickets.scheduledDate,
      })
        .from(itServiceTickets)
        .where(
          and(
            eq(itServiceTickets.isTemplate, false),
            // Only show open/assigned tickets (active ones)
          )
        );

      const ticketsWithCoords = openTickets
        .filter(t => ["open", "assigned", "in_progress"].includes(t.status))
        .map(t => {
          let lat = t.siteLat;
          let lng = t.siteLng;
          if (!lat || !lng) {
            const coords = geocodeCityState(t.siteCity, t.siteState);
            if (coords) {
              lat = coords.lat;
              lng = coords.lng;
            }
          }
          if (!lat || !lng) return null;
          return {
            id: t.id,
            title: t.title,
            category: t.category,
            priority: t.priority,
            status: t.status,
            city: t.siteCity,
            state: t.siteState,
            lat,
            lng,
            payType: t.payType,
            payRate: t.payRate,
            scheduledDate: t.scheduledDate,
          };
        })
        .filter(Boolean);

      res.json(ticketsWithCoords);
    } catch (error) {
      console.error("Error fetching IT tickets for map:", error);
      res.status(500).json({ message: "Failed to fetch IT tickets" });
    }
  });

  app.post("/api/it/companies", requireAuth, async (req, res) => {
    try {
      const parsed = insertItCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const userId = (req as any).session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const existing = await db.select().from(itCompanies).where(eq(itCompanies.ownerId, userId));
      if (existing.length > 0) {
        return res.status(400).json({ message: "You already have a company registered", company: existing[0] });
      }

      const [company] = await db.insert(itCompanies).values({
        ...parsed.data,
        ownerId: userId,
      }).returning();
      res.status(201).json(company);
    } catch (error) {
      console.error("Create IT company error:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.get("/api/it/companies/mine", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const companies = await db.select().from(itCompanies).where(eq(itCompanies.ownerId, userId));
      res.json(companies[0] || null);
    } catch (error) {
      console.error("Get IT company error:", error);
      res.status(500).json({ message: "Failed to get company" });
    }
  });

  app.patch("/api/it/companies/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const company = await db.select().from(itCompanies).where(eq(itCompanies.id, req.params.id));
      if (!company.length || company[0].ownerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const allowedFields = ["companyName", "contactEmail", "contactPhone", "address", "city", "state", "zipCode", "industry", "companySize"];
      const safeUpdate: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) safeUpdate[field] = req.body[field];
      }
      const [updated] = await db.update(itCompanies)
        .set(safeUpdate)
        .where(eq(itCompanies.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Update IT company error:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  const PAYMENT_TERM_FEES: Record<string, number> = {
    instant: 15,
    net7: 12,
    net14: 10,
    net30: 8,
  };

  const DURATION_HOURS: Record<string, number> = {
    "30min": 0.5,
    "1hr": 1,
    "2hr": 2,
    "4hr": 4,
    "full_day": 8,
  };

  function calculateEscrowAmount(payType: string, payRate: number, estimatedDuration?: string, budgetCap?: number): number {
    if (payType === "fixed") return payRate;
    if (budgetCap && budgetCap > 0) return budgetCap;
    const hours = estimatedDuration ? (DURATION_HOURS[estimatedDuration] || 2) : 2;
    return payRate * hours;
  }

  function calculatePayoutDate(approvalDate: Date, paymentTerms: string): Date {
    const d = new Date(approvalDate);
    switch (paymentTerms) {
      case "net7": d.setDate(d.getDate() + 7); break;
      case "net14": d.setDate(d.getDate() + 14); break;
      case "net30": d.setDate(d.getDate() + 30); break;
      default: break;
    }
    return d;
  }

  app.post("/api/it/tickets", requireAuth, async (req, res) => {
    try {
      const parsed = insertItServiceTicketSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const userId = (req as any).session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const userTickets = await db.select().from(itServiceTickets).where(eq(itServiceTickets.createdBy, userId));
      const ticketNumber = `IT-${String(userTickets.length + 1).padStart(5, '0')}`;

      const paymentTerms = parsed.data.paymentTerms || "instant";
      const feePercent = PAYMENT_TERM_FEES[paymentTerms] || 15;

      const payRate = parsed.data.payRate ? parseFloat(parsed.data.payRate) : 0;
      const budgetCapVal = parsed.data.budgetCap ? parseFloat(parsed.data.budgetCap) : undefined;
      const escrowAmt = payRate > 0 ? calculateEscrowAmount(
        parsed.data.payType || "hourly",
        payRate,
        parsed.data.estimatedDuration,
        budgetCapVal
      ) : 0;

      const [ticket] = await db.insert(itServiceTickets).values({
        ...parsed.data,
        createdBy: userId,
        ticketNumber,
        paymentTerms,
        platformFeePercent: String(feePercent),
        escrowAmount: escrowAmt > 0 ? String(escrowAmt.toFixed(2)) : undefined,
        budgetCap: budgetCapVal ? String(budgetCapVal.toFixed(2)) : undefined,
        overtimeRate: parsed.data.overtimeRate || undefined,
        scheduledDate: parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : undefined,
      }).returning();

      notifyItTechsOfNewTicket(
        ticketNumber,
        parsed.data.title,
        parsed.data.category || "general",
        parsed.data.priority || "medium",
        parsed.data.siteCity ? `${parsed.data.siteCity}, ${parsed.data.siteState || ""}` : undefined
      ).catch(err => console.error("Failed to notify techs:", err));

      res.status(201).json(ticket);
    } catch (error) {
      console.error("Create IT ticket error:", error);
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  app.get("/api/it/tickets", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const tickets = await db.select().from(itServiceTickets)
        .where(eq(itServiceTickets.createdBy, userId))
        .orderBy(desc(itServiceTickets.createdAt));
      res.json(tickets);
    } catch (error) {
      console.error("Get IT tickets error:", error);
      res.status(500).json({ message: "Failed to get tickets" });
    }
  });

  app.get("/api/it/tickets/stats/summary", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const tickets = await db.select().from(itServiceTickets)
        .where(eq(itServiceTickets.createdBy, userId));
      const stats = {
        total: tickets.length,
        open: tickets.filter(t => t.status === "open").length,
        inProgress: tickets.filter(t => t.status === "in_progress").length,
        resolved: tickets.filter(t => t.status === "resolved").length,
        closed: tickets.filter(t => t.status === "closed").length,
      };
      res.json(stats);
    } catch (error) {
      console.error("Get IT ticket stats error:", error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  app.get("/api/it/tickets/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });

      if (ticket.createdBy !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const notes = await db.select().from(itTicketNotes)
        .where(eq(itTicketNotes.ticketId, ticket.id))
        .orderBy(desc(itTicketNotes.createdAt));

      res.json({ ticket, notes });
    } catch (error) {
      console.error("Get IT ticket error:", error);
      res.status(500).json({ message: "Failed to get ticket" });
    }
  });

  app.patch("/api/it/tickets/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });

      if (ticket.createdBy !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const allowedFields = ["status", "title", "description", "category", "priority",
        "scheduledDate", "scheduledTime", "estimatedDuration", "siteAddress", "siteCity",
        "siteState", "siteZipCode", "contactOnSite", "contactPhone", "specialInstructions",
        "equipmentNeeded", "assignedTo"];
      const updateData: Record<string, any> = { updatedAt: new Date() };
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updateData[field] = req.body[field];
      }
      if (req.body.status === "resolved") updateData.resolvedAt = new Date();
      if (req.body.status === "closed") updateData.closedAt = new Date();

      const [updated] = await db.update(itServiceTickets)
        .set(updateData)
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Update IT ticket error:", error);
      res.status(500).json({ message: "Failed to update ticket" });
    }
  });

  app.post("/api/it/tickets/:id/notes", requireAuth, async (req, res) => {
    try {
      const parsed = insertItTicketNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });

      if (ticket.createdBy !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const [note] = await db.insert(itTicketNotes).values({
        ...parsed.data,
        ticketId: ticket.id,
        authorId: userId,
      }).returning();

      await db.update(itServiceTickets)
        .set({ updatedAt: new Date() })
        .where(eq(itServiceTickets.id, ticket.id));

      res.status(201).json(note);
    } catch (error) {
      console.error("Create IT ticket note error:", error);
      res.status(500).json({ message: "Failed to add note" });
    }
  });

  // ==========================================
  // IT TECH ONBOARDING & DISPATCH
  // ==========================================

  app.post("/api/it/tech/apply", async (req, res) => {
    try {
      const parsed = insertItTechProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }

      const existing = await db.select().from(users).where(eq(users.username, parsed.data.email));
      if (existing.length > 0) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const hashedPassword = await bcrypt.hash(parsed.data.password, 10);

      const result = await db.transaction(async (tx) => {
        const [user] = await tx.insert(users).values({
          username: parsed.data.email,
          password: hashedPassword,
          role: "it_tech",
        }).returning();

        const [profile] = await tx.insert(itTechProfiles).values({
          userId: user.id,
          fullName: parsed.data.fullName,
          email: parsed.data.email,
          phone: parsed.data.phone,
          city: parsed.data.city,
          state: parsed.data.state,
          zipCode: parsed.data.zipCode,
          skills: parsed.data.skills,
          certifications: parsed.data.certifications,
          experienceYears: parsed.data.experienceYears,
          bio: parsed.data.bio,
          hourlyRate: parsed.data.hourlyRate,
        }).returning();

        return profile;
      });

      res.status(201).json({ message: "Application submitted successfully", profile: result });
    } catch (error) {
      console.error("IT tech apply error:", error);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  app.get("/api/it/tech/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [profile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      res.json(profile || null);
    } catch (error) {
      console.error("Get IT tech profile error:", error);
      res.status(500).json({ message: "Failed to get profile" });
    }
  });

  app.get("/api/it/tech/available-tickets", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [profile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      if (!profile || profile.applicationStatus !== "approved") {
        return res.status(403).json({ message: "Your application must be approved first" });
      }

      const allOpenTickets = await db.select().from(itServiceTickets)
        .where(eq(itServiceTickets.status, "open"))
        .orderBy(desc(itServiceTickets.createdAt));

      const poolMemberships = await db.select().from(itTalentPoolMembers)
        .where(eq(itTalentPoolMembers.techUserId, userId));
      const myPoolIds = poolMemberships.map(m => m.poolId);

      const filtered = allOpenTickets.filter(ticket => {
        const mode = ticket.routingMode || "broadcast";
        if (mode === "broadcast") return true;
        if (mode === "direct_assign") return ticket.directAssignTo === userId;
        if (mode === "talent_pool") return ticket.talentPoolId && myPoolIds.includes(ticket.talentPoolId);
        return true;
      });

      res.json(filtered);
    } catch (error) {
      console.error("Get available IT tickets error:", error);
      res.status(500).json({ message: "Failed to get tickets" });
    }
  });

  app.get("/api/it/tech/my-jobs", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const tickets = await db.select().from(itServiceTickets)
        .where(eq(itServiceTickets.assignedTo, userId))
        .orderBy(desc(itServiceTickets.updatedAt));
      res.json(tickets);
    } catch (error) {
      console.error("Get IT tech jobs error:", error);
      res.status(500).json({ message: "Failed to get jobs" });
    }
  });

  app.post("/api/it/tech/accept-ticket/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [profile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      if (!profile || profile.applicationStatus !== "approved") {
        return res.status(403).json({ message: "Your application must be approved first" });
      }

      const blockedStatuses = ["on_hold", "suspended", "banned"];
      if (profile.accountStatus && blockedStatuses.includes(profile.accountStatus)) {
        const statusMessages: Record<string, string> = {
          on_hold: "Your account is on hold pending review. You cannot accept new tickets until the review is complete.",
          suspended: "Your account is currently suspended. Please contact support.",
          banned: "Your account has been permanently deactivated.",
        };
        return res.status(403).json({ message: statusMessages[profile.accountStatus] || "Account restricted" });
      }

      if (profile.suspendedUntil && new Date(profile.suspendedUntil) > new Date()) {
        return res.status(403).json({ message: `Your account is suspended until ${new Date(profile.suspendedUntil).toLocaleDateString()}` });
      }

      if (profile.suspendedUntil && new Date(profile.suspendedUntil) <= new Date() && profile.accountStatus === "suspended") {
        await db.update(itTechProfiles)
          .set({ accountStatus: "active", suspendedAt: null, suspendedUntil: null, suspensionReason: null })
          .where(eq(itTechProfiles.id, profile.id));
      }

      const [updated] = await db.update(itServiceTickets)
        .set({ assignedTo: userId, status: "in_progress", updatedAt: new Date() })
        .where(and(
          eq(itServiceTickets.id, req.params.id),
          eq(itServiceTickets.status, "open"),
          isNull(itServiceTickets.assignedTo)
        ))
        .returning();

      if (!updated) {
        return res.status(400).json({ message: "Ticket is no longer available or already assigned" });
      }

      notifyItCompanyOfTicketUpdate(
        updated.createdBy,
        updated.ticketNumber,
        updated.title,
        "accepted",
        profile.fullName
      ).catch(err => console.error("Failed to notify ticket owner:", err));

      res.json(updated);
    } catch (error) {
      console.error("Accept IT ticket error:", error);
      res.status(500).json({ message: "Failed to accept ticket" });
    }
  });

  app.post("/api/it/tech/complete-ticket/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [profile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      if (!profile || profile.applicationStatus !== "approved") {
        return res.status(403).json({ message: "Your application must be approved first" });
      }

      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.assignedTo !== userId) return res.status(403).json({ message: "Not assigned to you" });

      const [updated] = await db.update(itServiceTickets)
        .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      await db.update(itTechProfiles)
        .set({ totalJobsCompleted: (profile.totalJobsCompleted || 0) + 1 })
        .where(eq(itTechProfiles.userId, userId));

      notifyItCompanyOfTicketUpdate(
        ticket.createdBy,
        ticket.ticketNumber,
        ticket.title,
        "resolved",
        profile.fullName
      ).catch(err => console.error("Failed to notify ticket owner:", err));

      res.json(updated);
    } catch (error) {
      console.error("Complete IT ticket error:", error);
      res.status(500).json({ message: "Failed to complete ticket" });
    }
  });

  app.get("/api/it/admin/techs", requireAdmin, requirePermission("it_services"), async (_req, res) => {
    try {
      const techs = await db.select().from(itTechProfiles).orderBy(desc(itTechProfiles.createdAt));
      res.json(techs);
    } catch (error) {
      console.error("Get IT techs error:", error);
      res.status(500).json({ message: "Failed to get techs" });
    }
  });

  app.post("/api/it/admin/techs/:id/approve", requireAdmin, async (req, res) => {
    try {
      const [updated] = await db.update(itTechProfiles)
        .set({ applicationStatus: "approved" })
        .where(eq(itTechProfiles.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Tech not found" });
      res.json(updated);
    } catch (error) {
      console.error("Approve IT tech error:", error);
      res.status(500).json({ message: "Failed to approve tech" });
    }
  });

  app.post("/api/it/admin/techs/:id/reject", requireAdmin, async (req, res) => {
    try {
      const [updated] = await db.update(itTechProfiles)
        .set({ applicationStatus: "rejected" })
        .where(eq(itTechProfiles.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Tech not found" });
      res.json(updated);
    } catch (error) {
      console.error("Reject IT tech error:", error);
      res.status(500).json({ message: "Failed to reject tech" });
    }
  });

  // ==========================================
  // IT TECH: ETA / On My Way
  // ==========================================
  app.patch("/api/it/tech/eta/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const { etaStatus } = req.body;
      if (!["en_route", "arriving", "on_site"].includes(etaStatus)) {
        return res.status(400).json({ message: "Invalid ETA status" });
      }
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.assignedTo !== userId) return res.status(403).json({ message: "Not assigned to you" });

      const [updated] = await db.update(itServiceTickets)
        .set({ etaStatus, updatedAt: new Date() })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      notifyItCompanyOfTicketUpdate(
        ticket.createdBy,
        ticket.ticketNumber,
        ticket.title,
        etaStatus === "en_route" ? "tech is on the way" : etaStatus === "arriving" ? "tech is arriving" : "tech is on site",
        ""
      ).catch(err => console.error("Failed to notify ETA:", err));

      res.json(updated);
    } catch (error) {
      console.error("Update ETA error:", error);
      res.status(500).json({ message: "Failed to update ETA" });
    }
  });

  // ==========================================
  // IT TECH: Check-In / Check-Out
  // ==========================================
  app.post("/api/it/tech/checkin/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.assignedTo !== userId) return res.status(403).json({ message: "Not assigned to you" });
      if (ticket.checkInTime) return res.status(400).json({ message: "Already checked in" });

      const now = new Date();
      const isLate = ticket.scheduledDate && ticket.scheduledTime
        ? now > new Date(`${new Date(ticket.scheduledDate).toISOString().split('T')[0]}T${ticket.scheduledTime}:00`)
        : false;

      const { lat, lng } = req.body || {};
      let distanceMeters: number | null = null;
      let locationVerified = false;

      if (lat && lng && ticket.siteLat && ticket.siteLng) {
        const toRad = (d: number) => d * Math.PI / 180;
        const R = 6371000;
        const dLat = toRad(parseFloat(ticket.siteLat) - lat);
        const dLng = toRad(parseFloat(ticket.siteLng) - lng);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat)) * Math.cos(toRad(parseFloat(ticket.siteLat))) * Math.sin(dLng/2)**2;
        distanceMeters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        locationVerified = distanceMeters <= 500;
      }

      const setData: Record<string, any> = {
        checkInTime: now, etaStatus: "on_site", updatedAt: now,
      };
      if (lat) setData.checkInLat = String(lat);
      if (lng) setData.checkInLng = String(lng);
      if (distanceMeters !== null) setData.checkInDistance = String(Math.round(distanceMeters));
      setData.locationVerified = locationVerified;

      const [updated] = await db.update(itServiceTickets)
        .set(setData)
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      const [profile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      if (profile) {
        const updateData: Record<string, any> = {
          onTimeCheckIns: (profile.onTimeCheckIns || 0) + (isLate ? 0 : 1),
          lateCheckIns: (profile.lateCheckIns || 0) + (isLate ? 1 : 0),
        };
        const totalAll = (profile.onTimeCheckIns || 0) + (profile.lateCheckIns || 0) + 1;
        updateData.timelinessScore = String(Math.round(((profile.onTimeCheckIns || 0) + (isLate ? 0 : 1)) / totalAll * 100));
        await db.update(itTechProfiles).set(updateData).where(eq(itTechProfiles.userId, userId));
      }

      const locationNote = locationVerified ? " (GPS verified)" : (lat ? " (GPS unverified - too far)" : " (no GPS)");
      notifyItCompanyOfTicketUpdate(
        ticket.createdBy, ticket.ticketNumber, ticket.title,
        "tech checked in" + (isLate ? " (late)" : "") + locationNote, ""
      ).catch(err => console.error("Failed to notify check-in:", err));

      res.json({ ...updated, isLate, distanceMeters, locationVerified });
    } catch (error) {
      console.error("Check-in error:", error);
      res.status(500).json({ message: "Failed to check in" });
    }
  });

  app.post("/api/it/tech/checkout/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.assignedTo !== userId) return res.status(403).json({ message: "Not assigned to you" });
      if (!ticket.checkInTime) return res.status(400).json({ message: "Must check in first" });
      if (ticket.checkOutTime) return res.status(400).json({ message: "Already checked out" });

      const now = new Date();
      const hoursWorked = ((now.getTime() - new Date(ticket.checkInTime).getTime()) / 3600000).toFixed(2);
      const hoursNum = parseFloat(hoursWorked);

      const payRate = ticket.payRate ? parseFloat(ticket.payRate) : 0;
      const feePercent = ticket.platformFeePercent ? parseFloat(ticket.platformFeePercent) : 15;
      let laborPay = 0;
      let overageAmt = 0;
      let overageHrs = 0;
      let hasOverage = false;

      if (ticket.payType === "fixed") {
        laborPay = payRate;
        const estHours = ticket.estimatedDuration ? (DURATION_HOURS[ticket.estimatedDuration] || 2) : 0;
        if (estHours > 0 && hoursNum > estHours) {
          overageHrs = hoursNum - estHours;
          const otRate = ticket.overtimeRate ? parseFloat(ticket.overtimeRate) : payRate / (estHours || 1);
          overageAmt = Math.round(otRate * overageHrs * 100) / 100;
          hasOverage = true;
        }
      } else {
        laborPay = payRate * hoursNum;
        const budgetCap = ticket.budgetCap ? parseFloat(ticket.budgetCap) : 0;
        if (budgetCap > 0 && laborPay > budgetCap) {
          overageAmt = Math.round((laborPay - budgetCap) * 100) / 100;
          overageHrs = overageAmt / payRate;
          laborPay = budgetCap;
          hasOverage = true;
        }
      }

      const mileagePay = ticket.mileagePay ? parseFloat(ticket.mileagePay) : 0;
      const delayCmp = ticket.delayCompensation ? parseFloat(ticket.delayCompensation) : 0;
      const basePay = Math.round((laborPay + mileagePay + delayCmp) * 100) / 100;
      const totalPay = basePay;
      const platformFee = Math.round(totalPay * (feePercent / 100) * 100) / 100;
      const techPayout = Math.round((totalPay - platformFee) * 100) / 100;

      const setData: Record<string, any> = {
        checkOutTime: now,
        hoursWorked: hoursWorked,
        totalPay: String(totalPay.toFixed(2)),
        platformFee: String(platformFee.toFixed(2)),
        techPayout: String(techPayout.toFixed(2)),
        paymentStatus: totalPay > 0 ? "pending" : "unpaid",
        companyApproval: "pending",
        updatedAt: now,
      };

      if (hasOverage) {
        setData.overageAmount = String(overageAmt.toFixed(2));
        setData.overageHours = String(overageHrs.toFixed(2));
        setData.overageApproved = false;
      }

      const [updated] = await db.update(itServiceTickets)
        .set(setData)
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      const [profile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      if (profile) {
        await db.update(itTechProfiles)
          .set({ totalEarnings: String((parseFloat(profile.totalEarnings || "0") + techPayout).toFixed(2)) })
          .where(eq(itTechProfiles.userId, userId));
      }

      const overageNote = hasOverage ? ` (overage: $${overageAmt.toFixed(2)} pending approval)` : "";
      notifyItCompanyOfTicketUpdate(
        ticket.createdBy, ticket.ticketNumber, ticket.title,
        `tech checked out - awaiting your approval${overageNote}`, ""
      ).catch(err => console.error("Failed to notify checkout:", err));

      res.json({ ...updated, hasOverage, overageAmount: overageAmt, overageHours: overageHrs });
    } catch (error) {
      console.error("Check-out error:", error);
      res.status(500).json({ message: "Failed to check out" });
    }
  });

  // ==========================================
  // IT TECH: Deliverables / Proof of Work
  // ==========================================
  app.post("/api/it/tech/deliverables/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.assignedTo !== userId) return res.status(403).json({ message: "Not assigned to you" });

      const { description, type, url } = req.body;
      if (!description) return res.status(400).json({ message: "Description is required" });

      const existing = JSON.parse(ticket.deliverables || "[]");
      existing.push({
        id: Date.now().toString(),
        description,
        type: type || "note",
        url: url || null,
        addedAt: new Date().toISOString(),
        addedBy: userId,
      });

      const [updated] = await db.update(itServiceTickets)
        .set({ deliverables: JSON.stringify(existing), updatedAt: new Date() })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Add deliverable error:", error);
      res.status(500).json({ message: "Failed to add deliverable" });
    }
  });

  // ==========================================
  // IT: Cancellation with Compensation
  // ==========================================
  app.post("/api/it/tickets/:id/cancel", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });

      const isOwner = ticket.createdBy === userId;
      const isTech = ticket.assignedTo === userId;
      if (!isOwner && !isTech) return res.status(403).json({ message: "Not authorized" });

      if (["resolved", "closed", "cancelled"].includes(ticket.status)) {
        return res.status(400).json({ message: "Ticket is already " + ticket.status });
      }

      const { reason } = req.body;
      if (!reason) return res.status(400).json({ message: "Cancellation reason is required" });

      const now = new Date();
      const setData: Record<string, any> = {
        status: "cancelled",
        cancellationReason: reason,
        cancelledBy: userId,
        cancelledAt: now,
        updatedAt: now,
      };

      if (isOwner && ticket.assignedTo) {
        const payRate = ticket.payRate ? parseFloat(ticket.payRate) : 0;
        let cancellationFee = 0;

        if (ticket.checkInTime) {
          const hoursOnSite = (now.getTime() - new Date(ticket.checkInTime).getTime()) / 3600000;
          cancellationFee = Math.round(payRate * Math.max(hoursOnSite, 1) * 100) / 100;
        } else if (ticket.etaStatus === "en_route" || ticket.etaStatus === "arriving") {
          cancellationFee = Math.round(payRate * 0.5 * 100) / 100;
        } else {
          const scheduledTime = ticket.scheduledDate ? new Date(ticket.scheduledDate) : null;
          if (scheduledTime) {
            const hoursUntil = (scheduledTime.getTime() - now.getTime()) / 3600000;
            if (hoursUntil < 2) {
              cancellationFee = Math.round(payRate * 0.25 * 100) / 100;
            }
          }
        }

        const mileagePay = ticket.mileagePay ? parseFloat(ticket.mileagePay) : 0;
        cancellationFee += mileagePay;

        setData.cancellationFee = String(cancellationFee.toFixed(2));

        if (cancellationFee > 0) {
          const platformFee = Math.round(cancellationFee * 0.10 * 100) / 100;
          setData.totalPay = String(cancellationFee.toFixed(2));
          setData.platformFee = String(platformFee.toFixed(2));
          setData.techPayout = String((cancellationFee - platformFee).toFixed(2));
          setData.paymentStatus = "pending";

          const [profile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, ticket.assignedTo));
          if (profile) {
            const newEarnings = parseFloat(profile.totalEarnings || "0") + (cancellationFee - platformFee);
            await db.update(itTechProfiles)
              .set({ totalEarnings: String(newEarnings.toFixed(2)) })
              .where(eq(itTechProfiles.userId, ticket.assignedTo));
          }
        }
      }

      if (isTech && !isOwner) {
        setData.assignedTo = null;
        setData.status = "open";
        setData.etaStatus = "none";
        setData.cancelledAt = now;
        setData.cancellationReason = reason;
        setData.cancelledBy = userId;
      }

      const [updated] = await db.update(itServiceTickets)
        .set(setData)
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      const cancellerType = isOwner ? "Company" : "Tech";
      notifyItCompanyOfTicketUpdate(
        isOwner ? (ticket.assignedTo || ticket.createdBy) : ticket.createdBy,
        ticket.ticketNumber, ticket.title,
        `cancelled by ${cancellerType}: ${reason}` + (setData.cancellationFee ? ` (Compensation: $${setData.cancellationFee})` : ""),
        ""
      ).catch(err => console.error("Failed to notify cancellation:", err));

      res.json(updated);
    } catch (error) {
      console.error("Cancel IT ticket error:", error);
      res.status(500).json({ message: "Failed to cancel ticket" });
    }
  });

  // ==========================================
  // IT: Company Approval of Completed Work
  // ==========================================
  app.post("/api/it/tickets/:id/approve", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.createdBy !== userId) return res.status(403).json({ message: "Not authorized" });

      if (ticket.companyApproval === "approved") {
        return res.status(400).json({ message: "Already approved" });
      }

      const { notes } = req.body || {};
      const now = new Date();
      const payTerms = ticket.paymentTerms || "instant";
      const payoutDt = calculatePayoutDate(now, payTerms);

      const newPayStatus = payTerms === "instant" ? "processing" : "scheduled";

      const [updated] = await db.update(itServiceTickets)
        .set({
          companyApproval: "approved",
          companyApprovalAt: now,
          companyApprovalNotes: notes || null,
          paymentStatus: newPayStatus,
          payoutDate: payoutDt,
          escrowStatus: ticket.escrowStatus === "funded" ? "releasing" : ticket.escrowStatus,
          status: ticket.status === "resolved" ? "closed" : ticket.status,
          closedAt: ticket.status === "resolved" ? now : ticket.closedAt,
          updatedAt: now,
        })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      const payMsg = payTerms === "instant"
        ? "payment processing now"
        : `payment scheduled for ${payoutDt.toLocaleDateString()}`;

      if (ticket.assignedTo) {
        notifyItCompanyOfTicketUpdate(
          ticket.assignedTo, ticket.ticketNumber, ticket.title,
          `work approved by company - ${payMsg}`, ""
        ).catch(err => console.error("Failed to notify approval:", err));
      }

      res.json(updated);
    } catch (error) {
      console.error("Approve IT ticket error:", error);
      res.status(500).json({ message: "Failed to approve" });
    }
  });

  app.post("/api/it/tickets/:id/fund-escrow", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.createdBy !== userId) return res.status(403).json({ message: "Not authorized" });
      if (ticket.escrowStatus === "funded") return res.status(400).json({ message: "Escrow already funded" });

      const escrowAmt = ticket.escrowAmount ? parseFloat(ticket.escrowAmount) : 0;
      if (escrowAmt <= 0) return res.status(400).json({ message: "No escrow amount set" });

      const stripeClient = getUncachableStripeClient();

      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(escrowAmt * 100),
        currency: "usd",
        metadata: {
          type: "it_escrow",
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          userId,
        },
        capture_method: "manual",
        description: `IT Service Escrow - ${ticket.ticketNumber}: ${ticket.title}`,
      });

      const [updated] = await db.update(itServiceTickets)
        .set({
          stripePaymentIntentId: paymentIntent.id,
          escrowStatus: "pending",
          updatedAt: new Date(),
        })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      res.json({
        ticket: updated,
        clientSecret: paymentIntent.client_secret,
        escrowAmount: escrowAmt,
      });
    } catch (error) {
      console.error("Fund escrow error:", error);
      res.status(500).json({ message: "Failed to create escrow payment" });
    }
  });

  app.post("/api/it/tickets/:id/confirm-escrow", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.createdBy !== userId) return res.status(403).json({ message: "Not authorized" });

      if (ticket.stripePaymentIntentId) {
        const stripeClient = getUncachableStripeClient();
        const pi = await stripeClient.paymentIntents.retrieve(ticket.stripePaymentIntentId);
        if (pi.status !== "requires_capture" && pi.status !== "succeeded") {
          return res.status(400).json({ message: `Payment not confirmed. Status: ${pi.status}` });
        }
      }

      const [updated] = await db.update(itServiceTickets)
        .set({
          escrowStatus: "funded",
          updatedAt: new Date(),
        })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Confirm escrow error:", error);
      res.status(500).json({ message: "Failed to confirm escrow" });
    }
  });

  app.post("/api/it/tickets/:id/approve-overage", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.createdBy !== userId) return res.status(403).json({ message: "Not authorized" });

      if (!ticket.overageAmount || parseFloat(ticket.overageAmount) <= 0) {
        return res.status(400).json({ message: "No overage to approve" });
      }

      const overageAmt = parseFloat(ticket.overageAmount);
      const currentTotal = parseFloat(ticket.totalPay || "0");
      const feePercent = ticket.platformFeePercent ? parseFloat(ticket.platformFeePercent) : 15;
      const newTotal = Math.round((currentTotal + overageAmt) * 100) / 100;
      const newFee = Math.round(newTotal * (feePercent / 100) * 100) / 100;
      const newPayout = Math.round((newTotal - newFee) * 100) / 100;

      const [updated] = await db.update(itServiceTickets)
        .set({
          overageApproved: true,
          totalPay: String(newTotal.toFixed(2)),
          platformFee: String(newFee.toFixed(2)),
          techPayout: String(newPayout.toFixed(2)),
          updatedAt: new Date(),
        })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      if (ticket.assignedTo) {
        notifyItCompanyOfTicketUpdate(
          ticket.assignedTo, ticket.ticketNumber, ticket.title,
          `overage of $${overageAmt.toFixed(2)} approved - total updated to $${newTotal.toFixed(2)}`, ""
        ).catch(err => console.error("Failed to notify overage approval:", err));
      }

      res.json(updated);
    } catch (error) {
      console.error("Approve overage error:", error);
      res.status(500).json({ message: "Failed to approve overage" });
    }
  });

  app.post("/api/it/tickets/:id/reject-overage", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.createdBy !== userId) return res.status(403).json({ message: "Not authorized" });

      const [updated] = await db.update(itServiceTickets)
        .set({
          overageApproved: false,
          overageAmount: "0",
          overageHours: "0",
          updatedAt: new Date(),
        })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Reject overage error:", error);
      res.status(500).json({ message: "Failed to reject overage" });
    }
  });

  app.get("/api/it/payment-terms", (_req, res) => {
    res.json({
      terms: [
        { value: "instant", label: "Instant (upon approval)", feePercent: 15, description: "Tech gets paid immediately after you approve" },
        { value: "net7", label: "Net 7 days", feePercent: 12, description: "Payment released 7 days after approval" },
        { value: "net14", label: "Net 14 days", feePercent: 10, description: "Payment released 14 days after approval" },
        { value: "net30", label: "Net 30 days", feePercent: 8, description: "Payment released 30 days after approval" },
      ],
    });
  });

  app.get("/api/it/company/payment-history", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const tickets = await db.select().from(itServiceTickets)
        .where(eq(itServiceTickets.createdBy, userId))
        .orderBy(desc(itServiceTickets.updatedAt));

      const paid = tickets.filter(t => ["processing", "completed", "scheduled", "approved"].includes(t.paymentStatus || ""));
      const totalSpent = paid.reduce((s, t) => s + parseFloat(t.totalPay || "0"), 0);
      const totalFees = paid.reduce((s, t) => s + parseFloat(t.platformFee || "0"), 0);
      const pendingEscrow = tickets.filter(t => t.escrowStatus === "funded" && t.paymentStatus === "pending")
        .reduce((s, t) => s + parseFloat(t.escrowAmount || "0"), 0);

      res.json({
        totalSpent: totalSpent.toFixed(2),
        totalFees: totalFees.toFixed(2),
        pendingEscrow: pendingEscrow.toFixed(2),
        tickets: paid.map(t => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          title: t.title,
          totalPay: t.totalPay,
          platformFee: t.platformFee,
          techPayout: t.techPayout,
          paymentTerms: t.paymentTerms,
          paymentStatus: t.paymentStatus,
          payoutDate: t.payoutDate,
          escrowStatus: t.escrowStatus,
          companyApproval: t.companyApproval,
          approvedAt: t.companyApprovalAt,
          overageAmount: t.overageAmount,
          overageApproved: t.overageApproved,
        })),
      });
    } catch (error) {
      console.error("Get company payment history error:", error);
      res.status(500).json({ message: "Failed to get payment history" });
    }
  });

  app.get("/api/it/tech/payment-history", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const tickets = await db.select().from(itServiceTickets)
        .where(eq(itServiceTickets.assignedTo, userId))
        .orderBy(desc(itServiceTickets.updatedAt));

      const paid = tickets.filter(t => t.techPayout && parseFloat(t.techPayout) > 0);
      const totalEarned = paid.reduce((s, t) => s + parseFloat(t.techPayout || "0"), 0);
      const pendingPayout = paid.filter(t => ["pending", "scheduled", "processing"].includes(t.paymentStatus || ""))
        .reduce((s, t) => s + parseFloat(t.techPayout || "0"), 0);
      const completedPayout = paid.filter(t => t.paymentStatus === "completed")
        .reduce((s, t) => s + parseFloat(t.techPayout || "0"), 0);

      res.json({
        totalEarned: totalEarned.toFixed(2),
        pendingPayout: pendingPayout.toFixed(2),
        completedPayout: completedPayout.toFixed(2),
        payments: paid.map(t => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          title: t.title,
          hoursWorked: t.hoursWorked,
          totalPay: t.totalPay,
          platformFee: t.platformFee,
          techPayout: t.techPayout,
          paymentTerms: t.paymentTerms,
          paymentStatus: t.paymentStatus,
          payoutDate: t.payoutDate,
          companyApproval: t.companyApproval,
          overageAmount: t.overageAmount,
          overageApproved: t.overageApproved,
          checkOutTime: t.checkOutTime,
        })),
      });
    } catch (error) {
      console.error("Get tech payment history error:", error);
      res.status(500).json({ message: "Failed to get payment history" });
    }
  });

  app.post("/api/it/tickets/:id/dispute", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.createdBy !== userId) return res.status(403).json({ message: "Not authorized" });

      const { reason } = req.body;
      if (!reason) return res.status(400).json({ message: "Dispute reason is required" });

      const [updated] = await db.update(itServiceTickets)
        .set({
          companyApproval: "disputed",
          companyApprovalNotes: reason,
          paymentStatus: "disputed",
          disputeReason: reason,
          disputedAt: new Date(),
          mediationStatus: "none",
          updatedAt: new Date(),
        })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      if (ticket.assignedTo) {
        notifyItCompanyOfTicketUpdate(
          ticket.assignedTo, ticket.ticketNumber, ticket.title,
          "work disputed by company: " + reason, ""
        ).catch(err => console.error("Failed to notify dispute:", err));
      }

      res.json(updated);
    } catch (error) {
      console.error("Dispute IT ticket error:", error);
      res.status(500).json({ message: "Failed to dispute" });
    }
  });

  // ==========================================
  // IT: Dispute Mediation (Admin)
  // ==========================================
  app.post("/api/it/tickets/:id/request-mediation", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.createdBy !== userId && ticket.assignedTo !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (ticket.companyApproval !== "disputed") {
        return res.status(400).json({ message: "Ticket must be disputed to request mediation" });
      }

      const [updated] = await db.update(itServiceTickets)
        .set({ mediationStatus: "requested", updatedAt: new Date() })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Request mediation error:", error);
      res.status(500).json({ message: "Failed to request mediation" });
    }
  });

  app.post("/api/it/admin/tickets/:id/mediate", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin only" });

      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });

      const { resolution, notes, awardTo } = req.body;
      if (!resolution || !["favor_company", "favor_tech", "split", "cancel"].includes(resolution)) {
        return res.status(400).json({ message: "Invalid resolution. Must be favor_company, favor_tech, split, or cancel" });
      }

      let paymentStatus = "disputed";
      let companyApproval = "disputed";
      if (resolution === "favor_tech") {
        paymentStatus = ticket.paymentTerms === "instant" ? "processing" : "scheduled";
        companyApproval = "approved";
      } else if (resolution === "favor_company") {
        paymentStatus = "refunded";
        companyApproval = "disputed";
      } else if (resolution === "split") {
        const totalPay = parseFloat(ticket.totalPay || "0");
        const splitAmount = totalPay / 2;
        const feePercent = ticket.platformFeePercent ? parseFloat(ticket.platformFeePercent) : 15;
        const fee = Math.round(splitAmount * (feePercent / 100) * 100) / 100;
        await db.update(itServiceTickets)
          .set({
            totalPay: String(splitAmount.toFixed(2)),
            platformFee: String(fee.toFixed(2)),
            techPayout: String((splitAmount - fee).toFixed(2)),
          })
          .where(eq(itServiceTickets.id, req.params.id));
        paymentStatus = ticket.paymentTerms === "instant" ? "processing" : "scheduled";
        companyApproval = "approved";
      } else if (resolution === "cancel") {
        paymentStatus = "refunded";
        companyApproval = "disputed";
      }

      const [updated] = await db.update(itServiceTickets)
        .set({
          mediationStatus: "resolved",
          mediationNotes: notes || "",
          mediationResolution: resolution,
          mediationResolvedAt: new Date(),
          mediatorId: userId,
          paymentStatus,
          companyApproval,
          updatedAt: new Date(),
        })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      if (ticket.assignedTo) {
        notifyItCompanyOfTicketUpdate(
          ticket.assignedTo, ticket.ticketNumber, ticket.title,
          `Dispute resolved: ${resolution}. ${notes || ""}`, ""
        ).catch(err => console.error("Failed to notify mediation:", err));
      }

      res.json(updated);
    } catch (error) {
      console.error("Mediate dispute error:", error);
      res.status(500).json({ message: "Failed to mediate dispute" });
    }
  });

  // ==========================================
  // IT Tech: Contractor Onboarding & 1099
  // ==========================================
  const IT_TECH_IC_AGREEMENT_VERSION = "1.0";
  const IT_TECH_IC_AGREEMENT_TEXT = `INDEPENDENT CONTRACTOR AGREEMENT

This Independent Contractor Agreement ("Agreement") is entered into between CareHub ("Company") and the undersigned independent contractor ("Contractor").

1. INDEPENDENT CONTRACTOR RELATIONSHIP
Contractor acknowledges that they are an independent contractor and not an employee of the Company. Nothing in this Agreement shall be construed to create an employer-employee, partnership, or joint venture relationship.

2. SERVICES
Contractor agrees to provide IT services and technical support through the CareHub IT Services platform. Contractor retains full discretion over when, where, and how to perform services, subject to client site requirements.

3. WORK SCHEDULE
Contractor has complete freedom to accept or decline service tickets and work for competing platforms simultaneously. Scheduled appointments must be honored once accepted.

4. EQUIPMENT AND EXPENSES
Contractor is responsible for providing and maintaining their own tools, equipment, transportation, and all other resources necessary to perform services. Company shall not reimburse Contractor for these expenses unless explicitly agreed upon in the service ticket.

5. CERTIFICATIONS AND QUALIFICATIONS
Contractor represents that all certifications, skills, and qualifications listed in their profile are current and valid. Misrepresentation of qualifications may result in immediate account deactivation and financial liability.

6. COMPENSATION
Contractor will be compensated per completed service ticket based on the rate agreed upon in each ticket. Platform fees are deducted before payout. Contractor is responsible for all taxes, including self-employment tax. Company will issue a 1099-NEC form for annual earnings exceeding $600.

7. BACKGROUND CHECK AND COMPLIANCE
Contractor consents to background checks and must maintain valid professional certifications. Failure to maintain compliance may result in immediate deactivation.

8. CONFIDENTIALITY AND HIPAA
Contractor agrees to keep confidential all client information, site details, patient data, and proprietary Company information encountered during the performance of services, in strict compliance with HIPAA and applicable privacy laws. Violation may result in legal action.

9. LIABILITY AND INSURANCE
Contractor is responsible for any damage caused to client property or systems during service delivery. Contractor is encouraged to maintain professional liability insurance.

10. INDEMNIFICATION
Contractor agrees to indemnify and hold harmless the Company from any claims, damages, or liabilities arising from Contractor's performance of services.

11. TERMINATION
Either party may terminate this Agreement at any time, with or without cause, by providing written notice. Company may immediately deactivate Contractor's account for safety violations, quality failures, or compliance issues.

12. DISPUTE RESOLUTION
Any disputes arising under this Agreement shall first be submitted to the platform's mediation process. If unresolved, disputes shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.

13. GOVERNING LAW
This Agreement shall be governed by the laws of the state in which Contractor primarily operates.

[NOTE: This is a template agreement. Consult with a licensed attorney before use in production.]`;

  app.get("/api/it/tech/ic-agreement-text", requireAuth, (_req, res) => {
    res.json({ version: IT_TECH_IC_AGREEMENT_VERSION, content: IT_TECH_IC_AGREEMENT_TEXT });
  });

  app.post("/api/it/tech/sign-ic-agreement", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const { fullLegalName } = req.body;

      if (!fullLegalName || fullLegalName.trim().length < 2) {
        return res.status(400).json({ message: "Full legal name is required for digital signature" });
      }

      const [techProfile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      if (!techProfile) return res.status(404).json({ message: "IT tech profile not found" });

      const crypto = await import("crypto");
      const contentHash = crypto.createHash("sha256").update(IT_TECH_IC_AGREEMENT_TEXT).digest("hex");
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      await db.insert(legalAgreements).values({
        userId,
        agreementType: "it_tech_ic_agreement",
        version: IT_TECH_IC_AGREEMENT_VERSION,
        ipAddress,
        userAgent,
        content: IT_TECH_IC_AGREEMENT_TEXT,
        signerName: fullLegalName.trim(),
        contentHash,
      });

      await db.insert(itTechContractorAgreements).values({
        techProfileId: techProfile.id,
        agreementVersion: IT_TECH_IC_AGREEMENT_VERSION,
        ipAddress,
        userAgent,
      });

      await db.update(itTechProfiles)
        .set({ icAgreementSignedAt: new Date() })
        .where(eq(itTechProfiles.id, techProfile.id));

      res.json({ message: "Independent Contractor Agreement signed successfully" });
    } catch (error) {
      console.error("Error signing IT tech IC agreement:", error);
      res.status(500).json({ message: "Failed to sign agreement" });
    }
  });

  app.post("/api/it/tech/contractor-onboarding", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const { ssnLast4, taxClassification, businessName, taxAddress, taxCity, taxState, taxZip } = req.body;

      if (!ssnLast4 || ssnLast4.length !== 4 || !/^\d{4}$/.test(ssnLast4)) {
        return res.status(400).json({ message: "Last 4 digits of SSN required (4 digits)" });
      }

      const [techProfile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      if (!techProfile) return res.status(404).json({ message: "IT tech profile not found" });

      const [updated] = await db.update(itTechProfiles)
        .set({
          ssnLast4,
          taxClassification: taxClassification || "individual",
          businessName: businessName || null,
          taxAddress: taxAddress || null,
          taxCity: taxCity || null,
          taxState: taxState || null,
          taxZip: taxZip || null,
          w9ReceivedAt: new Date(),
          isContractorOnboarded: true,
        })
        .where(eq(itTechProfiles.id, techProfile.id))
        .returning();

      res.json({ message: "Contractor onboarding complete", profile: updated });
    } catch (error) {
      console.error("Error IT tech contractor onboarding:", error);
      res.status(500).json({ message: "Failed to complete contractor onboarding" });
    }
  });

  app.get("/api/it/tech/tax-years", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [techProfile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      if (!techProfile) return res.status(404).json({ message: "IT tech profile not found" });

      const completedTickets = await db.select().from(itServiceTickets)
        .where(and(eq(itServiceTickets.assignedTo, userId), eq(itServiceTickets.status, "completed")));

      const yearsSet = new Set<number>();
      completedTickets.forEach(t => {
        if (t.checkOutTime) {
          yearsSet.add(new Date(t.checkOutTime).getFullYear());
        } else if (t.updatedAt) {
          yearsSet.add(new Date(t.updatedAt).getFullYear());
        }
      });

      const years = Array.from(yearsSet).sort((a, b) => b - a);
      res.json({ years });
    } catch (error) {
      console.error("Error getting IT tech tax years:", error);
      res.status(500).json({ message: "Failed to get tax years" });
    }
  });

  app.get("/api/it/tech/1099/:year", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const taxYear = parseInt(req.params.year);

      if (isNaN(taxYear) || taxYear < 2020 || taxYear > new Date().getFullYear()) {
        return res.status(400).json({ message: "Invalid tax year" });
      }

      const [techProfile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      if (!techProfile) return res.status(404).json({ message: "IT tech profile not found" });

      if (!techProfile.isContractorOnboarded || !techProfile.ssnLast4) {
        return res.status(400).json({ message: "Must complete contractor onboarding first" });
      }

      const completedTickets = await db.select().from(itServiceTickets)
        .where(and(eq(itServiceTickets.assignedTo, userId), eq(itServiceTickets.status, "completed")));

      const yearTickets = completedTickets.filter(t => {
        const dt = t.checkOutTime ? new Date(t.checkOutTime) : (t.updatedAt ? new Date(t.updatedAt) : null);
        return dt && dt.getFullYear() === taxYear;
      });

      const totalEarnings = yearTickets.reduce((sum, t) => sum + parseFloat(t.techPayout || "0"), 0);
      const totalJobs = yearTickets.length;
      const requiresForm = totalEarnings >= 600;

      let [earningsRecord] = await db.select().from(itTechAnnualEarnings)
        .where(and(eq(itTechAnnualEarnings.techProfileId, techProfile.id), eq(itTechAnnualEarnings.taxYear, taxYear)));

      if (!earningsRecord) {
        [earningsRecord] = await db.insert(itTechAnnualEarnings).values({
          techProfileId: techProfile.id,
          taxYear,
          totalGrossEarnings: String(totalEarnings.toFixed(2)),
          totalJobs,
          form1099Generated: true,
          form1099GeneratedAt: new Date(),
          form1099DownloadCount: 1,
        }).returning();
      } else {
        await db.update(itTechAnnualEarnings)
          .set({
            totalGrossEarnings: String(totalEarnings.toFixed(2)),
            totalJobs,
            form1099Generated: true,
            form1099GeneratedAt: new Date(),
            form1099DownloadCount: (earningsRecord.form1099DownloadCount || 0) + 1,
            lastCalculatedAt: new Date(),
          })
          .where(eq(itTechAnnualEarnings.id, earningsRecord.id));
      }

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
          name: techProfile.businessName || techProfile.fullName,
          ssnLast4: techProfile.ssnLast4,
          address: techProfile.taxAddress || "",
          city: techProfile.taxCity || "",
          state: techProfile.taxState || "",
          zip: techProfile.taxZip || ""
        },
        box1_nonemployeeCompensation: totalEarnings.toFixed(2),
        totalJobs,
        grossEarnings: totalEarnings.toFixed(2),
        message: requiresForm
          ? "This is your 1099-NEC data for tax filing purposes."
          : "Your earnings were below $600. A 1099-NEC is not required, but you must still report this income."
      });
    } catch (error) {
      console.error("Error generating IT tech 1099:", error);
      res.status(500).json({ message: "Failed to generate 1099" });
    }
  });

  // ==========================================
  // IT Tech: Certification Document Uploads
  // ==========================================
  const certUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        const uploadDir = path.join(process.cwd(), "uploads", "it-certs");
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `cert-${uniqueSuffix}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Only PDF and image files are allowed"));
      }
    },
  });

  app.post("/api/it/tech/certifications/upload", requireAuth, certUpload.single("document"), async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const file = req.file;
      const { certName, certIssuer, certExpiry } = req.body;

      if (!file) return res.status(400).json({ message: "No file uploaded" });
      if (!certName) return res.status(400).json({ message: "Certification name is required" });

      const [techProfile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      if (!techProfile) return res.status(404).json({ message: "IT tech profile not found" });

      const filePath = `/uploads/it-certs/${file.filename}`;
      const existingDocs = (techProfile.certificationDocs as any[]) || [];
      const newDoc = {
        id: crypto.randomUUID(),
        name: certName,
        issuer: certIssuer || "",
        expiry: certExpiry || null,
        filePath,
        fileName: file.originalname,
        uploadedAt: new Date().toISOString(),
        verified: false,
      };

      const [updated] = await db.update(itTechProfiles)
        .set({ certificationDocs: [...existingDocs, newDoc] })
        .where(eq(itTechProfiles.id, techProfile.id))
        .returning();

      res.json({ message: "Certification uploaded", doc: newDoc, profile: updated });
    } catch (error) {
      console.error("Error uploading certification:", error);
      res.status(500).json({ message: "Failed to upload certification" });
    }
  });

  app.delete("/api/it/tech/certifications/:certId", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [techProfile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      if (!techProfile) return res.status(404).json({ message: "IT tech profile not found" });

      const existingDocs = (techProfile.certificationDocs as any[]) || [];
      const filtered = existingDocs.filter((d: any) => d.id !== req.params.certId);

      if (filtered.length === existingDocs.length) {
        return res.status(404).json({ message: "Certification not found" });
      }

      const [updated] = await db.update(itTechProfiles)
        .set({ certificationDocs: filtered })
        .where(eq(itTechProfiles.id, techProfile.id))
        .returning();

      res.json({ message: "Certification removed", profile: updated });
    } catch (error) {
      console.error("Error removing certification:", error);
      res.status(500).json({ message: "Failed to remove certification" });
    }
  });

  app.get("/api/it/tech/:id/certifications", requireAuth, async (req, res) => {
    try {
      const [techProfile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.id, req.params.id));
      if (!techProfile) return res.status(404).json({ message: "Tech profile not found" });

      const docs = ((techProfile.certificationDocs as any[]) || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        issuer: d.issuer,
        expiry: d.expiry,
        verified: d.verified,
        verifiedAt: d.verifiedAt,
        filePath: d.filePath,
        uploadedAt: d.uploadedAt,
      }));

      res.json({
        certifications: techProfile.certifications || [],
        certificationDocs: docs,
        fullName: techProfile.fullName,
      });
    } catch (error) {
      console.error("Error getting tech certifications:", error);
      res.status(500).json({ message: "Failed to get certifications" });
    }
  });

  app.post("/api/it/admin/certifications/:certId/verify", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin only" });

      const { techProfileId } = req.body;
      const [techProfile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.id, techProfileId));
      if (!techProfile) return res.status(404).json({ message: "Tech profile not found" });

      const docs = (techProfile.certificationDocs as any[]) || [];
      const updatedDocs = docs.map((d: any) => {
        if (d.id === req.params.certId) {
          return { ...d, verified: true, verifiedAt: new Date().toISOString(), verifiedBy: userId };
        }
        return d;
      });

      const [updated] = await db.update(itTechProfiles)
        .set({ certificationDocs: updatedDocs })
        .where(eq(itTechProfiles.id, techProfileId))
        .returning();

      res.json({ message: "Certification verified", profile: updated });
    } catch (error) {
      console.error("Error verifying certification:", error);
      res.status(500).json({ message: "Failed to verify certification" });
    }
  });

  app.get("/api/it/tech/contractor-status", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [techProfile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      if (!techProfile) return res.status(404).json({ message: "IT tech profile not found" });

      res.json({
        isContractorOnboarded: techProfile.isContractorOnboarded || false,
        icAgreementSignedAt: techProfile.icAgreementSignedAt,
        ssnLast4: techProfile.ssnLast4 ? `****${techProfile.ssnLast4}` : null,
        taxClassification: techProfile.taxClassification,
        businessName: techProfile.businessName,
        taxAddress: techProfile.taxAddress,
        taxCity: techProfile.taxCity,
        taxState: techProfile.taxState,
        taxZip: techProfile.taxZip,
        w9ReceivedAt: techProfile.w9ReceivedAt,
        certificationDocs: techProfile.certificationDocs,
      });
    } catch (error) {
      console.error("Error getting contractor status:", error);
      res.status(500).json({ message: "Failed to get contractor status" });
    }
  });

  // ==========================================
  // IT Tech: Complaint / Report System
  // ==========================================
  const COMPLAINT_CATEGORIES = ["time_padding", "no_show", "poor_work", "unprofessional", "damage", "safety_violation", "misrepresentation", "other"];
  const AUTO_HOLD_THRESHOLD = 3;

  app.post("/api/it/tech/:techUserId/report", requireAuth, async (req, res) => {
    try {
      const reporterId = (req as any).session?.userId;
      const { techUserId } = req.params;
      const { ticketId, reason, category, description, evidence } = req.body;

      if (!reason || !category || !description || !ticketId) {
        return res.status(400).json({ message: "Reason, category, description, and ticketId are required" });
      }
      if (!COMPLAINT_CATEGORIES.includes(category)) {
        return res.status(400).json({ message: `Invalid category. Must be one of: ${COMPLAINT_CATEGORIES.join(", ")}` });
      }

      const [techProfile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, techUserId));
      if (!techProfile) return res.status(404).json({ message: "Tech not found" });

      if (reporterId === techUserId) {
        return res.status(400).json({ message: "You cannot report yourself" });
      }

      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, ticketId));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.createdBy !== reporterId) {
        return res.status(403).json({ message: "You can only report techs on your own tickets" });
      }
      if (ticket.assignedTo !== techUserId) {
        return res.status(400).json({ message: "This tech is not assigned to this ticket" });
      }

      const [complaint] = await db.insert(itTechComplaints).values({
        techUserId,
        techProfileId: techProfile.id,
        ticketId: ticketId || null,
        reportedBy: reporterId,
        reason,
        category,
        description,
        evidence: evidence || null,
        status: "pending",
      }).returning();

      const newComplaintCount = (techProfile.complaintCount || 0) + 1;
      const updateData: any = { complaintCount: newComplaintCount };

      if (newComplaintCount >= AUTO_HOLD_THRESHOLD && techProfile.accountStatus === "active") {
        updateData.accountStatus = "on_hold";
        updateData.suspendedAt = new Date();
        updateData.suspensionReason = `Auto-hold: ${newComplaintCount} complaints received (threshold: ${AUTO_HOLD_THRESHOLD})`;

        await db.insert(itTechEnforcementLog).values({
          techUserId,
          techProfileId: techProfile.id,
          action: "auto_hold",
          reason: `Auto-hold triggered: ${newComplaintCount} complaints reached threshold of ${AUTO_HOLD_THRESHOLD}`,
          previousStatus: techProfile.accountStatus || "active",
          newStatus: "on_hold",
          performedBy: "system" as any,
          complaintId: complaint.id,
        });
      }

      await db.update(itTechProfiles)
        .set(updateData)
        .where(eq(itTechProfiles.id, techProfile.id));

      res.json({ message: "Complaint submitted successfully", complaint });
    } catch (error) {
      console.error("Error reporting tech:", error);
      res.status(500).json({ message: "Failed to submit complaint" });
    }
  });

  app.get("/api/it/admin/complaints", requireAdmin, requirePermission("it_services"), async (_req, res) => {
    try {
      const allComplaints = await db.select().from(itTechComplaints).orderBy(desc(itTechComplaints.createdAt));

      const enriched = await Promise.all(allComplaints.map(async (c) => {
        const [reporter] = await db.select().from(users).where(eq(users.id, c.reportedBy));
        const [tech] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.id, c.techProfileId));
        let ticketTitle = null;
        if (c.ticketId) {
          const [t] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, c.ticketId));
          ticketTitle = t ? `${t.ticketNumber}: ${t.title}` : null;
        }
        return { ...c, reporterName: reporter?.username || "Unknown", techName: tech?.fullName || "Unknown", techAccountStatus: tech?.accountStatus || "unknown", ticketTitle };
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Error getting complaints:", error);
      res.status(500).json({ message: "Failed to get complaints" });
    }
  });

  app.post("/api/it/admin/complaints/:id/review", requireAdmin, requirePermission("it_services"), async (req, res) => {
    try {
      const adminId = (req as any).session?.userId;
      const { status, adminNotes, adminAction } = req.body;

      if (!status || !["verified", "dismissed", "investigating"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be verified, dismissed, or investigating" });
      }

      const [complaint] = await db.select().from(itTechComplaints).where(eq(itTechComplaints.id, req.params.id));
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      const [updated] = await db.update(itTechComplaints)
        .set({
          status,
          adminReviewedBy: adminId,
          adminNotes: adminNotes || null,
          adminAction: adminAction || null,
          reviewedAt: new Date(),
        })
        .where(eq(itTechComplaints.id, req.params.id))
        .returning();

      if (status === "verified") {
        const [techProfile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.id, complaint.techProfileId));
        if (techProfile) {
          await db.update(itTechProfiles)
            .set({ verifiedComplaintCount: (techProfile.verifiedComplaintCount || 0) + 1 })
            .where(eq(itTechProfiles.id, techProfile.id));
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Error reviewing complaint:", error);
      res.status(500).json({ message: "Failed to review complaint" });
    }
  });

  app.post("/api/it/admin/techs/:id/enforce", requireAdmin, async (req, res) => {
    try {
      const adminId = (req as any).session?.userId;
      const { action, reason, suspendDays, notes } = req.body;

      if (!action || !["warn", "suspend", "ban", "reinstate", "remove_hold"].includes(action)) {
        return res.status(400).json({ message: "Invalid action. Must be warn, suspend, ban, reinstate, or remove_hold" });
      }
      if (!reason) return res.status(400).json({ message: "Reason is required" });

      const [techProfile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.id, req.params.id));
      if (!techProfile) return res.status(404).json({ message: "Tech profile not found" });

      const previousStatus = techProfile.accountStatus || "active";
      let newStatus = previousStatus;
      const updateData: any = {};

      if (action === "warn") {
        newStatus = "warning";
        updateData.accountStatus = "warning";
      } else if (action === "suspend") {
        newStatus = "suspended";
        updateData.accountStatus = "suspended";
        updateData.suspendedAt = new Date();
        updateData.suspensionReason = reason;
        if (suspendDays) {
          const until = new Date();
          until.setDate(until.getDate() + parseInt(suspendDays));
          updateData.suspendedUntil = until;
        }
      } else if (action === "ban") {
        newStatus = "banned";
        updateData.accountStatus = "banned";
        updateData.bannedAt = new Date();
        updateData.banReason = reason;
        updateData.isActive = false;
      } else if (action === "reinstate" || action === "remove_hold") {
        newStatus = "active";
        updateData.accountStatus = "active";
        updateData.suspendedAt = null;
        updateData.suspendedUntil = null;
        updateData.suspensionReason = null;
      }

      await db.update(itTechProfiles)
        .set(updateData)
        .where(eq(itTechProfiles.id, techProfile.id));

      await db.insert(itTechEnforcementLog).values({
        techUserId: techProfile.userId,
        techProfileId: techProfile.id,
        action,
        reason,
        previousStatus,
        newStatus,
        performedBy: adminId,
        notes: notes || null,
      });

      const [updated] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.id, req.params.id));
      res.json({ message: `Tech ${action} action applied`, tech: updated });
    } catch (error) {
      console.error("Error enforcing tech:", error);
      res.status(500).json({ message: "Failed to enforce action" });
    }
  });

  app.get("/api/it/admin/techs/:id/enforcement-history", requireAdmin, async (req, res) => {
    try {
      const [techProfile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.id, req.params.id));
      if (!techProfile) return res.status(404).json({ message: "Tech not found" });

      const history = await db.select().from(itTechEnforcementLog)
        .where(eq(itTechEnforcementLog.techProfileId, req.params.id))
        .orderBy(desc(itTechEnforcementLog.createdAt));

      const complaints = await db.select().from(itTechComplaints)
        .where(eq(itTechComplaints.techProfileId, req.params.id))
        .orderBy(desc(itTechComplaints.createdAt));

      res.json({ techProfile, enforcementHistory: history, complaints });
    } catch (error) {
      console.error("Error getting enforcement history:", error);
      res.status(500).json({ message: "Failed to get enforcement history" });
    }
  });

  app.get("/api/it/tech/account-status", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [techProfile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      if (!techProfile) return res.status(404).json({ message: "Tech profile not found" });

      const complaints = await db.select().from(itTechComplaints)
        .where(eq(itTechComplaints.techUserId, userId))
        .orderBy(desc(itTechComplaints.createdAt));

      res.json({
        accountStatus: techProfile.accountStatus || "active",
        complaintCount: techProfile.complaintCount || 0,
        verifiedComplaintCount: techProfile.verifiedComplaintCount || 0,
        suspendedAt: techProfile.suspendedAt,
        suspendedUntil: techProfile.suspendedUntil,
        suspensionReason: techProfile.suspensionReason,
        bannedAt: techProfile.bannedAt,
        banReason: techProfile.banReason,
        complaints: complaints.map(c => ({
          id: c.id,
          category: c.category,
          reason: c.reason,
          status: c.status,
          createdAt: c.createdAt,
        })),
      });
    } catch (error) {
      console.error("Error getting account status:", error);
      res.status(500).json({ message: "Failed to get account status" });
    }
  });

  // ==========================================
  // IT: Delay Reporting & Compensation
  // ==========================================
  app.post("/api/it/tech/report-delay/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.assignedTo !== userId) return res.status(403).json({ message: "Not assigned to you" });

      const { reason, minutes } = req.body;
      if (!reason) return res.status(400).json({ message: "Delay reason is required" });
      if (!minutes || minutes < 1) return res.status(400).json({ message: "Delay minutes must be at least 1" });

      const payRate = ticket.payRate ? parseFloat(ticket.payRate) : 0;
      const delayHours = minutes / 60;
      const delayCompensation = Math.round(payRate * delayHours * 0.5 * 100) / 100;

      const [updated] = await db.update(itServiceTickets)
        .set({
          delayReason: reason,
          delayMinutes: minutes,
          delayCompensation: String(delayCompensation.toFixed(2)),
          updatedAt: new Date(),
        })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      notifyItCompanyOfTicketUpdate(
        ticket.createdBy, ticket.ticketNumber, ticket.title,
        `tech reported ${minutes}min delay: ${reason} (compensation: $${delayCompensation.toFixed(2)})`, ""
      ).catch(err => console.error("Failed to notify delay:", err));

      res.json(updated);
    } catch (error) {
      console.error("Report delay error:", error);
      res.status(500).json({ message: "Failed to report delay" });
    }
  });

  // ==========================================
  // IT: Mileage / Travel Distance
  // ==========================================
  app.post("/api/it/tech/mileage/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.assignedTo !== userId) return res.status(403).json({ message: "Not assigned to you" });

      const { miles, fromAddress } = req.body;
      if (!miles || miles < 0) return res.status(400).json({ message: "Miles must be a positive number" });

      const mileageRate = ticket.mileageRate ? parseFloat(ticket.mileageRate) : 0.67;
      const mileagePay = Math.round(miles * mileageRate * 100) / 100;

      const [updated] = await db.update(itServiceTickets)
        .set({
          travelDistance: String(miles),
          mileageRate: String(mileageRate),
          mileagePay: String(mileagePay.toFixed(2)),
          updatedAt: new Date(),
        })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      res.json({ ...updated, mileageBreakdown: { miles, rate: mileageRate, total: mileagePay } });
    } catch (error) {
      console.error("Set mileage error:", error);
      res.status(500).json({ message: "Failed to set mileage" });
    }
  });

  // ==========================================
  // IT: Ratings (Both Ways)
  // ==========================================
  app.post("/api/it/tickets/:id/rate", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.createdBy !== userId) return res.status(403).json({ message: "Not authorized" });
      if (!["resolved", "closed"].includes(ticket.status)) return res.status(400).json({ message: "Ticket must be resolved first" });

      const { rating, review } = req.body;
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be 1-5" });

      const [updated] = await db.update(itServiceTickets)
        .set({ customerRating: rating, customerReview: review || null, updatedAt: new Date() })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      if (ticket.assignedTo) {
        const techTickets = await db.select().from(itServiceTickets)
          .where(eq(itServiceTickets.assignedTo, ticket.assignedTo));
        const allRated = techTickets.filter(t => t.id !== ticket.id && t.customerRating != null);
        allRated.push({ ...updated } as any);
        const avg = allRated.reduce((sum, t) => sum + (t.customerRating || 0), 0) / allRated.length;
        await db.update(itTechProfiles)
          .set({ averageRating: String(avg.toFixed(2)) })
          .where(eq(itTechProfiles.userId, ticket.assignedTo));
      }

      res.json(updated);
    } catch (error) {
      console.error("Rate tech error:", error);
      res.status(500).json({ message: "Failed to rate" });
    }
  });

  app.post("/api/it/tech/rate-customer/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.assignedTo !== userId) return res.status(403).json({ message: "Not assigned to you" });

      const { rating, review } = req.body;
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be 1-5" });

      const [updated] = await db.update(itServiceTickets)
        .set({ techRating: rating, techReview: review || null, updatedAt: new Date() })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Rate customer error:", error);
      res.status(500).json({ message: "Failed to rate" });
    }
  });

  // ==========================================
  // IT TECH: Earnings Dashboard
  // ==========================================
  app.get("/api/it/tech/earnings", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [profile] = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, userId));
      if (!profile) return res.status(404).json({ message: "Tech profile not found" });

      const completedJobs = await db.select().from(itServiceTickets)
        .where(and(eq(itServiceTickets.assignedTo, userId), eq(itServiceTickets.paymentStatus, "pending")))
        .orderBy(desc(itServiceTickets.resolvedAt));

      const paidJobs = await db.select().from(itServiceTickets)
        .where(and(eq(itServiceTickets.assignedTo, userId), eq(itServiceTickets.paymentStatus, "paid")))
        .orderBy(desc(itServiceTickets.resolvedAt));

      res.json({
        totalEarnings: profile.totalEarnings || "0",
        pendingPayout: completedJobs.reduce((sum, t) => sum + parseFloat(t.techPayout || "0"), 0).toFixed(2),
        paidOut: paidJobs.reduce((sum, t) => sum + parseFloat(t.techPayout || "0"), 0).toFixed(2),
        totalJobs: profile.totalJobsCompleted || 0,
        averageRating: profile.averageRating || "0",
        timelinessScore: profile.timelinessScore || "100",
        pendingJobs: completedJobs,
        paidJobs: paidJobs.slice(0, 20),
      });
    } catch (error) {
      console.error("Get earnings error:", error);
      res.status(500).json({ message: "Failed to get earnings" });
    }
  });

  // ==========================================
  // IT: Talent Pools
  // ==========================================
  app.post("/api/it/talent-pools", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const parsed = insertItTalentPoolSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });

      const [pool] = await db.insert(itTalentPools).values({
        ...parsed.data,
        ownerId: userId,
      }).returning();
      res.status(201).json(pool);
    } catch (error) {
      console.error("Create talent pool error:", error);
      res.status(500).json({ message: "Failed to create talent pool" });
    }
  });

  app.get("/api/it/talent-pools", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const pools = await db.select().from(itTalentPools)
        .where(eq(itTalentPools.ownerId, userId))
        .orderBy(desc(itTalentPools.createdAt));

      const poolsWithMembers = await Promise.all(pools.map(async (pool) => {
        const members = await db.select().from(itTalentPoolMembers)
          .where(eq(itTalentPoolMembers.poolId, pool.id));
        return { ...pool, memberCount: members.length };
      }));

      res.json(poolsWithMembers);
    } catch (error) {
      console.error("Get talent pools error:", error);
      res.status(500).json({ message: "Failed to get talent pools" });
    }
  });

  app.post("/api/it/talent-pools/:id/members", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const { techUserId } = req.body;
      if (!techUserId) return res.status(400).json({ message: "Tech user ID is required" });

      const [pool] = await db.select().from(itTalentPools).where(eq(itTalentPools.id, req.params.id));
      if (!pool || pool.ownerId !== userId) return res.status(403).json({ message: "Not authorized" });

      const [member] = await db.insert(itTalentPoolMembers).values({
        poolId: pool.id,
        techUserId,
      }).returning();
      res.status(201).json(member);
    } catch (error) {
      console.error("Add pool member error:", error);
      res.status(500).json({ message: "Failed to add member" });
    }
  });

  app.delete("/api/it/talent-pools/:poolId/members/:memberId", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [pool] = await db.select().from(itTalentPools).where(eq(itTalentPools.id, req.params.poolId));
      if (!pool || pool.ownerId !== userId) return res.status(403).json({ message: "Not authorized" });

      await db.delete(itTalentPoolMembers).where(
        and(
          eq(itTalentPoolMembers.id, req.params.memberId),
          eq(itTalentPoolMembers.poolId, req.params.poolId)
        )
      );
      res.json({ message: "Member removed" });
    } catch (error) {
      console.error("Remove pool member error:", error);
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  // ==========================================
  // IT: Work Order Templates
  // ==========================================
  app.post("/api/it/templates", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const parsed = insertItWorkOrderTemplateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });

      const [template] = await db.insert(itWorkOrderTemplates).values({
        ...parsed.data,
        ownerId: userId,
      }).returning();
      res.status(201).json(template);
    } catch (error) {
      console.error("Create template error:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.get("/api/it/templates", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const templates = await db.select().from(itWorkOrderTemplates)
        .where(eq(itWorkOrderTemplates.ownerId, userId))
        .orderBy(desc(itWorkOrderTemplates.createdAt));
      res.json(templates);
    } catch (error) {
      console.error("Get templates error:", error);
      res.status(500).json({ message: "Failed to get templates" });
    }
  });

  app.delete("/api/it/templates/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [template] = await db.select().from(itWorkOrderTemplates).where(eq(itWorkOrderTemplates.id, req.params.id));
      if (!template || template.ownerId !== userId) return res.status(403).json({ message: "Not authorized" });
      await db.delete(itWorkOrderTemplates).where(eq(itWorkOrderTemplates.id, req.params.id));
      res.json({ message: "Template deleted" });
    } catch (error) {
      console.error("Delete template error:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // ============ COURIER FARE CALCULATION ============

  function calculateCourierFare(params: {
    distanceMiles: number;
    priority: string;
    temperatureControl: string;
    signatureRequired: boolean;
    chainOfCustody: boolean;
    photoProofRequired: boolean;
    weightLbs: number;
    scheduledTime?: Date | null;
  }) {
    const cfg = courierFareConfig;
    const p = params.priority as keyof typeof cfg.baseFare;
    const t = params.temperatureControl as keyof typeof cfg.temperatureSurcharge;

    const baseFare = cfg.baseFare[p] || cfg.baseFare.standard;
    const mileageFare = params.distanceMiles * (cfg.perMileRate[p] || cfg.perMileRate.standard);
    const tempSurcharge = cfg.temperatureSurcharge[t] || 0;

    let servicesFee = 0;
    if (params.signatureRequired) servicesFee += cfg.signatureFee;
    if (params.chainOfCustody) servicesFee += cfg.chainOfCustodyFee;
    if (params.photoProofRequired) servicesFee += cfg.photoProofFee;

    let wSurcharge = 0;
    if (params.weightLbs > 100) wSurcharge = cfg.weightSurcharge.over100;
    else if (params.weightLbs > 50) wSurcharge = cfg.weightSurcharge.under100;
    else if (params.weightLbs > 25) wSurcharge = cfg.weightSurcharge.under50;

    let peakSurcharge = 0;
    const checkTime = params.scheduledTime || new Date();
    const hour = checkTime.getHours();
    const isPeak = (hour >= cfg.peakHours.start && hour < cfg.peakHours.end) ||
                   (hour >= cfg.peakHours.afternoonStart && hour < cfg.peakHours.afternoonEnd);

    let subtotal = baseFare + mileageFare + tempSurcharge + servicesFee + wSurcharge;
    if (isPeak) {
      peakSurcharge = subtotal * (cfg.peakHourMultiplier - 1);
      subtotal *= cfg.peakHourMultiplier;
    }

    let longDistSurcharge = 0;
    if (params.distanceMiles > cfg.longDistanceMiles) {
      longDistSurcharge = cfg.longDistanceSurcharge;
      subtotal += longDistSurcharge;
    }

    const total = Math.max(subtotal, cfg.minimumFare);
    const platformFee = total * cfg.platformFeePercent;
    const driverEarnings = total - platformFee;
    const estimatedMinutes = Math.ceil(params.distanceMiles * 2.5) + 10;

    return {
      baseFare: baseFare.toFixed(2),
      mileageFare: mileageFare.toFixed(2),
      prioritySurcharge: (baseFare - cfg.baseFare.standard).toFixed(2),
      temperatureSurcharge: tempSurcharge.toFixed(2),
      servicesFee: servicesFee.toFixed(2),
      weightSurcharge: wSurcharge.toFixed(2),
      peakSurcharge: peakSurcharge.toFixed(2),
      longDistanceSurcharge: longDistSurcharge.toFixed(2),
      estimatedFare: total.toFixed(2),
      platformFee: platformFee.toFixed(2),
      driverEarnings: driverEarnings.toFixed(2),
      estimatedDurationMinutes: estimatedMinutes,
      isPeakHour: isPeak,
    };
  }

  async function logCustodyEvent(params: {
    deliveryId: number;
    eventType: string;
    performedBy?: string;
    performedByName?: string;
    performedByRole?: string;
    lat?: string;
    lng?: string;
    locationAddress?: string;
    temperatureReading?: string;
    notes?: string;
    photoUrl?: string;
    signatureUrl?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const eventTimestamp = new Date().toISOString();
    const payload = JSON.stringify({
      deliveryId: params.deliveryId,
      eventType: params.eventType,
      performedBy: params.performedBy,
      performedByName: params.performedByName,
      performedByRole: params.performedByRole,
      timestamp: eventTimestamp,
      lat: params.lat || null,
      lng: params.lng || null,
      locationAddress: params.locationAddress || null,
      temperatureReading: params.temperatureReading || null,
      notes: params.notes || null,
      photoUrl: params.photoUrl || null,
      signatureUrl: params.signatureUrl || null,
    });
    const immutableHash = crypto.createHash("sha256").update(payload).digest("hex");

    await db.insert(courierChainOfCustodyLog).values({
      deliveryId: params.deliveryId,
      eventType: params.eventType,
      performedBy: params.performedBy || null,
      performedByName: params.performedByName || null,
      performedByRole: params.performedByRole || null,
      lat: params.lat || null,
      lng: params.lng || null,
      locationAddress: params.locationAddress || null,
      temperatureReading: params.temperatureReading || null,
      notes: params.notes || null,
      photoUrl: params.photoUrl || null,
      signatureUrl: params.signatureUrl || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      immutableHash,
    });

    return immutableHash;
  }

  // ============ MEDICAL COURIER DELIVERY SYSTEM ============

  app.post("/api/courier/companies", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const parsed = insertCourierCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }

      const existing = await db.select().from(courierCompanies).where(eq(courierCompanies.ownerId, userId));
      if (existing.length > 0) {
        return res.status(409).json({ message: "You already have a courier company registered" });
      }

      const [company] = await db.insert(courierCompanies).values({
        ...parsed.data,
        ownerId: userId,
      }).returning();

      await db.update(users).set({ role: "courier_company" }).where(eq(users.id, userId));

      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating courier company:", error);
      res.status(500).json({ message: "Failed to create courier company" });
    }
  });

  app.get("/api/courier/companies/mine", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [company] = await db.select().from(courierCompanies).where(eq(courierCompanies.ownerId, userId));
      if (!company) return res.status(404).json({ message: "No courier company found for your account" });
      res.json(company);
    } catch (error) {
      console.error("Error getting courier company:", error);
      res.status(500).json({ message: "Failed to get courier company" });
    }
  });

  app.patch("/api/courier/companies/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [company] = await db.select().from(courierCompanies).where(eq(courierCompanies.id, req.params.id));
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (company.ownerId !== userId) return res.status(403).json({ message: "Unauthorized" });

      const { companyName, contactEmail, contactPhone, address, city, state, zipCode, companyType, businessLicenseNumber, deaNumber, hipaaCompliant } = req.body;
      const [updated] = await db.update(courierCompanies)
        .set({ companyName, contactEmail, contactPhone, address, city, state, zipCode, companyType, businessLicenseNumber, deaNumber, hipaaCompliant })
        .where(eq(courierCompanies.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating courier company:", error);
      res.status(500).json({ message: "Failed to update courier company" });
    }
  });

  const fareEstimateSchema = z.object({
    distanceMiles: z.coerce.number().min(0).max(500).default(5),
    priority: z.enum(["standard", "urgent", "stat"]).default("standard"),
    temperatureControl: z.enum(["ambient", "cold_chain", "frozen", "controlled_room"]).default("ambient"),
    signatureRequired: z.boolean().default(true),
    chainOfCustody: z.boolean().default(false),
    photoProofRequired: z.boolean().default(false),
    weightLbs: z.coerce.number().min(0).max(2000).default(0),
    scheduledPickupTime: z.string().nullable().optional(),
  });

  app.post("/api/courier/fare-estimate", requireAuth, async (req, res) => {
    try {
      const parsed = fareEstimateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid fare estimate parameters", errors: parsed.error.errors });
      }
      const d = parsed.data;
      const estimate = calculateCourierFare({
        distanceMiles: d.distanceMiles,
        priority: d.priority,
        temperatureControl: d.temperatureControl,
        signatureRequired: d.signatureRequired,
        chainOfCustody: d.chainOfCustody,
        photoProofRequired: d.photoProofRequired,
        weightLbs: d.weightLbs,
        scheduledTime: d.scheduledPickupTime ? new Date(d.scheduledPickupTime) : null,
      });
      res.json({ ...estimate, fareConfig: courierFareConfig });
    } catch (error) {
      console.error("Error estimating fare:", error);
      res.status(500).json({ message: "Failed to estimate fare" });
    }
  });

  app.post("/api/courier/deliveries", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [company] = await db.select().from(courierCompanies).where(eq(courierCompanies.ownerId, userId));
      if (!company) return res.status(403).json({ message: "You must register a courier company first" });

      const parsed = insertCourierDeliverySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid delivery data", errors: parsed.error.errors });
      }

      const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

      const dist = Math.max(0, Number(parsed.data.distanceMiles) || 5);
      const wt = Math.max(0, Number(parsed.data.weightLbs) || 0);

      const fareCalc = calculateCourierFare({
        distanceMiles: isFinite(dist) ? dist : 5,
        priority: parsed.data.priority || "standard",
        temperatureControl: parsed.data.temperatureControl || "ambient",
        signatureRequired: parsed.data.signatureRequired ?? true,
        chainOfCustody: parsed.data.chainOfCustody ?? false,
        photoProofRequired: parsed.data.photoProofRequired ?? false,
        weightLbs: isFinite(wt) ? wt : 0,
        scheduledTime: parsed.data.scheduledPickupTime ? new Date(parsed.data.scheduledPickupTime) : null,
      });

      const [delivery] = await db.insert(courierDeliveries).values({
        ...parsed.data,
        companyId: company.id,
        status: "requested",
        verificationCode,
        estimatedFare: fareCalc.estimatedFare,
        baseFare: fareCalc.baseFare,
        mileageFare: fareCalc.mileageFare,
        prioritySurcharge: fareCalc.prioritySurcharge,
        temperatureSurcharge: fareCalc.temperatureSurcharge,
        servicesFee: fareCalc.servicesFee,
        weightSurcharge: fareCalc.weightSurcharge,
        peakSurcharge: fareCalc.peakSurcharge,
        longDistanceSurcharge: fareCalc.longDistanceSurcharge,
        platformFee: fareCalc.platformFee,
        driverEarnings: fareCalc.driverEarnings,
        estimatedDurationMinutes: fareCalc.estimatedDurationMinutes,
        scheduledPickupTime: parsed.data.scheduledPickupTime ? new Date(parsed.data.scheduledPickupTime) : null,
      }).returning();

      await logCustodyEvent({
        deliveryId: delivery.id,
        eventType: "dispatch_created",
        performedBy: userId,
        performedByName: company.companyName,
        performedByRole: "dispatcher",
        notes: `Delivery #${delivery.id} created by ${company.companyName}. Priority: ${delivery.priority}. Package: ${delivery.packageType}.`,
        ipAddress: req.ip || undefined,
        userAgent: req.headers["user-agent"] || undefined,
      });

      try {
        await notifyDriversOfNewRide(
          delivery.pickupAddress || "Pickup location",
          delivery.scheduledPickupTime || new Date(),
          {
            rideId: delivery.id,
            dropoffAddress: delivery.dropoffAddress || undefined,
            distanceMiles: parseFloat(delivery.distanceMiles || "0"),
            estimatedFare: parseFloat(delivery.estimatedFare || "0"),
          }
        );
      } catch (pushErr) {
        console.log("Push notification for courier delivery failed (non-critical):", pushErr);
      }

      res.status(201).json({ ...delivery, fareBreakdown: fareCalc });
    } catch (error) {
      console.error("Error creating courier delivery:", error);
      res.status(500).json({ message: "Failed to create delivery" });
    }
  });

  app.get("/api/courier/deliveries", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [company] = await db.select().from(courierCompanies).where(eq(courierCompanies.ownerId, userId));
      if (!company) return res.status(403).json({ message: "Courier company not found" });

      const deliveries = await db.select().from(courierDeliveries)
        .where(eq(courierDeliveries.companyId, company.id))
        .orderBy(desc(courierDeliveries.createdAt));

      res.json(deliveries);
    } catch (error) {
      console.error("Error getting deliveries:", error);
      res.status(500).json({ message: "Failed to get deliveries" });
    }
  });

  app.get("/api/courier/deliveries/pool", requireDriver, async (_req, res) => {
    try {
      const available = await db.select({
        delivery: courierDeliveries,
        companyName: courierCompanies.companyName,
        companyType: courierCompanies.companyType,
      })
        .from(courierDeliveries)
        .leftJoin(courierCompanies, eq(courierDeliveries.companyId, courierCompanies.id))
        .where(and(
          eq(courierDeliveries.status, "requested"),
          isNull(courierDeliveries.driverId)
        ))
        .orderBy(desc(courierDeliveries.createdAt));

      res.json(available.map(a => ({ ...a.delivery, companyName: a.companyName, companyType: a.companyType })));
    } catch (error) {
      console.error("Error getting delivery pool:", error);
      res.status(500).json({ message: "Failed to get available deliveries" });
    }
  });

  app.get("/api/courier/deliveries/active", requireDriver, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [driverProfile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, userId));
      if (!driverProfile) return res.status(404).json({ message: "Driver profile not found" });

      const activeDeliveries = await db.select({
        delivery: courierDeliveries,
        companyName: courierCompanies.companyName,
      })
        .from(courierDeliveries)
        .leftJoin(courierCompanies, eq(courierDeliveries.companyId, courierCompanies.id))
        .where(eq(courierDeliveries.driverId, driverProfile.id));

      const active = activeDeliveries
        .filter(a => ACTIVE_DELIVERY_STATUSES.includes(a.delivery.status))
        .map(a => ({ ...a.delivery, companyName: a.companyName }));

      res.json(active);
    } catch (error) {
      console.error("Error getting active deliveries:", error);
      res.status(500).json({ message: "Failed to get active deliveries" });
    }
  });

  app.post("/api/courier/deliveries/:id/accept", requireDriver, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      const userId = (req as any).session?.userId;
      const [driverProfile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, userId));
      if (!driverProfile) return res.status(404).json({ message: "Driver profile not found" });

      if (driverProfile.medicalCourierEnabled === false) {
        return res.status(403).json({ message: "Medical courier service is not enabled on your profile. Enable it in your dashboard settings." });
      }

      const compliance = await checkDriverCompliance(driverProfile.id);
      if (!compliance.compliant) {
        return res.status(403).json({ message: "Cannot accept deliveries due to compliance issues", issues: compliance.issues });
      }

      const activeTask = await checkDriverHasActiveTask(driverProfile.id);
      if (activeTask.hasActiveRide) {
        return res.status(409).json({ message: "You have an active patient ride. Complete it before accepting a delivery." });
      }
      if (activeTask.hasActiveDelivery) {
        return res.status(409).json({ message: "You already have an active delivery. Complete it before accepting another." });
      }

      const [delivery] = await db.select().from(courierDeliveries).where(eq(courierDeliveries.id, deliveryId));
      if (!delivery) return res.status(404).json({ message: "Delivery not found" });
      if (delivery.status !== "requested") return res.status(409).json({ message: "Delivery is no longer available" });
      if (delivery.driverId) return res.status(409).json({ message: "Delivery already assigned to another driver" });

      const [updated] = await db.update(courierDeliveries)
        .set({ driverId: driverProfile.id, status: "accepted", updatedAt: new Date() })
        .where(and(
          eq(courierDeliveries.id, deliveryId),
          eq(courierDeliveries.status, "requested"),
          isNull(courierDeliveries.driverId)
        ))
        .returning();

      if (!updated) return res.status(409).json({ message: "Delivery was claimed by another driver" });

      const [callerUser] = await db.select().from(users).where(eq(users.id, userId));
      await logCustodyEvent({
        deliveryId,
        eventType: "driver_assigned",
        performedBy: userId,
        performedByName: callerUser?.firstName ? `${callerUser.firstName} ${callerUser.lastName || ""}`.trim() : callerUser?.username || "Driver",
        performedByRole: "driver",
        notes: `Driver accepted delivery #${deliveryId}`,
        ipAddress: req.ip || undefined,
        userAgent: req.headers["user-agent"] || undefined,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error accepting delivery:", error);
      res.status(500).json({ message: "Failed to accept delivery" });
    }
  });

  app.patch("/api/courier/deliveries/:id/status", requireAuth, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      const userId = (req as any).session?.userId;
      const { status, proofOfDeliveryUrl, signatureUrl, pickupSignatureUrl, cancelledBy, cancellationReason, lat, lng, locationAddress, temperatureReading, notes } = req.body;

      if (!courierDeliveryStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${courierDeliveryStatuses.join(", ")}` });
      }

      const [delivery] = await db.select().from(courierDeliveries).where(eq(courierDeliveries.id, deliveryId));
      if (!delivery) return res.status(404).json({ message: "Delivery not found" });

      const validTransitions: Record<string, string[]> = {
        requested: ["accepted", "cancelled"],
        accepted: ["en_route_pickup", "cancelled"],
        en_route_pickup: ["picked_up", "cancelled"],
        picked_up: ["in_transit", "cancelled"],
        in_transit: ["arrived", "cancelled"],
        arrived: ["delivered", "cancelled"],
        delivered: ["confirmed"],
        confirmed: [],
        cancelled: [],
      };

      const allowed = validTransitions[delivery.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({ message: `Cannot transition from "${delivery.status}" to "${status}"` });
      }

      const [callerUser] = await db.select().from(users).where(eq(users.id, userId));
      const [driverProfileRow] = delivery.driverId
        ? await db.select().from(driverProfiles).where(eq(driverProfiles.id, delivery.driverId))
        : [null];
      const [company] = await db.select().from(courierCompanies).where(eq(courierCompanies.id, delivery.companyId));

      const isDriver = driverProfileRow?.userId === userId;
      const isCompany = company?.ownerId === userId;
      const isAdmin = callerUser?.role === "admin";

      if (!isDriver && !isCompany && !isAdmin) {
        return res.status(403).json({ message: "Unauthorized to update this delivery" });
      }

      const updateData: any = { status, updatedAt: new Date() };

      if (status === "picked_up") updateData.actualPickupTime = new Date();
      if (status === "delivered") updateData.actualDeliveryTime = new Date();
      if (status === "cancelled") {
        updateData.cancelledAt = new Date();
        updateData.cancelledBy = cancelledBy || (isDriver ? "driver" : "company");
        updateData.cancellationReason = cancellationReason;
      }
      if (proofOfDeliveryUrl) updateData.proofOfDeliveryUrl = proofOfDeliveryUrl;
      if (signatureUrl) updateData.signatureUrl = signatureUrl;
      if (pickupSignatureUrl) updateData.pickupSignatureUrl = pickupSignatureUrl;

      if (status === "delivered" || status === "confirmed") {
        const fare = parseFloat(delivery.estimatedFare || "0");
        const feeRate = courierFareConfig.platformFeePercent;
        updateData.finalFare = fare.toFixed(2);
        updateData.platformFee = (fare * feeRate).toFixed(2);
        updateData.driverEarnings = (fare * (1 - feeRate)).toFixed(2);
      }

      const [updated] = await db.update(courierDeliveries)
        .set(updateData)
        .where(eq(courierDeliveries.id, deliveryId))
        .returning();

      const statusEventMap: Record<string, string> = {
        en_route_pickup: "en_route_to_pickup",
        picked_up: "package_picked_up",
        in_transit: "in_transit",
        arrived: "arrived_at_destination",
        delivered: "package_delivered",
        confirmed: "delivery_confirmed",
        cancelled: "delivery_cancelled",
      };
      const custodyEventType = statusEventMap[status] || `status_${status}`;
      const performerName = callerUser?.firstName ? `${callerUser.firstName} ${callerUser.lastName || ""}`.trim() : callerUser?.username || "Unknown";
      const performerRole = isDriver ? "driver" : isCompany ? "dispatcher" : "admin";

      await logCustodyEvent({
        deliveryId,
        eventType: custodyEventType,
        performedBy: userId,
        performedByName: performerName,
        performedByRole: performerRole,
        lat: lat || undefined,
        lng: lng || undefined,
        locationAddress: locationAddress || undefined,
        temperatureReading: temperatureReading || undefined,
        notes: notes || `Status changed to "${status}" by ${performerRole}`,
        photoUrl: proofOfDeliveryUrl || undefined,
        signatureUrl: signatureUrl || pickupSignatureUrl || undefined,
        ipAddress: req.ip || undefined,
        userAgent: req.headers["user-agent"] || undefined,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating delivery status:", error);
      res.status(500).json({ message: "Failed to update delivery status" });
    }
  });

  app.post("/api/courier/deliveries/:id/custody-log", requireAuth, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      const userId = (req as any).session?.userId;

      const [delivery] = await db.select().from(courierDeliveries).where(eq(courierDeliveries.id, deliveryId));
      if (!delivery) return res.status(404).json({ message: "Delivery not found" });

      const [callerUser] = await db.select().from(users).where(eq(users.id, userId));
      const [driverProfileRow] = delivery.driverId
        ? await db.select().from(driverProfiles).where(eq(driverProfiles.id, delivery.driverId))
        : [null];
      const [company] = await db.select().from(courierCompanies).where(eq(courierCompanies.id, delivery.companyId));

      const isDriver = driverProfileRow?.userId === userId;
      const isCompany = company?.ownerId === userId;
      const isAdmin = callerUser?.role === "admin";
      if (!isDriver && !isCompany && !isAdmin) {
        return res.status(403).json({ message: "Unauthorized to log custody events for this delivery" });
      }

      const { eventType, lat, lng, locationAddress, temperatureReading, notes, photoUrl, signatureUrl: sigUrl } = req.body;
      if (!eventType || !courierCustodyEventTypes.includes(eventType)) {
        return res.status(400).json({ message: `Invalid event type. Must be one of: ${courierCustodyEventTypes.join(", ")}` });
      }

      const performerName = callerUser?.firstName ? `${callerUser.firstName} ${callerUser.lastName || ""}`.trim() : callerUser?.username || "Unknown";
      const performerRole = isDriver ? "driver" : isCompany ? "dispatcher" : "admin";

      const hash = await logCustodyEvent({
        deliveryId,
        eventType,
        performedBy: userId,
        performedByName: performerName,
        performedByRole: performerRole,
        lat, lng, locationAddress, temperatureReading, notes, photoUrl, signatureUrl: sigUrl,
        ipAddress: req.ip || undefined,
        userAgent: req.headers["user-agent"] || undefined,
      });

      res.status(201).json({ message: "Custody event logged", hash });
    } catch (error) {
      console.error("Error logging custody event:", error);
      res.status(500).json({ message: "Failed to log custody event" });
    }
  });

  app.get("/api/courier/deliveries/:id/custody-log", requireAuth, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      const userId = (req as any).session?.userId;

      const [delivery] = await db.select().from(courierDeliveries).where(eq(courierDeliveries.id, deliveryId));
      if (!delivery) return res.status(404).json({ message: "Delivery not found" });

      const [callerUser] = await db.select().from(users).where(eq(users.id, userId));
      const [driverProfileRow] = delivery.driverId
        ? await db.select().from(driverProfiles).where(eq(driverProfiles.id, delivery.driverId))
        : [null];
      const [company] = await db.select().from(courierCompanies).where(eq(courierCompanies.id, delivery.companyId));

      const isDriver = driverProfileRow?.userId === userId;
      const isCompany = company?.ownerId === userId;
      const isAdmin = callerUser?.role === "admin";
      if (!isDriver && !isCompany && !isAdmin) {
        return res.status(403).json({ message: "Unauthorized to view custody log for this delivery" });
      }

      const log = await db.select().from(courierChainOfCustodyLog)
        .where(eq(courierChainOfCustodyLog.deliveryId, deliveryId))
        .orderBy(courierChainOfCustodyLog.createdAt);

      res.json(log);
    } catch (error) {
      console.error("Error fetching custody log:", error);
      res.status(500).json({ message: "Failed to fetch custody log" });
    }
  });

  app.get("/api/courier/deliveries/:id", requireAuth, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      const userId = (req as any).session?.userId;
      const [delivery] = await db.select().from(courierDeliveries).where(eq(courierDeliveries.id, deliveryId));
      if (!delivery) return res.status(404).json({ message: "Delivery not found" });

      const [company] = await db.select().from(courierCompanies).where(eq(courierCompanies.id, delivery.companyId));
      const [callerUser] = await db.select().from(users).where(eq(users.id, userId));
      const isAdmin = callerUser?.role === "admin";
      const isCompanyOwner = company?.ownerId === userId;
      let isAssignedDriver = false;
      if (delivery.driverId) {
        const [dp] = await db.select().from(driverProfiles).where(eq(driverProfiles.id, delivery.driverId));
        if (dp?.userId === userId) isAssignedDriver = true;
      }

      if (!isAdmin && !isCompanyOwner && !isAssignedDriver) {
        return res.status(403).json({ message: "Unauthorized to view this delivery" });
      }

      let driverInfo = null;
      if (delivery.driverId) {
        const driver = await storage.getDriver(delivery.driverId);
        if (driver) driverInfo = { name: driver.fullName, phone: driver.phone, vehicleType: driver.vehicleType, vehiclePlate: driver.vehiclePlate };
      }

      res.json({ ...delivery, companyName: company?.companyName, driver: driverInfo });
    } catch (error) {
      console.error("Error getting delivery:", error);
      res.status(500).json({ message: "Failed to get delivery" });
    }
  });

  app.get("/api/admin/courier/deliveries", requireAdmin, async (_req, res) => {
    try {
      const allDeliveries = await db.select({
        delivery: courierDeliveries,
        companyName: courierCompanies.companyName,
      })
        .from(courierDeliveries)
        .leftJoin(courierCompanies, eq(courierDeliveries.companyId, courierCompanies.id))
        .orderBy(desc(courierDeliveries.createdAt));

      res.json(allDeliveries.map(d => ({ ...d.delivery, companyName: d.companyName })));
    } catch (error) {
      console.error("Error getting all deliveries:", error);
      res.status(500).json({ message: "Failed to get deliveries" });
    }
  });

  app.get("/api/admin/courier/companies", requireAdmin, async (_req, res) => {
    try {
      const companies = await db.select().from(courierCompanies).orderBy(desc(courierCompanies.createdAt));
      res.json(companies);
    } catch (error) {
      console.error("Error getting courier companies:", error);
      res.status(500).json({ message: "Failed to get courier companies" });
    }
  });

  app.get("/api/courier/deliveries/driver/history", requireDriver, async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const [driverProfile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, userId));
      if (!driverProfile) return res.status(404).json({ message: "Driver profile not found" });

      const history = await db.select({
        delivery: courierDeliveries,
        companyName: courierCompanies.companyName,
      })
        .from(courierDeliveries)
        .leftJoin(courierCompanies, eq(courierDeliveries.companyId, courierCompanies.id))
        .where(eq(courierDeliveries.driverId, driverProfile.id))
        .orderBy(desc(courierDeliveries.createdAt));

      res.json(history.map(h => ({ ...h.delivery, companyName: h.companyName })));
    } catch (error) {
      console.error("Error getting delivery history:", error);
      res.status(500).json({ message: "Failed to get delivery history" });
    }
  });

  const docUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = "uploads/documents";
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'));
      }
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg",
        "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error("Only PDF, PNG, JPG, DOC, DOCX files are allowed"));
    }
  });

  app.use("/uploads/documents", express.static("uploads/documents"));
  app.use("/uploads/signatures", express.static("uploads/signatures"));

  app.post("/api/documents/upload", requireAuth, docUpload.single("file"), async (req: any, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file provided" });
      const { documentType, documentName, description, relatedEntityType, relatedEntityId } = req.body;
      if (!documentType || !documentName) {
        return res.status(400).json({ message: "Document type and name are required" });
      }
      const fileUrl = `/uploads/documents/${file.filename}`;
      const [doc] = await db.insert(userDocuments).values({
        userId: req.session.userId,
        documentType,
        documentName,
        fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        description: description || null,
        relatedEntityType: relatedEntityType || "general",
        relatedEntityId: relatedEntityId || null,
      }).returning();
      res.json(doc);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/documents", requireAuth, async (req: any, res) => {
    try {
      const { entityType, entityId } = req.query;
      let conditions = [eq(userDocuments.userId, req.session.userId)];
      if (entityType) conditions.push(eq(userDocuments.relatedEntityType, entityType as string));
      if (entityId) conditions.push(eq(userDocuments.relatedEntityId, entityId as string));
      const docs = await db.select().from(userDocuments)
        .where(and(...conditions))
        .orderBy(desc(userDocuments.uploadedAt));
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/documents/admin", requireAuth, async (req: any, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.session.userId)).then(r => r[0]);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin access required" });
      const { userId, entityType, status } = req.query;
      let conditions: any[] = [];
      if (userId) conditions.push(eq(userDocuments.userId, userId as string));
      if (entityType) conditions.push(eq(userDocuments.relatedEntityType, entityType as string));
      if (status) conditions.push(eq(userDocuments.status, status as string));
      const docs = await db.select().from(userDocuments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(userDocuments.uploadedAt))
        .limit(100);
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/documents/:id/review", requireAuth, async (req: any, res) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, req.session.userId)).then(r => r[0]);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin access required" });
      const { status, reviewNotes } = req.body;
      if (!status || !["approved", "rejected", "under_review"].includes(status)) {
        return res.status(400).json({ message: "Valid status required: approved, rejected, under_review" });
      }
      const [updated] = await db.update(userDocuments)
        .set({ status, reviewedBy: req.session.userId, reviewedAt: new Date(), reviewNotes: reviewNotes || null })
        .where(eq(userDocuments.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Document not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/documents/:id", requireAuth, async (req: any, res) => {
    try {
      const [doc] = await db.select().from(userDocuments)
        .where(and(eq(userDocuments.id, req.params.id), eq(userDocuments.userId, req.session.userId)));
      if (!doc) return res.status(404).json({ message: "Document not found" });
      try { fs.unlinkSync(doc.fileUrl.replace(/^\//, "")); } catch {}
      await db.delete(userDocuments).where(eq(userDocuments.id, req.params.id));
      res.json({ message: "Document deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/it/tech/location-ping/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.assignedTo !== userId) return res.status(403).json({ message: "Not assigned to you" });
      if (!ticket.checkInTime || ticket.checkOutTime) {
        return res.status(400).json({ message: "Must be checked in and not checked out" });
      }

      const rawLat = Number(req.body?.lat);
      const rawLng = Number(req.body?.lng);
      if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng) || rawLat < -90 || rawLat > 90 || rawLng < -180 || rawLng > 180) {
        return res.status(400).json({ message: "Valid GPS coordinates required (lat: -90 to 90, lng: -180 to 180)" });
      }
      const lat = rawLat;
      const lng = rawLng;

      const now = new Date();
      let distanceMeters: number | null = null;
      let onSite = false;
      const ON_SITE_RADIUS = 500;
      const LEFT_SITE_RADIUS = 800;

      if (ticket.siteLat && ticket.siteLng) {
        const siteLat = parseFloat(ticket.siteLat);
        const siteLng = parseFloat(ticket.siteLng);
        if (Number.isFinite(siteLat) && Number.isFinite(siteLng)) {
          const toRad = (d: number) => d * Math.PI / 180;
          const R = 6371000;
          const dLat = toRad(siteLat - lat);
          const dLng = toRad(siteLng - lng);
          const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat)) * Math.cos(toRad(siteLat)) * Math.sin(dLng/2)**2;
          distanceMeters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          onSite = distanceMeters <= ON_SITE_RADIUS;
        }
      }

      let locationStatus = ticket.locationStatus || "unknown";
      let leftSiteAt = ticket.leftSiteAt;
      let checkoutReminderSent = ticket.checkoutReminderSent || false;

      if (distanceMeters !== null) {
        if (onSite) {
          locationStatus = "on_site";
          leftSiteAt = null;
          checkoutReminderSent = false;
        } else if (distanceMeters > LEFT_SITE_RADIUS) {
          if (locationStatus !== "left_site") {
            locationStatus = "left_site";
            leftSiteAt = now;
          }
        } else {
          locationStatus = "near_site";
        }
      }

      let shouldRemind = false;
      const hoursCheckedIn = (now.getTime() - new Date(ticket.checkInTime).getTime()) / 3600000;

      if (locationStatus === "left_site" && !checkoutReminderSent) {
        const minutesAway = leftSiteAt ? (now.getTime() - new Date(leftSiteAt).getTime()) / 60000 : 0;
        if (minutesAway >= 5) {
          shouldRemind = true;
          checkoutReminderSent = true;
        }
      }

      if (hoursCheckedIn > 8 && !checkoutReminderSent) {
        shouldRemind = true;
        checkoutReminderSent = true;
      }

      const [updated] = await db.update(itServiceTickets)
        .set({
          lastKnownLat: String(lat),
          lastKnownLng: String(lng),
          lastLocationUpdate: now,
          lastLocationDistance: distanceMeters !== null ? String(Math.round(distanceMeters)) : null,
          locationStatus,
          leftSiteAt,
          checkoutReminderSent,
          updatedAt: now,
        })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();

      if (shouldRemind && locationStatus === "left_site") {
        const distanceStr = distanceMeters ? `${Math.round(distanceMeters)}m` : "unknown distance";
        notifyItCompanyOfTicketUpdate(
          ticket.createdBy, ticket.ticketNumber, ticket.title,
          `Tech appears to have left the site (${distanceStr} away). Still checked in.`, ""
        ).catch(err => console.error("Failed to send location alert:", err));
      }

      res.json({
        locationStatus,
        distanceMeters: distanceMeters !== null ? Math.round(distanceMeters) : null,
        onSite,
        shouldRemind,
        hoursCheckedIn: Number(hoursCheckedIn.toFixed(2)),
        reminderReason: shouldRemind
          ? (locationStatus === "left_site" ? "left_site" : "long_shift")
          : null,
      });
    } catch (error) {
      console.error("Location ping error:", error);
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  app.get("/api/it/tech/location-status/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      const [ticket] = await db.select().from(itServiceTickets).where(eq(itServiceTickets.id, req.params.id));
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.assignedTo !== userId) return res.status(403).json({ message: "Not assigned to you" });

      const hoursCheckedIn = ticket.checkInTime
        ? (new Date().getTime() - new Date(ticket.checkInTime).getTime()) / 3600000
        : 0;

      res.json({
        locationStatus: ticket.locationStatus || "unknown",
        lastLocationDistance: ticket.lastLocationDistance ? Number(ticket.lastLocationDistance) : null,
        lastLocationUpdate: ticket.lastLocationUpdate,
        leftSiteAt: ticket.leftSiteAt,
        checkoutReminderSent: ticket.checkoutReminderSent,
        hoursCheckedIn: Number(hoursCheckedIn.toFixed(2)),
        locationVerified: ticket.locationVerified,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get location status" });
    }
  });

  app.post("/api/it/tickets/:id/signature", requireAuth, async (req: any, res) => {
    try {
      const ticket = await db.select().from(itServiceTickets)
        .where(eq(itServiceTickets.id, req.params.id)).then(r => r[0]);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.assignedTo !== req.session.userId) {
        return res.status(403).json({ message: "Only the assigned tech can capture signatures" });
      }
      if (!["assigned", "in_progress", "resolved"].includes(ticket.status)) {
        return res.status(400).json({ message: "Ticket must be in progress or resolved to capture signature" });
      }
      const { signatureDataUrl, signedName } = req.body;
      if (!signatureDataUrl || !signedName) {
        return res.status(400).json({ message: "Signature data and signed name are required" });
      }
      const base64Data = signatureDataUrl.replace(/^data:image\/png;base64,/, "");
      const dir = "uploads/signatures";
      fs.mkdirSync(dir, { recursive: true });
      const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}-signature.png`;
      fs.writeFileSync(`${dir}/${filename}`, base64Data, "base64");
      const signatureUrl = `/uploads/signatures/${filename}`;
      const [updated] = await db.update(itServiceTickets)
        .set({
          customerSignatureUrl: signatureUrl,
          customerSignedAt: new Date(),
          customerSignedName: signedName,
          updatedAt: new Date(),
        })
        .where(eq(itServiceTickets.id, req.params.id))
        .returning();
      res.json({ message: "Signature captured", ticket: updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/contact", async (req, res) => {
    try {
      const contactSchema = z.object({
        fullName: z.string().min(2, "Full name is required"),
        email: z.string().email("Valid email is required"),
        phone: z.string().min(7, "Phone number is required"),
        company: z.string().optional(),
        subject: z.string().min(3, "Subject is required"),
        inquiryType: z.string().min(1, "Please select an inquiry type"),
        message: z.string().min(10, "Message must be at least 10 characters"),
      });

      const data = contactSchema.parse(req.body);
      const sent = await sendContactFormEmail(data);

      if (sent) {
        res.json({ message: "Your message has been sent successfully. We'll get back to you shortly." });
      } else {
        res.status(500).json({ message: "Failed to send your message. Please try calling us at 774-581-9700." });
      }
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid form data" });
      }
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  return httpServer;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isPointNearSegment(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  pLat: number, pLng: number,
  radiusMiles: number
): boolean {
  const d1 = haversineDistance(lat1, lng1, pLat, pLng);
  const d2 = haversineDistance(lat2, lng2, pLat, pLng);
  if (d1 <= radiusMiles || d2 <= radiusMiles) return true;

  const segLen = haversineDistance(lat1, lng1, lat2, lng2);
  if (segLen === 0) return false;

  const numSamples = Math.max(10, Math.ceil(segLen / 5));
  for (let i = 1; i < numSamples; i++) {
    const t = i / numSamples;
    const sLat = lat1 + t * (lat2 - lat1);
    const sLng = lng1 + t * (lng2 - lng1);
    const dist = haversineDistance(sLat, sLng, pLat, pLng);
    if (dist <= radiusMiles) return true;
  }
  return false;
}

async function seedTollZonesData() {
  const { storage } = await import("./storage");
  const zones = [
    { name: "George Washington Bridge", tollAmount: "16.00", lat: "40.8517", lng: "-73.9527", radiusMiles: "2" },
    { name: "Lincoln Tunnel", tollAmount: "16.00", lat: "40.7628", lng: "-74.0142", radiusMiles: "2" },
    { name: "Holland Tunnel", tollAmount: "16.00", lat: "40.7267", lng: "-74.0111", radiusMiles: "2" },
    { name: "Verrazzano-Narrows Bridge", tollAmount: "6.88", lat: "40.6066", lng: "-74.0447", radiusMiles: "2" },
    { name: "Bayonne Bridge", tollAmount: "16.00", lat: "40.6426", lng: "-74.1418", radiusMiles: "2" },
    { name: "Goethals Bridge", tollAmount: "16.00", lat: "40.6381", lng: "-74.1956", radiusMiles: "2" },
    { name: "Robert F. Kennedy Bridge (Triborough)", tollAmount: "6.88", lat: "40.7808", lng: "-73.9218", radiusMiles: "2" },
    { name: "Throgs Neck Bridge", tollAmount: "6.88", lat: "40.8054", lng: "-73.7934", radiusMiles: "2" },
    { name: "Whitestone Bridge", tollAmount: "6.88", lat: "40.8010", lng: "-73.8283", radiusMiles: "2" },
    { name: "NJ Turnpike (Full Length)", tollAmount: "13.85", lat: "40.2788", lng: "-74.5590", radiusMiles: "8" },
    { name: "Golden Gate Bridge", tollAmount: "8.75", lat: "37.8199", lng: "-122.4783", radiusMiles: "2" },
    { name: "Bay Bridge (SF-Oakland)", tollAmount: "7.00", lat: "37.7983", lng: "-122.3778", radiusMiles: "3" },
    { name: "Chicago Skyway", tollAmount: "6.00", lat: "41.6833", lng: "-87.5569", radiusMiles: "3" },
    { name: "Illinois Tollway (I-90)", tollAmount: "4.80", lat: "42.0411", lng: "-87.9700", radiusMiles: "5" },
    { name: "Indiana Toll Road", tollAmount: "10.00", lat: "41.6500", lng: "-86.2500", radiusMiles: "8" },
    { name: "Pennsylvania Turnpike (Full)", tollAmount: "56.70", lat: "40.2732", lng: "-76.8867", radiusMiles: "10" },
    { name: "Florida Turnpike (Central)", tollAmount: "12.50", lat: "28.0523", lng: "-81.5226", radiusMiles: "10" },
    { name: "Dulles Toll Road (VA)", tollAmount: "3.25", lat: "38.9548", lng: "-77.4467", radiusMiles: "5" },
    { name: "Chesapeake Bay Bridge-Tunnel", tollAmount: "18.00", lat: "37.0388", lng: "-76.0867", radiusMiles: "5" },
    { name: "Mass Pike (I-90 MA)", tollAmount: "8.20", lat: "42.3485", lng: "-71.9019", radiusMiles: "8" },
    { name: "TX SH 130 (Austin)", tollAmount: "7.50", lat: "30.3800", lng: "-97.5600", radiusMiles: "6" },
    { name: "Dallas North Tollway", tollAmount: "5.00", lat: "33.0000", lng: "-96.8200", radiusMiles: "5" },
    { name: "Sam Houston Tollway (Houston)", tollAmount: "3.50", lat: "29.7800", lng: "-95.5500", radiusMiles: "6" },
    { name: "MD Express Toll (I-95)", tollAmount: "12.00", lat: "39.3474", lng: "-76.3825", radiusMiles: "4" },
    { name: "Delaware Memorial Bridge", tollAmount: "5.00", lat: "39.6916", lng: "-75.5148", radiusMiles: "2" },
  ];
  await storage.seedTollZones(zones);
  console.log("Toll zones seeded successfully");
}
