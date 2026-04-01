/**
 * Safe Sample 5: API Client for Trusted Endpoints
 *
 * This demonstrates safe usage of fetch and HTTP clients.
 * These patterns are NOT vulnerable because:
 * - URLs are hardcoded to trusted endpoints
 * - No user input influences request URLs or headers
 * - Proper error handling is implemented
 *
 * Expected findings: None (or info-level only)
 */

// SAFE: Fetching from hardcoded, trusted API endpoint
async function fetchWeatherData(city) {
  // City parameter is used only as query param, not in URL construction
  const url = `https://api.weather.com/v1/current?city=${encodeURIComponent(city)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  return response.json();
}

// SAFE: Fetching user data from own backend
async function fetchUserProfile(userId) {
  // URL is hardcoded to own API (not user-controlled)
  const url = `https://api.myapp.com/v1/users/${encodeURIComponent(userId)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`);
  }

  return response.json();
}

// SAFE: Posting to known endpoint
async function submitContactForm(formData) {
  // Endpoint is hardcoded
  const url = 'https://api.myapp.com/v1/contact';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(formData)
  });

  return response.json();
}

// SAFE: Making request with authentication token from environment
async function fetchProtectedResource() {
  const apiUrl = process.env.API_URL || 'https://api.example.com';
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error('API_KEY environment variable is required');
  }

  const response = await fetch(`${apiUrl}/v1/resource`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

// SAFE: Webhook delivery to known endpoint
async function deliverWebhook(webhookUrl, payload) {
  // webhookUrl is from database (validated on save), not user input
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'MyApp/1.0'
    },
    body: JSON.stringify(payload),
    // Timeout to prevent hanging
    signal: AbortSignal.timeout(5000)
  });

  return response.ok;
}

module.exports = {
  fetchWeatherData,
  fetchUserProfile,
  submitContactForm,
  fetchProtectedResource,
  deliverWebhook
};
