/**
 * Safely convert a Firestore Timestamp, plain Date, seconds-based object,
 * or ISO string into a JavaScript Date — returns null if conversion fails
 * instead of throwing or returning an Invalid Date.
 */
export function safeDate(val) {
  if (!val) return null;
  // Native Firestore Timestamp (.toDate())
  if (typeof val.toDate === "function") {
    try {
      const d = val.toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch { return null; }
  }
  // Serialized Firestore Timestamp { _seconds, _nanoseconds }
  if (val._seconds != null) {
    const d = new Date(val._seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  // Already a Date
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  // ISO string or numeric timestamp
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
