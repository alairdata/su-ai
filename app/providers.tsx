"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={60} // Refresh session every 60 seconds
      refetchOnWindowFocus={true} // Also refresh when tab becomes active
    >
      {children}
    </SessionProvider>
  );
}