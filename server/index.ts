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
import { users, itCompanies, itTechProfiles, driverProfiles, courierCompanies, facilities, facilityStaff, caregiverPatients } from "@shared/schema";

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
    permissions?: string[];
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
  
  if (origin && allowedOrigins.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Device-ID, Accept, Origin');
    res.header('Access-Control-Max-Age', '86400');

    if (req.path.startsWith('/api/mobile/')) {
      // JWT-only endpoints don't need credentials
    } else {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
  } else if (!origin && req.path.startsWith('/api/mobile/')) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Device-ID, Accept, Origin');
    res.header('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
  }
  
  next();
});

// Session middleware for authentication with production-grade security
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  app.set('trust proxy', 1);
}

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
      sameSite: "lax",
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
          { username: "employer@test.com", password: "TestEmployer123!", role: "employer" },
          { username: "worker@test.com", password: "TestWorker123!", role: "healthcare_worker" },
          { username: "caregiver@test.com", password: "TestCaregiver123!", role: "caregiver" },
          { username: "facility@test.com", password: "TestFacility123!", role: "facility_staff" },
          { username: "courier@test.com", password: "TestCourier123!", role: "user" },
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
              fullName: "David Martinez",
              email: "ittech@test.com",
              phone: "555-200-3000",
              city: "Chicago",
              state: "IL",
              zipCode: "60601",
              skills: ["Network", "Hardware", "EHR System", "Printer"],
              certifications: ["CompTIA A+", "Network+"],
              experienceYears: "3-5",
              bio: "Experienced healthcare IT technician specializing in EHR systems and hospital network infrastructure",
              hourlyRate: "45",
              applicationStatus: "approved",
              backgroundCheckStatus: "passed",
            });
            log("IT tech profile created for ittech@test.com");
          }
        }

        const driverUser = await storage.getUserByUsername("driver@test.com");
        if (driverUser) {
          const existingDriver = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, driverUser.id)).limit(1);
          if (existingDriver.length === 0) {
            await db.insert(driverProfiles).values({
              userId: driverUser.id,
              fullName: "James Wilson",
              phone: "555-300-4000",
              email: "driver@test.com",
              vehicleType: "sedan",
              vehiclePlate: "IL-TEST-001",
              wheelchairAccessible: false,
              stretcherCapable: false,
              isAvailable: true,
              applicationStatus: "approved",
              kycStatus: "approved",
              driversLicenseNumber: "D400-1234-5678",
              driversLicenseExpiry: "2028-12-31",
              driversLicenseState: "IL",
              insuranceProvider: "State Farm",
              insurancePolicyNumber: "SF-98765432",
              insuranceExpiry: "2027-06-30",
              vehicleYear: "2022",
              vehicleMake: "Toyota",
              vehicleModel: "Camry",
              vehicleColor: "Silver",
              currentLat: "41.8781",
              currentLng: "-87.6298",
              isContractorOnboarded: true,
              taxClassification: "individual",
              accountStatus: "active",
              patientTransportEnabled: true,
              medicalCourierEnabled: true,
            });
            log("Driver profile created for driver@test.com");
          }
        }

        const courierUser = await storage.getUserByUsername("courier@test.com");
        if (courierUser) {
          const existingCourier = await db.select().from(courierCompanies).where(eq(courierCompanies.ownerId, courierUser.id)).limit(1);
          if (existingCourier.length === 0) {
            await db.insert(courierCompanies).values({
              ownerId: courierUser.id,
              companyName: "MedExpress Courier Services",
              contactEmail: "courier@test.com",
              contactPhone: "555-400-5000",
              address: "456 Healthcare Blvd",
              city: "Chicago",
              state: "IL",
              zipCode: "60602",
              companyType: "pharmacy",
              businessLicenseNumber: "BL-2024-78901",
              hipaaCompliant: true,
              isActive: true,
              defaultDeliveryTerms: "standard",
            });
            log("Courier company profile created for courier@test.com");
          }
        }

        const facilityUser = await storage.getUserByUsername("facility@test.com");
        if (facilityUser) {
          const existingFacility = await db.select().from(facilities).limit(1);
          let facilityId: number;
          if (existingFacility.length === 0) {
            const [newFacility] = await db.insert(facilities).values({
              name: "Chicago General Hospital",
              address: "789 Hospital Way, Chicago, IL 60603",
              lat: "41.8827",
              lng: "-87.6233",
              phone: "555-500-6000",
              email: "discharge@chicagogeneral.test",
              facilityType: "hospital",
              contactPerson: "Karen Miller",
              isActive: true,
            }).returning();
            facilityId = newFacility.id;
            log("Facility created: Chicago General Hospital");
          } else {
            facilityId = existingFacility[0].id;
          }

          const existingStaff = await db.select().from(facilityStaff).where(eq(facilityStaff.userId, facilityUser.id)).limit(1);
          if (existingStaff.length === 0) {
            await db.insert(facilityStaff).values({
              facilityId,
              userId: facilityUser.id,
              role: "coordinator",
              isActive: true,
            });
            log("Facility staff profile created for facility@test.com");
          }
        }

        const caregiverUser = await storage.getUserByUsername("caregiver@test.com");
        if (caregiverUser) {
          const existingPatients = await db.select().from(caregiverPatients).where(eq(caregiverPatients.caregiverId, caregiverUser.id)).limit(1);
          if (existingPatients.length === 0) {
            await db.insert(caregiverPatients).values({
              caregiverId: caregiverUser.id,
              patientName: "Margaret Brown",
              patientPhone: "555-600-7000",
              patientEmail: "margaret.brown@test.com",
              relationship: "parent",
              mobilityNeeds: ["wheelchair"],
              medicalNotes: "Requires wheelchair-accessible vehicle. Has regular dialysis appointments on Tuesdays and Thursdays.",
              isActive: true,
            });
            log("Caregiver patient profile created for caregiver@test.com");
          }
        }
      } catch (err) {
        console.error("Error seeding accounts:", err);
      }
    },
  );
})();
