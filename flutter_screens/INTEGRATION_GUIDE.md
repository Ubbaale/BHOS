# CareHub IT Services - Flutter Integration Guide

## File Structure

```
flutter_screens/
├── models/
│   └── it_models.dart              # All data models (Ticket, TechProfile, Complaint, etc.)
├── services/
│   └── it_api_service.dart         # API service with all backend endpoints
├── screens/
│   ├── tech/
│   │   ├── tech_dashboard_screen.dart      # Main tech dashboard with 5 tabs
│   │   ├── tech_ticket_detail_screen.dart  # Ticket detail with ETA, check-in/out, deliverables
│   │   ├── tech_earnings_screen.dart       # Earnings, payment history, 1099 tax forms
│   │   ├── tech_settings_screen.dart       # IC agreement, W-9 tax info, certifications
│   │   └── tech_apply_screen.dart          # Public tech application form
│   └── company/
│       ├── company_ticket_list_screen.dart  # Ticket list with filters and stats
│       ├── company_ticket_detail_screen.dart # Detail view with approve, rate, report, mediate
│       ├── create_ticket_screen.dart        # Create new service ticket form
│       └── report_tech_screen.dart          # File complaint against a tech
├── widgets/
│   ├── ticket_card.dart            # Reusable ticket card with status, priority, ETA
│   ├── account_status_banner.dart  # On-hold/suspended/banned warning banner
│   ├── eta_controls.dart           # En Route / Arriving / On Site buttons
│   ├── deliverables_form.dart      # Proof of work submission form
│   └── rating_dialog.dart          # Star rating dialog
└── INTEGRATION_GUIDE.md
```

## Required Dependencies (pubspec.yaml)

```yaml
dependencies:
  http: ^1.2.0
  file_picker: ^8.0.0
```

## Setup

### 1. Initialize the API Service

```dart
final apiService = ItApiService(
  baseUrl: 'https://your-carehub-domain.com',  // Your backend URL
  getAuthToken: () => myAuthProvider.jwtToken,   // Your JWT token getter
);
```

### 2. Tech Dashboard (for approved IT technicians)

```dart
Navigator.push(context, MaterialPageRoute(
  builder: (_) => TechDashboardScreen(apiService: apiService),
));
```

### 3. Company Ticket Management (for IT companies)

```dart
Navigator.push(context, MaterialPageRoute(
  builder: (_) => CompanyTicketListScreen(apiService: apiService),
));
```

### 4. Tech Application (public, no auth required)

```dart
Navigator.push(context, MaterialPageRoute(
  builder: (_) => TechApplyScreen(baseUrl: 'https://your-carehub-domain.com'),
));
```

## API Endpoints Used

### Tech Endpoints
| Method | Endpoint | Screen |
|--------|----------|--------|
| GET | `/api/it/tech/available-tickets` | Dashboard - Available tab |
| GET | `/api/it/tech/my-jobs` | Dashboard - Active/Completed tabs |
| GET | `/api/it/tech/account-status` | Dashboard - Status banner |
| GET | `/api/it/tech/earnings` | Earnings tab |
| GET | `/api/it/tech/payment-history` | Earnings - Payment history |
| GET | `/api/it/tech/tax-years` | Earnings - Tax documents |
| GET | `/api/it/tech/1099/:year` | Earnings - 1099 download |
| GET | `/api/it/tech/contractor-status` | Settings tab |
| POST | `/api/it/tech/sign-ic-agreement` | Settings - IC Agreement |
| POST | `/api/it/tech/contractor-onboarding` | Settings - W-9 tax info |
| POST | `/api/it/tech/certifications/upload` | Settings - Cert uploads |
| DELETE | `/api/it/tech/certifications/:id` | Settings - Delete cert |
| POST | `/api/it/tech/accept-ticket/:id` | Accept available ticket |
| PATCH | `/api/it/tech/eta/:id` | ETA status update |
| POST | `/api/it/tech/checkin/:id` | GPS check-in |
| POST | `/api/it/tech/checkout/:id` | Check-out |
| POST | `/api/it/tech/deliverables/:id` | Submit proof of work |
| POST | `/api/it/tech/complete-ticket/:id` | Mark job complete |
| POST | `/api/it/tech/rate-customer/:id` | Rate the customer |
| POST | `/api/it/tech/report-delay/:id` | Report delay |
| POST | `/api/it/tech/mileage/:id` | Record travel mileage |
| POST | `/api/it/tech/apply` | Apply as new tech |

### Company Endpoints
| Method | Endpoint | Screen |
|--------|----------|--------|
| GET | `/api/it/tickets` | Ticket list |
| GET | `/api/it/tickets/:id` | Ticket detail |
| POST | `/api/it/tickets` | Create ticket |
| POST | `/api/it/tickets/:id/rate` | Rate technician |
| POST | `/api/it/tickets/:id/approve` | Approve completed work |
| POST | `/api/it/tickets/:id/cancel` | Cancel ticket |
| POST | `/api/it/tickets/:id/fund-escrow` | Fund escrow payment |
| POST | `/api/it/tickets/:id/request-mediation` | Request dispute mediation |
| POST | `/api/it/tickets/:id/notes` | Add ticket note |
| POST | `/api/it/tech/:techUserId/report` | File complaint |

## Features Covered

### Tech Dashboard
- **Available Jobs** - Browse and accept open tickets filtered by routing/talent pool
- **Active Jobs** - Full lifecycle: ETA tracking → Check-in → Deliverables → Check-out → Complete
- **Completed Jobs** - History with customer ratings
- **Earnings** - Total earnings, performance stats, payment history, 1099-NEC tax forms
- **Settings** - IC Agreement signing, W-9/SSN tax info, certification uploads

### Company Portal
- **Ticket List** - Filter by status, view stats, create new tickets
- **Ticket Detail** - View tech progress, approve work, rate, cancel
- **Report Tech** - 8 complaint categories with formal filing
- **Dispute Mediation** - Request admin intervention
- **Escrow** - Fund upfront escrow for tickets

### Account Enforcement
- On-hold/suspended/banned banners shown automatically
- Blocked techs cannot accept tickets (enforced server-side)
- Complaint count tracking with auto-hold at 3 complaints
