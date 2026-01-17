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

          throw new Error("Invalid email or password");
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
        // For credentials login, user object has our custom fields
        if (account?.provider === "credentials") {
          token.id = user.id;
          token.plan = user.plan;
          token.messagesUsedToday = user.messagesUsedToday;
          token.isNewUser = false;
        } else {
          // For OAuth login, we need to fetch user data from database
          const { data: dbUser } = await supabase
            .from('users')
            .select('id, plan, messages_used_today, is_new_user')
            .eq('email', user.email?.toLowerCase())
            .single();

          if (dbUser) {
            token.id = dbUser.id;
            token.plan = dbUser.plan;
            token.messagesUsedToday = dbUser.messages_used_today;
            token.isNewUser = dbUser.is_new_user || false;
          }
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
        const { data: user } = await supabase
          .from('users')
          .select('plan, messages_used_today, last_reset_date, timezone')
          .eq('id', token.id)
          .single();

        if (user) {
          // Always use fresh plan from database (for upgrades to reflect immediately)
          session.user.plan = user.plan;
          session.user.timezone = user.timezone || 'UTC';

          // Calculate midnight in user's timezone (server-side, no client manipulation possible)
          const userTimezone = user.timezone || 'UTC';
          const now = new Date();

          // Get current date in user's timezone
          const userDateStr = now.toLocaleDateString('en-CA', { timeZone: userTimezone }); // YYYY-MM-DD format
          const lastResetStr = user.last_reset_date
            ? new Date(user.last_reset_date).toLocaleDateString('en-CA', { timeZone: userTimezone })
            : null;

          // Reset if last reset was on a different day in user's timezone
          if (!lastResetStr || lastResetStr !== userDateStr) {
            await supabase
              .from('users')
              .update({
                messages_used_today: 0,
                last_reset_date: now.toISOString(),
              })
              .eq('id', token.id);

            session.user.messagesUsedToday = 0;
          } else {
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
