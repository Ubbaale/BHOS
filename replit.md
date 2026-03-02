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
-   **Healthcare Staffing**: Interactive job map using Leaflet.js, job posting and real-time updates via WebSocket.
-   **Issue Reporting**: Support ticket system with file attachments and email notifications.
-   **Medical Ride-Hailing (NEMT)**:
    -   **Marketplace Model**: Patients post requests to a driver pool, drivers claim jobs.
    -   **Ride Workflow**: Supports statuses from `Requested` to `Completed`, with navigation integration (Google Maps, Waze, Apple Maps).
    -   **Real-time**: WebSocket-based updates, notifications, and in-app chat between drivers and patients.
    -   **Fare Calculation**: Distance-based pricing with configurable base fare and per-mile rates.
    -   **Safety**: Trip sharing, SOS button, verification codes, driver info display, ETA tracking.
    -   **Policy Handling**: 15-minute free cancellation window, capped surge pricing (1.25x for self-pay, none for insurance rides), tiered patient accounts based on balance, traffic delay reporting.
-   **Driver Management**:
    -   **Onboarding**: Self-service application, admin review, KYC verification (document upload, admin dashboard).
    -   **Earnings**: Dashboard displaying net pay, tips, and 1099-NEC generation for tax purposes.
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