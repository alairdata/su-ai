import { Providers } from "./providers";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "UnFiltered-AI",
  description: "Your intelligent AI assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className={inter.className} style={{ margin: 0, padding: 0, overflowX: 'hidden', width: '100%' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}