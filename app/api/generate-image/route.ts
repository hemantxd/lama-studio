import { NextRequest, NextResponse } from "next/server";
import { generateAIImage } from "@/lib/ai";
import { uploadBufferToImagekit } from "@/lib/imagekit";

// Request body type
interface GenerateImageRequest {
  prompt: string;
}

// Response type
interface GenerateImageResponse {
  success: boolean;
  image?: string;
  fileId?: string;
  error?: string;
}

/**
 * POST /api/generate-image
 * 
 * Generates an image from a text prompt using Hugging Face's FLUX.1-schnell model,
 * then uploads the generated image to ImageKit.
 */
export async function POST(request: NextRequest): Promise<NextResponse<GenerateImageResponse>> {
  try {
    // Parse request body
    const body: GenerateImageRequest = await request.json();
    const { prompt } = body;

    // Validate prompt
    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          error: "Prompt is required and must be a non-empty string",
        },
        { status: 400 }
      );
    }

    // Generate image using Hugging Face
    const imageBuffer = await generateAIImage(prompt.trim());

    // Generate a unique filename with timestamp
    const timestamp = Date.now();
    const fileName = `ai-generated-${timestamp}.png`;

    // Upload to ImageKit in the /ai-images folder
    const uploadResult = await uploadBufferToImagekit({
      buffer: imageBuffer,
      fileName,
      folder: "/ai-images",
      mimetype: "image/png",
    });

    // Return success response
    return NextResponse.json({
      success: true,
      image: uploadResult.url,
      fileId: uploadResult.fileId,
    });
  } catch (error) {
    console.error("Error generating image:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate image",
      },
      { status: 500 }
    );
  }
}