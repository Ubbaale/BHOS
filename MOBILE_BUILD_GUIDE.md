# Carehub Mobile App Build Guide

This guide explains how to build the Carehub mobile app for iOS App Store and Google Play Store submission.

## Prerequisites

### For Both Platforms
- Node.js 18+ installed locally
- Xcode (Mac only, for iOS)
- Android Studio (for Android)
- Apple Developer Account ($99/year) for iOS
- Google Play Developer Account ($25 one-time) for Android

### Local Development Setup
1. Clone or download this project to your local machine
2. Install dependencies: `npm install`
3. Build the web assets: `npm run build`

## Step 1: Build Web Assets

First, build the production web assets that will be bundled into the mobile app:

```bash
npm run build
```

This creates the `dist/public` folder with optimized production assets.

## Step 2: Initialize Native Projects

### Add iOS Platform
```bash
npx cap add ios
```

### Add Android Platform
```bash
npx cap add android
```

## Step 3: Sync Web Assets to Native Projects

After building, sync the web assets to native projects:

```bash
npx cap sync
```

Run this command every time you update the web code.

## Step 4: Configure App Icons and Splash Screens

### iOS Icons
Place your app icons in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

Required sizes:
- 1024x1024 (App Store)
- 180x180 (iPhone @3x)
- 120x120 (iPhone @2x)
- 167x167 (iPad Pro)
- 152x152 (iPad @2x)
- 76x76 (iPad @1x)

### Android Icons
Place your app icons in:
- `android/app/src/main/res/mipmap-xxxhdpi/` (192x192)
- `android/app/src/main/res/mipmap-xxhdpi/` (144x144)
- `android/app/src/main/res/mipmap-xhdpi/` (96x96)
- `android/app/src/main/res/mipmap-hdpi/` (72x72)
- `android/app/src/main/res/mipmap-mdpi/` (48x48)

### Splash Screens
Configure in `capacitor.config.ts` (already done):
```typescript
SplashScreen: {
  launchShowDuration: 2000,
  backgroundColor: '#1e40af'
}
```

## Step 5: iOS Build for App Store

### Open in Xcode
```bash
npx cap open ios
```

### Configure Signing
1. Select the project in Xcode navigator
2. Go to "Signing & Capabilities" tab
3. Select your Team (Apple Developer account)
4. Enable "Automatically manage signing"

### Configure App Info
Edit `ios/App/App/Info.plist`:
- Bundle Identifier: `com.carehubapp.app`
- Bundle Name: `Carehub`
- Version: Match your release version

### Required Permissions
Add these to Info.plist:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Carehub needs your location to show nearby rides and navigate to pickup/dropoff locations.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Carehub needs your location in the background to track rides and provide accurate ETAs.</string>
<key>NSCameraUsageDescription</key>
<string>Carehub needs camera access to capture documents for driver verification.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Carehub needs photo library access to upload documents.</string>
```

### Build for App Store
1. Select "Any iOS Device" as build target
2. Product > Archive
3. In Organizer, click "Distribute App"
4. Choose "App Store Connect"
5. Follow the upload wizard

## Step 6: Android Build for Google Play

### Open in Android Studio
```bash
npx cap open android
```

### Configure Signing
1. Build > Generate Signed Bundle / APK
2. Create new keystore or use existing
3. Fill in key details (save these securely!)

### Configure App Info
Edit `android/app/build.gradle`:
```gradle
android {
    defaultConfig {
        applicationId "com.carehubapp.app"
        versionCode 1
        versionName "1.0.0"
    }
}
```

### Required Permissions
Already configured in `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

### Build for Google Play
1. Build > Generate Signed Bundle / APK
2. Select "Android App Bundle"
3. Choose release build type
4. Click "Create"

The `.aab` file will be in `android/app/release/`

## Step 7: App Store Submissions

### iOS App Store Connect
1. Go to https://appstoreconnect.apple.com
2. Create new app with bundle ID `com.carehubapp.app`
3. Fill in app information (see metadata below)
4. Upload screenshots (required sizes below)
5. Submit for review

### Google Play Console
1. Go to https://play.google.com/console
2. Create new application
3. Fill in store listing (see metadata below)
4. Upload screenshots
5. Upload the `.aab` file
6. Submit for review

## App Store Metadata

### App Name
Carehub - Medical Transport

### Short Description (80 chars)
Book medical rides instantly. NEMT transportation made easy.

### Full Description
Carehub connects patients with reliable non-emergency medical transportation (NEMT) services. Whether you need a ride to a doctor's appointment, dialysis treatment, or physical therapy session, Carehub makes booking easy and stress-free.

Features:
- Book rides instantly or schedule in advance
- Real-time driver tracking and ETAs
- Secure in-app messaging with your driver
- Wheelchair, stretcher, and mobility assistance options
- Vehicle type selection (Sedan, SUV, Wheelchair Van, Stretcher Van, Minivan)
- Automatic toll estimation — see toll charges before booking
- Insurance billing support
- 24/7 customer support

Caregiver/Family Portal:
- Manage rides for loved ones from one dashboard
- Add and track multiple patients
- Quick booking with pre-filled patient info
- View ride history across all managed patients

Facility Discharge Coordination:
- Hospital and clinic staff can book patient transport
- Discharge and appointment transport presets
- Facility address auto-fills for fast booking
- Track all facility rides in one place

For Healthcare Workers:
- Find healthcare staffing opportunities
- Apply for positions at top facilities
- Manage your schedule and availability

For Drivers:
- Accept ride requests in your area
- Navigate with integrated maps
- Track your earnings and tips
- Wait time tracking at appointments
- Surge zone demand map

Download Carehub today for reliable medical transportation!

### Keywords
medical transport, NEMT, healthcare ride, doctor appointment, medical taxi, wheelchair transport, dialysis transport, healthcare staffing

### Categories
- iOS: Medical, Travel
- Android: Medical, Maps & Navigation

### Screenshots Required

#### iOS
- 6.7" (iPhone 14 Pro Max): 1290 x 2796
- 6.5" (iPhone 11 Pro Max): 1284 x 2778
- 5.5" (iPhone 8 Plus): 1242 x 2208
- 12.9" iPad Pro: 2048 x 2732

#### Android
- Phone: 1080 x 1920 minimum
- 7" Tablet: 1200 x 1920
- 10" Tablet: 1600 x 2560

### Privacy Policy URL
https://carehubapp.com/privacy

### Support URL
https://carehubapp.com/support

### Contact Email
support@carehubapp.com

## Push Notifications Setup

### iOS (APNs)
1. In Apple Developer Portal, create APNs key
2. Download the .p8 file
3. Note the Key ID and Team ID
4. Configure in your backend

### Android (FCM)
1. Go to Firebase Console
2. Create project or use existing
3. Add Android app with package name `com.carehubapp.app`
4. Download `google-services.json`
5. Place in `android/app/`

## Testing Before Submission

### iOS TestFlight
1. Archive and upload to App Store Connect
2. Add internal testers
3. Test on real devices

### Android Internal Testing
1. Upload to Google Play Console
2. Create internal testing track
3. Add testers by email

## Common Issues

### iOS Build Fails
- Ensure Xcode is updated
- Check provisioning profiles
- Clean build: Product > Clean Build Folder

### Android Build Fails
- Update Android Studio and Gradle
- Sync project with Gradle files
- Check SDK versions match

### Web Assets Not Updating
Run sync after every web build:
```bash
npm run build && npx cap sync
```

## Production Checklist

- [ ] Update version numbers in capacitor.config.ts
- [ ] Update version in package.json
- [ ] Build production web assets
- [ ] Sync to native projects
- [ ] Test on real iOS device
- [ ] Test on real Android device
- [ ] Create app screenshots
- [ ] Write store descriptions
- [ ] Configure push notifications
- [ ] Set up privacy policy page
- [ ] Generate signed builds
- [ ] Submit to app stores

## Support

For questions about the mobile app build process, contact the development team or refer to:
- Capacitor docs: https://capacitorjs.com/docs
- iOS docs: https://developer.apple.com/documentation
- Android docs: https://developer.android.com/docs
