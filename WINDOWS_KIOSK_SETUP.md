# XEENA INSTITUTE OF SKILL DEVELOPMENT
## CBT Examination System - Windows Computer Lab Kiosk & Security Guide

This guide explains how to lock down Windows 10/11 desktop terminals in your college computer examination lab and how to administer exams on mobile devices using Termux or Acode.

---

### 1. Windows Lab Terminal Lockdown (Kiosk Mode)

In a college computer lab, students may attempt to open other applications, switch tabs, or use keyboard shortcuts (Alt+Tab, Windows key, Ctrl+Alt+Del). To enforce a strict examination environment, configure Windows Kiosk Mode:

#### Method A: Microsoft Edge Assigned Access (Single-App Kiosk) - Recommended
1. On Windows 10/11 Pro/Enterprise:
   - Go to **Settings > Accounts > Other users > Set up a kiosk (Assigned access)**.
   - Choose **Get started**.
   - Enter a kiosk account name (e.g., `LabStudent`).
   - Select **Microsoft Edge** as the kiosk app.
   - Choose **As a digital sign or interactive display (InPrivate full-screen mode)**.
   - Enter your CBT platform URL: `https://<YOUR_FIREBASE_APP>.web.app/student-login.html` (or your local LAN server URL `http://192.168.1.100:3000/student-login.html`).
   - Set idle reset time to `0` or disable it.
2. Sign in to the `LabStudent` Windows account. The browser opens in true full-screen with no address bar, no navigation buttons, and Windows hotkeys disabled.

#### Method B: Chrome / Edge Fullscreen Kiosk Shortcut
If using standard Windows user accounts:
1. Right-click on desktop > **New > Shortcut**.
2. For Google Chrome:
   ```cmd
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --incognito --disable-pinch --overscroll-history-navigation=0 "https://<YOUR_FIREBASE_APP>.web.app/student-login.html"
   ```
3. For Microsoft Edge:
   ```cmd
   "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk --inprivate "https://<YOUR_FIREBASE_APP>.web.app/student-login.html"
   ```
4. Place this shortcut in the Windows Startup folder (`shell:startup`) so it launches automatically on computer boot.

---

### 2. Built-in Web Anti-Cheat Controls (Automated)

The application automatically enforces:
* **Right-Click Blocked**: Prevents opening context menus or inspecting element code.
* **Developer Shortcuts Blocked**: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (view source), and Ctrl+P (printing) are trapped and prevented.
* **Fullscreen Enforcement**: Candidates are prompted into HTML5 Fullscreen mode on start. Exiting fullscreen triggers an invigilator alert and an on-screen warning modal.
* **Tab Switch & Window Blur Detection**: Switching tabs or minimizing the window registers a security warning count and automatically logs the event with timestamp to the Teacher Audit Log.
* **Accidental Close Protection**: A `beforeunload` dialog warns students against refreshing or closing the browser during testing.
* **Early Exit Password**: If a student finishes early or requires emergency termination, a teacher authorization password is required before the session terminates.

---

### 3. Server-Authoritative Architecture Verification

* **Question Answers**: Stored strictly in Firestore and verified inside Firebase Cloud Functions (`functions/index.js`). The student's browser never receives correct answer keys.
* **Question Randomization**: Randomly shuffled for each student on the server when a session begins.
* **Server-Authoritative Clock**: The timer countdown computes time remaining from `expiryTime` on the server, avoiding any device clock tampering.
* **Duplicate Submissions**: Locked server-side once submitted; attempts to submit twice or alter submitted scores are blocked with `400 Bad Request`.
* **Storage Sanitization**: Neither `localStorage` nor `sessionStorage` contains passwords or answers. Only session tokens and user display profiles are retained.

---

### 4. Running the Backend on Mobile (Termux / Acode)

If managing the server locally on an Android device via Termux:
1. Open Termux and ensure Node.js is installed:
   ```bash
   pkg update && pkg install nodejs git
   ```
2. In the project directory:
   ```bash
   npm install
   npm run build
   node server.ts
   ```
3. Find your device's LAN IP address:
   ```bash
   ifconfig wlan0
   ```
4. All computer lab desktops connected to the same Wi-Fi/LAN router can access:
   `http://<PHONE_IP>:3000/student-login.html`
