# Mac App Store Signing Guide

Step-by-step guide for signing and submitting Powerdoro to the Mac App Store.

---

## Prerequisites

- Apple Developer Program membership ($99/year) at https://developer.apple.com
- Xcode installed (for certificate management)
- macOS with Keychain Access

---

## Step 1: Create Certificates

Open https://developer.apple.com/account/resources/certificates/list and create:

### 1a. Mac App Distribution Certificate
- Click **+** > **Mac App Distribution**
- Create a Certificate Signing Request (CSR) via Keychain Access:
  - Open **Keychain Access** > **Certificate Assistant** > **Request a Certificate From a Certificate Authority**
  - Enter your email, select **Saved to disk**
- Upload the CSR, download the certificate, and double-click to install in Keychain

### 1b. Mac Installer Distribution Certificate
- Click **+** > **Mac Installer Distribution**
- Use the same CSR (or create a new one)
- Download and install in Keychain

### 1c. (Optional) Mac Development Certificate
- For `mas-dev` local testing builds
- Click **+** > **Mac Development**
- Download and install in Keychain

Verify certificates are installed:
```bash
security find-identity -v -p codesigning
```

You should see entries like:
```
"3rd Party Mac Developer Application: Your Name (TEAM_ID)"
"3rd Party Mac Developer Installer: Your Name (TEAM_ID)"
```

---

## Step 2: Create App ID

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click **+** > **App IDs** > **App**
3. Fill in:
   - **Description:** Powerdoro
   - **Bundle ID (Explicit):** `com.electron.powerdoro`
4. Enable capabilities as needed:
   - No special capabilities required for Powerdoro
5. Click **Continue** > **Register**

---

## Step 3: Create Provisioning Profile

### 3a. Distribution Profile (for App Store submission)

1. Go to https://developer.apple.com/account/resources/profiles/list
2. Click **+** > **Mac App Store** (under Distribution)
3. Select the App ID: `com.electron.powerdoro`
4. Select the **Mac App Distribution** certificate
5. Name it: `Powerdoro MAS Distribution`
6. Download the `.provisionprofile` file

### 3b. Development Profile (for local testing)

1. Click **+** > **macOS App Development**
2. Select the App ID: `com.electron.powerdoro`
3. Select the **Mac Development** certificate
4. Select your test devices
5. Name it: `Powerdoro MAS Development`
6. Download the `.provisionprofile` file

---

## Step 4: Place Provisioning Profile

Copy the downloaded provisioning profile to the build directory:

```bash
cp ~/Downloads/Powerdoro_MAS_Distribution.provisionprofile build/embedded.provisionprofile
```

The file must be named `embedded.provisionprofile` to match the `package.json` config.

For development testing, use the development profile instead:
```bash
cp ~/Downloads/Powerdoro_MAS_Development.provisionprofile build/embedded.provisionprofile
```

---

## Step 5: Set Environment Variables

For the build process, set these environment variables:

```bash
# Required for code signing (electron-builder reads from Keychain automatically)
# No env vars needed if certificates are in the default Keychain

# Optional: specify team ID if you have multiple
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

For notarization of DMG builds (not needed for MAS):
```bash
export APPLE_ID="your@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

Generate an app-specific password at https://appleid.apple.com/account/manage (Sign-In and Security > App-Specific Passwords).

---

## Step 6: Build

### MAS Distribution Build
```bash
npm run dist:mas
```

### MAS Development Build (local testing)
```bash
npm run dist:mas-dev
```

### DMG Build (direct distribution)
```bash
npm run dist:dmg
```

The output `.pkg` file will be in the `release/` directory.

---

## Step 7: Upload to App Store Connect

### Using Transporter
1. Download **Transporter** from the Mac App Store
2. Open Transporter, sign in with your Apple ID
3. Drag the `.pkg` file from `release/` into Transporter
4. Click **Deliver**

### Using xcrun
```bash
xcrun altool --upload-app \
  --type osx \
  --file "release/Powerdoro-1.0.0-mas.pkg" \
  --apiKey "YOUR_API_KEY" \
  --apiIssuer "YOUR_ISSUER_ID"
```

---

## Troubleshooting

### "No signing identity found"
- Ensure certificates are installed in your login Keychain
- Run `security find-identity -v -p codesigning` to verify

### "Provisioning profile does not match"
- Ensure the bundle ID in `package.json` (`com.electron.powerdoro`) matches the App ID
- Ensure the provisioning profile uses the correct certificate and App ID

### "Code signature invalid"
- Run `codesign --verify --deep --strict /path/to/Powerdoro.app` to check
- Ensure `hardenedRuntime` is NOT set in the `mas` config (it's only for DMG)

### Native module signing issues (better-sqlite3)
- Ensure you ran `npm run rebuild:mas` before building
- electron-builder automatically codesigns native modules with the provisioning profile
