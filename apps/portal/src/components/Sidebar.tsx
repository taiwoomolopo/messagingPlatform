"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Send, Megaphone, FileText, Radio, LogOut } from "lucide-react";
import { Brand } from "./Brand";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Traffic", icon: BarChart3 },
  { href: "/dashboard/send", label: "Send", icon: Send },
  { href: "/dashboard/blast", label: "Blast", icon: Megaphone },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/senders", label: "Senders", icon: Radio },
];

export function Sidebar({ email, onLogout }: { email: string | null; onLogout: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Brand />
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`sidebar-link ${pathname === href ? "active" : ""}`}>
            <Icon />
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        {email && <div className="sidebar-email">{email}</div>}
        <button onClick={onLogout} className="sidebar-link sidebar-link-button">
          <LogOut />
          Log out
        </button>
      </div>
    </aside>
  );
}
