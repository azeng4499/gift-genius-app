// Helpers for turning Clerk's error shape into user-facing copy.

type ClerkError = { code?: string; longMessage?: string; message?: string };

function firstClerkError(err: unknown): ClerkError | undefined {
  if (typeof err === "object" && err !== null && "errors" in err) {
    return (err as { errors?: ClerkError[] }).errors?.[0];
  }
  return undefined;
}

/** Best readable message from a Clerk (or generic) error, else `fallback`. */
export function getClerkErrorMessage(err: unknown, fallback: string): string {
  const first = firstClerkError(err);
  if (first?.longMessage) return first.longMessage;
  if (first?.message) return first.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

// Wrong-credential and identifier-format codes. Sign-in never reveals which
// field was wrong, so all of these collapse to one generic message.
const SIGN_IN_CREDENTIAL_CODES = new Set([
  "form_identifier_not_found",
  "form_password_incorrect",
  "form_identifier_invalid",
  "form_param_format_invalid",
]);

/** Sign-in error copy that never leaks which field failed. */
export function getSignInErrorMessage(err: unknown): string {
  const first = firstClerkError(err);
  if (first?.code && SIGN_IN_CREDENTIAL_CODES.has(first.code)) {
    return "Invalid email or password.";
  }
  const message = getClerkErrorMessage(err, "Invalid email or password.");
  if (/identifier/i.test(message)) return "Invalid email or password.";
  return message;
}
