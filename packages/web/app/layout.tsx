import type { Metadata } from "next";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "ink-mirror",
  description: "A writing self-awareness tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <Nav />
        <main style={{ padding: "2rem" }}>{children}</main>
      </body>
    </html>
  );
}
