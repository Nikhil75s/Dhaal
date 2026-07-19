// Input validation placeholder.
// TODO: implement schema validation for request body, query, and route params.

function validateRequest(req) {
  if (!req) {
    return {
      isValid: false,
      message: 'Request object is missing.'
    };
  }

  return {
    isValid: true,
    message: 'Request validation placeholder passed.'
  };
}

module.exports = {
  validateRequest
};
