# Carehub - Healthcare Staffing Platform

## Overview
Carehub is a healthcare staffing agency landing page and job management platform. It connects healthcare facilities with qualified medical professionals for 24/7 staffing needs, featuring an interactive job map, issue reporting, and facility/worker matching. It also includes a robust Non-Emergency Medical Transportation (NEMT) marketplace, allowing patients to book rides and drivers to manage requests, with advanced features like real-time tracking, in-app chat, and integrated payment processing. The platform aims to streamline healthcare staffing and NEMT services with a focus on reliability, efficiency, and patient care.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Technologies
-   **Frontend**: React 18 with TypeScript, Wouter for routing, TanStack React Query for state, Tailwind CSS with shadcn/ui for styling, Vite for building.
-   **Backend**: Node.js with Express, TypeScript (ESM), RESTful JSON API.
-   **Database**: PostgreSQL with Drizzle ORM.
-   **Monorepo Structure**: Client, server, and shared code (schema, types) in a single repository.

### Key Features
-   **Healthcare Staffing**: Interactive job map using Leaflet.js, job posting (requires authentication) and real-time updates via WebSocket. Unauthenticated users are redirected to app.carehubapp.com to sign in before posting.
    -   **User Roles**: Users pick their role at registration: employer, healthcare_worker, patient, or driver. All roles can post jobs once authenticated.
-   **Issue Reporting**: Support ticket system with file attachments and email notifications.
-   **Medical Ride-Hailing (NEMT)**:
    -   **Marketplace Model**: Patients post requests to a driver pool, drivers claim jobs.
    -   **Ride Workflow**: Supports statuses from `Requested` to `Completed`, with navigation integration (Google Maps, Waze, Apple Maps).
    -   **Real-time**: WebSocket-based updates, notifications, and in-app chat between drivers and patients.
    -   **Fare Calculation**: Distance-based pricing with configurable base fare and per-mile rates.
    -   **Safety**: Trip sharing, SOS button, verification codes, driver info display, ETA tracking.
    -   **Policy Handling**: 15-minute free cancellation window, capped surge pricing (1.25x for self-pay, none for insurance rides), tiered patient accounts based on balance, traffic delay reporting.
    -   **Patient Email Notifications**: When a ride is booked on behalf of a patient (bookedByOther=true), an email is sent to the patient's email address notifying them of the ride details. Uses SendGrid.
    -   **Distance Warning**: If the user's device is more than 50 miles from the selected pickup location, an amber warning banner is displayed suggesting they double-check the address or toggle "booking for someone else."
    -   **Medical Notes**: Special instructions for driver (e.g., "Patient is hard of hearing", "Oxygen equipment") stored per-ride and displayed prominently on driver dashboard.
    -   **Round Trip**: Toggle for round-trip rides with return pickup time and wait time inputs; shown on driver dashboard and tracking page.
    -   **Recurring Rides**: Schedule rides as daily, weekly, biweekly, or monthly with specific days of week and end date; stored as JSONB on ride.
    -   **Ride History**: `/my-rides` page showing past rides with status, fare, dates, and action buttons (View Receipt, Book Again, Rate).
    -   **Post-Ride Rating**: Star rating (1-5) with optional comment after ride completion; updates driver average rating; shown on tracking page and ride history.
    -   **Live Tracking Map**: Embedded Leaflet map on tracking page showing pickup (green), dropoff (red), and driver (blue car) markers with route lines and ETA countdown.
    -   **Enhanced Driver Card**: Uber-style driver info display with large avatar, vehicle details, license plate, verification code, and integrated call/message buttons.
    -   **Surge Zone Map**: Driver dashboard shows color-coded demand zones on map (red=very high, orange=high, yellow=moderate). Surge banner displays when multiplier >1x. Route lines connect pickup/dropoff markers on map. `GET /api/surge/zones` returns clustered demand zones with multiplier, label, and radius.
    -   **Ride Request Direction**: Each ride card shows trip direction (compass heading N/NE/E/etc.), distance, per-mile rate, and surge indicator. Direction arrow rotates to show trip heading.
-   **Driver Management**:
    -   **Onboarding**: Self-service application, admin review, KYC verification (document upload, admin dashboard).
    -   **Earnings**: Dashboard displaying net pay, tips, and 1099-NEC generation for tax purposes.
    -   **Weekly Earnings Summary**: Bar chart on earnings page showing last 5 weeks of earnings and tips (Recharts).
    -   **Trip History**: Per-trip fare breakdown page (`/driver/trip-history`) showing base fare, distance fee, tolls, tip, platform fee, and driver net for each completed ride.
    -   **Driver Stats**: Dashboard card showing average rating (stars), acceptance rate %, cancellation rate %, and background check status badge.
    -   **Document Expiration Alerts**: Red/amber banners on driver dashboard for expired or soon-to-expire documents (license, insurance, vehicle inspection).
    -   **Vehicle Inspection Tracking**: Inspection date and expiry fields on KYC form, checked in document alerts.
    -   **Background Check Status**: Admin-manageable status (not_started, pending, passed, failed) via dropdown on admin-drivers page; displayed on driver dashboard.
    -   **Independent Contractor**: Agreement logging, tax info collection, and deduction reminders.
    -   **Uber-style Payouts**: Stripe Connect integration for driver bank account linking, instant payouts (1.5% fee), standard payouts (free, 1-2 business days), payout history tracking, and configurable payout preferences (manual, daily, weekly).
-   **Payment System**:
    -   Stripe integration for upfront payments (self-pay rides) and tip collection.
    -   Supports full or partial refunds via admin endpoint.
    -   Insurance billing support without upfront payment.
-   **Native Mobile App UI**:
    -   Platform detection hook (`usePlatform`) for iOS, Android, and standalone mode.
    -   Bottom tab bar navigation (Home, Book Ride, Jobs, Report, Account) on mobile.
    -   Compact mobile header with centered title and iOS-style back navigation on sub-pages.
    -   Native-style quick action tiles with gradient cards (2x2 grid on mobile).
    -   Safe area inset support (`viewport-fit=cover`, `env(safe-area-inset-*)`) for iOS notch/home indicator.
    -   Touch-optimized interactions (44px min tap targets, touch feedback animations, no tap highlights).
    -   Auto-hiding footer on mobile (replaced by bottom tab bar).
    -   Mobile app shell (`MobileAppShell`) wraps all routes with bottom padding and tab bar.
    -   PWA-enhanced manifest with standalone display override.
-   **Mobile App Integration (v2.0 API)**:
    -   JWT token-based authentication for native iOS/Android apps (including Flutter app `com.fieldhcp.app`).
    -   Access tokens (15min) and refresh tokens (7 days) with rotation.
    -   CORS configured for Capacitor, Ionic, custom app schemes, and Flutter native apps (no-origin requests allowed for `/api/mobile/*`).
    -   Comprehensive mobile API covering: auth (register/login/refresh), jobs (list/search/create), rides (book/accept/complete/cancel/rate/chat), driver management (profile/availability/location/earnings/payouts/apply), patient profiles, surge pricing, incidents, and Stripe payments.
    -   Firebase push notification registration endpoint for FCM/APNs tokens.
    -   API documentation available at `/api/mobile/docs` (v2.0).
    -   Flutter integration guide at `FLUTTER_INTEGRATION.md`.

### Legal Protection and Compliance
-   **Terms of Service**: TOS page at `/terms`, Privacy Policy at `/privacy`. TOS acceptance required at driver registration (`tosAcceptedAt`, `tosVersion` on users table). Existing users can accept via `POST /api/auth/accept-tos`.
-   **Independent Contractor Agreement**: Digital signature page at `/driver/ic-agreement`. Server-side canonical agreement text (v1.0) with SHA-256 content hash. Signer name, IP, user agent stored in `legal_agreements` table. Driver dashboard shows amber banner if IC agreement not signed.
-   **Audit Logging**: `audit_logs` table tracks sensitive actions (ride acceptance, PHI access, background check updates, payout requests, IC agreement signing, admin ride views). Admin endpoint `GET /api/admin/audit-logs` with filtering.
-   **Driver Compliance Enforcement**: `checkDriverCompliance()` blocks ride acceptance and availability toggle for drivers with expired license/insurance/inspection or failed background checks. `getAvailableDrivers()` filters non-compliant drivers from ride pool. Red compliance banner on driver dashboard.

### Security and Data Protection
-   **Session Security**: PostgreSQL-backed sessions, HttpOnly and SameSite=strict cookies, session regeneration on login to prevent session fixation.
-   **Authentication**: Rate limiting for login attempts (5 attempts per 15 min, 30 min block), token-based authentication for WebSockets.
-   **Password Security**: bcrypt hashing with strong password requirements (uppercase, lowercase, number, special character).
-   **Input Validation**: Zod schemas for all API inputs.
-   **Security Headers**: X-Frame-Options (DENY), X-XSS-Protection, X-Content-Type-Options (nosniff), Content-Security-Policy, HSTS (production), Referrer-Policy, Permissions-Policy.
-   **Global Rate Limiting**: 100 requests per minute per IP to prevent DoS attacks.
-   **File Upload Security**: 10MB size limit, restricted MIME types (PNG, JPG, PDF only).
-   **CORS**: Strict allowlist for session-based endpoints, configured for Capacitor/Ionic mobile apps.
-   **WebSocket Security**: Single-use authentication tokens required for ride updates and chat connections.

## Mobile App Store Preparation

**Current Version: 1.1.0 (Build 2) - January 2026**

The application is configured for iOS App Store and Google Play submission:

-   **Build Guide**: `MOBILE_BUILD_GUIDE.md` - Complete step-by-step instructions
-   **Store Metadata**: `app-store-assets/store-metadata.json` - App descriptions, keywords, screenshots specs
-   **Capacitor Config**: `capacitor.config.ts` - Native app settings for iOS and Android

### Version 1.1.0 Changes
- New mobile-optimized quick action tiles (Book Ride, Driver Portal)
- Enhanced mobile UI with vibrant gradient styling
- Production domain support (carehubapp.com, carehubapp.replit.app)
- Updated CORS and CSP security headers
- Improved mobile responsiveness

### Quick Build Steps
1. Build web assets: `npm run build`
2. Add platforms: `npx cap add ios` and `npx cap add android`
3. Sync assets: `npx cap sync`
4. Open in IDE: `npx cap open ios` or `npx cap open android`
5. Build and sign for release

### Pre-Submission Checklist
- [ ] Run `npm run build` to create production assets
- [ ] Run `npx cap sync` to update native projects
- [ ] Update version in Xcode (iOS) and build.gradle (Android)
- [ ] Test on real devices before submission
- [ ] Capture new screenshots showing mobile tiles
- [ ] Update "What's New" in app stores

## External Dependencies

-   **Database**: PostgreSQL, Drizzle Kit (for migrations).
-   **Mapping**: Leaflet.js, Google Places Autocomplete.
-   **UI/UX**: Radix UI primitives, Tailwind CSS, Class Variance Authority, Lucide React, react-icons.
-   **Form Handling**: React Hook Form with Zod resolver.
-   **Date Manipulation**: date-fns.
-   **Payment Gateway**: Stripe (via Replit connector).
-   **Email**: SendGrid.
-   **Development Tools**: TypeScript, Vite, PostCSS, esbuild.