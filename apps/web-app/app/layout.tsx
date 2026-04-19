import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { UserProvider } from "./context/UserContext";
import SpineNav from "./components/SpineNav";
import AuthGate from "./components/AuthGate";

export const metadata: Metadata = {
  title: "Magic Grimoire",
  description: "AI-powered Magic: The Gathering deck builder. Describe your playstyle in plain language and get a balanced 60-card deck with real MTG cards — instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" data-accent="gold">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <UserProvider>
          <SpineNav />
          <div className="shell" id="app">
            {children}
          </div>
          <AuthGate />
        </UserProvider>
      </body>
    </html>
  );
}
