import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      plan: "Free" | "Pro" | "Plus";
      messagesUsedToday: number;
      isNewUser?: boolean;
      timezone?: string;
      subscriptionStatus?: string;
      currentPeriodEnd?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    plan: "Free" | "Pro" | "Plus";
    messagesUsedToday: number;
    isNewUser?: boolean;
    timezone?: string;
    subscriptionStatus?: string;
    currentPeriodEnd?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    plan?: string;
    messagesUsedToday?: number;
    isNewUser?: boolean;
    timezone?: string;
  }
}