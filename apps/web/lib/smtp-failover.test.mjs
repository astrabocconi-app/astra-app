import test from "node:test";
import assert from "node:assert/strict";
import {
  sendWithFailover,
  looksRateLimited,
  AllMailboxesFailedError,
} from "./smtp-failover.ts";

const COOLDOWN = 10 * 60 * 1000;

function boxes() {
  return [
    { label: "primary", blockedUntil: 0 },
    { label: "fallback", blockedUntil: 0 },
  ];
}

/** An SMTP refusal shaped like nodemailer's, so the classifier sees what it would in production. */
function smtpError(message, responseCode) {
  return Object.assign(new Error(message), { responseCode });
}

test("uses the primary mailbox when it works", async () => {
  const tried = [];
  const mailboxes = boxes();
  const used = await sendWithFailover(
    mailboxes,
    async (m) => {
      tried.push(m.label);
    },
    { cooldownMs: COOLDOWN },
  );
  assert.equal(used.label, "primary");
  assert.deepEqual(tried, ["primary"], "must not touch the fallback unnecessarily");
});

test("falls back when the primary is over its hourly quota", async () => {
  const tried = [];
  const mailboxes = boxes();
  const used = await sendWithFailover(
    mailboxes,
    async (m) => {
      tried.push(m.label);
      if (m.label === "primary") throw smtpError("450 4.2.1 quota exceeded", 450);
    },
    { cooldownMs: COOLDOWN },
  );
  assert.equal(used.label, "fallback");
  assert.deepEqual(tried, ["primary", "fallback"]);
});

test("a rate-limited mailbox is put in cooldown and tried last next time", async () => {
  const mailboxes = boxes();
  let now = 1_000_000;
  const clock = () => now;

  await sendWithFailover(
    mailboxes,
    async (m) => {
      if (m.label === "primary") throw smtpError("421 too many messages", 421);
    },
    { cooldownMs: COOLDOWN, now: clock },
  );
  assert.equal(mailboxes[0].blockedUntil, now + COOLDOWN, "primary should be cooling");

  // The very next send must go straight to the fallback, paying no failed
  // round trip against the exhausted mailbox.
  const tried = [];
  now += 1000;
  const used = await sendWithFailover(
    mailboxes,
    async (m) => {
      tried.push(m.label);
    },
    { cooldownMs: COOLDOWN, now: clock },
  );
  assert.equal(used.label, "fallback");
  assert.deepEqual(tried, ["fallback"], "cooling mailbox must not be tried first");
});

test("a cooldown never blocks a send: a cooling mailbox is still tried last", async () => {
  const mailboxes = boxes();
  const now = 5_000_000;
  // Primary is cooling, and the fallback is broken.
  mailboxes[0].blockedUntil = now + COOLDOWN;

  const tried = [];
  const used = await sendWithFailover(
    mailboxes,
    async (m) => {
      tried.push(m.label);
      if (m.label === "fallback") throw smtpError("550 mailbox unavailable", 550);
    },
    { cooldownMs: COOLDOWN, now: () => now },
  );
  // Fallback first (it is not cooling), then the cooling primary, which works.
  assert.deepEqual(tried, ["fallback", "primary"]);
  assert.equal(used.label, "primary");
  assert.equal(mailboxes[0].blockedUntil, 0, "a successful send clears the cooldown");
});

test("throws with every reason when all mailboxes refuse", async () => {
  const mailboxes = boxes();
  await assert.rejects(
    () =>
      sendWithFailover(
        mailboxes,
        async (m) => {
          throw smtpError(`${m.label} is down`, 554);
        },
        { cooldownMs: COOLDOWN },
      ),
    (e) => {
      assert.ok(e instanceof AllMailboxesFailedError);
      assert.equal(e.failures.length, 2);
      assert.match(e.message, /primary is down/);
      assert.match(e.message, /fallback is down/);
      return true;
    },
  );
});

test("works with a single mailbox configured", async () => {
  const only = [{ label: "primary", blockedUntil: 0 }];
  const used = await sendWithFailover(only, async () => {}, { cooldownMs: COOLDOWN });
  assert.equal(used.label, "primary");
});

test("classifies quota refusals, but not ordinary failures", () => {
  assert.equal(looksRateLimited(smtpError("421 too many messages", 421)), true);
  assert.equal(looksRateLimited(smtpError("450 quota exceeded", 450)), true);
  assert.equal(looksRateLimited(new Error("Rate limit reached, try again later")), true);
  // A bad recipient or bad password is NOT a quota problem: cooling the mailbox
  // for those would take a working mailbox out of rotation for no reason.
  assert.equal(looksRateLimited(smtpError("550 no such user", 550)), false);
  assert.equal(looksRateLimited(smtpError("535 authentication failed", 535)), false);
});
