const regex = /^[a-zA-Z0-9 _()\-]+$/;

function validateAlphaNumSpaceUnderscore(req, res, next) {

  function validateObject(obj, path = "") {
    for (const key in obj) {
      const value = obj[key];

      if (typeof value === "string") {
        if (!regex.test(value)) {
          return `Invalid characters in field '${path + key}'. Only alphabets, numbers, space and '_' allowed`;
        }
      }

      if (typeof value === "object" && value !== null) {
        const nestedError = validateObject(value, path + key + ".");
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