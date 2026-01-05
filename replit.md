# Carehub - Healthcare Staffing Platform

## Overview

Carehub is a healthcare staffing agency landing page and job management platform. It connects healthcare facilities with qualified nurses, CNAs, and medical professionals for 24/7 staffing needs. The application features an interactive job map, issue reporting system, and facility/worker matching capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Build Tool**: Vite with path aliases (@/ for client/src, @shared/ for shared)

The frontend follows a component-based architecture with:
- Page components in `client/src/pages/`
- Reusable UI components in `client/src/components/ui/` (shadcn/ui)
- Feature components in `client/src/components/` (Header, Hero, JobMap, etc.)
- Interactive map using Leaflet.js for job location visualization

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API under `/api/` prefix
- **Development**: Hot module replacement via Vite middleware

The server uses a storage abstraction pattern (`IStorage` interface) allowing for database implementation swapping. Routes are registered in `server/routes.ts` with endpoints for jobs and tickets.

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Validation**: Zod schemas generated via drizzle-zod

Database tables:
- `users` - User authentication (id, username, password)
- `jobs` - Healthcare job listings (title, facility, location, lat/lng, pay, shift, urgency, requirements)
- `tickets` - Issue/support tickets (category, priority, description, email, status)
- `rides` - Medical transportation ride requests (patient info, pickup/dropoff locations, appointment time, status, mobility needs)
- `ride_events` - Ride status change history and audit trail
- `driver_profiles` - Driver information (name, phone, vehicle, accessibility capabilities)
- `patient_profiles` - Patient information (name, contact, mobility needs, emergency contact)

### Key Design Decisions

1. **Monorepo Structure**: Client, server, and shared code coexist with path aliases for clean imports. The shared folder contains database schema and types used by both frontend and backend.

2. **Component Library**: Uses shadcn/ui (Radix primitives + Tailwind) for consistent, accessible UI components. Components are copied into the project rather than installed as dependencies.

3. **API Client Pattern**: `apiRequest` helper in `client/src/lib/queryClient.ts` handles fetch requests with proper error handling and credentials.

4. **Build Process**: Custom build script bundles server with esbuild (allowlisting specific dependencies) and client with Vite.

## External Dependencies

### Database
- PostgreSQL (connection via `DATABASE_URL` environment variable)
- Drizzle Kit for migrations (`npm run db:push`)

### Frontend Libraries
- Leaflet.js for interactive maps
- React Hook Form with Zod resolver for form handling
- date-fns for date formatting
- Lucide React and react-icons for iconography

### UI Framework
- Radix UI primitives (dialog, popover, select, tabs, etc.)
- Tailwind CSS with custom design tokens
- Class Variance Authority for component variants

### Development Tools
- Replit-specific plugins (cartographer, dev-banner, runtime-error-modal)
- TypeScript with strict mode
- PostCSS with autoprefixer

## Features

### Job Map & Staffing
- Interactive nationwide map displaying healthcare job postings
- Green markers for local database jobs, blue markers for external FieldHCP API jobs
- Real-time job updates via WebSocket
- Job posting form for facilities

### Issue Reporting
- Support ticket system with file attachments
- Email notifications via SendGrid

### Medical Ride-Hailing (NEMT)
- Patient ride booking with interactive pickup/dropoff map selection
- Mobility needs tracking (wheelchair, stretcher, walker, oxygen)
- Driver dashboard for managing ride requests
- Ride status workflow: Requested → Accepted → En Route → Arrived → In Progress → Completed
- Real-time status updates via WebSocket
- Ride history and event tracking
- Distance-based fare calculation: $20 base + $2.50/mile, $22 minimum (industry-standard NEMT pricing)
- Google Places Autocomplete for address entry (requires VITE_GOOGLE_MAPS_API_KEY)
- Insurance billing support: Self-pay or insurance payment options with provider, member ID, group number, and prior auth tracking

### Driver Onboarding
- Self-service driver application form at `/driver/apply`
- Admin dashboard for reviewing applications at `/admin/drivers`
- Application status workflow: Pending → Approved/Rejected
- Driver dashboard only accessible for approved and KYC-verified drivers
- Rejection reason tracking for transparency

### KYC Verification
- Two-stage driver verification: (1) initial application approval, (2) KYC document verification
- Document upload for driver's license, vehicle registration, insurance, and profile photo
- KYC status workflow: Not Submitted → Pending Review → Approved/Rejected
- Admin KYC review dashboard with document viewing and approval/rejection
- Document storage in `/uploads/kyc` directory (max 10MB, PNG/JPG/PDF)
- Drivers must complete KYC verification before accepting rides

### Routes
- `/` - Landing page with job map, services, and issue reporting
- `/book-ride` - Patient ride booking form with map
- `/driver` - Driver dashboard for ride management (KYC-verified drivers only)
- `/driver/apply` - Driver application form for new drivers
- `/driver/kyc` - KYC verification page for document upload
- `/admin/drivers` - Admin dashboard for managing driver applications and KYC verification