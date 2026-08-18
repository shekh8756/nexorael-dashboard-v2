"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: "▣",
  },
  {
    label: "Release Management",
    href: "/admin/releases",
    icon: "♫",
  },
  {
    label: "Artists",
    href: "/admin/artists",
    icon: "♟",
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: "♙",
  },
  {
    label: "White Labels",
    href: "/admin/white-labels",
    icon: "◆",
  },
  {
    label: "Royalties",
    href: "/admin/royalties",
    icon: "◉",
  },
  {
    label: "Withdrawals",
    href: "/admin/withdrawals",
    icon: "↗",
  },
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: "▥",
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: "⚙",
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: "240px",
        minWidth: "240px",
        minHeight: "100vh",
        background: "#1f2a2f",
        color: "#ffffff",
        borderRight: "1px solid #303b40",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 50,
      }}
    >
      {/* Brand */}
      <div
        style={{
          height: "64px",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          background: "#343434",
          borderBottom: "1px solid #454545",
          fontSize: "20px",
          fontWeight: 700,
        }}
      >
        <span style={{ marginRight: "12px" }}>♫</span>
        Nexorael
      </div>

      {/* Navigation */}
      <nav style={{ paddingTop: "12px" }}>
        {menuItems.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "13px",
                height: "48px",
                padding: "0 20px",
                textDecoration: "none",
                color: active ? "#ffffff" : "#cbd5d8",
                background: active ? "#34444a" : "transparent",
                borderLeft: active
                  ? "3px solid #38bdf8"
                  : "3px solid transparent",
                fontSize: "14px",
                fontWeight: active ? 600 : 400,
                transition: "all 0.15s ease",
              }}
            >
              <span
                style={{
                  width: "20px",
                  textAlign: "center",
                  fontSize: "17px",
                }}
              >
                {item.icon}
              </span>

              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}