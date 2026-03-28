"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./nav.module.css";

const links = [
  { href: "/write", label: "Write" },
  { href: "/entries", label: "Entries" },
  { href: "/curate", label: "Curate" },
  { href: "/profile", label: "Profile" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.wordmark}>
        ink<span className={styles.wordmarkSeparator}>-</span>mirror
      </Link>
      <nav className={styles.nav}>
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={pathname.startsWith(href) ? styles.navItemActive : styles.navItem}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
