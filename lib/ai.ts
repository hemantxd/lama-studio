import { InferenceClient } from "@huggingface/inference";

// Initialize Hugging Face Inference Client with API token
const client = new InferenceClient(process.env.HF_TOKEN!);

/**
 * Preset filter configurations for image transformation.
 */
export const PRESET_FILTERS = {
  "ghibli-film": {
    label: "Ghibli Film Filter",
    prompt: "I want this exact scene and subjects recreated in Studio Ghibli anime style — hand-drawn animation, soft pastel colors, dreamy atmosphere, whimsical magical feeling, beautiful detailed artwork",
  },
  "disney": {
    label: "Disney Filter",
    prompt: "I want this exact scene and subjects recreated in Disney Pixar 3D animation style — vibrant colors, polished CGI rendering, expressive characters, magical lighting, cinematic composition",
  },
  "anime": {
    label: "Anime Style",
    prompt: "I want this exact scene and subjects recreated in modern anime style — sharp linework, vibrant colors, detailed cel shading, high quality anime illustration, professional production aesthetic",
  },
  "looney-toons": {
    label: "Looney Toons Filter",
    prompt: "I want this exact scene and subjects recreated in Looney Toons cartoon style — exaggerated features, bold outlines, vibrant primary colors, rubber hose animation, vintage cartoon charm",
  },
} as const;

export type FilterSlug = keyof typeof PRESET_FILTERS;

/**
 * Describes the content of an image using Hugging Face's BLIP vision model.
 * Returns a detailed caption of what's in the image.
 */
async function describeImage(imageBuffer: Buffer): Promise<string> {
  // BLIP expects a Blob input on the HF Inference API
  const imageBlob = new Blob([new Uint8Array(imageBuffer)], { type: "image/png" });

  const response = await client.imageToText({
    provider: "hf-inference",
    model: "Salesforce/blip-image-captioning-base",
    inputs: imageBlob,
  });

  return response as unknown as string;
}

/**
 * Generates an image from a text prompt using Hugging Face's FLUX.1-schnell model.
 */
export async function generateAIImage(prompt: string): Promise<Buffer> {
  const response = await client.textToImage({
    provider: "hf-inference",
    model: "black-forest-labs/FLUX.1-schnell",
    inputs: prompt,
    parameters: {
      num_inference_steps: 30,
      guidance_scale: 7.5,
    },
  }) as unknown as Blob;

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Transforms an image using a preset filter style.
 *
 * FLUX.1-schnell only supports text-to-image (not img2img), so:
 * 1. BLIP vision model describes what's in your uploaded image
 * 2. We combine that description with the style prompt
 * 3. FLUX.1-schnell generates a new image matching the description in the requested style
 *
 * @param imageBuffer - The source image as a Buffer
 * @param filterSlug - The preset filter to apply
 * @returns A Node.js Buffer containing the transformed image data
 */
export async function transformImageWithFilter(
  imageBuffer: Buffer,
  filterSlug: FilterSlug
): Promise<Buffer> {
  const filterConfig = PRESET_FILTERS[filterSlug];
  if (!filterConfig) {
    throw new Error(`Unknown filter: ${filterSlug}`);
  }

  // Step 1: Describe the image content using BLIP vision model
  let imageDescription: string;
  try {
    imageDescription = await describeImage(imageBuffer);
  } catch (error) {
    console.warn("Image description failed, using fallback:", error);
    imageDescription = "a person or scene in a photograph";
  }

  // Step 2: Build a prompt that tells FLUX to recreate the exact content in the style
  const combinedPrompt = `${filterConfig.prompt}

DETAILED SCENE DESCRIPTION: ${imageDescription}

CRITICAL: Recreate the EXACT same subject, pose, expression, objects, background, and composition described above. ONLY change the art style to match the filter. Do NOT change anything about the scene itself.`;

  // Step 3: Generate using FLUX.1-schnell
  const response = await client.textToImage({
    provider: "hf-inference",
    model: "black-forest-labs/FLUX.1-schnell",
    inputs: combinedPrompt,
    parameters: {
      num_inference_steps: 30,
      guidance_scale: 7.5,
    },
  }) as unknown as Blob;

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}