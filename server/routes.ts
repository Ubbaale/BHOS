import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertJobSchema, insertTicketSchema, insertRideSchema, insertDriverProfileSchema, rideStatuses, insertPushSubscriptionSchema, insertRideMessageSchema, insertTripShareSchema, users, auditLogs, insertFacilitySchema, insertFacilityStaffSchema, insertCaregiverPatientSchema } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { sendIssueNotification, sendRideBookedForPatientEmail, FileAttachment } from "./email";
import { saveSubscription, removeSubscription, getVapidPublicKey, notifyDriversOfNewRide, notifyPatientOfRideUpdate } from "./push";
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
    return res.status(401).json({ message: 'Authorization token required' });
  }
  
  const token = authHeader.substring(7);
  const payload = verifyToken(token, 'access');
  
  if (!payload) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  
  // Attach user info to request
  (req as any).mobileUser = payload;
  next();
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
        await storage.createUser({
          username: "driver@test.com",
          password: driverHash,
          role: "driver"
        });
        results.push("Driver account created: driver@test.com / TestDriver123!");
      } else {
        results.push("Driver account already exists: driver@test.com");
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
      
      res.json({ 
        success: true, 
        message: "Test accounts setup complete",
        results,
        credentials: {
          driver: { username: "driver@test.com", password: "TestDriver123!" },
          patient: { username: "patient@test.com", password: "TestPatient123!" }
        }
      });
    } catch (error) {
      console.error("Error seeding test accounts:", error);
      res.status(500).json({ message: "Failed to seed test accounts", error: String(error) });
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

      // Regenerate session to prevent session fixation attacks
      const oldSession = req.session;
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        
        // Set session data on new session
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role || "user";
        if (driverId) {
          req.session.driverId = driverId;
        }

        // Clear rate limiting on successful login
        if ((req as any).loginRateLimitKey) {
          clearLoginAttempts((req as any).loginRateLimitKey);
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

      res.json({
        accessToken,
        refreshToken: refreshTokenValue,
        expiresIn: 900, // 15 minutes in seconds
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
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Mobile token refresh
  app.post("/api/mobile/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token required" });
      }

      const payload = verifyToken(refreshToken, 'refresh');
      if (!payload) {
        return res.status(401).json({ message: "Invalid or expired refresh token" });
      }

      // Invalidate old refresh token
      refreshTokens.delete(refreshToken);

      // Generate new tokens
      const tokenPayload = {
        userId: payload.userId,
        username: payload.username,
        role: payload.role,
        driverId: payload.driverId,
        deviceId: payload.deviceId
      };

      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(500).json({ message: "Token refresh failed" });
    }
  });

  // Mobile logout - invalidate refresh token
  app.post("/api/mobile/auth/logout", async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
      refreshTokens.delete(refreshToken);
    }
    res.json({ message: "Logged out successfully" });
  });

  // Mobile - get current user (using JWT)
  app.get("/api/mobile/auth/me", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      
      const user = await storage.getUserByUsername(mobileUser.username);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      let driverProfile = null;
      if (mobileUser.driverId) {
        driverProfile = await storage.getDriver(mobileUser.driverId);
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
    } catch (error) {
      console.error("Mobile auth me error:", error);
      res.status(500).json({ message: "Failed to get user info" });
    }
  });

  // Mobile - register device for push notifications (FCM/APNs)
  app.post("/api/mobile/push/register", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const { deviceToken, platform, deviceId } = req.body;
      
      if (!deviceToken || !platform) {
        return res.status(400).json({ message: "Device token and platform are required" });
      }
      
      if (!['fcm', 'apns', 'ios', 'android'].includes(platform.toLowerCase())) {
        return res.status(400).json({ message: "Platform must be 'fcm', 'apns', 'ios', or 'android'" });
      }
      
      // Store mobile push subscription using the push service
      const endpoint = `mobile://${platform.toLowerCase()}/${deviceToken}`;
      const p256dh = deviceId || 'mobile-device';
      const auth = `user-${mobileUser.userId}`;
      
      await saveSubscription(endpoint, p256dh, auth, mobileUser.role, mobileUser.driverId);
      
      res.json({ 
        message: "Device registered for push notifications",
        platform: platform.toLowerCase()
      });
    } catch (error) {
      console.error("Mobile push registration error:", error);
      res.status(500).json({ message: "Failed to register device" });
    }
  });

  // Mobile - get WebSocket token (using JWT auth)
  app.get("/api/mobile/auth/ws-token", mobileAuthMiddleware, (req, res) => {
    const mobileUser = (req as any).mobileUser as JwtPayload;
    const token = generateWsToken(String(mobileUser.userId), mobileUser.role);
    res.json({ token });
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
      
      rides = rides.slice(0, Number(limit));
      
      res.json({ rides });
    } catch (error) {
      console.error("Mobile get rides error:", error);
      res.status(500).json({ message: "Failed to get rides" });
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
        return res.status(404).json({ message: "Ride not found" });
      }
      
      // Verify driver owns this ride
      if (mobileUser.role === 'driver' && ride.driverId !== mobileUser.driverId) {
        return res.status(403).json({ message: "Not authorized for this ride" });
      }
      
      // Update status
      const updatedRide = await storage.updateRideStatus(rideId, status);
      if (!updatedRide) {
        return res.status(500).json({ message: "Failed to update ride" });
      }
      broadcastRideUpdate("status_change", updatedRide);
      
      res.json({ ride: updatedRide });
    } catch (error) {
      console.error("Mobile update ride status error:", error);
      res.status(500).json({ message: "Failed to update ride status" });
    }
  });

  // Mobile - update driver location
  app.post("/api/mobile/driver/location", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      
      if (!mobileUser.driverId) {
        return res.status(403).json({ message: "Not a driver account" });
      }
      
      const { latitude, longitude, rideId } = req.body;
      
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ message: "Valid latitude and longitude required" });
      }
      
      await storage.updateDriverLocation(mobileUser.driverId, latitude, longitude);
      
      if (rideId) {
        const ride = await storage.getRide(rideId);
        if (ride && ride.driverId === mobileUser.driverId) {
          broadcastRideUpdate("driver_location", { ...ride, driverLatitude: latitude, driverLongitude: longitude });
        }
      }
      
      res.json({ message: "Location updated" });
    } catch (error) {
      console.error("Mobile driver location update error:", error);
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  // ============================================
  // MOBILE API - USER REGISTRATION
  // ============================================

  app.post("/api/mobile/auth/register", loginRateLimiter, async (req, res) => {
    try {
      const { username, password, confirmPassword, role, fullName, phone } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username (email) and password are required" });
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
      if (!/[^A-Za-z0-9]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one special character" });
      }

      if (confirmPassword && password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords don't match" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Email is already registered. Please use a different email or login." });
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

      res.status(201).json({
        accessToken,
        refreshToken: refreshTokenValue,
        expiresIn: 900,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (error) {
      console.error("Mobile registration error:", error);
      res.status(500).json({ message: "Registration failed" });
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

      jobs = jobs.slice(0, Number(limit));
      res.json({ jobs, total: jobs.length });
    } catch (error) {
      console.error("Mobile get jobs error:", error);
      res.status(500).json({ message: "Failed to get jobs" });
    }
  });

  app.get("/api/mobile/jobs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json({ job });
    } catch (error) {
      console.error("Mobile get job error:", error);
      res.status(500).json({ message: "Failed to get job" });
    }
  });

  app.post("/api/mobile/jobs", mobileAuthMiddleware, async (req, res) => {
    try {
      const parsed = insertJobSchema.parse(req.body);
      const job = await storage.createJob(parsed);
      broadcastJobUpdate("add", job);
      res.status(201).json({ job });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid job data", errors: error.errors });
      }
      console.error("Mobile create job error:", error);
      res.status(500).json({ message: "Failed to create job" });
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
        await notifyDriversOfNewRide(ride.pickupAddress, new Date(ride.appointmentTime));
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

      res.status(201).json({ ride });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid ride data", errors: error.errors });
      }
      console.error("Mobile create ride error:", error);
      res.status(500).json({ message: "Failed to create ride" });
    }
  });

  app.get("/api/mobile/rides/pool", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      if (mobileUser.role !== 'driver') {
        return res.status(403).json({ message: "Only drivers can view the ride pool" });
      }

      let rides = await storage.getAllRides();
      rides = rides.filter((r: any) => r.status === "requested" && !r.driverId);
      res.json({ rides });
    } catch (error) {
      console.error("Mobile ride pool error:", error);
      res.status(500).json({ message: "Failed to get ride pool" });
    }
  });

  app.get("/api/mobile/rides/:id", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      const isPatient = String(ride.patientId) === String(mobileUser.userId);
      const isDriver = mobileUser.driverId && ride.driverId === mobileUser.driverId;
      if (!isPatient && !isDriver) {
        return res.status(403).json({ message: "Not authorized for this ride" });
      }
      res.json({ ride });
    } catch (error) {
      console.error("Mobile get ride error:", error);
      res.status(500).json({ message: "Failed to get ride" });
    }
  });

  app.post("/api/mobile/rides/:id/accept", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      if (!mobileUser.driverId) {
        return res.status(403).json({ message: "Only drivers can accept rides" });
      }

      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      if (ride.status !== "requested") {
        return res.status(400).json({ message: "Ride is no longer available" });
      }

      const updatedRide = await storage.assignDriver(rideId, mobileUser.driverId);
      if (updatedRide) {
        await storage.updateRideStatus(rideId, "accepted");
        const finalRide = await storage.getRide(rideId);
        broadcastRideUpdate("status_change", finalRide);

        try {
          if (finalRide) await notifyPatientOfRideUpdate("accepted", finalRide.driverId?.toString());
        } catch (e) {
          console.error("Failed to notify patient:", e);
        }

        res.json({ ride: finalRide });
      } else {
        res.status(500).json({ message: "Failed to accept ride" });
      }
    } catch (error) {
      console.error("Mobile accept ride error:", error);
      res.status(500).json({ message: "Failed to accept ride" });
    }
  });

  app.post("/api/mobile/rides/:id/complete", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      if (mobileUser.role === 'driver' && ride.driverId !== mobileUser.driverId) {
        return res.status(403).json({ message: "Not authorized for this ride" });
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
          await notifyPatientOfRideUpdate("completed");
        } catch (e) {
          console.error("Failed to notify patient:", e);
        }
      }

      res.json({ ride: updatedRide });
    } catch (error) {
      console.error("Mobile complete ride error:", error);
      res.status(500).json({ message: "Failed to complete ride" });
    }
  });

  app.post("/api/mobile/rides/:id/cancel", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      const { reason } = req.body;
      const cancelledBy = mobileUser.role === 'driver' ? 'driver' : 'patient';
      const updatedRide = await storage.cancelRide(rideId, cancelledBy, reason || "Cancelled via mobile app");

      if (updatedRide) {
        broadcastRideUpdate("status_change", updatedRide);
        if (cancelledBy === 'driver' && mobileUser.driverId) {
          await storage.incrementDriverCancellations(mobileUser.driverId);
        }
      }

      res.json({ ride: updatedRide });
    } catch (error) {
      console.error("Mobile cancel ride error:", error);
      res.status(500).json({ message: "Failed to cancel ride" });
    }
  });

  app.get("/api/mobile/rides/:id/messages", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      const isPatient = String(ride.patientId) === String(mobileUser.userId);
      const isDriver = mobileUser.driverId && ride.driverId === mobileUser.driverId;
      if (!isPatient && !isDriver) {
        return res.status(403).json({ message: "Not authorized for this ride" });
      }
      const messages = await storage.getRideMessages(rideId);
      res.json({ messages });
    } catch (error) {
      console.error("Mobile get messages error:", error);
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  app.post("/api/mobile/rides/:id/messages", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const { message: messageText } = req.body;

      if (!messageText || typeof messageText !== 'string' || messageText.trim().length === 0) {
        return res.status(400).json({ message: "Message text is required" });
      }

      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      const isPatient = String(ride.patientId) === String(mobileUser.userId);
      const isDriver = mobileUser.driverId && ride.driverId === mobileUser.driverId;
      if (!isPatient && !isDriver) {
        return res.status(403).json({ message: "Not authorized for this ride" });
      }

      const senderType = mobileUser.role === 'driver' ? 'driver' : 'patient';
      const msg = await storage.createRideMessage({
        rideId,
        senderType,
        message: messageText.trim(),
        isQuickMessage: false,
      });

      broadcastChatMessage(rideId, msg);
      res.status(201).json({ message: msg });
    } catch (error) {
      console.error("Mobile send message error:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/mobile/rides/:id/events", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      const isPatient = String(ride.patientId) === String(mobileUser.userId);
      const isDriver = mobileUser.driverId && ride.driverId === mobileUser.driverId;
      if (!isPatient && !isDriver) {
        return res.status(403).json({ message: "Not authorized for this ride" });
      }
      const events = await storage.getRideEvents(rideId);
      res.json({ events });
    } catch (error) {
      console.error("Mobile get events error:", error);
      res.status(500).json({ message: "Failed to get ride events" });
    }
  });

  app.post("/api/mobile/rides/:id/rate", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const { rating, comment } = req.body;

      if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be a number between 1 and 5" });
      }

      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      const isPatient = String(ride.patientId) === String(mobileUser.userId);
      const isDriver = mobileUser.driverId && ride.driverId === mobileUser.driverId;
      if (!isPatient && !isDriver) {
        return res.status(403).json({ message: "Not authorized for this ride" });
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

      res.status(201).json({ rating: rideRating });
    } catch (error) {
      console.error("Mobile rate ride error:", error);
      res.status(500).json({ message: "Failed to rate ride" });
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
          return res.status(404).json({ message: "No driver profile found" });
        }
        return res.json({ driver: driverByUser });
      }
      const driver = await storage.getDriver(mobileUser.driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json({ driver });
    } catch (error) {
      console.error("Mobile get driver profile error:", error);
      res.status(500).json({ message: "Failed to get driver profile" });
    }
  });

  app.patch("/api/mobile/driver/availability", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      if (!mobileUser.driverId) {
        return res.status(403).json({ message: "Not a driver account" });
      }
      const { isAvailable } = req.body;
      if (typeof isAvailable !== 'boolean') {
        return res.status(400).json({ message: "isAvailable must be a boolean" });
      }
      const driver = await storage.updateDriverAvailability(mobileUser.driverId, isAvailable);
      res.json({ driver });
    } catch (error) {
      console.error("Mobile update availability error:", error);
      res.status(500).json({ message: "Failed to update availability" });
    }
  });

  app.get("/api/mobile/driver/earnings", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      if (!mobileUser.driverId) {
        return res.status(403).json({ message: "Not a driver account" });
      }
      const earnings = await storage.getDriverEarnings(mobileUser.driverId);
      const driver = await storage.getDriver(mobileUser.driverId);
      res.json({
        earnings,
        balance: {
          available: driver?.availableBalance || "0",
          pending: driver?.pendingBalance || "0",
          total: driver?.totalEarnings || "0",
        }
      });
    } catch (error) {
      console.error("Mobile get earnings error:", error);
      res.status(500).json({ message: "Failed to get earnings" });
    }
  });

  app.get("/api/mobile/driver/payouts", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      if (!mobileUser.driverId) {
        return res.status(403).json({ message: "Not a driver account" });
      }
      const payouts = await storage.getDriverPayouts(mobileUser.driverId);
      res.json({ payouts });
    } catch (error) {
      console.error("Mobile get payouts error:", error);
      res.status(500).json({ message: "Failed to get payouts" });
    }
  });

  app.post("/api/mobile/driver/apply", async (req, res) => {
    try {
      const { email, password, confirmPassword, ...driverData } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        return res.status(400).json({ message: "Password must contain uppercase, lowercase, number, and special character" });
      }
      if (confirmPassword && password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords don't match" });
      }

      const existingUser = await storage.getUserByUsername(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email is already registered" });
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

      res.status(201).json({
        accessToken,
        refreshToken: refreshTokenValue,
        expiresIn: 900,
        user: { id: user.id, username: user.username, role: "driver" },
        driver: { id: driver.id, fullName: driver.fullName, applicationStatus: driver.applicationStatus }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid driver data", errors: error.errors });
      }
      console.error("Mobile driver apply error:", error);
      res.status(500).json({ message: "Failed to submit driver application" });
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
        return res.status(404).json({ message: "Patient profile not found" });
      }
      res.json({ patient });
    } catch (error) {
      console.error("Mobile get patient profile error:", error);
      res.status(500).json({ message: "Failed to get patient profile" });
    }
  });

  app.post("/api/mobile/patient/profile", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const existing = await storage.getPatient(mobileUser.userId);
      if (existing) {
        return res.json({ patient: existing });
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

      res.status(201).json({ patient });
    } catch (error) {
      console.error("Mobile create patient profile error:", error);
      res.status(500).json({ message: "Failed to create patient profile" });
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

      res.json({
        isActive: !!activeSurge,
        multiplier: activeSurge ? activeSurge.multiplier : 1.0,
        reason: activeSurge ? activeSurge.reason : null,
      });
    } catch (error) {
      console.error("Mobile surge pricing error:", error);
      res.status(500).json({ message: "Failed to get surge pricing" });
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
      res.status(201).json({ incident });
    } catch (error) {
      console.error("Mobile create incident error:", error);
      res.status(500).json({ message: "Failed to report incident" });
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
        return res.status(404).json({ message: "Ride not found" });
      }

      const isPatient = String(ride.patientId) === String(mobileUser.userId);
      if (!isPatient) {
        return res.status(403).json({ message: "Only the ride patient can create a payment" });
      }

      const fare = parseFloat(ride.estimatedFare || "0");
      if (fare <= 0) {
        return res.status(400).json({ message: "Invalid fare amount" });
      }

      const stripeClient = getUncachableStripeClient();
      if (!stripeClient) {
        return res.status(500).json({ message: "Payment service unavailable" });
      }

      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(fare * 100),
        currency: "usd",
        metadata: { rideId: String(rideId), type: "ride_payment" },
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        publishableKey: getStripePublishableKey(),
        amount: fare,
      });
    } catch (error) {
      console.error("Mobile payment intent error:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  app.post("/api/mobile/rides/:id/tip", mobileAuthMiddleware, async (req, res) => {
    try {
      const mobileUser = (req as any).mobileUser as JwtPayload;
      const rideId = parseInt(req.params.id);
      const { amount } = req.body;

      if (!amount || typeof amount !== 'number' || amount <= 0 || amount > 500) {
        return res.status(400).json({ message: "Tip amount must be a number between $0.01 and $500" });
      }

      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      const isPatient = String(ride.patientId) === String(mobileUser.userId);
      if (!isPatient) {
        return res.status(403).json({ message: "Only the ride patient can tip" });
      }

      const stripeClient = getUncachableStripeClient();
      if (!stripeClient) {
        return res.status(500).json({ message: "Payment service unavailable" });
      }

      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: "usd",
        metadata: { rideId: String(rideId), type: "tip" },
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        publishableKey: getStripePublishableKey(),
        amount,
      });
    } catch (error) {
      console.error("Mobile tip payment error:", error);
      res.status(500).json({ message: "Failed to create tip payment" });
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
        success: "{ data: ... } or { rides: [...] } etc.",
        error: "{ message: 'Error description' }"
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
      
      notifyDriversOfNewRide(ride.pickupAddress, ride.appointmentTime).catch(err => {
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

      const compliance = await checkDriverCompliance(driverId);
      if (!compliance.compliant) {
        return res.status(403).json({ 
          message: "Cannot accept rides due to compliance issues",
          issues: compliance.issues
        });
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
  app.post("/api/admin/rides/:id/refund", requireAdmin, async (req, res) => {
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
