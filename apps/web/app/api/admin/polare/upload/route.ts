import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requirePageApi } from "@/lib/admin-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Videos are too big for a Vercel function body (4.5 MB), so the browser uploads
// them straight to Vercel Blob. This route only hands out the short-lived token.
const MAX_BYTES = 100 * 1024 * 1024;
const TYPES = ["video/mp4", "video/quicktime", "video/webm"];

// POST /api/admin/polare/upload — Blob client-upload handshake.
async function handlePost(req: Request) {
  const requestId = newRequestId();
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body || typeof body !== "object") return errorResponse(400, "BAD_REQUEST", "Bad request.", requestId);

  // Only the token request comes from a signed-in editor; Vercel's own "upload
  // completed" callback carries a signature that handleUpload verifies.
  // Two editors upload videos here: Stella Polare reels (polare/…) and the
  // sponsors' "how to redeem" videos on the App overlays page (content/…).
  // Each path prefix needs its own page.
  if (body.type === "blob.generate-client-token") {
    const pathname = String((body.payload as { pathname?: unknown } | undefined)?.pathname ?? "");
    const page = pathname.startsWith("content/") ? "app-content" : "polare";
    const guard = await requirePageApi(req, requestId, page);
    if ("error" in guard) return guard.error;
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("polare/") && !pathname.startsWith("content/")) throw new Error("Bad upload path.");
        return { allowedContentTypes: TYPES, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(400, "BAD_REQUEST", e instanceof Error ? e.message : "Upload refused.", requestId);
  }
}

export const POST = withApi(handlePost);
