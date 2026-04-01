/**
 * Sensitive Data Exposure Threat Sample
 *
 * This sample demonstrates hardcoded credentials and sensitive data
 * exposure vulnerabilities that can lead to unauthorized access.
 *
 * Severity: High
 * References:
 * - https://github.com/marcuspat/secret-scan
 * - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
 */

// Example 1: AWS Access Key ID (High)
const AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE'
const AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'

// Example 2: AWS Session Token (High)
const awsSessionToken = 'FwoGZXIvYXdzEBYaDGURR///1eP4gDIJ4yEXAMPLESESSIONTOKEN'

// Example 3: Google API Key (High)
const googleApiKey = 'AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe'

// Example 4: Google OAuth Client ID (High)
const googleClientId = '123456789-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com'

// Example 5: GitHub Personal Access Token (High)
const githubToken = 'ghp_1234567890abcdef1234567890abcdef12345678'

// Example 6: GitHub OAuth App Token (High)
const githubAppToken = 'gho_1234567890abcdefghijklmnopqrstuvwxyz123456'

// Example 7: GitHub Refresh Token (High)
const githubRefreshToken = 'ghr_1234567890abcdefghijklmnopqrstuvwxyz123456'

// Example 8: Slack API Token (High)
const slackToken = 'xoxb-1234567890-1234567890123-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234'

// Example 9: Slack User Token (High)
const slackUserToken = 'xoxp-1234567890-1234567890123-1234567890123-abcdefghijklmnopqrstuvwxyz123456'

// Example 10: Stripe API Key (High)
const stripeSecretKey = 'sk_live_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcdef'

// Example 11: Stripe Publishable Key (Medium)
const stripePublicKey = 'pk_live_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcdef'

// Example 12: Twilio Account SID (High)
const twilioAccountSid = 'AC1234567890abcdef1234567890abcdef'

// Example 13: Twilio Auth Token (High)
const twilioAuthToken = '1234567890abcdef1234567890abcdef12'

// Example 14: SendGrid API Key (High)
const sendgridApiKey = 'SG.abcdefghijklmnopqrstuvwxyz1234567890abcdef.1234567890abcdef'

// Example 15: Mailgun API Key (High)
const mailgunApiKey = 'key-1234567890abcdef1234567890abcdef'

// Example 16: Datadog API Key (High)
const datadogApiKey = '1234567890abcdef1234567890abcdef'

// Example 17: PagerDuty API Key (High)
const pagerdutyApiKey = 'PUP1234567890abcdef1234567890abcdef'

// Example 18: New Relic Insights Key (High)
const newRelicKey = 'NRAK-1234567890abcdef1234567890abcdef123456'

// Example 19: Splunk HEC Token (High)
const splunkToken = 'Splunk 1234567890abcdef1234567890abcdef12345678='

// Example 20: Firebase Private Key (Critical)
const firebasePrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA2a2j9z8/l/Xm2Nx9/abcdefghijklmnopqrstuvwxyz1234567890
abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890
abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890
abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890
abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890
abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890
abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890
abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890
abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890
abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890
qwertyuiopasdfghjklzxcvbnm1234567890
-----END RSA PRIVATE KEY-----`

// Example 21: Database connection string (High)
const databaseUrl = 'postgresql://user:password123@localhost:5432/dbname'

// Example 22: MongoDB connection string (High)
const mongoUrl = 'mongodb://admin:secretpass@localhost:27017/authdb'

// Example 23: Redis connection string (High)
const redisUrl = 'redis://:defaultpassword@localhost:6379'

// Example 24: SMTP credentials (High)
const smtpConfig = {
  host: 'smtp.gmail.com',
  port: 587,
  auth: {
    user: 'user@gmail.com',
    pass: 'app-specific-password-123'
  }
}

// Example 25: API Keys in configuration (High)
const config = {
  aws: {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
  },
  stripe: {
    secretKey: 'sk_live_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcdef'
  },
  github: {
    token: 'ghp_1234567890abcdef1234567890abcdef12345678'
  }
}

// Example 26: JWT Secret (Critical)
const jwtSecret = 'my-super-secret-jwt-key-12345678901234567890'

// Example 27: Encryption key (Critical)
const encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

// Example 28: Password in URL (High)
const legacyApiUrl = 'https://admin:password123@api.example.com/data'

// Example 29: OAuth client secret (High)
const oauthClientSecret = 'abcdefghijklmnopqrstuvwxyz1234567890abcdef'

// Example 30: Private SSH key (Critical)
const sshPrivateKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACB/abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz
1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz
1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz
1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz
1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz
qwertyuiopasdfghjklzxcvbnm1234567890
-----END OPENSSH PRIVATE KEY-----`

// Example 31: Base64 encoded secret (High)
const base64Secret = 'bXktc2VjcmV0LWtleS0xMjM0NTY3ODkwYWJjZGVm'

// Example 32: Slack Webhook URL (High)
const slackWebhook = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX'

// Example 33: Discord Webhook URL (High)
const discordWebhook = 'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz1234567890'

// Example 34: Heroku API Key (High)
const herokuApiKey = '01234567-89ab-cdef-0123-456789abcdef'

// Example 35: npm auth token (Medium)
const npmAuthToken = '_authToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

// Example 36: Docker Hub credentials (High)
const dockerHubToken = 'dkr_pat_abcdefghijklmnopqrstuvwxyz1234567890'

// Example 37: Grafana API Key (High)
const grafanaKey = 'eyJrIjoiabcdefgh1234567890abcdefghijklmnopqrstuvwxyz1234567890'

// Example 38: Jenkins API Token (High)
const jenkinsToken = '11abcdefghijklmnopqrstuvwxyz12345678901234567890'

// Example 39: SonarQube token (High)
const sonarToken = 'sqa_abcdefghijklmnopqrstuvwxyz12345678901234567890123'

// Example 40: Jira API Token (High)
const jiraToken = 'abcdefghijklmnopqrstuvwxyz1234567890123456789012'

// Example 41: Okta API Token (High)
const oktaToken = '00abcdefghijklmnopqrstuvwxyz1234567890123456789012345678'

// Example 42: Auth0 Client Secret (High)
const auth0Secret = 'abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890'

// Example 43: Azure Storage Key (High)
const azureStorageKey = 'abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz12345678901234567890=='

// Example 44: Azure Client Secret (High)
const azureClientSecret = 'abc123~XYZ456-abcdef7890-ghij1234'

// Example 45: Google Service Account Key (Critical)
const googleServiceAccount = {
  "type": "service_account",
  "project_id": "my-project",
  "private_key_id": "1234567890abcdef",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "service-account@my-project.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}

// Example 46: LinkedIn Client Secret (High)
const linkedinSecret = 'abcdefghijklmnopqrstuvwxyz1234567890'

// Example 47: Twitter API Key (High)
const twitterApiKey = 'abcdefghijklmnopqrstuvwxyz1234567890'

// Example 48: Twitter API Secret (High)
const twitterApiSecret = 'abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890'

// Example 49: Facebook App Secret (High)
const facebookAppSecret = 'abcdefghijklmnopqrstuvwxyz1234567890'

// Example 50: Instagram Access Token (High)
const instagramToken = 'IGQVJ...abcdefghijklmnopqrstuvwxyz1234567890...'

module.exports = {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  googleApiKey,
  githubToken,
  stripeSecretKey,
  jwtSecret,
  encryptionKey,
  config
}
