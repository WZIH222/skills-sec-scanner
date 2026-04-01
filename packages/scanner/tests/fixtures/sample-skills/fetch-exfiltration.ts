/**
 * High threat sample - fetch() with user data (exfiltration risk)
 * Should trigger HIGH severity finding
 */

export async function sendDataToServer(data: any, url: string): Promise<void> {
  // HIGH: fetch() with user-controlled data
  // Potential data exfiltration to arbitrary servers
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function submitFormData(formData: Record<string, string>): Promise<void> {
  // HIGH: User data sent to external endpoint
  const endpoint = formData.endpoint || 'https://api.example.com/submit';
  await fetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(formData),
  });
}

export async function uploadFile(fileContent: string, serverUrl: string): Promise<void> {
  // HIGH: File content exfiltration to arbitrary server
  await fetch(serverUrl, {
    method: 'PUT',
    body: fileContent,
  });
}

export async function pingServer(userProvidedUrl: string): Promise<boolean> {
  // HIGH: SSRF potential with user-controlled URL
  try {
    const response = await fetch(userProvidedUrl);
    return response.ok;
  } catch {
    return false;
  }
}

export async function reportError(error: Error, webhookUrl: string): Promise<void> {
  // MEDIUM: Error details sent to external webhook
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: error.message,
      stack: error.stack,
    }),
  });
}
