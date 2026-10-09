// Turning a zod error into one sentence a person can act on. SERVER-ONLY (pure).
//
// zod's own messages ("Invalid URL", "Too small: expected number to be >=1")
// never say WHICH field is wrong. The backoffice shows the message verbatim, so
// it is prefixed with the field's label: "Ticket link: Must start with https://".

import type { ZodError } from "zod";

const LABELS: Record<string, string> = {
  title: "Title",
  body: "Body",
  excerpt: "Summary",
  imageUrl: "Image",
  logoUrl: "Logo",
  photoUrl: "Photo",
  description: "Description",
  location: "Location",
  startsAt: "Start",
  endsAt: "End",
  externalTicketUrl: "Ticket link",
  eventbriteEventId: "Eventbrite event",
  appDiscountPercent: "Discount",
  appDiscountLimit: "Discount limit",
  costPoints: "Cost",
  stock: "Stock",
  perUserLimit: "Max per account",
  name: "Name",
  category: "Category",
  address: "Address",
  latitude: "Latitude",
  longitude: "Longitude",
  discountValue: "Discount value",
  discountType: "Discount type",
  label: "Label",
  value: "Link",
  email: "Email",
  delta: "Amount",
  reason: "Reason",
  loginCode: "Login code",
  password: "Password",
  username: "Username",
  adminNote: "Note",
  message: "Message",
  route: "Destination",
  quantity: "Quantity",
  percentOff: "Percent off",
  eventId: "Event",
};

function humanise(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const label = (key: string) => LABELS[key] ?? humanise(key);

/** "Discount 2 title" for offers[1].title, "Link 1 label" for links[0].label, else the field's label. */
export function fieldLabel(path: ReadonlyArray<PropertyKey>): string {
  const keys = path.map(String);
  const last = keys[keys.length - 1];
  if (!last) return "";
  const index = keys.findIndex((k) => /^\d+$/.test(k));
  if (index > 0) {
    const noun = keys[index - 1] === "offers" ? "Discount" : keys[index - 1] === "links" ? "Link" : humanise(keys[index - 1]!);
    const n = Number(keys[index]) + 1;
    return keys.length - 1 > index ? `${noun} ${n} ${label(last).toLowerCase()}` : `${noun} ${n}`;
  }
  return label(last);
}

/** The first problem, as "Field: what is wrong". Never empty. */
export function zodMessage(error: ZodError, fallback = "Invalid input."): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  const text = issue.message || fallback;
  const field = fieldLabel(issue.path);
  if (!field) return text;
  // "Title is required" already names the field.
  if (text.toLowerCase().startsWith(field.toLowerCase())) return text;
  return `${field}: ${text}`;
}
