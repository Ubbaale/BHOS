# Flutter App Integration Guide

## Overview

This guide explains how to connect the Flutter app (`com.fieldhcp.app`) to the CareHub backend API. Once connected, both the web app and the Flutter app share the same database - users, jobs, rides, and drivers are all unified.

**Base URL:** `https://carehubapp.replit.app` (or your custom domain)
**API Prefix:** `/api/mobile`
**API Docs:** `GET /api/mobile/docs` (returns full endpoint list as JSON)

---

## Authentication

All authenticated endpoints use JWT Bearer tokens.

### Register a New User

```
POST /api/mobile/auth/register
Content-Type: application/json

{
  "username": "user@email.com",
  "password": "SecurePass1!",
  "role": "employer",       // "employer", "healthcare_worker", "patient", or "driver"
  "fullName": "John Doe",   // optional
  "phone": "555-0123",      // optional
  "deviceId": "device-uuid" // optional, for token tracking
}
```

Response:
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "expiresIn": 900,
  "user": { "id": "uuid", "username": "user@email.com", "role": "user" }
}
```

### Login

```
POST /api/mobile/auth/login
Content-Type: application/json

{
  "username": "user@email.com",
  "password": "SecurePass1!",
  "deviceId": "device-uuid"
}
```

Response includes `accessToken`, `refreshToken`, `user`, and `driver` (if driver account).

### Refresh Token

```
POST /api/mobile/auth/refresh
Content-Type: application/json

{ "refreshToken": "eyJhbG..." }
```

### Using Tokens

Add to every authenticated request:
```
Authorization: Bearer <accessToken>
```

Access tokens expire after 15 minutes. Use the refresh token to get a new access token. Refresh tokens expire after 7 days.

### Get Current User

```
GET /api/mobile/auth/me
Authorization: Bearer <token>
```

---

## Firebase Push Notifications

After login, register the FCM token:

```
POST /api/mobile/push/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "deviceToken": "fcm-token-from-firebase",
  "platform": "fcm",
  "deviceId": "device-uuid"
}
```

Platform values: `fcm`, `apns`, `ios`, `android`

---

## Jobs

### List Jobs (no auth required)

```
GET /api/mobile/jobs?state=TX&shift=Day+Shift&search=nurse&limit=50
```

Response:
```json
{
  "jobs": [
    {
      "id": 1,
      "title": "RN - Emergency",
      "facility": "Hospital Name",
      "location": "Houston, TX",
      "lat": "29.7604",
      "lng": "-95.3698",
      "pay": "$52-65/hr",
      "shift": "Day Shift",
      "urgency": "immediate",
      "requirements": ["RN License", "ACLS"],
      "status": "available"
    }
  ],
  "total": 1
}
```

### Get Job Details

```
GET /api/mobile/jobs/:id
```

### Create Job (auth required)

```
POST /api/mobile/jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "RN - ICU",
  "facility": "Hospital Name",
  "location": "City, State",
  "lat": "29.7604",
  "lng": "-95.3698",
  "pay": "$50-60/hr",
  "shift": "Night Shift",
  "urgency": "immediate",
  "requirements": ["RN License"],
  "status": "available"
}
```

---

## Rides

### Book a Ride

```
POST /api/mobile/rides
Authorization: Bearer <token>
Content-Type: application/json

{
  "patientName": "John Doe",
  "patientPhone": "555-0123",
  "pickupAddress": "123 Main St",
  "pickupLat": "29.7604",
  "pickupLng": "-95.3698",
  "dropoffAddress": "456 Oak Ave",
  "dropoffLat": "29.7700",
  "dropoffLng": "-95.3600",
  "appointmentTime": "2026-03-15T10:00:00Z",
  "mobilityNeeds": ["wheelchair"],
  "notes": "Front entrance",
  "paymentType": "self_pay",
  "distanceMiles": "5.2",
  "estimatedFare": "25.00"
}
```

### Get My Rides

```
GET /api/mobile/rides?status=requested&limit=20
Authorization: Bearer <token>
```

### Get Available Rides (Drivers Only)

```
GET /api/mobile/rides/pool
Authorization: Bearer <token>
```

### Accept a Ride (Drivers Only)

```
POST /api/mobile/rides/:id/accept
Authorization: Bearer <token>
```

### Complete a Ride

```
POST /api/mobile/rides/:id/complete
Authorization: Bearer <token>
Content-Type: application/json

{ "actualDistanceMiles": 5.4 }
```

### Cancel a Ride

```
POST /api/mobile/rides/:id/cancel
Authorization: Bearer <token>
Content-Type: application/json

{ "reason": "Patient cancelled" }
```

### Rate a Ride

```
POST /api/mobile/rides/:id/rate
Authorization: Bearer <token>
Content-Type: application/json

{ "rating": 5, "comment": "Great driver!" }
```

### Chat Messages

```
GET /api/mobile/rides/:id/messages
Authorization: Bearer <token>

POST /api/mobile/rides/:id/messages
Authorization: Bearer <token>
Content-Type: application/json

{ "message": "I'm at the front entrance" }
```

### Ride Statuses

`requested` -> `accepted` -> `en_route` -> `arrived` -> `in_progress` -> `completed`

Can be `cancelled` at any point before completion.

---

## Driver Management

### Get Driver Profile

```
GET /api/mobile/driver/profile
Authorization: Bearer <token>
```

### Toggle Availability

```
PATCH /api/mobile/driver/availability
Authorization: Bearer <token>
Content-Type: application/json

{ "isAvailable": true }
```

### Update Location

```
POST /api/mobile/driver/location
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 29.7604,
  "longitude": -95.3698,
  "rideId": 123  // optional, broadcasts location to ride tracking
}
```

### Get Earnings

```
GET /api/mobile/driver/earnings
Authorization: Bearer <token>
```

### Get Payout History

```
GET /api/mobile/driver/payouts
Authorization: Bearer <token>
```

### Apply as Driver (creates account)

```
POST /api/mobile/driver/apply
Content-Type: application/json

{
  "email": "driver@email.com",
  "password": "SecurePass1!",
  "fullName": "Jane Smith",
  "phone": "555-0456",
  "vehicleType": "sedan",
  "vehiclePlate": "ABC1234"
}
```

---

## Patient Profile

### Get Profile

```
GET /api/mobile/patient/profile
Authorization: Bearer <token>
```

### Create Profile

```
POST /api/mobile/patient/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "fullName": "John Doe",
  "phone": "555-0123",
  "email": "john@email.com",
  "mobilityNeeds": ["wheelchair"],
  "emergencyContactName": "Jane Doe",
  "emergencyContactPhone": "555-0456"
}
```

---

## Payments (Stripe)

### Create Payment Intent for Ride

```
POST /api/mobile/rides/:id/payment-intent
Authorization: Bearer <token>
```

Response:
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "publishableKey": "pk_live_xxx",
  "amount": 25.00
}
```

Use the `clientSecret` with the Stripe Flutter SDK to complete payment.

### Tip a Driver

```
POST /api/mobile/rides/:id/tip
Authorization: Bearer <token>
Content-Type: application/json

{ "amount": 5.00 }
```

---

## Surge Pricing

```
GET /api/mobile/surge/current
```

Response:
```json
{
  "isActive": false,
  "multiplier": 1.0,
  "reason": null
}
```

---

## Incidents

### Report an Incident

```
POST /api/mobile/incidents
Authorization: Bearer <token>
Content-Type: application/json

{
  "rideId": 123,
  "category": "safety",
  "severity": "high",
  "description": "Description of the incident",
  "location": "123 Main St"
}
```

---

## WebSocket Real-time Updates

### Get WebSocket Token

```
GET /api/mobile/auth/ws-token
Authorization: Bearer <token>
```

Response: `{ "token": "abc123..." }`

### Connect to WebSocket

Tokens are single-use and expire after 60 seconds.

**Ride updates:**
```
wss://carehubapp.replit.app/ws/rides?token=<ws-token>
```

Messages:
```json
{ "type": "new", "ride": { ... } }
{ "type": "status_change", "ride": { ... } }
{ "type": "driver_location", "ride": { ..., "driverLatitude": 29.76, "driverLongitude": -95.37 } }
```

**Job updates:**
```
wss://carehubapp.replit.app/ws/jobs?token=<ws-token>
```

**Chat:**
```
wss://carehubapp.replit.app/ws/chat/:rideId?token=<ws-token>
```

---

## Flutter Code Example

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class CareHubApi {
  static const String baseUrl = 'https://carehubapp.replit.app/api/mobile';
  String? _accessToken;
  String? _refreshToken;

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
  };

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': email, 'password': password}),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      _accessToken = data['accessToken'];
      _refreshToken = data['refreshToken'];
    }
    return data;
  }

  Future<Map<String, dynamic>> getJobs({String? search, String? state}) async {
    final params = <String, String>{};
    if (search != null) params['search'] = search;
    if (state != null) params['state'] = state;
    final uri = Uri.parse('$baseUrl/jobs').replace(queryParameters: params);
    final response = await http.get(uri, headers: _headers);
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> getMyRides() async {
    final response = await http.get(
      Uri.parse('$baseUrl/rides'),
      headers: _headers,
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> bookRide(Map<String, dynamic> rideData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/rides'),
      headers: _headers,
      body: jsonEncode(rideData),
    );
    return jsonDecode(response.body);
  }

  Future<void> refreshAccessToken() async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/refresh'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refreshToken': _refreshToken}),
    );
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      _accessToken = data['accessToken'];
      _refreshToken = data['refreshToken'];
    }
  }
}
```

---

## Error Handling

All errors return:
```json
{ "message": "Error description" }
```

Common HTTP status codes:
- `400` - Bad request (invalid input)
- `401` - Unauthorized (invalid/expired token)
- `403` - Forbidden (wrong role)
- `404` - Not found
- `500` - Server error

When you receive a `401`, try refreshing the token. If refresh also fails, redirect to login.

---

## Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
