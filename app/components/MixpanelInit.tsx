"use client";

import Script from "next/script";

export default function MixpanelInit() {
  return (
    <>
      <Script
        id="mixpanel-lib"
        src="https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          (window as any).mixpanel.init('f7f0420f484f10149af49240230f2c9d', {
            autocapture: true,
            record_sessions_percent: 100,
          });
        }}
      />
    </>
  );
}
