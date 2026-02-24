const xss = require("xss");

const options = {
  whiteList: {},        // No tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script"],
  css: false,           // Disable CSS
  stripIgnoreTag: true,
  allowCommentTag: false
};

function clean(value) {
  if (typeof value !== "string") return value;
  
  // Remove any potential control characters
  const sanitized = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return xss(sanitized.trim(), options);
}

// Additional sanitization for filenames
function sanitizeFilename(filename) {
  if (typeof filename !== "string") return '';
  
  // Remove path traversal attempts and special characters
  return filename.replace(/[^a-zA-Z0-9._-]/g, '');
}

module.exports = { clean, sanitizeFilename };