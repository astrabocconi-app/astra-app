// /get — one link for both stores: iPhones go to the App Store, everything else
// (Android, desktop) to Google Play.
const APP_STORE = "https://apps.apple.com/app/id6805444602";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=it.astrabocconi.app";

export function GET(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  return Response.redirect(/iPhone|iPad|iPod/i.test(ua) ? APP_STORE : PLAY_STORE, 302);
}
