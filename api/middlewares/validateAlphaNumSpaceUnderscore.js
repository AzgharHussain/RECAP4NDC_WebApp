const regex = /^[a-zA-Z0-9 _()\-]+$/;

// Skip validation for content types that carry binary/geo data where
// alphanumeric validation makes no sense and wastes CPU.
const SKIP_CONTENT_TYPES = [
  'multipart/form-data',
  'application/octet-stream',
];

// Cap total string fields validated to bound CPU time on huge nested bodies.
const MAX_FIELDS_CHECKED = 200;

function validateAlphaNumSpaceUnderscore(req, res, next) {
  // Skip validation for GET requests (no body to validate)
  if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD') {
    return next();
  }

  // Skip multipart uploads and binary content — multer handles those
  const ct = req.headers['content-type'] || '';
  if (SKIP_CONTENT_TYPES.some((t) => ct.includes(t))) {
    return next();
  }

  // Skip if body is empty or not a plain object (file uploads with metadata)
  if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
    return next();
  }

  let fieldsChecked = 0;

  function validateObject(obj, path = "", depth = 0) {
    // Limit recursion depth to prevent stack overflow on deeply nested objects
    if (depth > 10) return null;

    for (const key in obj) {
      const value = obj[key];

      if (typeof value === "string") {
        // Skip very long strings (likely file data, base64, or geojson)
        if (value.length > 10000) continue;
        // Bail out if we've checked too many fields — avoids CPU spikes
        // on deeply nested geojson / large arrays
        if (++fieldsChecked > MAX_FIELDS_CHECKED) return null;
        if (!regex.test(value)) {
          return `Invalid characters in field '${path + key}'. Only alphabets, numbers, space and '_' allowed`;
        }
      }

      if (typeof value === "object" && value !== null) {
        const nestedError = validateObject(value, path + key + ".", depth + 1);
        if (nestedError) return nestedError;
      }
    }
    return null;
  }

  const error = validateObject(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      error
    });
  }

  next();
}

module.exports = validateAlphaNumSpaceUnderscore;