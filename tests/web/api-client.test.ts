// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../../apps/web/src/lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("web API client", () => {
  it("keeps string error messages readable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "Invalid email or password" }, 401)),
    );

    await expect(
      api.post("/auth/login", { email: "ada@example.com", password: "nope" }),
    ).rejects.toEqual(expect.any(ApiError));

    await expect(
      api.post("/auth/login", { email: "ada@example.com", password: "nope" }),
    ).rejects.toMatchObject({
      status: 401,
      message: "Invalid email or password",
    });
  });

  it("describes validation errors instead of [object Object]", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              formErrors: [],
              fieldErrors: { email: ["Invalid email"] },
            },
          },
          400,
        ),
      ),
    );

    await expect(
      api.post("/auth/register", {
        username: "ada",
        email: "not-an-email",
        password: "secret12",
      }),
    ).rejects.toThrow(/Invalid email/);
  });
});
