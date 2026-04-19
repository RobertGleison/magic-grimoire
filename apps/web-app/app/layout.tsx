import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "./context/UserContext";
import SpineNav from "./components/SpineNav";

export const metadata: Metadata = {
  title: "Magic Grimoire",
  description: "Whisper thine desire into the tome, and it shall render sixty cards of purest intent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
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
        </UserProvider>
      </body>
    </html>
  );
}
