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
        background:
          "linear-gradient(180deg, #06101d 0%, #07111f 100%)",
        color: "#f8fafc",
      }}
    >
      <AdminSidebar />

      {/* MAIN AREA */}
      <div
        style={{
          marginLeft: "240px",
          minHeight: "100vh",
          background:
            "linear-gradient(180deg, #06101d 0%, #081321 100%)",
        }}
      >
        {/* TOP BAR */}
        <header
          style={{
            height: "70px",
            background:
              "rgba(6, 16, 29, 0.96)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            padding: "0 28px",
            position: "sticky",
            top: 0,
            zIndex: 40,
            borderBottom:
              "1px solid #182536",
            backdropFilter:
              "blur(14px)",
            boxShadow:
              "0 8px 30px rgba(0,0,0,0.18)",
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
                background:
                  "transparent",
                color: "#cbd5e1",
                fontSize: "24px",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              ☰
            </button>

            <strong
              style={{
                fontSize: "20px",
                fontWeight: 700,
                letterSpacing:
                  "-0.02em",
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
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg,#0ea5e9,#2563eb)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "center",
                fontSize: "18px",
                boxShadow:
                  "0 0 20px rgba(14,165,233,0.25)",
              }}
            >
              👤
            </div>

            <div
              style={{
                display: "flex",
                flexDirection:
                  "column",
                lineHeight: 1.2,
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                Admin
              </span>

              <span
                style={{
                  fontSize: "11px",
                  color: "#7dd3fc",
                }}
              >
                Nexorael
              </span>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main
          style={{
            minHeight:
              "calc(100vh - 70px)",
            padding: "24px",
            background:
              "transparent",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}