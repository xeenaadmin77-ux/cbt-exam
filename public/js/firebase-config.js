/**
 * ITI College CBT Examination System - Firebase & API Configuration
 * Production-ready API client with Token Authentication & Storage Audit.
 */

// Firebase Project Configuration
// Replace with your Firebase Web project credentials if using client SDK directly:
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Authoritative API Base URL:
// In Firebase Hosting, rewrites map '/api/**' to the 'api' Cloud Function.
const API_BASE = '/api';

/**
 * Robust API helper attaching verified Firebase ID token as Bearer header.
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // Attach verified Firebase ID Token if signed in
  const user = getCurrentUser();
  if (user && user.token) {
    defaultHeaders['Authorization'] = `Bearer ${user.token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      // CHANGE 24: Clean, user-friendly error message without backend internals
      const message = data.message || `Request failed (${response.status})`;
      throw new Error(message);
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err.message);
    throw err;
  }
}

/**
 * Storage helpers - Audited (CHANGE 18):
 * Stores ONLY public UI profile and session token.
 * NEVER stores passwords, exit passwords, or answer keys.
 */
function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem('cbt_user') || localStorage.getItem('cbt_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(userData, remember = false) {
  // Sanitize user object to ensure no passwords or sensitive secrets get stored in browser storage
  const cleanUser = {
    uid: userData.uid,
    name: userData.name,
    username: userData.username,
    admissionNumber: userData.admissionNumber,
    trade: userData.trade,
    batch: userData.batch,
    role: userData.role,
    token: userData.token
  };
  const serialized = JSON.stringify(cleanUser);
  sessionStorage.setItem('cbt_user', serialized);
  if (remember) {
    localStorage.setItem('cbt_user', serialized);
  }
}

function clearCurrentUser() {
  sessionStorage.removeItem('cbt_user');
  localStorage.removeItem('cbt_user');
  sessionStorage.removeItem('cbt_active_session');
}

/**
 * Get college branding and lab settings (CHANGE 15: Public only)
 */
async function getCollegeSettings() {
  try {
    const res = await apiFetch('/settings');
    return res.settings || {
      collegeName: 'XEENA INSTITUTE OF SKILL DEVELOPMENT',
      labName: 'Main Computer Examination Lab',
      tagline: 'Centre of Excellence in Vocational & Technical Training'
    };
  } catch (e) {
    return {
      collegeName: 'XEENA INSTITUTE OF SKILL DEVELOPMENT',
      labName: 'Main Computer Examination Lab',
      tagline: 'Centre of Excellence in Vocational & Technical Training'
    };
  }
}

/**
 * Update college titles in DOM
 */
async function applyCollegeBranding() {
  try {
    const settings = await getCollegeSettings();
    const collegeElements = document.querySelectorAll('.college-name-display');
    collegeElements.forEach(el => {
      el.textContent = settings.collegeName;
    });
    const labElements = document.querySelectorAll('.lab-name-display');
    labElements.forEach(el => {
      el.textContent = settings.labName || 'Main Computer Lab';
    });
  } catch (e) {
    // Graceful fallback
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyCollegeBranding();
});
