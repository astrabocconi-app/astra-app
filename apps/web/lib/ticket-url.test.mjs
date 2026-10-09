import assert from "node:assert/strict";
import test from "node:test";
import { withDiscount, ticketUrl, isEventbriteUrl } from "./ticket-url.ts";

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

test("the code is only appended on Eventbrite pages", () => {
  assert.equal(withDiscount("https://example.com/tickets?x=1", "APP-AB12-CD34"), "https://example.com/tickets?x=1");
  assert.equal(withDiscount("https://eventbrite.com.evil.test/e/1", "APP-AB12-CD34"), "https://eventbrite.com.evil.test/e/1");
  assert.equal(withDiscount("http://www.eventbrite.com/e/1", "APP-AB12-CD34"), "http://www.eventbrite.com/e/1");
});

test("isEventbriteUrl accepts regional domains and rejects look-alikes", () => {
  for (const ok of ["https://www.eventbrite.com/e/1", "https://eventbrite.it/e/1", "https://www.eventbrite.co.uk/e/1"]) {
    assert.equal(isEventbriteUrl(ok), true, ok);
  }
  for (const bad of ["https://noteventbrite.com/e/1", "https://eventbrite.example.com/e/1", "not a url", "javascript:alert(1)"]) {
    assert.equal(isEventbriteUrl(bad), false, bad);
  }
});

test("discountProblem requires a linked event and an Eventbrite ticket link", async () => {
  const { discountProblem } = await import("./ticket-url.ts");
  assert.equal(discountProblem(null, null, "https://x.test"), null);
  assert.match(discountProblem(20, null, null), /Link the Eventbrite event/);
  assert.match(discountProblem(20, "1", "https://x.test/t"), /Eventbrite page/);
  assert.equal(discountProblem(20, "1", "https://www.eventbrite.com/e/1"), null);
  assert.equal(discountProblem(20, "1", null), null);
});
