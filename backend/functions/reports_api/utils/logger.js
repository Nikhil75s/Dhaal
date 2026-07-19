// Lightweight logger placeholder.
// TODO: replace this with a structured logging approach for production environments.

const logger = {
  info(message, meta = null) {
    if (meta) {
      console.log(`[INFO] ${message}`, meta);
      return;
    }
    console.log(`[INFO] ${message}`);
  },
  error(message, error = null) {
    if (error) {
      console.error(`[ERROR] ${message}`, error);
      return;
    }
    console.error(`[ERROR] ${message}`);
  }
};

module.exports = {
  logger
};
