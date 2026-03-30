import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { runMigrations } from "stripe-replit-sync";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { securityHeaders, globalRateLimiter } from "./security";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { users, itCompanies, itTechProfiles } from "@shared/schema";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    username: string;
    role: string;
    driverId?: number;
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn('DATABASE_URL not found, skipping Stripe initialization');
    return;
  }

  try {
    console.log('Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    console.log('Stripe schema ready');

    const stripeSync = await getStripeSync();

    console.log('Setting up managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const webhookResult = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`
    );
    if (webhookResult?.webhook?.url) {
      console.log(`Webhook configured: ${webhookResult.webhook.url}`);
    } else {
      console.warn('Stripe webhook setup incomplete - webhook URL not available');
    }

    console.log('Syncing Stripe data...');
    stripeSync.syncBackfill()
      .then(() => {
        console.log('Stripe data synced');
      })
      .catch((err: any) => {
        console.error('Error syncing Stripe data:', err);
      });
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

// Initialize Stripe (wrapped in IIFE for CommonJS compatibility)
(async () => {
  await initStripe();
})();

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Security headers (XSS protection, CSP, HSTS, etc.)
app.use(securityHeaders);

// Global rate limiting to prevent DoS attacks
app.use(globalRateLimiter);

// CORS configuration for mobile apps
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Exact-match allowed origins for security (no prefix matching)
  const allowedOrigins = new Set([
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:8100',
    'carehub://app',
    'https://carehubapp.com',
    'https://www.carehubapp.com',
    'https://carehubapp.replit.app',
    'https://app.carehubapp.com',
  ]);
  
  // For /api/mobile/* endpoints (JWT token-based auth, no cookies needed)
  if (req.path.startsWith('/api/mobile/')) {
    // Only allow known mobile app origins, not arbitrary origins
    if (origin && allowedOrigins.has(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      // For mobile apps without origin header (native apps)
      res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Device-ID');
    // No credentials needed for JWT-only endpoints
    res.header('Access-Control-Max-Age', '86400');
    
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
  } else if (origin && allowedOrigins.has(origin)) {
    // Exact match for session-based endpoints
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  next();
});

// Session middleware for authentication with production-grade security
const isProduction = process.env.NODE_ENV === "production";

// Enforce strong session secret in production
const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && !sessionSecret) {
  console.error("SECURITY ERROR: SESSION_SECRET environment variable is required in production!");
  process.exit(1);
}

// Configure session store - use PostgreSQL in production for security and scalability
let sessionStore: session.Store | undefined;
if (isProduction && process.env.DATABASE_URL) {
  const PgSession = connectPgSimple(session);
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });
  pool.query(`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid")
    ) WITH (OIDS=FALSE);
    CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");
  `).then(() => {
    console.log("Session table ensured");
  }).catch((err: Error) => {
    console.error("Session table creation error:", err.message);
  });
  sessionStore = new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: false,
  });
  console.log("Using PostgreSQL session store for production security");
}

app.use(
  session({
    store: sessionStore,
    secret: sessionSecret || "carehub-session-secret-dev",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: isProduction ? "strict" : "lax", // Strict in production for CSRF protection
    },
  })
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      log(`serving on port ${port}`);
      try {
        const accounts = [
          { username: "admin@carehubapp.com", password: "Admin123!", role: "admin" },
          { username: "driver@test.com", password: "TestDriver123!", role: "driver" },
          { username: "patient@test.com", password: "TestPatient123!", role: "patient" },
          { username: "itcompany@test.com", password: "TestCompany123!", role: "user" },
          { username: "ittech@test.com", password: "TestTech123!", role: "it_tech" },
        ];
        for (const acct of accounts) {
          const hash = await bcrypt.hash(acct.password, 10);
          const existing = await storage.getUserByUsername(acct.username);
          if (!existing) {
            const newUser = await storage.createUser({ username: acct.username, password: hash, role: acct.role });
            await db.update(users).set({ emailVerified: true }).where(eq(users.id, newUser.id));
            log(`${acct.role} account created: ${acct.username}`);
          } else {
            await storage.updateUserPassword(existing.id, hash);
            await db.update(users).set({ emailVerified: true }).where(eq(users.id, existing.id));
            log(`${acct.role} account password reset: ${acct.username}`);
          }
        }

        const itCompanyUser = await storage.getUserByUsername("itcompany@test.com");
        if (itCompanyUser) {
          const existingCompany = await db.select().from(itCompanies).where(eq(itCompanies.ownerId, itCompanyUser.id)).limit(1);
          if (existingCompany.length === 0) {
            await db.insert(itCompanies).values({
              ownerId: itCompanyUser.id,
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
            log("IT company profile created for itcompany@test.com");
          }
        }

        const itTechUser = await storage.getUserByUsername("ittech@test.com");
        if (itTechUser) {
          const existingTech = await db.select().from(itTechProfiles).where(eq(itTechProfiles.userId, itTechUser.id)).limit(1);
          if (existingTech.length === 0) {
            await db.insert(itTechProfiles).values({
              userId: itTechUser.id,
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
            log("IT tech profile created for ittech@test.com");
          }
        }
      } catch (err) {
        console.error("Error seeding accounts:", err);
      }
    },
  );
})();
