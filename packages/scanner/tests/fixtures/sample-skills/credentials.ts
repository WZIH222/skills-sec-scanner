/**
 * Low threat sample - credentials in environment variables
 * Should trigger LOW severity finding
 */

const API_KEY = process.env.API_KEY || 'default-key';
const DATABASE_URL = process.env.DATABASE_URL || 'localhost:5432';
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

export function getApiKey(): string {
  // LOW: Hardcoded fallback for sensitive data
  return API_KEY;
}

export function connectToDatabase(): string {
  // LOW: Exposing database connection string
  return DATABASE_URL;
}

export function uploadToS3(): void {
  // LOW: Using AWS credentials from environment
  const secret = AWS_SECRET_KEY || 'fallback-secret';
  console.log('Uploading with secret:', secret);
}

export function processPayment(): void {
  // LOW: Exposing Stripe secret
  if (STRIPE_SECRET) {
    console.log('Processing payment with Stripe');
  }
}

export const config = {
  apiKey: API_KEY,
  dbUrl: DATABASE_URL,
  awsSecret: AWS_SECRET_KEY,
  stripeKey: STRIPE_SECRET,
};

// LOW: Potential credential leakage in error messages
export function handleError(error: Error): void {
  console.error('Error with API:', API_KEY, error.message);
}
