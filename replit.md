# Behavioral Home Operating System (BHOS)

## Overview

The Behavioral Home Operating System (BHOS) is a full-stack, monorepo-based platform designed to manage behavioral health group homes. It aims to streamline operations for directors via a web application and empower staff through a mobile application. The project's vision is to provide a comprehensive, HIPAA-compliant solution for managing patients, staff, medications, billing, and compliance, ultimately improving care delivery and operational efficiency in behavioral health settings. Key capabilities include medication management with advanced safety features, robust workforce management, comprehensive billing and claims processing, and a strong focus on security and compliance.

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
- **Database**: PostgreSQL with Drizzle ORM.
- **Validation**: Zod for schema validation.
- **API Codegen**: Orval from OpenAPI spec for generating API hooks and Zod schemas.
- **State Management**: @tanstack/react-query for both web and mobile.
- **Build Tools**: esbuild for the API server and Vite for the web frontend.
- **Authentication**: Clerk for integrated authentication across web and mobile, supporting various user roles and robust session management.
- **Security & Compliance**: HIPAA-compliant module with geofencing, PHI audit logging, active session management, IP whitelisting, device security checks, biometric authentication, auto-lock, med-pass PIN re-verification, inactivity lock screen, quick lock & switch user, Duo-style push approval for medication access, and bulk session revocation.
- **Medication Safety**: Electronic Medication Administration Record (eMAR) with 5 Rights verification, controlled substance tracking, inventory, drug-drug interaction checks, automatic error detection, error reporting, and medication reconciliation. Supports barcode scanning via phone camera and USB/handheld scanner.
- **Workforce Management**: Shift management, configurable onboarding checklists, and attendance tracking with geofencing and fraud detection.
- **Family Portal**: Access to patient information, daily summaries, care messaging, and consent document management for family members.
- **Predictive Analytics**: Tracks behavior trends and uses a risk scoring engine for Incident Escalation, Medication Non-Adherence, and Behavioral Decline, with actionable clinical recommendations.
- **Staff Messaging**: Internal chat system with urgency levels and broadcast capabilities.
- **Medical Appointments**: Comprehensive appointment tracking, scheduling, and management.
- **Daily Assignments**: Shift-based staff-to-patient assignment with auto-assign and manual assignment options.
- **Transportation & Fleet Management**: Vehicle fleet registry, driver management, ride request management, and dispatch workflows.
- **Global Search**: Command palette (⌘K) search across patients, staff, medications, incidents, and homes.
- **Homes Map View**: Leaflet/OpenStreetMap map showing group home locations with color-coded pins and occupancy stats.
- **Camera Management**: Security camera registry across all homes with status monitoring, specs tracking, recording configuration, retention policies, stream/dashboard URL links, and event logging.
- **Support Ticket System**: Organizations can submit and manage support tickets with categories, priority levels, and threaded message conversations.
- **Super Admin Panel**: Platform-owner dashboard for managing all enrolled organizations, including platform-wide stats, organization browsing, cross-org ticket management, and platform-wide backup management.
- **Multi-Tenant Backup System**: Per-organization data export system allowing users to create full backups of their data. Platform admins can trigger backups for any org and perform platform-wide backups.
- **App Store Deployment**: Mobile app fully configured for iOS App Store and Google Play Store submission with EAS Build profiles and store listing metadata.
- **Push Notifications**: Expo push notification infrastructure for targeted and broadcast alerts.
- **Organization & Subscription**: Multi-tenant organization management with per-home billing and subscription lifecycle management.
- **Free Trial System**: 14-day free trial with comprehensive sample data seeding.
- **Census & Bed Board**: Real-time bed tracking, occupancy rates, and visual bed board view.
- **Admissions & Intake CRM**: Kanban-style referral pipeline, intake assessments, and waitlist management.
- **Treatment Plans / ISP**: Individual Service Plans with goal tracking, interventions, and clinician signatures.
- **Progress Notes**: Multi-format clinical documentation with signing and co-signing workflows.
- **Discharge Planning**: Comprehensive discharge plans, aftercare planning, and follow-up scheduling.
- **Device-Bound Enrollment**: Staff mobile devices must be registered and admin-approved.
- **Crisis Management**: Full crisis lifecycle management with crisis plans, event tracking, and debriefings.
- **Training & Certification Tracking**: Staff training compliance management, including course tracking and certification renewals.
- **State Compliance & Inspector Portal**: Regulatory readiness scorecard, state inspector management, inspection visit tracking, compliance report generation, full state audit trail, and a standalone read-only inspector portal.
- **Staff Enrollment Invitations**: Admin/manager-controlled enrollment with single-use codes for staff members.
- **Staff Role Management & Admin Transfer**: Admins can change staff roles and transfer admin ownership securely.
- **Billing & Claims**: Full revenue cycle management for claims, billable services, payment posting, and payer management.
- **Document Management**: Upload, organize, categorize, and e-sign documents with folder support, templates, and electronic signature workflow.
- **Individual Service Plans (ISP)**: Create and manage individualized service plans with hierarchical goals and objectives, and track progress.
- **Behavior Tracking (ABC)**: Antecedent-Behavior-Consequence data collection with defined behaviors, severity levels, and measurement types. Includes Behavior Intervention Plans (BIP) management.
- **Staff Credentials & Licenses**: Track staff certifications, licenses, and credentials with expiration alerts and a verification workflow.
- **Custom Forms Builder**: Create custom assessments, checklists, and documentation forms with JSON schema definitions, publish/draft workflow, and submission tracking.
- **State Agency Reporting**: Manage and submit required state reports with schedule tracking and due date management.
- **Care Coordination**: External provider directory, referral management, and communication logging for provider interactions.
- **Insurance Authorizations**: Track prior authorizations with unit utilization monitoring and alert thresholds.

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