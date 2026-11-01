try {
  module.exports = require("playwright");
} catch {
  module.exports = require(
    process.env.PLAYWRIGHT_MODULE || "playwright",
  );
}
