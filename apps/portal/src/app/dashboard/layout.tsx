import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav style={{ display: "flex", gap: 16, padding: "16px 48px", borderBottom: "1px solid #ddd" }}>
        <Link href="/dashboard">Traffic</Link>
        <Link href="/dashboard/send">Send</Link>
        <Link href="/dashboard/blast">Blast</Link>
        <Link href="/dashboard/reports">Reports</Link>
        <Link href="/dashboard/senders">Senders</Link>
      </nav>
      {children}
    </div>
  );
}
