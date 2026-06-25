/**
 * Extract the most useful error message from an API error response.
 *
 * Backend returns errors in this format:
 *   { success: false, message: "Validation failed", errors: [{ field: "password", message: "Password must include..." }] }
 *
 * This helper extracts the most specific message available,
 * digging into the validation errors array when present.
 */
export function getErrorMessage(err, fallback = 'Something went wrong') {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;

  // If backend returns a validation errors array, join all messages
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors
      .map((e) => e.message || e.msg || String(e))
      .join('. ');
  }

  // Direct message field (e.g. "Invalid email or password")
  if (data.message) {
    return data.message;
  }

  return data.error || fallback;
}
