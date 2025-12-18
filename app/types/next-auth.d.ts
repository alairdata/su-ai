import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      plan: "Free" | "Pro" | "Enterprise";
      messagesUsedToday: number;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    plan: "Free" | "Pro" | "Enterprise";
    messagesUsedToday: number;
  }
}