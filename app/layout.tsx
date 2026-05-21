import { Providers } from "./providers";
import { Inter } from "next/font/google";
import Script from "next/script";
import type { Metadata } from "next";
import MixpanelInit from "./components/MixpanelInit";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "So UnFiltered AI",
  description: "Your intelligent AI assistant",
  icons: {
    icon: "/bolt-icon.png",
    apple: "/bolt-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function() {
            try {
              var theme = localStorage.getItem('theme') || 'dark';
              document.documentElement.setAttribute('data-theme', theme);
            } catch(e) {}
          })();
        `}</Script>
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "v9865bw1hp");
          `}
        </Script>
      </head>
      <body className={inter.className} style={{ margin: 0, padding: 0, overflowX: 'hidden', width: '100%' }}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <div style={{
          background: '#f59e0b',
          color: '#1a1a1a',
          textAlign: 'center',
          padding: '10px 16px',
          fontWeight: 600,
          fontSize: '14px',
          letterSpacing: '0.01em',
          zIndex: 9999,
          position: 'relative',
        }}>
          ⚠️ System Downtime — Options will resume soon
        </div>
        <Providers>
          <MixpanelInit />
          {children}
        </Providers>
      </body>
    </html>
  );
}