import { describe, it, expect } from "vitest";
import { extractContact, hasContact } from "./extract-contact";

describe("extractContact — in-app Call/Text/Email", () => {
  it("pulls a formatted phone from messy listing text", () => {
    const c = extractContact(
      "Call Mike today! 305-477-0142 for this clean ride",
    );
    expect(c.phone).toBe("(305) 477-0142");
  });

  it("rejects the reserved 555-01xx fictional range as a placeholder", () => {
    expect(extractContact("call 305-555-0142").phone).toBeUndefined();
  });

  it("handles parenthesized + dotted phone formats", () => {
    expect(extractContact("(786) 412.9981").phone).toBe("(786) 412-9981");
    expect(extractContact("phone: +1 813 221 0099").phone).toBe(
      "(813) 221-0099",
    );
  });

  it("extracts and lowercases a seller email, skipping no-reply/asset hosts", () => {
    expect(extractContact("Email Sales@AEofMiami.com").email).toBe(
      "sales@aeofmiami.com",
    );
    expect(extractContact("no-reply@platform.com").email).toBeUndefined();
    expect(extractContact("img@dxyz.cloudfront.net").email).toBeUndefined();
  });

  it("always carries the original listing url so View-original works", () => {
    const c = extractContact("no contact here", "https://x2builders.com/v/123");
    expect(c.listingUrl).toBe("https://x2builders.com/v/123");
    expect(c.phone).toBeUndefined();
  });

  it("hasContact is true only with an actionable channel", () => {
    expect(hasContact(extractContact("call 305-477-0142"))).toBe(true);
    expect(hasContact(extractContact("nothing", "https://site.com/x"))).toBe(
      false,
    );
    expect(hasContact(undefined)).toBe(false);
  });
});
