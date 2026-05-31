import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { transformImageWithFilter, type FilterSlug, PRESET_FILTERS } from "@/lib/ai";
import { uploadBufferToImagekit } from "@/lib/imagekit";
import { createGeneration, countGenerationsSince, utcMonthStart } from "@/db/generations";

// Monthly generation limit
const MONTHLY_LIMIT = 10;

// Response type
interface TransformImageResponse {
  success: boolean;
  resultImageUrl?: string;
  generationId?: string;
  error?: string;
  remainingGenerations?: number;
}

/**
 * POST /api/transform-image
 * 
 * Accepts a multipart form with:
 *   - file: the source image file
 *   - filterSlug: the filter to apply
 * 
 * Uploads source to ImageKit, transforms with AI, uploads result to ImageKit,
 * and stores the generation in the database.
 */
export async function POST(request: NextRequest): Promise<NextResponse<TransformImageResponse>> {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const fileField = formData.get("file") as File | null;
    const filterSlug = formData.get("filterSlug") as string | null;

    // Validate file
    if (!fileField) {
      return NextResponse.json(
        { success: false, error: "No image file provided" },
        { status: 400 }
      );
    }

    if (!fileField.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate filter slug
    if (!filterSlug || !(filterSlug in PRESET_FILTERS)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid filter. Choose from: ${Object.keys(PRESET_FILTERS).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Check monthly generation limit
    const monthStart = utcMonthStart();
    const generationsThisMonth = await countGenerationsSince(userId, monthStart);

    if (generationsThisMonth >= MONTHLY_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: `Monthly generation limit reached (${MONTHLY_LIMIT}). Please wait until next month.`,
          remainingGenerations: 0,
        },
        { status: 429 }
      );
    }

    const typedFilterSlug = filterSlug as FilterSlug;

    // Convert uploaded file to Buffer
    const fileArrayBuffer = await fileField.arrayBuffer();
    const sourceBuffer = Buffer.from(fileArrayBuffer);
    const timestamp = Date.now();
    const sourceFileName = `source-${timestamp}-${fileField.name}`;

    // Upload source image to ImageKit server-side
    const sourceUpload = await uploadBufferToImagekit({
      buffer: sourceBuffer,
      fileName: sourceFileName,
      folder: "/ai-images/sources",
      mimetype: fileField.type,
    });

    // Transform image using the selected filter
    const transformedBuffer = await transformImageWithFilter(sourceBuffer, typedFilterSlug);

    // Upload transformed image to ImageKit
    const resultFileName = `transformed-${typedFilterSlug}-${timestamp}.png`;
    const uploadResult = await uploadBufferToImagekit({
      buffer: transformedBuffer,
      fileName: resultFileName,
      folder: "/ai-images",
      mimetype: "image/png",
    });

    // Get the filter configuration
    const filterConfig = PRESET_FILTERS[typedFilterSlug];

    // Store generation in database
    const generation = await createGeneration({
      clerkUserId: userId,
      sourceImageUrl: sourceUpload.url,
      resultImageUrl: uploadResult.url,
      styleSlug: typedFilterSlug,
      styleLabel: filterConfig.label,
      model: "black-forest-labs/FLUX.1-schnell",
      promptUsed: filterConfig.prompt,
      originalFileName: sourceFileName,
    });

    // Calculate remaining generations
    const remainingGenerations = MONTHLY_LIMIT - generationsThisMonth - 1;

    return NextResponse.json({
      success: true,
      resultImageUrl: uploadResult.url,
      generationId: generation.id,
      remainingGenerations,
    });
  } catch (error) {
    console.error("Error transforming image:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to transform image",
      },
      { status: 500 }
    );
  }
}