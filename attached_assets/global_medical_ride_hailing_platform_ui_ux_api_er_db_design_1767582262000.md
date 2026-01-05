# Global Medical Ride-Hailing Platform

**Scope:** UI/UX Wireframes (textual), Full API Specifications, ER Diagrams & Database Schema

**Design Goal:** A global, region-customizable, HIPAA-aware Non‑Emergency Medical Transportation (NEMT) ride‑hailing system supporting patients, drivers, healthcare companies, and administrators.

---

## 1. UI/UX WIREFRAMES (TEXTUAL / STRUCTURAL)

### 1.1 Global UX Principles
- Accessibility-first (large text, high contrast, screen reader support)
- Simple flows for elderly & vulnerable users
- Offline-tolerant UI states
- Region-aware (currency, language, date/time, regulations)

---

### 1.2 Authentication Screens

**Screens:**
- Welcome / Role Selection (Patient | Driver | Company)
- Login (Email / Phone / OTP)
- Register
- Region Selection (Country, City)

---

### 1.3 Patient App Wireframes

**Patient Dashboard**
- Upcoming Appointment Card
- Active Ride Status (Map)
- Quick Book Ride
- Wallet Balance

**Book Ride Flow**
1. Select Pickup Location
2. Select Medical Facility
3. Appointment Time
4. Return Trip Time (auto-suggest)
5. Mobility Needs
6. Payment Source
7. Confirm

**Patient Profile**
- Personal Info
- Emergency Contact
- Saved Locations
- Ride History
- Wallet & Transactions

---

### 1.4 Driver App Wireframes

**Driver Dashboard**
- Today’s Rides
- Upcoming Scheduled Rides
- Availability Toggle
- Wallet Balance

**Ride Detail Screen**
- Patient Name (limited)
- Pickup / Dropoff
- Mobility Needs
- Start / End Ride Buttons

---

### 1.5 Company Web Dashboard

**Company Home**
- Active Rides
- Upcoming Schedules
- Spend Summary

**Schedule Ride for Patient**
- Select Patient
- Pickup / Facility
- Appointment & Return Time
- Assign Driver (optional)

**Reports Screen**
- By Patient
- By Date
- By Cost

---

### 1.6 Admin Dashboard
- User Management
- Driver Verification
- Region Rules
- Pricing Controls
- Audit Logs

---

## 2. FULL API SPECIFICATIONS

### 2.1 API Standards
- RESTful
- JSON
- OAuth 2.0 + JWT
- Versioned (`/api/v1`)

---

### 2.2 Authentication APIs

**POST /auth/register**
```json
{ "role": "patient", "email": "", "phone": "", "password": "", "region": "US-NY" }
```

**POST /auth/login**

**POST /auth/otp/verify**

---

### 2.3 User & Profile APIs

**GET /users/me**

**PUT /users/me/profile**

**GET /companies/{id}/patients**

---

### 2.4 Ride APIs

**POST /rides**
```json
{
  "patient_id": "",
  "pickup_location": {},
  "dropoff_location": {},
  "appointment_time": "",
  "return_time": "",
  "mobility_needs": ["wheelchair"],
  "payment_source": "company"
}
```

**GET /rides/{id}**

**PATCH /rides/{id}/status**

---

### 2.5 Driver APIs

**GET /drivers/available**

**POST /drivers/{id}/accept-ride**

**POST /drivers/{id}/complete-ride**

---

### 2.6 Wallet & Payment APIs

**GET /wallets/{user_id}**

**GET /wallets/{id}/transactions**

**POST /wallets/charge**

**POST /wallets/payout**

---

### 2.7 Notifications APIs

**GET /notifications**

**POST /notifications/send**

---

## 3. ER DIAGRAM (TEXTUAL REPRESENTATION)

```
User ──< Profile
User ──< Wallet ──< Transaction
User ──< Ride >── Driver
Company ──< Patient (User)
Company ──< Ride
Ride ──< RideSegment
Driver ──< Vehicle
Ride ──< Notification
Region ──< PricingRule
```

---

## 4. DATABASE SCHEMA (SIMPLIFIED)

### users
- id (PK)
- role (patient, driver, company, admin)
- email
- phone
- region_id
- status

### profiles
- id (PK)
- user_id (FK)
- full_name
- mobility_needs
- emergency_contact

### companies
- id (PK)
- name
- region_id
- billing_type

### rides
- id (PK)
- patient_id (FK)
- company_id (FK, nullable)
- driver_id (FK)
- status
- appointment_time
- return_time
- region_id

### ride_segments
- id (PK)
- ride_id (FK)
- segment_type (outbound/return)
- pickup_location
- dropoff_location

### wallets
- id (PK)
- owner_id (FK)
- balance
- currency

### transactions
- id (PK)
- wallet_id (FK)
- amount
- type
- reference_id

### regions
- id (PK)
- country
- currency
- timezone
- regulations

---

## 5. USA-ONLY DEPLOYMENT (PHASE 1)

This phase is **explicitly designed for the United States** and aligns with **HIPAA, NEMT regulations, and US payment systems**.

---

### 5.1 Regulatory & Compliance (USA)
- HIPAA-compliant data handling (PHI minimization)
- Audit logs for all ride & access actions
- Role-based access control (RBAC)
- Encrypted data at rest & in transit
- Business Associate Agreement (BAA) readiness

---

### 5.2 Geography & Localization
- Country: United States
- Currency: USD
- Timezones: EST, CST, MST, PST (auto-detected)
- Units: Miles

---

### 5.3 Payment & Wallet (USA)
- Payment processors: Stripe / ACH / Debit & Credit Cards
- Company billing: prepaid wallet or monthly invoice
- Driver payouts: ACH (weekly / instant optional)
- Patient payments: wallet, card, company-sponsored

---

### 5.4 NEMT-Specific Rules
- Wheelchair & stretcher flags
- Driver certification tracking
- Wait-time billing for appointments
- Return-trip auto-reminders

---



## 6. READY FOR NEXT PHASE

This design is suitable for:
- MVP build
- Donor & investor decks
- Government & NGO deployment

---

**Next Available Expansions:**
- High‑fidelity Figma wireframes
- API Swagger/OpenAPI docs
- DevOps & deployment architecture
- Investor pitch deck

(You can iterate on this document directly.)

