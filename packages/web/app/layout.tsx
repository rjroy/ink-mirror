import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ink Mirror",
  description: "A reading-room for your own writing.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-accent="verdigris">
      <body>
        <div className="im-app grain">
          <Nav />
          <main className="im-body">{children}</main>
        </div>
      </body>
    </html>
  );
}
