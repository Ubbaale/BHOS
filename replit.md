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