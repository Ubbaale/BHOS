# BHOS Mobile - App Store Deployment Guide

## Prerequisites

### Developer Accounts
1. **Apple Developer Account** — $99/year at https://developer.apple.com
2. **Google Play Developer Account** — $25 one-time at https://play.google.com/console

### Tools
- Install EAS CLI: `npm install -g eas-cli`
- Log in to Expo: `eas login`

---

## Step 1: Initialize EAS Project

```bash
cd artifacts/bhos-mobile
eas init
```

This will create an EAS project and give you a **Project ID**. Update these files:
- `app.json` → replace `YOUR_EAS_PROJECT_ID` with the actual ID (in two places)

---

## Step 2: Configure Environment Variables

Update `eas.json` with your actual values:
- `EXPO_PUBLIC_DOMAIN` — your deployed web app domain
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — your Clerk publishable key

### For Production
- Deploy the BHOS web app first (Replit deploy or custom hosting)
- Set the production domain in the `production` build profile
- Create a separate Clerk production instance

---

## Step 3: iOS Setup

### 3a. Create App in App Store Connect
1. Go to https://appstoreconnect.apple.com
2. My Apps → "+" → New App
3. Fill in:
   - Name: **BHOS**
   - Bundle ID: `com.bhos.mobile`
   - SKU: `bhos-mobile`
   - Primary Language: English (U.S.)

### 3b. Configure Signing
EAS handles signing automatically. On first build, it will:
- Create a distribution certificate
- Create a provisioning profile
- You just need to approve prompts

### 3c. Push Notifications (iOS)
1. In Apple Developer portal → Keys → Create a new key
2. Enable "Apple Push Notifications service (APNs)"
3. Download the `.p8` key file
4. Upload to Expo: `eas credentials --platform ios`

### 3d. Update eas.json
Replace in the `submit.production.ios` section:
- `appleId` — your Apple ID email
- `ascAppId` — App Store Connect app ID (found in App Store Connect → App Information)
- `appleTeamId` — your Apple Developer Team ID

---

## Step 4: Android Setup

### 4a. Create App in Google Play Console
1. Go to https://play.google.com/console
2. Create App → Fill in details
3. App name: **BHOS - Behavioral Home OS**

### 4b. Firebase Setup (for Push Notifications)
1. Go to https://console.firebase.google.com
2. Create a project or use existing
3. Add Android app with package name `com.bhos.mobile`
4. Download `google-services.json`
5. Place it in `artifacts/bhos-mobile/google-services.json`

### 4c. Play Store Service Account Key
1. In Google Play Console → Setup → API access
2. Create a service account
3. Grant "Release manager" permissions
4. Download the JSON key
5. Save as `artifacts/bhos-mobile/play-store-key.json`

---

## Step 5: Build

### Preview Build (Internal Testing)
```bash
pnpm --filter @workspace/bhos-mobile run eas:build:preview
```

### Production Build
```bash
# Both platforms
pnpm --filter @workspace/bhos-mobile run eas:build:prod

# iOS only
pnpm --filter @workspace/bhos-mobile run eas:build:ios

# Android only
pnpm --filter @workspace/bhos-mobile run eas:build:android
```

Builds run in the cloud on Expo's servers. Typical build time: 10-20 minutes.

---

## Step 6: Submit to Stores

### iOS
```bash
pnpm --filter @workspace/bhos-mobile run eas:submit:ios
```
This uploads the built IPA to App Store Connect. Then:
1. Go to App Store Connect
2. Select the build under TestFlight
3. Add App Store listing info (use `store-listing/app-store-description.txt`)
4. Add screenshots (see Screenshot Requirements below)
5. Upload privacy policy URL
6. Submit for review (typically 1-3 days)

### Android
```bash
pnpm --filter @workspace/bhos-mobile run eas:submit:android
```
This uploads the AAB to Google Play Console. Then:
1. Go to Play Console → your app
2. Set up store listing (use `store-listing/play-store-description.txt`)
3. Add screenshots
4. Complete the content rating questionnaire
5. Set up pricing (Free)
6. Complete the data safety form
7. Submit for review (typically 1-7 days)

---

## Screenshot Requirements

### iOS (Required sizes)
- **6.7" iPhone** (1290 × 2796px) — iPhone 15 Pro Max
- **6.5" iPhone** (1284 × 2778px) — iPhone 14 Plus
- **5.5" iPhone** (1242 × 2208px) — iPhone 8 Plus

### Android (Required)
- Phone screenshots: min 320px, max 3840px (at least 4 screenshots)
- 16:9 or 9:16 aspect ratio

### Recommended Screenshots (5-8 per platform)
1. Dashboard overview
2. Medication administration (eMAR)
3. Barcode scanner — camera view scanning a medication barcode
4. Barcode scan result — medication match with patient info
5. Patient list/detail
6. Shift clock-in with GPS
7. Incident reporting
8. Daily logs

---

## Privacy & Compliance

### iOS App Privacy
In App Store Connect → App Privacy, declare:
- **Contact Info**: Name, Email (for account purposes)
- **Health & Fitness**: Health records (clinical data)
- **Location**: Precise location (for shift verification)
- **Identifiers**: Device ID (for device enrollment)
- **Usage Data**: Product interaction (audit trail)
- **Photos or Videos**: Camera (for medication barcode scanning — images are processed on-device only, not stored or transmitted)

### Android Data Safety
In Play Console → App content → Data safety:
- Personal info: Name, email
- Health info: Health records
- Location: Approximate & precise location
- App activity: App interactions
- Device info: Device identifiers
- Photos and videos: Camera access (for medication barcode scanning — processed on-device, not collected)

### Both Platforms
- Upload the privacy policy from `store-listing/privacy-policy.md` to your website
- Set the privacy URL in both store listings

---

## Over-the-Air Updates

After initial store approval, you can push updates without going through store review:

```bash
eas update --branch production --message "Bug fix description"
```

This uses Expo Updates to push JavaScript/asset changes instantly. Only native code changes require a new store build.

---

## Checklist Before Submission

- [ ] EAS project initialized with Project ID
- [ ] `app.json` updated with correct Project ID
- [ ] `eas.json` updated with production environment variables
- [ ] Production Clerk instance configured
- [ ] Web app deployed with production domain
- [ ] iOS: App Store Connect app created
- [ ] iOS: Push notification key uploaded
- [ ] iOS: `eas.json` Apple credentials filled in
- [ ] Android: Play Console app created
- [ ] Android: `google-services.json` in place
- [ ] Android: Play Store service account key in place
- [ ] Privacy policy hosted at public URL
- [ ] Store listing descriptions ready
- [ ] Screenshots captured for all required sizes
- [ ] Content ratings completed on both platforms
- [ ] Barcode scanning tested with real NDC/Rx/lot codes on device
- [ ] Camera permission prompts working on both iOS and Android
- [ ] Internal testing completed
- [ ] Production build successful
