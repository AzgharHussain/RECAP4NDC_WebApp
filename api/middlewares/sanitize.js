const xss = require("xss");

const options = {
  whiteList: {},        // No tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script"]
};

function clean(value) {
  if (typeof value !== "string") return value;
  return xss(value.trim(), options);
}

module.exports = { clean };
