import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = [
  "master_admin",
  "admin",
  "white_label_admin",
];

const BLOCKED_STATUSES = [
  "blocked",
  "disabled",
  "suspended",
  "inactive",
];

const MAX_NOTE_LENGTH = 4000;

type AdminProfile = {
  id: string;
  role?: string | null;
  status?: string | null;
  white_label_id?: string | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

/* ======================================================
   VERIFY ADMIN
====================================================== */

async function authorizeAdmin(request: NextRequest) {
  const authorization =
    request.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    throw new Error("Unauthorized.");
  }

  const accessToken = authorization
    .slice("Bearer ".length)
    .trim();

  if (!accessToken) {
    throw new Error("Unauthorized.");
  }

  const {
    data: userData,
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !userData.user) {
    throw new Error("Invalid or expired admin session.");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabaseAdmin
    .from("profiles")
    .select("id,role,status,white_label_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `Unable to verify admin profile: ${profileError.message}`
    );
  }

  if (!profile) {
    throw new Error("Admin profile was not found.");
  }

  const normalizedProfile: AdminProfile = {
    ...profile,
    role: clean(profile.role).toLowerCase(),
    status: clean(profile.status).toLowerCase(),
  };

  if (
    !ALLOWED_ROLES.includes(
      normalizedProfile.role || ""
    )
  ) {
    throw new Error(
      "You are not authorized to manage release review information."
    );
  }

  if (
    BLOCKED_STATUSES.includes(
      normalizedProfile.status || ""
    )
  ) {
    throw new Error(
      "This admin account is not active."
    );
  }

  return {
    user: userData.user,
    profile: normalizedProfile,
  };
}

/* ======================================================
   VERIFY RELEASE ACCESS
====================================================== */

async function getAllowedReleases(
  releaseIds: string[],
  profile: AdminProfile
) {
  const {
    data: releases,
    error,
  } = await supabaseAdmin
    .from("releases")
    .select(
      "id,title,white_label_id,toolost_release_id,status"
    )
    .in("id", releaseIds);

  if (error) {
    throw new Error(
      `Unable to load releases: ${error.message}`
    );
  }

  const rows = releases || [];

  if (rows.length !== releaseIds.length) {
    throw new Error(
      "One or more selected releases could not be found."
    );
  }

  if (
    profile.role === "white_label_admin"
  ) {
    if (!profile.white_label_id) {
      throw new Error(
        "White-label account is not configured correctly."
      );
    }

    const forbidden = rows.find(
      (release) =>
        String(release.white_label_id || "") !==
        String(profile.white_label_id)
    );

    if (forbidden) {
      throw new Error(
        "You cannot manage review information for this release."
      );
    }
  }

  return rows;
}

/* ======================================================
   GET REVIEW INFO
====================================================== */

export async function GET(request: NextRequest) {
  try {
    const { profile } =
      await authorizeAdmin(request);

    const { searchParams } =
      new URL(request.url);

    const releaseId =
      clean(searchParams.get("releaseId"));

    if (!releaseId) {
      return NextResponse.json(
        {
          success: false,
          error: "releaseId is required.",
        },
        {
          status: 400,
        }
      );
    }

    await getAllowedReleases(
      [releaseId],
      profile
    );

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("release_review_info")
      .select(
        "id,release_id,review_note,file_name,file_type,file_url,storage_path,created_by,created_at,updated_at"
      )
      .eq("release_id", releaseId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to load review information: ${error.message}`
      );
    }

    return NextResponse.json({
      success: true,
      review: data || null,
    });
  } catch (error) {
    console.error(
      "GET RELEASE REVIEW INFO:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load review information.",
      },
      {
        status: 403,
      }
    );
  }
}

/* ======================================================
   SAVE SINGLE / BULK REVIEW INFO
====================================================== */

export async function POST(request: NextRequest) {
  try {
    const { user, profile } =
      await authorizeAdmin(request);

    const body = await request.json();

    const rawReleaseIds =
      Array.isArray(body?.releaseIds)
        ? body.releaseIds
        : body?.releaseId
        ? [body.releaseId]
        : [];

    const releaseIds: string[] = Array.from(
  new Set<string>(
    rawReleaseIds
      .map((value: unknown) => clean(value))
      .filter(
        (value: string): value is string =>
          value.length > 0
      )
  )
);

    if (releaseIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "At least one release must be selected.",
        },
        {
          status: 400,
        }
      );
    }

    const reviewNote =
      clean(body?.reviewNote);

    const fileName =
      clean(body?.fileName);

    const fileType =
      clean(body?.fileType);

    const fileUrl =
      clean(body?.fileUrl);

    const storagePath =
      clean(body?.storagePath);

    if (
      reviewNote.length >
      MAX_NOTE_LENGTH
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Review note cannot exceed 4000 characters.",
        },
        {
          status: 400,
        }
      );
    }

    if (fileName.length > 255) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Document file name cannot exceed 255 characters.",
        },
        {
          status: 400,
        }
      );
    }

    if (fileType.length > 40) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Document file type cannot exceed 40 characters.",
        },
        {
          status: 400,
        }
      );
    }

    if (fileUrl.length > 2048) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Document URL is too long.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !reviewNote &&
      !fileUrl
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please enter review notes or upload a supporting document.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      fileUrl &&
      (!fileName || !fileType)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Document name and file type are required when a document is attached.",
        },
        {
          status: 400,
        }
      );
    }

    await getAllowedReleases(
      releaseIds,
      profile
    );

    const now =
      new Date().toISOString();

    const records =
      releaseIds.map(
        (releaseId) => ({
          release_id: releaseId,

          review_note:
            reviewNote || null,

          file_name:
            fileName || null,

          file_type:
            fileType || null,

          file_url:
            fileUrl || null,

          storage_path:
            storagePath || null,

          created_by:
            user.id,

          updated_at: now,
        })
      );

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("release_review_info")
      .upsert(records, {
        onConflict: "release_id",
      })
      .select(
        "id,release_id,review_note,file_name,file_type,file_url,storage_path,created_by,created_at,updated_at"
      );

    if (error) {
      throw new Error(
        `Unable to save review information: ${error.message}`
      );
    }

    return NextResponse.json({
      success: true,

      message:
        releaseIds.length === 1
          ? "Review information saved successfully."
          : `Review information saved to ${releaseIds.length} releases.`,

      count: releaseIds.length,

      reviews: data || [],
    });
  } catch (error) {
    console.error(
      "SAVE RELEASE REVIEW INFO:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to save review information.",
      },
      {
        status: 403,
      }
    );
  }
}