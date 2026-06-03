import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listUserGenerationsSummaries } from "@/db/generations";

/**
 * GET /api/generations
 * 
 * Returns the current user's generation history, ordered by most recent first.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const generations = await listUserGenerationsSummaries(userId);

    return NextResponse.json({
      success: true,
      generations,
    });
  } catch (error) {
    console.error("Error fetching generations:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch generations",
      },
      { status: 500 }
    );
  }
}