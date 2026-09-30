/**
 * Capitalize only the first letter of a string; the rest become lowercase.
 * Non-string values are returned unchanged.
 *
 * Examples:
 *   capitalizeFirst("BHAVNAGAR")   → "Bhavnagar"
 *   capitalizeFirst("range x")     → "Range x"
 *   capitalizeFirst("Ahmedabad")   → "Ahmedabad"
 *   capitalizeFirst(null)          → null
 *   capitalizeFirst(123)           → 123
 */
export const capitalizeFirst = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};
