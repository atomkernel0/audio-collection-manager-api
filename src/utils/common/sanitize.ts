/**
 * Sanitizes input data by removing MongoDB operator keys (starting with '$') to prevent NoSQL injection attacks.
 * This function performs a deep sanitization on nested objects and arrays.
 *
 * @description
 * This recursive function handles:
 * - Objects: Removes any key starting with '$' to prevent MongoDB operators injection
 * - Arrays: Sanitizes each element recursively
 * - Primitive values: Returns them unchanged
 *
 * @example
 * // Safe input
 * sanitize({ name: "John", age: 30 })
 * // Returns: { name: "John", age: 30 }
 *
 * @example
 * // Malicious input with MongoDB operators
 * sanitize({ name: "John", "$set": { admin: true } })
 * // Returns: { name: "John" }
 *
 * @template T - The type of the input value to sanitize
 * @param {T} value - The value to sanitize, can be of any type
 * @returns {T} A sanitized copy of the input value with all MongoDB operators removed
 *
 * @security This function helps prevent NoSQL injection attacks by removing MongoDB operators
 * @performance O(n) where n is the total number of properties in the object tree
 * @maintainability High - Single responsibility, well-typed, and recursive pattern
 */
export function sanitize<T>(value: T): T {
  if (value && typeof value === "object") {
    if (Array.isArray(value)) {
      return value.map(sanitize) as T;
    }

    return Object.entries(value).reduce((acc, [key, val]) => {
      if (!key.startsWith("$")) {
        acc[key as keyof T] = sanitize(val);
      }
      return acc;
    }, {} as T);
  }

  return value;
}
