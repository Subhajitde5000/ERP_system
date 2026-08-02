import type { Metadata, Viewport } from "next";
import "./globals.css";

/*
 * Typography is defined as local/system stacks in globals.css.  Keeping fonts
 * local means a production build and first render do not depend on Google
 * Fonts being reachable from the build environment or a school network.
 */

export const metadata: Metadata = {
  title: {
    default: "xyz.com · Education, connected",
    template: "%s · xyz.com",
  },
  description:
    "Secure, multi-tenant ERP + LMS for schools and colleges. Attendance, exams, assignments, fees, hostel and more.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
