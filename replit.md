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
-   **Payment System**:
    -   Stripe integration for upfront payments (self-pay rides) and tip collection.
    -   Supports full or partial refunds via admin endpoint.
    -   Insurance billing support without upfront payment.

### Security and Data Protection
-   **Session Security**: PostgreSQL-backed sessions, HttpOnly and SameSite=strict cookies.
-   **Authentication**: Rate limiting for login attempts, token-based authentication for WebSockets.
-   **Password Security**: bcrypt hashing.
-   **Input Validation**: Zod schemas for all API inputs.

## External Dependencies

-   **Database**: PostgreSQL, Drizzle Kit (for migrations).
-   **Mapping**: Leaflet.js, Google Places Autocomplete.
-   **UI/UX**: Radix UI primitives, Tailwind CSS, Class Variance Authority, Lucide React, react-icons.
-   **Form Handling**: React Hook Form with Zod resolver.
-   **Date Manipulation**: date-fns.
-   **Payment Gateway**: Stripe (via Replit connector).
-   **Email**: SendGrid.
-   **Development Tools**: TypeScript, Vite, PostCSS, esbuild.