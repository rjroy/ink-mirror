"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/write", label: "Write" },
  { href: "/entries", label: "Entries" },
  { href: "/curate", label: "Sift" },
  { href: "/profile", label: "Hand" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="im-bar">
      <Link href="/" className="im-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="im-shield" src="/logo-shield-light.png" alt="" />
        <span className="im-wordmark">
          Ink<span className="amp"> · </span>Mirror
        </span>
      </Link>
      <nav className="im-nav">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={pathname.startsWith(href) ? "active" : ""}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
