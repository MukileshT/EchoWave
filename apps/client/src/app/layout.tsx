import { PostHogProvider } from "@/components/PostHogProvider";
import TQProvider from "@/components/TQProvider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EchoWave",
  description:
    "Turn every device into a synchronized speaker. EchoWave is an open-source music player for multi-device audio playback. Host a listening party today!",
  keywords: ["music", "sync", "audio", "collaboration", "real-time"],
  authors: [{ name: "Mukilesh" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EchoWave",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body
        className={cn(
          "antialiased font-sans selection:bg-primary-800 selection:text-white"
        )}
      >
        <PostHogProvider>
          <TQProvider>
            {children}
            <Toaster />
          </TQProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
