import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAccessToken() {
  const cookieStore = await cookies();

  return cookieStore.get(
    "toolost_access_token"
  )?.value;
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await context.params;

    const accessToken =
      await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Too Lost is not connected.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      response,
      data,
    } = await tooLostApi(
      accessToken,
      `releases/${id}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    return NextResponse.json(
      {
        success:
          response.ok,

        status:
          response.status,

        tooLostResponse:
          data,
      },
      {
        status:
          response.ok
            ? 200
            : response.status,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to fetch Too Lost release.",
      },
      {
        status: 500,
      }
    );
  }
}