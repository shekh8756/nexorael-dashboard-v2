import AdminSidebar from "./components/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f6f8",
        color: "#1f2933",
      }}
    >
      <AdminSidebar />

      {/* Main area */}
      <div
        style={{
          marginLeft: "240px",
          minHeight: "100vh",
        }}
      >
        {/* Top bar */}
        <header
          style={{
            height: "64px",
            background: "#343434",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            position: "sticky",
            top: 0,
            zIndex: 40,
            borderBottom: "1px solid #454545",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <button
              type="button"
              aria-label="Toggle menu"
              style={{
                border: "none",
                background: "transparent",
                color: "#ffffff",
                fontSize: "22px",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              ☰
            </button>

            <strong
              style={{
                fontSize: "18px",
                fontWeight: 600,
              }}
            >
              Admin Panel
            </strong>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                background: "#d1d5db",
                color: "#374151",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              👤
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.2,
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                Admin
              </span>

              <span
                style={{
                  fontSize: "11px",
                  color: "#cbd5e1",
                }}
              >
                Nexorael
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          style={{
            minHeight: "calc(100vh - 64px)",
            padding: "24px",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}