// Shared constants - safe for both client and server
// Keep these in sync! Backend enforces, frontend displays.

export const PLAN_LIMITS: Record<string, number> = {
  'Free': 5,
  'Pro': 100,
  'Plus': 300
};

export type PlanType = 'Free' | 'Pro' | 'Plus';
