import assert from "node:assert/strict";
import test from "node:test";
import { withDiscount, ticketUrl } from "./ticket-url.ts";

test("discount code goes on the ticket link, keeping its own query", () => {
  assert.equal(
    withDiscount("https://www.eventbrite.it/e/party-123?aff=astra", "APP-AB12-CD34"),
    "https://www.eventbrite.it/e/party-123?aff=astra&discount=APP-AB12-CD34",
  );
});

test("falls back to the Eventbrite event page", () => {
  assert.equal(ticketUrl(null, "123"), "https://www.eventbrite.com/e/123");
  assert.equal(ticketUrl("https://x.test/t", "123"), "https://x.test/t");
  assert.equal(ticketUrl(null, null), null);
});
