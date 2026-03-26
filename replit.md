# Carehub - Healthcare Staffing Platform

## Overview
Carehub is a comprehensive platform designed to streamline healthcare staffing and Non-Emergency Medical Transportation (NEMT) services. It features a landing page and job management system that connects healthcare facilities with qualified medical professionals. Additionally, it incorporates a robust NEMT marketplace where patients can book rides and drivers can manage requests, complete with real-time tracking, in-app communication, and integrated payment processing. The platform aims to enhance efficiency, reliability, and patient care in both healthcare staffing and medical transportation.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Technologies
The platform is built as a monorepo, separating client, server, and shared code.
-   **Frontend**: React 18 with TypeScript, Wouter for routing, TanStack React Query for state management, Tailwind CSS with shadcn/ui for UI components, and Vite for efficient builds.
-   **Backend**: Node.js with Express, TypeScript (ESM), providing a RESTful JSON API.
-   **Database**: PostgreSQL, managed with Drizzle ORM.

### Key Features
-   **Healthcare Staffing**: Features an interactive job map (Leaflet.js) for job postings and real-time updates via WebSockets. User roles include employer, healthcare worker, patient, and driver, all capable of posting jobs post-authentication.
-   **Issue Reporting**: A support ticket system with file attachment capabilities and email notifications.
-   **Medical Ride-Hailing (NEMT)**: Operates on a marketplace model allowing patients to post requests for drivers to claim. Includes a comprehensive ride workflow with various statuses, real-time updates, in-app chat, and navigation integration. Advanced features include wait time tracking with charges, vehicle type matching, distance-based fare calculation, and safety features like trip sharing and an SOS button. The system also manages policies such as cancellation windows, surge pricing, and provides patient email notifications for booked rides. Supports medical notes for drivers, round trips, recurring rides, ride history, and post-ride ratings. Drivers benefit from a live tracking map, an enhanced driver card, and a surge zone map indicating demand.
-   **Toll Zone Estimation**: 25 major US toll zones seeded on startup (bridges, tunnels, turnpikes). Route-based toll estimation via `POST /api/toll-zones/estimate` checks which toll zones fall along the straight-line route. Estimated tolls are shown in fare breakdowns during booking (book-ride, caregiver-book-ride, facility-book-ride) and saved with each ride. Drivers confirm actual tolls at trip completion. Tolls appear in trip history and tax documents as deductible expenses.
-   **Caregiver/Family Portal**: A dedicated portal for managing rides for loved ones, including adding/editing patient profiles, quick ride booking for managed patients, and summary statistics.
-   **Facility Discharge Coordination**: A portal for hospital and clinic staff to book patient transport, with preset transport options and integration with facility-specific addresses.
-   **Driver Management**: Encompasses self-service onboarding, admin review with KYC verification, earnings dashboards (including weekly summaries and trip history), driver statistics, and alerts for expiring documents. Compliance enforcement blocks non-compliant drivers from accepting rides.
-   **Payment System**: Utilizes Stripe for upfront payments, tip collection, and supports insurance billing. Integrates Stripe Connect for driver payouts, offering instant and standard payout options.
-   **Native Mobile App UI**: Designed for iOS and Android with a platform detection hook, bottom tab bar navigation, compact headers, quick action tiles, and safe area inset support. The mobile experience is touch-optimized and PWA-enhanced.
-   **Mobile App Integration**: Provides a JWT token-based API (v2.0) for native apps, covering authentication, job/ride management, driver features, patient profiles, surge pricing, and payments. Includes Firebase push notification integration. All mobile API responses use an Uber-style envelope format `{ status, data, meta: { timestamp, version } }` with structured error codes. Push notifications are rich and context-aware, including driver info, vehicle details, ETA, fare, and actionable buttons (Track, Contact, Rate, Receipt).
-   **Legal Protection and Compliance**: Implements Terms of Service and Privacy Policy pages, requires digital signing of an Independent Contractor Agreement with server-side content hashing, and includes an audit logging system for sensitive actions. Driver compliance is enforced based on license, insurance, inspection, and background check statuses.
-   **Security and Data Protection**: Features PostgreSQL-backed session security, rate limiting for authentication, bcrypt password hashing, Zod schema validation for API inputs, comprehensive security headers, global rate limiting, and secure file uploads with MIME type restrictions. WebSocket connections are secured with single-use authentication tokens.
-   **Web Authentication**: A single unified `/login` page for all user types (admin, driver, patient). Login credentials determine the destination: admins go to `/admin`, drivers to `/driver`, patients to `/`. The `/driver/login` route also points to this same unified page. Includes a multi-step forgot password flow at `/forgot-password` with 5-digit email codes via SendGrid. The Header shows "Sign In" for unauthenticated users and role-appropriate account links when logged in. All protected routes redirect to `/login` when not authenticated.

## External Dependencies

-   **Database**: PostgreSQL
-   **Mapping**: Leaflet.js, Google Places Autocomplete
-   **UI/UX Libraries**: Radix UI, Tailwind CSS, Class Variance Authority, Lucide React, react-icons
-   **Form Management**: React Hook Form, Zod
-   **Date Utilities**: date-fns
-   **Payment Processing**: Stripe
-   **Email Services**: SendGrid
-   **Development Tooling**: TypeScript, Vite, PostCSS, esbuild