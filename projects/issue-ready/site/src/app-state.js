function isStringRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}

export function isTitleValid(title) {
  return typeof title === "string" && title.trim().length > 0;
}

export function isReviewCurrent(currentFields, reviewedFields) {
  if (!isStringRecord(currentFields) || !isStringRecord(reviewedFields)) return false;
  const currentKeys = Object.keys(currentFields);
  const reviewedKeys = Object.keys(reviewedFields);
  if (currentKeys.length !== reviewedKeys.length) return false;

  return currentKeys.every((key) => (
    Object.hasOwn(reviewedFields, key) && currentFields[key] === reviewedFields[key]
  ));
}
