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
- `rides` - Medical transportation ride requests with extended fields:
  - Patient info, pickup/dropoff locations, appointment time
  - Status, mobility needs, verification codes, ETA
  - Cancellation tracking (cancelledAt, cancelledBy, cancellationReason, cancellationFee)
  - Surge pricing (surgeMultiplier, baseFare)
  - Toll tracking (estimatedTolls, actualTolls)
  - Traffic (delayMinutes, trafficCondition)
  - Payment (paymentStatus, paymentAttempts, finalFare)
- `ride_events` - Ride status change history and audit trail
- `ride_messages` - In-app chat messages between drivers and patients
- `trip_shares` - Trip sharing records for emergency contacts
- `driver_profiles` - Driver information (name, phone, vehicle, accessibility capabilities, cancellationCount, completedRides, averageRating, totalRatings)
- `patient_profiles` - Patient information (name, contact, mobility needs, emergency contact)
- `surge_pricing` - Time-based surge pricing configuration
- `patient_accounts` - Patient billing status and outstanding balances
- `ride_ratings` - Driver and patient ratings for completed rides
- `cancellation_policies` - Configurable cancellation fee policies
- `toll_zones` - Geographic toll tracking zones

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

### Medical Ride-Hailing (NEMT) - Marketplace Model
- **Ride Pool Marketplace**: Patients post ride requests to a public pool where drivers can browse and claim jobs
- Patient ride booking with interactive pickup/dropoff map selection
- Mobility needs tracking (wheelchair, stretcher, walker, oxygen)
- Driver dashboard with stats cards: Rides in Pool, Active Rides, Completed, Total Earnings
- Real-time notifications: Sound alerts and toast notifications when new rides are posted
- NEW badge highlighting for recently posted rides (30-second window)
- Ride status workflow: Requested (in pool) → Accepted (claimed) → En Route → Arrived → In Progress → Completed
- Real-time status updates via WebSocket
- Ride history and event tracking
- Distance-based fare calculation: $20 base + $2.50/mile, $22 minimum (industry-standard NEMT pricing)
- Google Places Autocomplete for address entry (requires VITE_GOOGLE_MAPS_API_KEY)
- Insurance billing support: Self-pay or insurance payment options with provider, member ID, group number, and prior auth tracking
- Trip receipts for insurance reimbursement: Patients can view and print receipts at `/receipt/:id`

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

### Payment System (Deferred)
- **Current Status**: Payment integration not yet configured (user dismissed Stripe setup)
- **Workflow**: Patients post rides for free → Drivers claim from pool → Fare calculated on completion
- **Fare Structure**: $20 base + $2.50/mile, $22 minimum
- **Future Integration**: Stripe payment processing can be added when ready
- **Note**: To enable payments, user needs to complete Stripe integration setup

### Healthcare-Friendly Operational Policies

#### Cancellation Policy
- **15-minute free cancellation window** for all rides
- **$3 fee** if no driver assigned and past free window
- **$5 maximum fee** if driver assigned (vs Uber's $10)
- **Fee exemptions for**: Medical emergencies, insurance rides, facility cancellations, driver cancellations
- Driver cancellations don't charge patients - drivers tracked separately

#### Surge Pricing (Capped for Healthcare)
- **Self-pay rides**: Maximum 1.25x surge (vs Uber's 3-5x)
- **Insurance rides**: No surge pricing (flat rates required)
- Demand-based calculations: ratio of rides to available drivers
- Time-based scheduled surge from database configuration

#### Tiered Patient Account System
- **Green ($0-$25)**: Full access, no restrictions
- **Yellow ($25-$75)**: Warning shown, full access
- **Orange ($75-$150)**: Requires acknowledgment, can still book
- **Red ($150+)**: Blocked unless emergency booking
- Emergency override allows urgent medical transport even for blocked accounts
- Payment plan available for balances over $50

#### Traffic Delay Handling
- Drivers can report delays with reason and updated ETA
- Patients notified of delays via push notifications
- Delay history tracked in ride events for accountability

#### Ride Completion & Ratings
- Final fare calculated with actual distance and tolls
- Both drivers and patients can rate completed rides
- Driver average rating updated after each patient rating
- Completion stats tracked for driver reliability

### In-App Chat
- Real-time messaging between drivers and patients during active rides
- WebSocket-based communication for instant message delivery
- Quick message templates for drivers ("I've arrived", "On my way", etc.)
- Chat available only during active ride statuses (accepted → in_progress)
- Message history stored in database for audit purposes

### Safety Features (Uber-Inspired)
- **Trip Sharing**: Patients can share live trip status with emergency contacts via unique share codes
- **SOS Button**: One-tap emergency 911 calling for immediate assistance
- **Driver Information Display**: Patient sees driver photo, name, vehicle info, and ratings
- **Verification Code**: Unique 4-digit code shown to patient before boarding for driver verification
- **ETA Tracking**: Real-time estimated arrival times updated by drivers
- **Trip Tracking Page**: Dedicated `/track/:id` page for patients to monitor ride progress

### Routes
- `/` - Landing page with job map, services, and issue reporting
- `/book-ride` - Patient ride booking form with map
- `/track/:id` - Ride tracking page with driver info, chat, and safety features
- `/receipt/:id` - Trip receipt for insurance reimbursement
- `/driver` - Driver dashboard for ride management (KYC-verified drivers only)
- `/driver/apply` - Driver application form for new drivers
- `/driver/kyc` - KYC verification page for document upload
- `/admin/drivers` - Admin dashboard for managing driver applications and KYC verification