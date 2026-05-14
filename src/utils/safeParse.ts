/**
 * Attempt `JSON.parse`; on failure return the raw value (or `null` if the
 * input is null/undefined). Used wherever a column stores serialised JSON
 * but may, for historical reasons, also contain a plain string.
 */
export function safeParse(value: string | null | undefined): unknown {
    if (value == null) return null;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}
