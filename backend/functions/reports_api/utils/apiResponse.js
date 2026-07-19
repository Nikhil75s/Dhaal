// Standard API response formatter.
// This utility provides a consistent response shape for the serverless functions.
// TODO: extend this with richer metadata when the real API contract is finalized.

function createSuccessResponse(data, statusCode = 200, message = 'Request completed successfully') {
  return {
    statusCode,
    body: {
      success: true,
      message,
      data
    }
  };
}

function createErrorResponse(message, statusCode = 400, details = null) {
  return {
    statusCode,
    body: {
      success: false,
      message,
      details
    }
  };
}

module.exports = {
  createSuccessResponse,
  createErrorResponse
};
