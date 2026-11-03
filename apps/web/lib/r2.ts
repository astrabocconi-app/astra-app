// Minimal Cloudflare R2 (S3-compatible) object reader. SERVER-ONLY.
//
// One signed GET, so SigV4 is written out here rather than pulling in the AWS SDK.
// Needs R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.

import { createHash, createHmac } from "node:crypto";

const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();
const sha = (data: string) => createHash("sha256").update(data).digest("hex");

export class R2NotConfigured extends Error {}

export async function r2GetText(key: string): Promise<string> {
  const { R2_ACCOUNT_ID: account, R2_BUCKET: bucket, R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret } = process.env;
  if (!account || !bucket || !id || !secret) throw new R2NotConfigured("R2 environment variables are not set.");

  const host = `${account}.r2.cloudflarestorage.com`;
  const path = `/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, ""); // 20261103T200500Z
  const day = amzDate.slice(0, 8);
  const scope = `${day}/auto/s3/aws4_request`;
  const payloadHash = sha("");

  const canonical = ["GET", path, "", `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`, "host;x-amz-content-sha256;x-amz-date", payloadHash].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha(canonical)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secret}`, day), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(toSign).digest("hex");

  const res = await fetch(`https://${host}${path}`, {
    headers: {
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      authorization: `AWS4-HMAC-SHA256 Credential=${id}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`R2 ${res.status} reading ${key}`);
  return res.text();
}
