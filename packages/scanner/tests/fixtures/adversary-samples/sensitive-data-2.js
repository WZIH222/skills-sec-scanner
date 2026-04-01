/**
 * Sensitive Data Exposure Sample 2: Hardcoded Google API key
 *
 * This demonstrates exposure of Google API credentials.
 * Google API keys follow the pattern: AIza[A-Za-z0-9_-]{35}
 *
 * CVSS: 8.6 (High)
 * CWE-798
 */

const { GoogleAuth } = require('google-auth-library');

// VULNERABLE: Hardcoded Google API key
const GOOGLE_API_KEY = 'AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe';

async function callGoogleMapsAPI(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;

  const response = await fetch(url);
  return response.json();
}

// Another vulnerable pattern with Google Cloud
const googleCloudConfig = {
  apiKey: 'AIzaSyC-1aB2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q',
  projectId: 'my-project-12345'
};

// Vulnerable pattern with Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyAaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQq',
  authDomain: 'my-app.firebaseapp.com',
  projectId: 'my-app',
  storageBucket: 'my-app.appspot.com'
};

module.exports = { callGoogleMapsAPI, googleCloudConfig, firebaseConfig };
