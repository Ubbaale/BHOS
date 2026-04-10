# Behavioral Home Operating System (BHOS)

## Overview

The Behavioral Home Operating System (BHOS) is a full-stack, monorepo-based platform designed to manage behavioral health group homes. It aims to streamline operations for directors via a web application and empower staff through a mobile application. The project's vision is to provide a comprehensive, HIPAA-compliant solution for managing patients, staff, medications, billing, and compliance, ultimately improving care delivery and operational efficiency in behavioral health settings. Key capabilities include medication management with advanced safety features, robust workforce management, comprehensive billing and claims processing, and a strong focus on security and compliance.

## Test Accounts

Pre-created test accounts for testing the application (all with password `BhosTest2024!`):

| Role | Email | Access Level |
|------|-------|-------------|
| Admin | admin@test.bhos.app | Full access to all features |
| Manager | manager@test.bhos.app | Home management, staff oversight, reports |
| Nurse | nurse@test.bhos.app | Medication admin, eMAR, patient care |
| Caregiver | caregiver@test.bhos.app | Daily logs, basic patient interactions |

Test data includes: 1 organization ("BHOS Test Organization"), 3 homes, 8 staff members, 6 patients with medications and bed assignments.

To recreate test accounts: `POST /api/test-accounts/setup` (dev only, bypasses Clerk auth).

## Dev Test Auth Bypass

For automated testing (Playwright) and manual dev testing without Clerk email verification:
- **Dev Login Page**: Navigate to `/dev-login`, click a test account button. Sets `x-test-user-email` in localStorage.
- **API Bypass**: Requests with `x-test-user-email` header are authenticated without Clerk in dev mode (`devTestAuth` middleware in `artifacts/api-server/src/middlewares/devTestAuth.ts`).
- **Frontend Bypass**: `artifacts/bhos-web/src/lib/devTestAuth.ts` patches `window.fetch` to inject the header from localStorage. Imported at top of `main.tsx`.
- **Route Bypass**: `DevTestOrProtectedRoutes` in `App.tsx` renders `AppRoutes` (the Layout+Switch) directly when localStorage has the test email, skipping Clerk's `<Show when="signed-in">` gate.
- **Production Safety**: All dev auth bypasses are gated on `NODE_ENV !== "production"` or `import.meta.env.DEV`.

## User Preferences

I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `lib/db/src/schema/`.

## System Architecture

BHOS is built as a pnpm monorepo utilizing TypeScript.

**UI/UX Decisions:**
- **bhos-web**: Desktop command center using React, Vite, Tailwind CSS, shadcn/ui, and Recharts.
- **bhos-mobile**: Mobile app for staff developed with Expo React Native and Expo Router.
- **Design Principles**: Focus on clear, intuitive interfaces, prioritizing ease of use for complex workflows.
- **Reporting**: Reports center with 14 types across Medication, Clinical, Operations, and Compliance, offering inline previews and CSV export.

**Technical Implementations:**
- **Monorepo Tool**: pnpm workspaces
- **Backend**: Express 5 for the API server.
- **Database**: PostgreSQL with Drizzle ORM. The schema includes ~55 tables covering various entities like homes, staff, patients, medications, incidents, billing, and specialized modules.
- **Validation**: Zod for schema validation.
- **API Codegen**: Orval from OpenAPI spec for generating API hooks and Zod schemas.
- **State Management**: @tanstack/react-query for both web and mobile.
- **Build Tools**: esbuild for the API server and Vite for the web frontend.
- **Authentication**: Clerk for integrated authentication across web and mobile, supporting various user roles and robust session management.
- **Security & Compliance**: HIPAA-compliant module with geofencing, PHI audit logging, active session management, IP whitelisting, device security checks, biometric authentication, auto-lock, med-pass PIN re-verification (4-6 digit personal PIN required before each medication administration, with lockout after 5 failed attempts, single-use tokens, staff binding, and full attempt audit trail), inactivity lock screen (2-min idle timeout, blur/hide PHI, re-auth options), quick lock & switch user from sidebar, Duo-style push approval for medication access (challenge → push to phone → approve/deny with high-entropy response secret → token issued), and bulk session revocation ("Sign Out Everyone").
- **Medication Safety**: Electronic Medication Administration Record (eMAR) with safety features like 5 Rights verification, controlled substance tracking, inventory management, drug-drug interaction checks, automatic error detection (missed doses, late administrations, double-dose detection), error reporting with resolution workflow, and medication reconciliation (provider order processing, refill tracking, medication change trail). **Barcode Scanning**: Supports medication barcode verification via phone camera (mobile, expo-camera) and USB/handheld scanner (web, keyboard wedge input). Barcode lookup API matches NDC codes, Rx numbers, and lot numbers. Web: `BarcodeScanner` component (`artifacts/bhos-web/src/components/BarcodeScanner.tsx`) with dialog UI for manual entry and auto-detect handheld scanner input. Mobile: full-screen camera scanner at `/scanner` route, returns scanned medication ID to the administer screen. Barcode verification status is recorded on each medication administration (`barcode_scan_verified` column).
- **Workforce Management**: Shift management, configurable onboarding checklists, and attendance tracking with geofencing and fraud detection.
- **Family Portal**: Allows family members to access patient information, receive daily summaries, engage in care messaging, and manage consent documents.
- **Predictive Analytics**: Tracks behavior trends and uses a risk scoring engine for Incident Escalation, Medication Non-Adherence, and Behavioral Decline, with actionable clinical recommendations.
- **Staff Messaging**: Internal chat system with urgency levels and broadcast capabilities.
- **Medical Appointments**: Comprehensive appointment tracking, scheduling, and management.
- **Daily Assignments**: Shift-based staff-to-patient assignment with auto-assign and manual assignment options.
- **Transportation & Fleet Management**: Vehicle fleet registry, driver management, ride request management, and dispatch workflows.
- **Global Search**: Command palette (⌘K) search bar in sidebar, searches across patients, staff, medications, incidents, and homes via `GET /api/search?q=term` with ILIKE queries. Results grouped by category with emoji headers and clickable navigation.
- **Homes Map View**: Leaflet/OpenStreetMap map showing all group home locations with color-coded pins (green=active, gray=inactive, amber=maintenance). List/Map view toggle on Homes page, with card grid below map showing occupancy stats.
- **Camera Management**: Security camera registry across all homes with status monitoring (online/offline/maintenance), camera specs tracking (brand, model, resolution, night vision, audio, motion detection), recording mode configuration, retention policies, stream/dashboard URL links, event logging, and per-home camera overview with filtering. Camera cards show live view and dashboard links to external camera systems.
- **Support Ticket System**: Organizations can submit support tickets with categories (general, technical, billing, bug, feature request, account), priority levels, and threaded message conversations. Ticket lifecycle: open → in_progress → waiting → resolved → closed.
- **Super Admin Panel** (`/platform-admin`): Platform-owner dashboard for managing all enrolled organizations. Features: platform-wide stats (org count, staff count, homes, tickets), organization browser with drill-down into each org's homes/staff/tickets, cross-org ticket management with admin replies (tagged as "BHOS Support"), ticket status control, and platform-wide backup management (backup any/all orgs, download backups). Access controlled via `super_admins` table (email whitelist).
- **Multi-Tenant Backup System** (`/backups`): Per-organization data export system. Org users can create full backups of their data (homes, staff, patients, medications, incidents, shifts, treatment plans, compliance data, etc.) scoped strictly to their org. Backups traverse org→homes→patients→staff relationship chains to collect all related records across 14+ table categories. Features: backup creation with notes, backup history with status/size/record counts, JSON download, 90-day expiration. Platform admins can trigger backups for any org and perform platform-wide backups (365-day retention). All admin backup routes protected by `requireSuperAdmin` middleware. Schema: `data_backups` table tracks backup metadata.
- **App Store Deployment**: Mobile app fully configured for iOS App Store and Google Play Store submission. EAS Build profiles (development, preview, production) configured in `eas.json`. Store listing metadata, privacy policy, and comprehensive deployment guide in `artifacts/bhos-mobile/store-listing/` and `STORE_DEPLOYMENT_GUIDE.md`. Bundle ID: `com.bhos.mobile`. All required permissions declared (camera, location, biometrics, notifications, storage).
- **Push Notifications**: Expo push notification infrastructure for targeted and broadcast alerts.
- **Organization & Subscription**: Multi-tenant organization management with per-home billing and subscription lifecycle management.
- **Free Trial System**: 14-day free trial with comprehensive sample data seeding.
- **Census & Bed Board**: Real-time bed tracking, occupancy rates, and visual bed board view.
- **Admissions & Intake CRM**: Kanban-style referral pipeline, intake assessments, and waitlist management.
- **Treatment Plans / ISP**: Individual Service Plans with goal tracking, interventions, and clinician signatures.
- **Progress Notes**: Multi-format clinical documentation with signing and co-signing workflows.
- **Discharge Planning**: Comprehensive discharge plans, aftercare planning, and follow-up scheduling.
- **Device-Bound Enrollment**: Staff mobile devices must be registered and admin-approved for full app access.
- **Crisis Management**: Full crisis lifecycle management with crisis plans, event tracking, and debriefings.
- **Training & Certification Tracking**: Staff training compliance management, including course tracking and certification renewals.
- **State Compliance & Inspector Portal**: Regulatory readiness scorecard (8 compliance areas), state inspector management with hashed token auth, inspection visit tracking, compliance report generation, full state audit trail, and a standalone read-only inspector portal for state nurses/surveyors.
- **Staff Enrollment Invitations**: Admin/manager-controlled enrollment replaces self-registration. Admins generate single-use enrollment codes (7-day expiry) for staff members, who then use the BHOS mobile app to validate the code, create their account, and get linked to their staff record. Public endpoints (`/staff/invitation/validate`, `/staff/invitation/accept`) mounted before Clerk middleware. Atomic token consumption prevents race conditions.
- **Staff Role Management & Admin Transfer**: Admins can change staff roles and transfer admin ownership securely.
- **Billing & Claims**: Full revenue cycle management for claims, billable services, payment posting, and payer management.

**System Design Choices:**
- **API Structure**: All API routes are prefixed with `/api` and cover CRUD operations for core entities, alongside specialized endpoints.
- **Shared Libraries**: Centralized `lib` directory for OpenAPI spec, generated API Zod schemas, React Query API client hooks, and Drizzle ORM database schema.

## External Dependencies

- **Database**: PostgreSQL
- **Authentication**: Clerk
- **Frontend Frameworks/Libraries**: React, Vite, Tailwind CSS, shadcn/ui, Recharts, Expo, React Native, Expo Router, @tanstack/react-query
- **Backend Frameworks/Libraries**: Express 5, Drizzle ORM, Zod, Orval, esbuild
- **Payment Processing**: Stripe
- **Claims Clearinghouses**: Availity, Change Healthcare, Waystar, Trizetto, Office Ally
- **State Medicaid Portals**: Integrations with 8 state Medicaid portals (MA, NY, CA, TX, FL, PA, IL, OH)
- **EHR/FHIR Integrations**: HL7 FHIR R4 API endpoints for Epic, Cerner, Allscripts, athenahealth