import {
  redirect,
} from "next/navigation";

import {
  createServerSupabaseClient,
} from "@/lib/supabase/server";

import AdminSidebar
  from "./components/AdminSidebar";

export default async function
AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase =
    await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (
    userError ||
    !user
  ) {
    redirect(
      "/admin-login"
    );
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select(
        "role,status"
      )
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.status !==
      "active" ||
    ![
      "master_admin",
      "white_label_admin",
    ].includes(
      profile.role
    )
  ) {
    redirect(
      "/admin-login"
    );
  }

  return (
    <div
      style={{
        minHeight:
          "100vh",

        background:
          "linear-gradient(180deg,#06101d 0%,#081321 100%)",

        color:
          "#f8fafc",
      }}
    >
      <AdminSidebar />

      <div
        style={{
          marginLeft:
            "240px",

          minHeight:
            "100vh",
        }}
      >
        <header
          style={{
            height:
              "70px",

            background:
              "rgba(6,16,29,.96)",

            color:
              "#fff",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "space-between",

            padding:
              "0 28px",

            position:
              "sticky",

            top: 0,

            zIndex: 40,

            borderBottom:
              "1px solid #182536",
          }}
        >
          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              gap:
                "16px",
            }}
          >
            <span
              style={{
                fontSize:
                  "24px",
              }}
            >
              ☰
            </span>

            <strong
              style={{
                fontSize:
                  "20px",
              }}
            >
              Admin Panel
            </strong>
          </div>

          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              gap:
                "10px",
            }}
          >
            <div
              style={{
                width:
                  "40px",

                height:
                  "40px",

                borderRadius:
                  "50%",

                background:
                  "linear-gradient(135deg,#0ea5e9,#2563eb)",

                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "center",
              }}
            >
              👤
            </div>

            <div>
              <div
                style={{
                  fontSize:
                    "13px",

                  fontWeight:
                    700,
                }}
              >
                Admin
              </div>

              <div
                style={{
                  fontSize:
                    "11px",

                  color:
                    "#7dd3fc",
                }}
              >
                Nexorael
              </div>
            </div>
          </div>
        </header>

        <main
          style={{
            minHeight:
              "calc(100vh - 70px)",

            padding:
              "24px",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}