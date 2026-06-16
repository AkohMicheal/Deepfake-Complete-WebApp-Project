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
    default: "Dual-Stream Deepfake Detector | Image & Video Verification",
    template: "%s | Dual-Stream Detector",
  },
  description: "Advanced deepfake detection for images and videos using dual-stream spatial-frequency neural network analysis. Upload photos or videos for instant AI-powered media verification.",
  keywords: ["Deepfake Detection", "Image Verification", "Video Verification", "Dual-Stream Neural Network", "AI Ethics", "Frequency Domain Analysis", "Face Manipulation Detection"],
  authors: [{ name: "Micheal Akoh-Idoko Idoko" }],
  creator: "Micheal Akoh-Idoko Idoko",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://deepfake-scanner.vercel.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Dual-Stream Deepfake Detector",
    description: "Verify image and video authenticity instantly via spatial-frequency anomaly mapping.",
    siteName: "Dual-Stream Detector",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dual-Stream Deepfake Detector",
    description: "Real-time deepfake analysis for images and videos using dual-stream neural networks.",
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