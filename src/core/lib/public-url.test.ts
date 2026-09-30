import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publicUrl } from "./public-url";

const internal = "https://0.0.0.0:3000/auth/confirm?code=x";

describe("publicUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("usa NEXT_PUBLIC_APP_URL em vez do endereço interno", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.exemplo.pt/");
    const url = publicUrl(new NextRequest(internal), "/login?error=link");
    expect(url.toString()).toBe("https://app.exemplo.pt/login?error=link");
  });

  it("sem configuração, usa os cabeçalhos do proxy", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const req = new NextRequest(internal, { headers: { "x-forwarded-host": "app.exemplo.pt", "x-forwarded-proto": "https" } });
    expect(publicUrl(req, "/auth/callback?next=%2Fx").toString()).toBe("https://app.exemplo.pt/auth/callback?next=%2Fx");
  });
});
