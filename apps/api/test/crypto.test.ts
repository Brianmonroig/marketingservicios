import { beforeAll, expect, test } from "vitest";
import { decryptToken, encryptToken } from "../src/crypto.js";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
});

test("un token de integración se recupera después de cifrarlo", () => {
  const encrypted = encryptToken("page-token-secreto");
  expect(encrypted).not.toContain("page-token-secreto");
  expect(decryptToken(encrypted)).toBe("page-token-secreto");
});
