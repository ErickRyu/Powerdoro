# App Store Submission Checklist

Pre-submission checklist for Powerdoro on the Mac App Store.

---

## App Store Connect Setup

- [ ] Create app in [App Store Connect](https://appstoreconnect.apple.com)
- [ ] Set **Bundle ID**: `com.electron.powerdoro`
- [ ] Set **SKU**: `powerdoro` (or any unique identifier)
- [ ] Set **Primary Language**: English (or Korean)

---

## App Information

- [ ] **App Name**: Powerdoro
- [ ] **Subtitle** (max 30 chars): e.g., "Pomodoro Timer & Retrospective"
- [ ] **Category**: Productivity
- [ ] **Secondary Category** (optional): Lifestyle
- [ ] **Content Rights**: Confirm you own or have rights to all content

---

## Version Information

- [ ] **Version Number**: 1.0.0 (matches `package.json` version)
- [ ] **Build Number**: Auto-incremented by electron-builder (or set manually)
  - Version = user-facing (1.0.0), Build = internal (1, 2, 3...)
  - Each upload must have a unique build number
  - Set in electron-builder: `"buildVersion": "1"` in `build` config

---

## App Icons

- [ ] **App Icon** (1024x1024 px, PNG, no alpha/transparency)
  - Place at `build/icon.icns` (macOS) or provide `build/icon.png`
  - electron-builder generates `.icns` from a 1024x1024 PNG
  - Must NOT have rounded corners (macOS applies them automatically)
  - Must NOT have alpha channel for App Store submission

---

## Screenshots

Required sizes for Mac App Store:

- [ ] **1280x800** or **1440x900** (minimum one required)
- [ ] **2560x1600** or **2880x1800** (Retina, optional but recommended)

Tips:
- Show the tray window with timer input
- Show the retrospective/block window
- Show the statistics window with chart
- Show the settings window
- Max 10 screenshots per locale
- Use clean, focused screenshots without personal data

---

## App Description

- [ ] **Description** (max 4000 chars): Describe what Powerdoro does
  - Mention: Pomodoro technique, mandatory retrospective, menu bar app
  - Highlight: statistics tracking, customizable timer, focus enforcement
- [ ] **Keywords** (max 100 chars, comma-separated):
  - e.g.: `pomodoro,timer,productivity,focus,retrospective,time management,study`
- [ ] **What's New** (for updates): Describe changes in this version
- [ ] **Promotional Text** (max 170 chars, can be updated without new build)

---

## Privacy

- [ ] **Privacy Policy URL** (required): Host a privacy policy page
  - Powerdoro stores data locally only (retrospect files, SQLite database)
  - No data is sent to external servers
  - Mention: local file storage, no analytics, no tracking
- [ ] **App Privacy** questionnaire in App Store Connect:
  - Data types collected: **None** (all data stays on device)
  - Select "No" for all data collection categories if no analytics

---

## Age Rating

- [ ] Complete the **Age Rating** questionnaire
  - Powerdoro has no objectionable content
  - Expected rating: **4+** (suitable for all ages)
  - No violence, gambling, horror, etc.

---

## Pricing & Availability

- [ ] Set **Price**: Free or paid
- [ ] Set **Availability**: Select countries/regions
- [ ] Set **Pre-Order** (optional): Configure if desired

---

## Build & Upload

- [ ] Certificates installed (see [signing-guide.md](./signing-guide.md))
- [ ] Provisioning profile at `build/embedded.provisionprofile`
- [ ] Run `npm run dist:mas` to create the MAS package
- [ ] Upload `.pkg` via **Transporter** or `xcrun altool`
- [ ] Wait for build processing (usually 5-30 minutes)
- [ ] Select the build in App Store Connect under the version

---

## Review Notes (Optional)

- [ ] Add **Review Notes** to explain the app to Apple reviewers:
  - "Powerdoro is a menu bar Pomodoro timer. Click the tray icon to set a timer. When the timer ends, a retrospective screen appears for the user to reflect on their work session."
  - Explain the block window behavior: "The fullscreen retrospective window encourages users to write a brief reflection. Users can dismiss it after writing."
- [ ] Add a **Demo Account** if applicable (N/A for Powerdoro)

---

## Final Checks

- [ ] Test `npm run dist:mas-dev` locally before submitting
- [ ] Verify the app launches and timer works in sandboxed build
- [ ] Verify retrospective file writing works in sandbox container
- [ ] Verify statistics database works in sandbox container
- [ ] Verify tray icon and menu work correctly
- [ ] Verify settings page works (auto-launch should be hidden in MAS)
- [ ] No crashes or sandbox violations in Console.app
- [ ] App does not reference `globalShortcut` (removed for MAS)
