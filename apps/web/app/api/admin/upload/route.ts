import { NextResponse } from "next/server";
import { prisma } from "@astra/db";
import { newRequestId, errorResponse, withApi } from "@/lib/api";
import { requireAnyPage } from "@/lib/admin-route";
import { optimizeImage } from "@/lib/image";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 4 MB, not 5: Vercel rejects request bodies above 4.5 MB before the handler runs,
// with a plain-text 413 the dashboard cannot read. Staying under it keeps the
// message ours.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// POST /api/admin/upload — multipart form-data { file } → stored image.
// Returns { url } (relative /api/media/:id); callers store that in the image
// field. Read routes resolve it to an absolute URL for the caller's host.
async function handlePost(req: Request) {
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
    return errorResponse(400, "PAYLOAD_TOO_LARGE", "Image must be 4 MB or smaller.", requestId);
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

  const asset = await prisma.$transaction(async (tx) => {
    const row = await tx.imageAsset.create({
      data: { mimeType, data: bytes, byteSize: bytes.length },
      select: { id: true },
    });
    await writeAudit(
      {
        actorId: guard.session.user.id,
        action: "create",
        targetType: "ImageAsset",
        targetId: row.id,
        metadata: { bytes: bytes.length, mimeType },
      },
      tx,
    );
    return row;
  });
  return NextResponse.json({ url: `/api/media/${asset.id}`, id: asset.id }, { status: 201 });
}

export const POST = withApi(handlePost);
