# Running ASTRA on a physical iPhone (dev build)

Expo Go **can't run this app on a physical iPhone**: the project is on **Expo SDK 57**,
and the App Store version of Expo Go may be older (e.g. 54), so the phone reports
*"incompatible with this version of Expo Go."* (The iOS **Simulator** works because
Expo ships SDK-matched simulator builds of Expo Go directly.)

The fix is a **development build** — a custom "ASTRA (development)" app compiled for
your phone. It behaves like Expo Go (connects to Metro, hot-reloads JS) but bundles
the SDK 57 runtime + native modules (camera, etc.). This is also the path to store
builds later (EAS).

> Camera/QR scanning **must** be tested on a real phone — the iOS Simulator has no camera.

---

## Prerequisites (one time)

- **Xcode** + **CocoaPods** installed (`xcodebuild -version`, `pod --version`).
- A **free Apple ID** (your normal one is fine). No $99 account needed for dev builds.
- iPhone + **USB cable**, phone and Mac on the **same Wi-Fi**.
- Local web API running (`npm run dev` in `apps/web`) and Metro (`npx expo start` in `apps/mobile`).

## Steps

### 1. Point the app at the Mac's LAN IP (not localhost)
On a physical phone, `localhost` means the *phone*, so it can't reach the Mac's dev
server. Find the Mac IP and set it in `apps/mobile/.env` (gitignored):

```bash
ipconfig getifaddr en0          # e.g. 192.168.1.15
```
```
EXPO_PUBLIC_API_URL="http://<mac-lan-ip>:3000"
```
Restart Metro after changing it (`npx expo start -c`). The dev build also connects to
Metro at `http://<mac-lan-ip>:8081`.

### 2. Add your Apple ID to Xcode
Xcode → **Settings (⌘,) → Accounts → "+" → Apple ID** → sign in. This gives a free
"Personal Team" used for signing.

### 3. First build attempt (generates the native project + surfaces Developer Mode)
```bash
cd apps/mobile
npx expo run:ios --device <UDID>     # find UDID: xcrun xctrace list devices
```
This prebuilds `ios/`, installs pods (incl. `expo-camera`), and tries to build. The
first run typically **fails** on signing — that's expected; continue below.

### 4. Set the signing team (creates the certificate)
```bash
open apps/mobile/ios/ASTRAdevelopment.xcworkspace
```
In Xcode: select the **ASTRAdevelopment** project → **TARGETS → ASTRAdevelopment** →
**Signing & Capabilities** → check **Automatically manage signing** → pick your
**Personal Team**. Xcode creates an *"Apple Development"* certificate and registers the device.

### 5. Enable Developer Mode on the iPhone
The **Developer Mode** toggle only appears **after** a build attempt (step 3).
On the phone: **Settings → Privacy & Security → (scroll to bottom) → Developer Mode →
On** → it restarts → after reboot, confirm **Turn On** with your passcode.

### 6. Build + install
```bash
npx expo run:ios --device <UDID>
```
Keep the phone **unlocked and plugged in**.

### 7. Trust the developer certificate
After install: iPhone → **Settings → General → VPN & Device Management** → tap your
Apple ID profile → **Trust**. Then open **"ASTRA (development)"** from the home screen.

---

## Gotchas we hit (and the fixes)

| Symptom | Cause | Fix |
|---|---|---|
| *"incompatible with this version of Expo Go"* on the phone | Project SDK (57) newer than App Store Expo Go | Use a dev build (this doc) |
| `No code signing certificates are available` | No dev cert yet | Set the signing **Team** in Xcode (step 4) |
| Keychain prompt rejects the *correct* Mac password | `login` keychain password **out of sync** with the account password (after a past password change) | Try an older password; else Keychain Access → Settings → **Reset Default Keychains**, then re-create the cert (step 4). Click **"Always Allow"** to stop future prompts |
| `ApplicationVerificationFailed` during install | Free-signed app verification (needs device online) / first-attempt flakiness | Ensure the phone has **internet**; **re-run** the install |
| `Cannot launch … because the device is locked` | Phone locked at launch time | **Unlock** the phone and tap the app icon (it's already installed) |
| Crash: *"missing NSCameraUsageDescription"* on the scanner | Native `Info.plist` lacked the camera-usage string (stale `ios/` predated the camera plugin) | Set it in `app.config.ts` under `ios.infoPlist` (done) — regenerated on prebuild. For an existing `ios/`, add it directly with PlistBuddy |

## Maintenance
- A **free** Apple ID signing cert **expires after 7 days** — just re-run
  `npx expo run:ios --device <UDID>` to refresh it.
- After the first native build, day-to-day JS changes **hot-reload over Metro** — no rebuild.
- A paid **Apple Developer** account ($99/yr) removes the 7-day limit and enables
  wireless EAS builds; see Phase 14 in `ROADMAP.md`.
