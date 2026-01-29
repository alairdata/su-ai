import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// VIP emails that get free Plus access (comma-separated in env var)
// Example: VIP_EMAILS=admin@example.com,vip@example.com
const VIP_EMAILS = (process.env.VIP_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(email => email.length > 0);

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        // Normalize email to lowercase for consistent lookup
        const normalizedEmail = credentials.email.toLowerCase().trim();

        // Check if user exists in users table (only verified users are here)
        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', normalizedEmail)
          .single();

        if (error || !user) {
          // Check if user is still pending verification
          const { data: pendingUser } = await supabase
            .from('pending_users')
            .select('email')
            .eq('email', normalizedEmail)
            .single();

          if (pendingUser) {
            throw new Error("Please verify your email before logging in. Check your inbox.");
          }

          throw new Error("NO_ACCOUNT");
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );

        if (!isValidPassword) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          messagesUsedToday: user.messages_used_today,
          totalMessages: user.total_messages || 0,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      // Handle OAuth sign in (Google/GitHub)
      if (account?.provider === "google" || account?.provider === "github") {
        const email = user.email?.toLowerCase();
        if (!email) return false;

        // Check if user already exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single();

        if (!existingUser) {
          // Create new user for OAuth sign-in
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              name: user.name || email.split('@')[0],
              email: email,
              password_hash: '', // No password for OAuth users
              plan: 'Free',
              messages_used_today: 0,
              email_verified: true, // OAuth emails are verified
              oauth_provider: account.provider,
              is_new_user: true, // Flag for welcome screen
            });

          if (insertError) {
            console.error('Failed to create OAuth user:', insertError);
            return false;
          }
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        // Initial login - set token.id
        if (account?.provider === "credentials") {
          token.id = user.id;
        } else {
          // For OAuth login, get user ID from database
          const { data: dbUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email?.toLowerCase())
            .single();

          if (dbUser) {
            token.id = dbUser.id;
          }
        }
      }

      // Always fetch fresh plan data from database on every JWT refresh
      // This ensures plan changes sync across all devices immediately
      if (token.id) {
        const { data: freshUser } = await supabase
          .from('users')
          .select('plan, messages_used_today, is_new_user')
          .eq('id', token.id)
          .single();

        if (freshUser) {
          token.plan = freshUser.plan;
          token.messagesUsedToday = freshUser.messages_used_today;
          token.isNewUser = freshUser.is_new_user || false;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.plan = token.plan as "Free" | "Pro" | "Plus";
        session.user.messagesUsedToday = token.messagesUsedToday as number;
        session.user.isNewUser = token.isNewUser as boolean;

        // Fetch fresh user data from database (including plan for upgrades)
        // First try with reset_timezone, fall back to without if column doesn't exist
        let user: {
          name: string;
          plan: "Free" | "Pro" | "Plus";
          messages_used_today: number;
          total_messages: number;
          last_reset_date: string | null;
          timezone: string | null;
          reset_timezone?: string | null;
          is_new_user?: boolean;
          subscription_status?: string | null;
          current_period_end?: string | null;
        } | null = null;

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('name, plan, messages_used_today, total_messages, last_reset_date, timezone, reset_timezone, is_new_user, subscription_status, current_period_end')
          .eq('id', token.id)
          .single();

        if (userError) {
          // Try without newer columns that might not exist
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('users')
            .select('name, plan, messages_used_today, last_reset_date, timezone, is_new_user, subscription_status, current_period_end')
            .eq('id', token.id)
            .single();

          if (fallbackError && fallbackError.code === 'PGRST116') {
            // PGRST116 = no rows returned = user actually deleted
            console.log('User not found in database, invalidating session:', token.id);
            session.user.id = '';
            session.user.plan = 'Free';
            session.user.isDeleted = true;
            return session;
          }

          user = fallbackData ? { ...fallbackData, total_messages: 0 } : null;
        } else {
          user = userData;
        }

        if (user) {
          // Always use fresh data from database (for name/plan/isNewUser updates to reflect immediately)
          session.user.name = user.name;
          session.user.plan = user.plan;
          session.user.timezone = user.timezone || 'UTC';
          session.user.isNewUser = user.is_new_user || false;
          session.user.subscriptionStatus = user.subscription_status || undefined;
          session.user.currentPeriodEnd = user.current_period_end || undefined;
          session.user.totalMessages = user.total_messages || 0;

          // VIP override: Give Plus access to special email addresses
          const userEmail = session.user.email?.toLowerCase();
          if (userEmail && VIP_EMAILS.includes(userEmail)) {
            session.user.plan = 'Plus';
          }

          // SECURITY: Use reset_timezone (the timezone at last reset) for calculations
          // This prevents abuse where users change timezone to trigger early resets
          // Falls back to current timezone if reset_timezone doesn't exist
          let resetTimezone = user.reset_timezone || user.timezone || 'UTC';
          const now = new Date();

          // Validate timezone - if invalid, fall back to UTC
          try {
            Intl.DateTimeFormat(undefined, { timeZone: resetTimezone });
          } catch {
            console.warn('Invalid timezone:', resetTimezone, '- falling back to UTC');
            resetTimezone = 'UTC';
          }

          // Get current date in the RESET timezone (not current user timezone)
          let currentDateStr: string;
          let lastResetStr: string | null = null;

          try {
            currentDateStr = now.toLocaleDateString('en-CA', { timeZone: resetTimezone }); // YYYY-MM-DD format
            if (user.last_reset_date) {
              lastResetStr = new Date(user.last_reset_date).toLocaleDateString('en-CA', { timeZone: resetTimezone });
            }
          } catch (dateError) {
            console.error('Date parsing error:', dateError);
            // Fall back to UTC
            currentDateStr = now.toLocaleDateString('en-CA', { timeZone: 'UTC' });
            if (user.last_reset_date) {
              lastResetStr = new Date(user.last_reset_date).toLocaleDateString('en-CA', { timeZone: 'UTC' });
            }
          }

          console.log('Reset check:', { currentDateStr, lastResetStr, resetTimezone, lastResetDate: user.last_reset_date });

          // Reset if last reset was on a different day in the RESET timezone
          if (!lastResetStr || lastResetStr !== currentDateStr) {
            console.log('Triggering reset - dates differ or no last reset');
            const { error: updateError } = await supabase
              .from('users')
              .update({
                messages_used_today: 0,
                last_reset_date: now.toISOString(),
              })
              .eq('id', token.id);

            if (updateError) {
              console.error('Failed to update last_reset_date:', updateError.message);
            }

            session.user.messagesUsedToday = 0;
          } else {
            console.log('No reset needed - same day');
            session.user.messagesUsedToday = user.messages_used_today;
          }
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
