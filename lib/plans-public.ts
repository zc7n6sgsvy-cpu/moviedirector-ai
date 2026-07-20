/**
 * Client-safe / route-safe re-exports of plan catalog (no secrets).
 */
import { planList, CREDIT_PACKS, CREDIT_COSTS, PLANS, getPlan } from '@/lib/plans';

export { planList, CREDIT_PACKS, CREDIT_COSTS, PLANS, getPlan };

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
