import { z } from 'zod';

/**
 * Strict schema validation for all API inputs
 * - Type checking
 * - Length limits
 * - Format validation
 * - Rejects unexpected fields (.strict())
 */

// ============================================
// Common validators
// ============================================

const email = z
  .string()
  .min(1, 'Email is required')
  .max(255, 'Email too long')
  .email('Invalid email format')
  .transform(val => val.toLowerCase().trim());

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const name = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name too long')
  .transform(val => val.trim());

const uuid = z.string().uuid('Invalid ID format');

const message = z
  .string()
  .min(1, 'Message cannot be empty')
  .max(32000, 'Message too long (max 32,000 characters)');

const chatTitle = z
  .string()
  .min(1, 'Title cannot be empty')
  .max(200, 'Title too long')
  .transform(val => val.trim());

const timezone = z
  .string()
  .min(1, 'Timezone is required')
  .max(100, 'Invalid timezone')
  .refine(
    (tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Invalid timezone' }
  );

const plan = z.enum(['Pro', 'Plus'], {
  message: 'Invalid plan. Must be Pro or Plus',
});

// ============================================
// Auth Schemas
// ============================================

export const signupSchema = z.object({
  name,
  email,
  password,
}).strict(); // Reject unexpected fields

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128),
}).strict();

export const forgotPasswordSchema = z.object({
  email,
}).strict();

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required').max(500),
  password,
}).strict();

// ============================================
// Chat Schemas
// ============================================

export const createChatSchema = z.object({
  title: chatTitle.optional().default('New Chat'),
}).strict();

export const renameChatSchema = z.object({
  chatId: uuid,
  title: chatTitle,
}).strict();

export const deleteChatSchema = z.object({
  chatId: uuid,
}).strict();

// ============================================
// Message Schemas
// ============================================

export const sendMessageSchema = z.object({
  chatId: uuid,
  message,
}).strict();

// ============================================
// User Schemas
// ============================================

export const updateNameSchema = z.object({
  name,
}).strict();

export const updateTimezoneSchema = z.object({
  timezone,
}).strict();

// ============================================
// Payment Schemas
// ============================================

export const initializePaymentSchema = z.object({
  plan,
}).strict();

export const verifyPaymentSchema = z.object({
  session_id: z.string().min(1, 'Session ID is required').max(500),
}).strict();

// ============================================
// Validation helper
// ============================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Safely validate input against a schema
 * Returns parsed data or formatted error message
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): ValidationResult<T> {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format error message - get first issue message
  const firstIssue = result.error.issues?.[0];
  if (firstIssue) {
    const path = firstIssue.path.length > 0 ? `${String(firstIssue.path[0])}: ` : '';
    return { success: false, error: `${path}${firstIssue.message}` };
  }

  return { success: false, error: 'Invalid input' };
}

/**
 * Validate and return JSON response if invalid
 * Returns null if valid (data is in the result)
 */
export function validateOrError<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { data: T } | { error: Response } {
  const result = validateInput(schema, input);

  if (result.success) {
    return { data: result.data };
  }

  return {
    error: new Response(
      JSON.stringify({ error: result.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    ),
  };
}
