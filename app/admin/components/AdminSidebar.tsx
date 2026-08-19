"use client";

import Link from "next/link";
import {
  usePathname,
} from "next/navigation";

const menuItems = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: "▦",
  },
  {
    label:
      "Release Management",
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
    icon: "◎",
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
  label: "Invitations",
  href: "/admin/invitations",
  icon: "✉",
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: "⚙",
  },
];

export default function AdminSidebar() {
  const pathname =
    usePathname();

  function isActive(
    href: string
  ) {
    if (href === "/admin") {
      return pathname === "/admin";
    }

    return pathname.startsWith(
      href
    );
  }

  return (
    <aside
      style={{
        width: "240px",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 50,
        background:
          "linear-gradient(180deg,#071525 0%,#0a1928 100%)",
        borderRight:
          "1px solid #162638",
        display: "flex",
        flexDirection:
          "column",
        overflowY: "auto",
        boxShadow:
          "8px 0 30px rgba(0,0,0,0.18)",
      }}
    >
      {/* LOGO */}
      <div
        style={{
          height: "70px",
          display: "flex",
          alignItems: "center",
          padding: "0 22px",
          borderBottom:
            "1px solid #162638",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              fontSize: "23px",
              color: "#38bdf8",
            }}
          >
            ♫
          </div>

          <strong
            style={{
              fontSize: "21px",
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing:
                "-0.03em",
            }}
          >
            Nexorael
          </strong>
        </div>
      </div>

      {/* NAV */}
      <nav
        style={{
          padding: "14px 10px",
          display: "flex",
          flexDirection:
            "column",
          gap: "4px",
        }}
      >
        {menuItems.map(
          (item) => {
            const active =
              isActive(
                item.href
              );

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  textDecoration:
                    "none",
                  color: active
                    ? "#ffffff"
                    : "#b8c4d4",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: "13px",
                    minHeight:
                      "46px",
                    padding:
                      "0 14px",
                    borderRadius:
                      "10px",
                    position:
                      "relative",
                    background:
                      active
                        ? "linear-gradient(90deg,rgba(14,165,233,0.24),rgba(37,99,235,0.20))"
                        : "transparent",
                    border:
                      active
                        ? "1px solid rgba(56,189,248,0.22)"
                        : "1px solid transparent",
                    boxShadow:
                      active
                        ? "0 8px 24px rgba(14,165,233,0.10)"
                        : "none",
                    transition:
                      "all 0.2s ease",
                  }}
                >
                  {active && (
                    <span
                      style={{
                        position:
                          "absolute",
                        left: "-10px",
                        top: "8px",
                        bottom: "8px",
                        width: "3px",
                        borderRadius:
                          "0 4px 4px 0",
                        background:
                          "#38bdf8",
                        boxShadow:
                          "0 0 14px rgba(56,189,248,0.8)",
                      }}
                    />
                  )}

                  <span
                    style={{
                      width: "20px",
                      textAlign:
                        "center",
                      fontSize:
                        "16px",
                      color: active
                        ? "#38bdf8"
                        : "#8fa3b8",
                    }}
                  >
                    {item.icon}
                  </span>

                  <span
                    style={{
                      fontSize:
                        "13px",
                      fontWeight:
                        active
                          ? 700
                          : 500,
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          }
        )}
      </nav>

      {/* BOTTOM CARD */}
      <div
        style={{
          marginTop: "auto",
          padding: "14px",
        }}
      >
        <div
          style={{
            border:
              "1px solid #162638",
            background:
              "rgba(15,30,47,0.7)",
            borderRadius:
              "14px",
            padding: "14px",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "13px",
            }}
          >
            Nexorael Music
          </div>

          <div
            style={{
              marginTop: "6px",
              color: "#38bdf8",
              fontSize: "11px",
            }}
          >
            Admin
          </div>

          <div
            style={{
              marginTop: "4px",
              color: "#64748b",
              fontSize: "11px",
            }}
          >
            Music Distribution
          </div>
        </div>
      </div>
    </aside>
  );
}