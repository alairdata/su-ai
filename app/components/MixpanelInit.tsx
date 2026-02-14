"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import mixpanel from "mixpanel-browser";

let initialized = false;

export default function MixpanelInit() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!initialized) {
      mixpanel.init("f7f0420f484f10149af49240230f2c9d", {
        autocapture: true,
        record_sessions_percent: 100,
      });
      initialized = true;
    }
  }, []);

  useEffect(() => {
    if (initialized && session?.user) {
      mixpanel.identify(session.user.id);
      mixpanel.people.set({
        $name: session.user.name,
        $email: session.user.email,
        plan: session.user.plan,
      });
    }
  }, [session]);

  return null;
}
