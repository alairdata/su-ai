// Centralized plan configuration - single source of truth
// Import limits from shared constants (safe for client/server)
import { PLAN_LIMITS } from './constants';
export { PLAN_LIMITS };

// VIP emails that get free Plus access (comma-separated in env var)
export const VIP_EMAILS = (process.env.VIP_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(email => email.length > 0);

/**
 * Check if an email is a VIP (gets free Plus access)
 */
export function isVipEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return VIP_EMAILS.includes(email.toLowerCase());
}

/**
 * Get the effective plan for a user (considering VIP override)
 */
export function getEffectivePlan(
  dbPlan: string | null | undefined,
  email: string | null | undefined
): string {
  // VIP emails always get Plus
  if (isVipEmail(email)) {
    return 'Plus';
  }
  return dbPlan || 'Free';
}

/**
 * Get the daily message limit for a plan
 */
export function getPlanLimit(plan: string): number {
  return PLAN_LIMITS[plan] || PLAN_LIMITS['Free'];
}
