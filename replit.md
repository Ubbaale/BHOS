# Carehub - Healthcare Staffing Platform

## Overview
Carehub is a comprehensive platform designed to streamline healthcare staffing, Non-Emergency Medical Transportation (NEMT), and IT services dispatch. It connects healthcare facilities with medical professionals, provides a robust NEMT marketplace for patients and drivers with real-time tracking and integrated payments, and offers a FieldNation-style system for healthcare IT dispatch. The platform aims to enhance efficiency, reliability, and patient care across these critical healthcare domains, while also providing a marketplace for medical courier services.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Technologies
The platform is built as a monorepo.
-   **Frontend**: React 18 with TypeScript, Wouter for routing, TanStack React Query for state management, Tailwind CSS with shadcn/ui, and Vite.
-   **Backend**: Node.js with Express, TypeScript (ESM), providing a RESTful JSON API.
-   **Database**: PostgreSQL, managed with Drizzle ORM.

### Key Features
-   **Healthcare Staffing**: Job management system with an interactive map for postings and real-time updates. Supports employer and healthcare worker roles.
-   **Medical Ride-Hailing (NEMT)**: Marketplace for patients to book rides and drivers to claim. Features include real-time updates, in-app chat, navigation, wait time tracking, distance-based fare calculation, safety features (trip sharing, SOS), and policy management (cancellations, surge pricing). Includes toll zone estimation.
-   **Caregiver/Family Portal**: Manages rides for loved ones with patient profiles and quick booking.
-   **Facility Discharge Coordination**: For hospital staff to book patient transport.
-   **Driver Management**: Self-service onboarding with KYC, earnings dashboards, and compliance enforcement.
-   **Payment System**: Stripe for upfront payments, tips, and driver payouts (instant/standard).
-   **Mobile App Integration**: Native mobile UI (iOS/Android) with JWT API (v2.0) for authentication, job/ride management, push notifications (Firebase), and an Uber-style API response envelope.
-   **Legal & Compliance**: Terms of Service, Privacy Policy, digital signing of Independent Contractor Agreements with content hashing, and audit logging. Driver compliance checks.
-   **Security**: PostgreSQL-backed sessions, rate limiting, bcrypt hashing, Zod validation, security headers, global rate limiting, secure file uploads, and WebSocket authentication.
-   **IT Services Dispatch & Ticketing**: FieldNation-style system for healthcare IT. Users submit tickets with dispatch details, categories, and tracking (ETA, check-in/out with GPS). Features include deliverables, two-way ratings, work order templates, talent pools, and routing modes.
-   **IT Services Payment System**: Escrow-based payment with tiered platform fees via Stripe. Budget caps and overtime rate management.
-   **IT Tech Onboarding & Dispatch**: Tech application process with admin approval. Dashboard for available, active, and completed jobs, earnings, and settings (IC Agreement, W-9, certifications). Includes a complaint and enforcement system for techs, and dispute mediation. On-screen customer signature capture for work order completion.
-   **Document Upload System**: General-purpose document upload for all user roles (drivers, IT techs, etc.). Supports signed agreements, W-9 forms, certifications, insurance docs, and more. Admin review workflow with approve/reject statuses. Files stored locally in `uploads/documents/`.
-   **On-Screen Signature Capture**: Canvas-based signature pad (touch + mouse) for IT service work orders. Techs capture customer signatures on-site via phone. Signatures saved as PNG images in `uploads/signatures/` and linked to IT tickets (`customerSignatureUrl`, `customerSignedName`, `customerSignedAt`).
-   **Medical Courier Delivery System**: Marketplace for medical courier companies to dispatch delivery jobs. Drivers can accept jobs for various package types with specific requirements (temperature, priority, signature). Enforces mutual exclusivity with NEMT rides for drivers. Features auto-calculated fares (base + mileage + priority/temp/weight surcharges + peak hour multiplier), HIPAA-compliant chain of custody logging (immutable SHA-256 hashed events with GPS, temperature readings, signatures, photos), and push notifications to drivers on new deliveries.
-   **Admin Dashboard**: Comprehensive panel with sidebar navigation and custom permission management. Allows full ride/driver detail view, earnings breakdown, user account management (creation, roles, verification, blocking), ride cancellation/refunds, and complaint/enforcement management for both drivers and IT techs.
-   **Web Authentication**: Unified `/login` page for all user types with smart mobile detection and role-based redirects. Multi-step forgot password flow.

### Flutter App Integration (flutter_screens/)
Reference Flutter/Dart screens for the native mobile app (iOS: id6444679914, Google Play: com.fieldhcp.app).
-   **Services**: `auth_service.dart`, `ride_service.dart`, `driver_service.dart`, `job_service.dart`, `it_api_service.dart`, `courier_api_service.dart`, `push_notification_service.dart`
-   **Screens**: Patient home, Driver dashboard, IT Tech dashboard (with GPS location tracking + signature capture), IT Company ticket management, Courier dashboard (pool/active/history + chain of custody logging)
-   **Widgets**: `signature_pad.dart` (canvas-based signature capture), `eta_controls.dart`, `deliverables_form.dart`, `rating_dialog.dart`, `ticket_card.dart`, `ride_card.dart`, `chat_bubble.dart`, `fare_breakdown_widget.dart`, `account_status_banner.dart`
-   **Models**: `auth_models.dart`, `it_models.dart`, `courier_models.dart`
-   **Key Features**: Location tracking pings every 2min during checked-in IT jobs, real-time GPS for check-in, customer signature capture before job completion, courier delivery chain of custody with GPS/temperature logging

## External Dependencies

-   **Database**: PostgreSQL
-   **Mapping**: Leaflet.js, Google Places Autocomplete
-   **UI/UX Libraries**: Radix UI, Tailwind CSS, Class Variance Authority, Lucide React, react-icons
-   **Form Management**: React Hook Form, Zod
-   **Date Utilities**: date-fns
-   **Payment Processing**: Stripe
-   **Email Services**: SendGrid
-   **Development Tooling**: TypeScript, Vite, PostCSS, esbuild