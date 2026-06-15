import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Footer from "@/components/Footer"; // Adjust path based on your folder structure
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Viewport configuration optimized for mobile responsiveness and hybrid app wrappers
export const viewport: Viewport = {
  themeColor: "#020617", // Matches Slate-950 background
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Comprehensive SEO & Social Graph Metadata Configuration
export const metadata: Metadata = {
  title: {
    default: "Dual-Stream Deepfake Detector | Real-Time Media Verification",
    template: "%s | Dual-Stream Detector",
  },
  description: "Advanced web application utilizing unified spatial features and frequency domain DCT math to detect synthetic media distortions in real-time.",
  keywords: ["Deepfake Detection", "Media Verification", "Dual-Stream Neural Network", "AI Ethics", "Frequency Domain Analysis"],
  authors: [{ name: "Micheal Akoh-Idoko Idoko" }],
  creator: "Micheal Akoh-Idoko Idoko",
  metadataBase: new URL("https://yourdomain.com"), // Update with your deployment URL later
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Dual-Stream Deepfake Detector",
    description: "Verify media authenticity instantly via spatial-frequency anomaly mapping.",
    url: "https://yourdomain.com",
    siteName: "Dual-Stream Detector",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dual-Stream Deepfake Detector",
    description: "Real-time deepfake analysis running optimized edge-ready multi-stream networks.",
    creator: "@AkohTech",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-950 text-slate-100 flex flex-col antialiased">
        {/* Main Content Area stretches to push the footer down if content is short */}
        <div className="flex-1 flex flex-col">
          {children}
        </div>

        {/* Globally Integrated Sticky Footer */}
        <Footer />
      </body>
    </html>
  );
}