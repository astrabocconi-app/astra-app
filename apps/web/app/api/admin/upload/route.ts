import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newRequestId, errorResponse } from "@/lib/api";
import { requireAnyPage } from "@/lib/admin-route";
import { optimizeImage } from "@/lib/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// POST /api/admin/upload — multipart form-data { file } → stored image.
// Returns { url } (relative /api/media/:id); callers store that in the image
// field. Read routes resolve it to an absolute URL for the caller's host.
export async function POST(req: Request) {
  const requestId = newRequestId();
  const guard = await requireAnyPage(req, requestId);
  if ("error" in guard) return guard.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse(400, "BAD_REQUEST", "Expected multipart form-data.", requestId);
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return errorResponse(400, "BAD_REQUEST", "No file provided.", requestId);
  }
  if (!ALLOWED.includes(file.type)) {
    return errorResponse(400, "BAD_REQUEST", "Only JPEG, PNG, WebP or GIF images are allowed.", requestId);
  }
  if (file.size > MAX_BYTES) {
    return errorResponse(400, "PAYLOAD_TOO_LARGE", "Image must be 5 MB or smaller.", requestId);
  }

  const raw = Buffer.from(await file.arrayBuffer());

  // Downscale + re-encode before storing: /api/media serves these bytes as-is,
  // so an unoptimized original would be re-downloaded in full by every client.
  let bytes: Uint8Array<ArrayBuffer>;
  let mimeType: string;
  try {
    ({ data: bytes, mimeType } = await optimizeImage(raw, file.type));
  } catch {
    return errorResponse(400, "BAD_REQUEST", "Could not read that image.", requestId);
  }

  const asset = await prisma.imageAsset.create({
    data: { mimeType, data: bytes, byteSize: bytes.length },
    select: { id: true },
  });
  return NextResponse.json(
    { url: `/api/media/${asset.id}`, id: asset.id },
    { status: 201, headers: { "x-request-id": requestId } },
  );
}
