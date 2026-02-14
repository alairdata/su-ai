"use client";

import { useEffect } from "react";
import mixpanel from "mixpanel-browser";

export default function MixpanelInit() {
  useEffect(() => {
    mixpanel.init("f7f0420f484f10149af49240230f2c9d", {
      autocapture: true,
      record_sessions_percent: 100,
    });
  }, []);

  return null;
}
