import { router } from "expo-router";

/** Destinations that are tabs of the student navigator (the rest are pushed screens). */
const TAB_ROUTES = new Set(["/discounts", "/academics", "/events", "/card", "/home"]);

/**
 * Open an in-app destination from a notification or a content link.
 *
 * `push` always adds a route, so pushing a tab from a pushed screen (a news
 * post, an open Rewards screen) created a SECOND tab navigator with its own
 * Home, polling and first-login sheet, and Back returned to the wrong place.
 * `navigate` goes to the existing tab instead.
 */
export function openRoute(route: string) {
  if (TAB_ROUTES.has(route)) router.navigate(route as never);
  else router.push(route as never);
}
