import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const { data: user } = await supabase
          .from("users")
          .select("*")
          .eq("email", credentials.email)
          .single();

        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password_hash);
        
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          messagesUsedToday: user.messages_used_today,
        };
      }
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        
        const { data: user } = await supabase
          .from("users")
          .select("plan, messages_used_today, last_reset_date")
          .eq("id", token.sub)
          .single();

        if (user) {
          const today = new Date().toISOString().split('T')[0];
          if (user.last_reset_date !== today) {
            await supabase
              .from("users")
              .update({ 
                messages_used_today: 0, 
                last_reset_date: today 
              })
              .eq("id", token.sub);
            
            session.user.plan = user.plan;
            session.user.messagesUsedToday = 0;
          } else {
            session.user.plan = user.plan;
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
  session: {
    strategy: "jwt",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };