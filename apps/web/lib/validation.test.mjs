import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { zodMessage, fieldLabel } from "./validation.ts";

const message = (schema, input) => zodMessage(schema.safeParse(input).error);

test("prefixes the field label", () => {
  const s = z.object({ externalTicketUrl: z.string().url() });
  assert.equal(message(s, { externalTicketUrl: "nope" }), "Ticket link: Invalid URL");
});

test("does not repeat a label the message already starts with", () => {
  const s = z.object({ title: z.string().min(1, "Title is required") });
  assert.equal(message(s, { title: "" }), "Title is required");
});

test("names the row for array items", () => {
  const s = z.object({ offers: z.array(z.object({ title: z.string().min(1, "Discount title is required") })) });
  assert.equal(message(s, { offers: [{ title: "ok" }, { title: "" }] }), "Discount 2 title: Discount title is required");
  assert.equal(fieldLabel(["offers", 1, "discountValue"]), "Discount 2 discount value");
  assert.equal(fieldLabel(["links", 0, "label"]), "Link 1 label");
});

test("unknown camelCase keys are humanised, and a root error has no prefix", () => {
  assert.equal(fieldLabel(["someNewField"]), "Some new field");
  assert.equal(zodMessage(z.string().safeParse(1).error), "Invalid input: expected string, received number");
});
