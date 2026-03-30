# CareHub Flutter Mobile App - Integration Guide

## File Structure

```
flutter_screens/
├── app.dart                                # Main app entry point with routing
├── models/
│   ├── auth_models.dart                    # User, AuthTokens
│   ├── ride_models.dart                    # Ride, RideMessage, RideEvent, FareEstimate, SurgeZone
│   ├── driver_models.dart                  # DriverProfile, DriverEarnings, EarningsEntry
│   ├── job_models.dart                     # Job, ExternalJob
│   └── it_models.dart                      # ItServiceTicket, ItTechProfile, complaints, etc.
├── services/
│   ├── api_client.dart                     # Base HTTP client with JWT auth + token refresh
│   ├── auth_service.dart                   # Login, register, password reset, token mgmt
│   ├── ride_service.dart                   # Ride booking, tracking, chat, rating
│   ├── driver_service.dart                 # Driver profile, location, earnings, availability
│   ├── job_service.dart                    # Job listings, external jobs
│   ├── push_notification_service.dart      # FCM token registration
│   └── it_api_service.dart                 # IT Services (tech + company endpoints)
├── screens/
│   ├── auth/
│   │   ├── login_screen.dart               # Unified login (all roles)
│   │   ├── register_screen.dart            # Role-based registration
│   │   └── forgot_password_screen.dart     # 3-step password reset (email → code → new pw)
│   ├── patient/
│   │   ├── patient_home_screen.dart        # Patient home with quick actions + active rides
│   │   ├── book_ride_screen.dart           # Book NEMT ride (vehicle type, schedule, notes)
│   │   ├── ride_tracking_screen.dart       # Live tracking with status timeline + chat
│   │   ├── ride_history_screen.dart        # All rides with filters
│   │   └── ride_detail_screen.dart         # Full ride detail + fare breakdown + rating
│   ├── driver/
│   │   ├── driver_dashboard_screen.dart    # Driver home: online toggle, stats, active rides
│   │   ├── available_rides_screen.dart     # Browse + accept ride requests
│   │   ├── active_ride_screen.dart         # Full ride workflow: enroute → arrived → pickup → complete
│   │   ├── driver_earnings_screen.dart     # Earnings overview, weekly, trip history, monthly
│   │   └── driver_apply_screen.dart        # 3-step driver application form
│   ├── caregiver/
│   │   └── caregiver_portal_screen.dart    # Manage patients, book rides for loved ones
│   ├── jobs/
│   │   └── job_list_screen.dart            # Healthcare job listings + external jobs
│   ├── tech/
│   │   ├── tech_dashboard_screen.dart      # IT Tech: available/active/completed/earnings/settings
│   │   ├── tech_ticket_detail_screen.dart  # Ticket lifecycle: ETA, check-in/out, deliverables
│   │   ├── tech_earnings_screen.dart       # Tech earnings, payment history, 1099 tax forms
│   │   ├── tech_settings_screen.dart       # IC agreement, W-9, certifications
│   │   └── tech_apply_screen.dart          # Public tech application form
│   └── company/
│       ├── company_ticket_list_screen.dart  # Ticket list with filters + stats
│       ├── company_ticket_detail_screen.dart # Detail: approve, rate, report, mediate
│       ├── create_ticket_screen.dart        # Create new service ticket
│       └── report_tech_screen.dart          # File complaint against tech
├── widgets/
│   ├── ride_card.dart                      # Reusable ride card (patient + driver views)
│   ├── chat_bubble.dart                    # Chat message bubble (driver ↔ patient)
│   ├── fare_breakdown_widget.dart          # Fare display with line items
│   ├── ticket_card.dart                    # IT service ticket card
│   ├── account_status_banner.dart          # On-hold/suspended/banned warning
│   ├── eta_controls.dart                   # En Route / Arriving / On Site buttons
│   ├── deliverables_form.dart              # Proof of work submission
│   └── rating_dialog.dart                  # Star rating dialog
└── INTEGRATION_GUIDE.md
```

## Required Dependencies (pubspec.yaml)

```yaml
dependencies:
  http: ^1.2.0
  file_picker: ^8.0.0
  # Optional for push notifications:
  # firebase_messaging: ^15.0.0
  # firebase_core: ^3.0.0
```

## Setup

### 1. Initialize Services

```dart
import 'package:your_app/flutter_screens/app.dart';

void main() {
  runApp(const CareHubApp());
}
```

Or initialize services manually:

```dart
final apiClient = ApiClient(
  baseUrl: 'https://app.carehubapp.com',
  onTokenExpired: () => navigateToLogin(),
);
final authService = AuthService(client: apiClient);
final rideService = RideService(client: apiClient);
final driverService = DriverService(client: apiClient);
```

### 2. Login Flow

```dart
// Login returns JWT tokens + user info
final tokens = await authService.login('user@example.com', 'password');
// apiClient automatically stores tokens for subsequent requests
// Route based on user role:
switch (tokens.user.role) {
  case 'driver': // → DriverDashboardScreen
  case 'it_tech': // → TechDashboardScreen
  case 'it_company': // → CompanyTicketListScreen
  default: // → PatientHomeScreen (patient/user/admin)
}
```

### 3. Push Notifications

```dart
// After login, register FCM token:
final pushService = PushNotificationService(client: apiClient);
await pushService.registerToken(fcmToken, platform: 'android'); // or 'ios'
```

### 4. WebSocket Real-Time Updates

```dart
// Get a short-lived WS token:
final wsToken = await authService.getWsToken();
// Connect: wss://app.carehubapp.com/ws/rides?token=$wsToken
```

## API Endpoints Used

### Authentication
| Method | Endpoint | Screen |
|--------|----------|--------|
| POST | `/api/mobile/auth/login` | Login |
| POST | `/api/mobile/auth/register` | Register |
| POST | `/api/mobile/auth/refresh` | Token refresh (automatic) |
| POST | `/api/mobile/auth/logout` | Logout |
| GET | `/api/mobile/auth/me` | Get current user |
| GET | `/api/mobile/auth/ws-token` | WebSocket auth token |
| POST | `/api/auth/forgot-password` | Forgot password step 1 |
| POST | `/api/auth/verify-reset-code` | Forgot password step 2 |
| POST | `/api/auth/reset-password` | Forgot password step 3 |

### Patient / Ride Endpoints
| Method | Endpoint | Screen |
|--------|----------|--------|
| GET | `/api/mobile/rides` | Ride history |
| POST | `/api/mobile/rides` | Book a ride |
| GET | `/api/mobile/rides/:id` | Ride detail |
| POST | `/api/mobile/rides/:id/cancel` | Cancel ride |
| POST | `/api/mobile/rides/:id/rate` | Rate ride |
| GET | `/api/mobile/rides/:id/messages` | Ride chat |
| POST | `/api/mobile/rides/:id/messages` | Send message |
| GET | `/api/mobile/rides/:id/events` | Ride timeline |

### Driver Endpoints
| Method | Endpoint | Screen |
|--------|----------|--------|
| GET | `/api/mobile/rides/pool` | Available rides |
| POST | `/api/mobile/rides/:id/accept` | Accept ride |
| PATCH | `/api/mobile/rides/:id/status` | Update ride status |
| POST | `/api/mobile/rides/:id/complete` | Complete ride |
| GET | `/api/mobile/driver/profile` | Driver profile |
| POST | `/api/mobile/driver/location` | Update GPS |
| PATCH | `/api/mobile/driver/availability` | Toggle online/offline |
| GET | `/api/mobile/driver/earnings` | Earnings dashboard |
| POST | `/api/mobile/driver/apply` | Apply as driver |

### Caregiver Endpoints
| Method | Endpoint | Screen |
|--------|----------|--------|
| GET | `/api/caregiver/patients` | List managed patients |
| POST | `/api/caregiver/patients` | Add patient |

### Job Endpoints
| Method | Endpoint | Screen |
|--------|----------|--------|
| GET | `/api/mobile/jobs` | Job listings |
| GET | `/api/external-jobs` | External job aggregation |

### Push Notifications
| Method | Endpoint | Screen |
|--------|----------|--------|
| POST | `/api/mobile/push/register` | Register FCM token |
| POST | `/api/push/register-native` | Register native push token |

### IT Tech Endpoints
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

### IT Company Endpoints
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

## Features by Role

### Patient / Rider
- Book NEMT rides with vehicle type selection (sedan, wheelchair van, stretcher, gurney)
- Schedule rides or request ASAP
- Round trip support
- Special needs and medical notes for drivers
- Real-time ride tracking with status timeline
- In-app chat with driver during ride
- Trip sharing and SOS emergency button
- Complete ride history with filters
- Fare breakdown (base + distance + surge + tolls + wait time + tip)
- Post-ride rating and comments
- Caregiver portal for managing loved ones

### Driver
- Online/offline toggle for availability
- Browse and accept available ride requests
- Full ride workflow: En Route → Arrived → Picked Up → Complete
- Toll confirmation at trip completion
- Real-time chat with patient
- Medical notes and special needs visibility
- Earnings dashboard with weekly/monthly breakdown
- Trip history with fare details
- Multi-step driver application form

### IT Technician
- Browse available IT service tickets
- Accept and manage jobs through full lifecycle
- ETA tracking (en route → arriving → on site)
- GPS-verified check-in/check-out
- Proof of work / deliverables submission
- Customer ratings
- Earnings with payment history and 1099 tax forms
- IC Agreement signing, W-9 tax info, certification uploads
- Account status enforcement (hold/suspended/banned)

### IT Company
- Create and manage service tickets
- View tech progress and ETA status
- Approve completed work
- Rate technicians
- File complaints with 8 categories
- Request dispute mediation
- Escrow payment management

## Mobile App Links
- **iOS**: https://apps.apple.com/app/id6444679914
- **Google Play**: https://play.google.com/store/apps/details?id=com.fieldhcp.app
- **Web Login**: https://app.carehubapp.com/#/login

## Response Format
All `/api/mobile/*` endpoints return an Uber-style envelope:
```json
{
  "status": "success",
  "data": { ... },
  "meta": {
    "timestamp": "2026-03-30T12:00:00Z",
    "version": "2.0"
  }
}
```
