import Stripe from 'stripe';

let stripeSingleton: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  if (!stripeSingleton) {
    // Use account/SDK default API version — avoid pinning a version the types don't match.
    stripeSingleton = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeSingleton;
}

export function appUrl(path = ''): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
