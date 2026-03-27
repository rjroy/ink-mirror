"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/write", label: "Write" },
  { href: "/entries", label: "Entries" },
  { href: "/curate", label: "Curate" },
  { href: "/profile", label: "Profile" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", gap: "1.5rem", padding: "1rem 2rem", borderBottom: "1px solid #e5e5e5" }}>
      <Link href="/" style={{ fontWeight: 600, textDecoration: "none", color: "#111", marginRight: "1rem" }}>
        ink-mirror
      </Link>
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          style={{
            textDecoration: "none",
            color: pathname.startsWith(href) ? "#111" : "#666",
            fontWeight: pathname.startsWith(href) ? 600 : 400,
          }}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
