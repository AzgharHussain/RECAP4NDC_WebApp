const regex = /^[a-zA-Z0-9 _()\-]+$/;

function validateAlphaNumSpaceUnderscore(req, res, next) {
  // Skip validation for GET requests (no body to validate)
  if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD') {
    return next();
  }

  // Skip if body is empty or too large (file uploads with metadata)
  if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
    return next();
  }

  function validateObject(obj, path = "", depth = 0) {
    // Limit recursion depth to prevent stack overflow on deeply nested objects
    if (depth > 10) return null;

    for (const key in obj) {
      const value = obj[key];

      if (typeof value === "string") {
        // Skip very long strings (likely file data, base64, or geojson)
        if (value.length > 10000) continue;
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