"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  Upload,
  Sparkles,
  Download,
  Trash2,
  History,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { PRESET_FILTERS, type FilterSlug } from "@/lib/ai";

// API response type
interface TransformImageResponse {
  success: boolean;
  resultImageUrl?: string;
  generationId?: string;
  error?: string;
  remainingGenerations?: number;
}

// Generation history type
interface Generation {
  id: string;
  clerkUserId: string;
  originalFileName: string | null;
  sourceImageUrl: string;
  resultImageUrl: string;
  styleSlug: string;
  styleLabel: string;
  model: string;
  promptUsed: string;
  createdAt: string;
}

export default function StudioPage() {
  const { isSignedIn } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterSlug | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remainingGenerations, setRemainingGenerations] = useState<number>(10);
  const [filteredName, setFilteredName] = useState<string | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isLoadingGenerations, setIsLoadingGenerations] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }

      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResultImageUrl(null);
      setError(null);
      setFilteredName(null);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResultImageUrl(null);
      setError(null);
      setFilteredName(null);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleTransform = async () => {
    if (!selectedFile || !selectedFilter) return;

    setIsProcessing(true);
    setError(null);
    setResultImageUrl(null);
    setFilteredName(null);

    try {
      // Build form data with file and filter slug
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("filterSlug", selectedFilter);

      // Send directly to our API
      const response = await fetch("/api/transform-image", {
        method: "POST",
        body: formData,
        // No Content-Type header — fetch sets multipart/form-data automatically
      });

      const data: TransformImageResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Transformation failed");
      }

      setResultImageUrl(data.resultImageUrl || null);
      setFilteredName(PRESET_FILTERS[selectedFilter].label);

      if (data.remainingGenerations !== undefined) {
        setRemainingGenerations(data.remainingGenerations);
      }
      
      // Refresh the generations list
      fetchGenerations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!resultImageUrl) return;

    try {
      const response = await fetch(resultImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transformed-${selectedFilter}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download:", err);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedFilter(null);
    setResultImageUrl(null);
    setError(null);
    setFilteredName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Fetch generations on mount and after a successful transform
  const fetchGenerations = async () => {
    if (!isSignedIn) return;
    
    setIsLoadingGenerations(true);
    try {
      const response = await fetch("/api/generations");
      const data = await response.json();
      
      if (data.success) {
        setGenerations(data.generations);
      }
    } catch (err) {
      console.error("Failed to fetch generations:", err);
    } finally {
      setIsLoadingGenerations(false);
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric" 
    });
  };

  // Fetch generations when signed in
  useEffect(() => {
    if (isSignedIn) {
      fetchGenerations();
    }
  }, [isSignedIn]);

  // Show sign-in prompt if not authenticated
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-4">
              <Sparkles className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="mb-4 text-3xl font-bold">Welcome to AI Studio</h1>
          <p className="mb-8 text-muted-foreground">
            Sign in to transform your images with AI-powered filters
          </p>
          <SignInButton mode="modal">
            <Button size="lg" className="w-full rounded-xl py-6 text-lg">
              Sign In to Continue
            </Button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 p-2">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold">AI Studio</h1>
            </div>
            <p className="mt-2 text-muted-foreground">
              Transform your images with AI-powered filters
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg border bg-card px-4 py-2">
              <p className="text-xs text-muted-foreground">Remaining this month</p>
              <p className="text-lg font-bold">
                {remainingGenerations} / 10
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Upload & Filter Selection */}
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="rounded-2xl border bg-card p-6 shadow-lg">
              <h2 className="mb-4 text-lg font-semibold">Upload Image</h2>

              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  previewUrl
                    ? "border-primary/50 bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isProcessing}
                />

                {previewUrl ? (
                  <div className="relative">
                    <Image
                      src={previewUrl}
                      alt="Preview"
                      width={400}
                      height={300}
                      className="mx-auto max-h-64 rounded-lg object-contain"
                      unoptimized
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        resetForm();
                      }}
                      className="absolute right-2 top-2 rounded-full bg-destructive p-2 text-white hover:bg-destructive/90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="mb-2 font-medium">Drop your image here</p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse (PNG, JPG up to 10MB)
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Filter Selection */}
            <div className="rounded-2xl border bg-card p-6 shadow-lg">
              <h2 className="mb-4 text-lg font-semibold">Choose Filter</h2>

              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(PRESET_FILTERS) as FilterSlug[]).map((slug) => {
                  const filter = PRESET_FILTERS[slug];
                  const isSelected = selectedFilter === slug;

                  return (
                    <button
                      key={slug}
                      onClick={() => setSelectedFilter(slug)}
                      disabled={isProcessing}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-3 w-3 rounded-full ${
                            isSelected ? "bg-primary" : "bg-muted-foreground/30"
                          }`}
                        />
                        <span className="font-medium">{filter.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transform Button */}
            <Button
              onClick={handleTransform}
              disabled={
                !selectedFile ||
                !selectedFilter ||
                isProcessing ||
                remainingGenerations <= 0
              }
              className="w-full rounded-xl py-6 text-lg font-semibold"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Transforming...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Transform Image
                </>
              )}
            </Button>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">Error</p>
                    <p className="text-sm text-destructive/80">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Result */}
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-6 shadow-lg">
              <h2 className="mb-4 text-lg font-semibold">Result</h2>

              {resultImageUrl ? (
                <div className="space-y-4">
                  <div className="relative overflow-hidden rounded-xl border">
                    <Image
                      src={resultImageUrl}
                      alt="Transformed result"
                      width={600}
                      height={500}
                      className="h-auto w-full"
                      unoptimized
                    />
                  </div>

                  <div className="rounded-lg bg-muted p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">
                        {filteredName} — Complete!
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You have {remainingGenerations} transformations remaining this month.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleDownload}
                      variant="outline"
                      className="flex-1 rounded-xl"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                    <Button
                      onClick={resetForm}
                      variant="outline"
                      className="flex-1 rounded-xl"
                    >
                      Start Over
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Sparkles className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">No result yet</h3>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Upload an image and select a filter to see the AI
                    transformation
                  </p>
                </div>
              )}
            </div>

            {/* History Section */}
            <div className="rounded-2xl border bg-card p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Recent Generations</h2>
                </div>
                {generations.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {generations.length} total
                  </span>
                )}
              </div>

              {isLoadingGenerations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : generations.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Your generation history will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {generations.slice(0, 10).map((generation) => (
                    <div
                      key={generation.id}
                      className="group flex items-center gap-3 rounded-lg border p-3 transition-all hover:bg-muted/50"
                    >
                      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border">
                        <Image
                          src={generation.resultImageUrl}
                          alt={generation.styleLabel}
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {generation.styleLabel}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(generation.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {generation.originalFileName || "Uploaded image"}
                        </p>
                      </div>
                      <a
                        href={generation.resultImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 p-2 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}