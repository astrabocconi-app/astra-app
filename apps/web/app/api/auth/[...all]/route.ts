// Better Auth mounts its whole surface here: /api/auth/*
//   - POST /api/auth/email-otp/send-verification-otp  { email, type }
//   - POST /api/auth/sign-in/email-otp                { email, otp }
//   - POST /api/auth/sign-out
//   - GET  /api/auth/get-session
// See apps/web/lib/auth.ts for config (email-OTP only, Bearer tokens).

import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { withApi } from "@/lib/api";

export const runtime = "nodejs";

const handlers = toNextJsHandler(auth);
export const GET = withApi(handlers.GET);
export const POST = withApi(handlers.POST);
