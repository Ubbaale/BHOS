# CareHub Flutter Native Features

## Required Dependencies (pubspec.yaml)

```yaml
dependencies:
  flutter:
    sdk: flutter
  local_auth: ^2.1.8
  shared_preferences: ^2.2.2
  image_picker: ^1.0.7
  share_plus: ^7.2.2
  connectivity_plus: ^5.0.2
  geolocator: ^10.1.1
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.10
```

## iOS Info.plist Required Keys

```xml
<key>NSFaceIDUsageDescription</key>
<string>Use Face ID for quick, secure login to CareHub</string>
<key>NSCameraUsageDescription</key>
<string>Take photos of documents for verification</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Upload documents from your photo library</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Find nearby rides and track your driver's location</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Track your location during active rides for safety</string>
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
  <string>remote-notification</string>
</array>
```

## Native Features Implemented

### 1. Biometric Authentication (Face ID / Touch ID)
- **File**: `services/biometric_service.dart`
- Uses `local_auth` package for iOS Face ID and Touch ID
- Stores biometric preference via SharedPreferences
- Re-authenticates when app returns from background
- Login screen shows "Sign in with Face ID" button

### 2. Haptic Feedback
- **File**: `services/haptic_service.dart`
- Contextual haptics: light for taps, medium for success, heavy for errors
- Applied to all interactive elements across the app
- Uses iOS-native HapticFeedback system

### 3. Native Onboarding Flow
- **File**: `screens/onboarding/onboarding_screen.dart`
- 5-page onboarding with gradient icons and animated page indicators
- Only shown on first app launch (SharedPreferences flag)
- Swipe navigation with haptic feedback on page change

### 4. Animated Splash Screen
- **File**: `screens/splash/splash_screen.dart`
- Logo scales in with elastic animation
- Text slides up with fade
- Gradient background matching brand colors

### 5. Offline Support & Local Caching
- **File**: `services/local_cache_service.dart`
- Caches rides, profile, and jobs locally
- Shows "last synced" timestamp in settings
- Automatic cache expiry (1 hour)
- Clear cache option in settings

### 6. Connectivity Monitoring
- **File**: `widgets/connectivity_wrapper.dart`
- Real-time network status banner (online/offline)
- Animated banner slides down when connection changes
- Haptic feedback on connectivity change

### 7. Native Share Sheet
- **File**: `services/native_share_service.dart`
- Share ride details with family (trip safety)
- Share job postings with colleagues
- Invite friends to download the app
- Uses iOS native share sheet via `share_plus`

### 8. Camera/Document Scanner
- **File**: `widgets/document_scanner.dart`
- Camera capture for driver documents
- Gallery picker for existing photos
- Bottom sheet UI with camera/gallery/PDF options
- Used in driver onboarding and document uploads

### 9. Location Tracking
- **File**: `services/location_service.dart`
- iOS-specific `AppleSettings` for automotive navigation
- Background location updates during active rides
- Distance calculation between coordinates
- Blue location indicator bar on iOS

### 10. Native App Settings
- **File**: `screens/settings/app_settings_screen.dart`
- iOS-style settings with CupertinoSwitch toggles
- Biometric enable/disable with authentication
- Push notification preferences
- Dark mode toggle
- Cache management with clear option

### 11. Cupertino UI Elements
- CupertinoSwitch for all toggles
- CupertinoAlertDialog for destructive confirmations
- iOS-style back navigation (arrow_back_ios)
- CupertinoPageTransitionsBuilder for iOS page transitions

### 12. Animations & Transitions
- Hero animations for avatars and logos
- Fade/slide transitions on login screen
- Elastic scale animation on FABs
- AnimatedContainer for status changes
- AnimatedSwitcher for page transitions

## Required Flutter Dependencies (pubspec.yaml additions)

```yaml
  permission_handler: ^11.1.0
```

## App Store Rejection Fixes Applied

### Fix 1: Guideline 4.2 – Minimum Functionality
- Added 12+ native features (biometrics, haptics, camera, share sheet, offline cache, etc.)
- No WebViews used — all screens are native Flutter widgets

### Fix 2: Guideline 2.3.10 – Accurate Metadata
- Removed all irrelevant third-party references (no Google Pay mentions)
- App only references services actually integrated (Stripe for payments)

### Fix 3: Guideline 4 – Login Experience
- Login and registration are fully in-app using native Flutter TextFields
- No external browser redirects for authentication
- Biometric login (Face ID/Touch ID) as alternative sign-in method

### Fix 4: Guideline 2.1(a) – Camera Crash on iPad
- Fixed in `widgets/document_scanner.dart`
- Added `permission_handler` for proper camera/photo library permission requests
- All `ImagePicker` calls wrapped in try-catch with `PlatformException` handling
- Shows CupertinoAlertDialog to guide users to Settings if permission denied
- Tested error paths for missing camera on iPad simulators

### Fix 5: Guideline 1.5 – Developer Information
- Working support URL: `https://app.carehubapp.com/support`
- Includes: email support, phone support, contact form, FAQs, safety info, legal links
- Update App Store metadata to point to: `https://[your-replit-url]/support`

### Fix 6: Account Deletion (Apple Requirement)
- Full account deletion flow: `screens/settings/delete_account_screen.dart`
- Password verification required before deletion
- CupertinoAlertDialog confirmation with "Delete Forever" destructive action
- Lists all data that will be deleted (profile, rides, payments, messages, documents)
- Optional reason selection (why leaving)
- Backend API: `POST /api/mobile/auth/delete-account`
- Clears local cache after deletion

## App Review Response Notes

This app is NOT a web wrapper. It is a fully native Flutter application that:
- Uses iOS Face ID/Touch ID for biometric authentication
- Provides haptic feedback on all interactive elements
- Includes native camera integration for document scanning
- Uses iOS native share sheet for trip safety sharing
- Monitors network connectivity with native APIs
- Tracks location using iOS Core Location framework
- Stores data locally using SharedPreferences
- Has a native onboarding flow shown only on first launch
- Uses Cupertino-style UI elements (switches, dialogs)
- Implements native page transitions and Hero animations
- Supports dark mode via native theme system
