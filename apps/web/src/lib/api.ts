const API_BASE = "http://localhost:3001";

interface ApiErrorDetails {
  formErrors?: string[];
  fieldErrors?: Record<string, string[]>;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: ApiErrorDetails,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isApiErrorDetails(value: unknown): value is ApiErrorDetails {
  if (typeof value !== "object" || value === null) return false;
  const { formErrors, fieldErrors } = value as Record<string, unknown>;
  const formErrorsOk = formErrors === undefined || Array.isArray(formErrors);
  const fieldErrorsOk =
    fieldErrors === undefined ||
    (typeof fieldErrors === "object" && fieldErrors !== null);
  return formErrorsOk && fieldErrorsOk;
}

function messageFromDetails(details: ApiErrorDetails): string {
  const messages = [
    ...(details.formErrors ?? []),
    ...Object.values(details.fieldErrors ?? {}).flat(),
  ];
  return messages.length > 0 ? messages.join(", ") : "Validation failed";
}

// Derives a human-readable message + structured details from a failed
// response body, regardless of whether `error` is a string (current server
// contract) or an object (legacy/unexpected shape) — never stringifies an
// object into the message.
function parseErrorBody(
  body: unknown,
  status: number,
): { message: string; details?: ApiErrorDetails } {
  if (typeof body === "object" && body !== null && "error" in body) {
    const { error } = body as { error: unknown };

    if (typeof error === "string") {
      const rawDetails = (body as { details?: unknown }).details;
      return {
        message: error,
        details: isApiErrorDetails(rawDetails) ? rawDetails : undefined,
      };
    }

    if (isApiErrorDetails(error)) {
      return { message: messageFromDetails(error), details: error };
    }
  }

  return { message: `Request failed: ${status}` };
}

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => ({}));
    const { message, details } = parseErrorBody(body, response.status);
    throw new ApiError(response.status, message, details);
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export { ApiError };
