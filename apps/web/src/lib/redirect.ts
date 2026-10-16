export interface AuthSearch {
  redirect?: string;
}

// Only allow same-origin paths ("/cart"), never "//evil.com" or "https://…"
export function safeRedirect(redirect: unknown): string | undefined {
  return typeof redirect === "string" &&
    redirect.startsWith("/") &&
    !redirect.startsWith("//")
    ? redirect
    : undefined;
}

export const validateAuthSearch = (
  search: Record<string, unknown>,
): AuthSearch => ({
  redirect: safeRedirect(search.redirect),
});
