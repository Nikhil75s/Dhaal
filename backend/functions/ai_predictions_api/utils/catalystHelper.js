// Catalyst SDK initialization helper for DHAAL backend services.
// Extracts the repeated SDK initialization pattern from repositories
// into a single reusable function.
//
// Every repository currently duplicates this logic:
//   const catalystRequest = req && typeof req === 'object' && req.catalystRequest
//     ? req.catalystRequest : req;
//   const app = catalyst.initialize(catalystRequest);
//
// This helper centralizes it.

const catalyst = require('zcatalyst-sdk-node');

/**
 * Initializes the Catalyst SDK from a normalized request object.
 *
 * Extracts the Catalyst runtime context from the request data object
 * passed through the Controller → Service → Repository chain.
 *
 * @param {object} requestData - The normalized request object created by the runtime adapter.
 * @param {object} [requestData.catalystRequest] - The Catalyst runtime context.
 * @returns {import('zcatalyst-sdk-node').CatalystApp} Initialized Catalyst app instance.
 */
function initializeCatalystApp(requestData) {
  const catalystContext = requestData && typeof requestData === 'object' && requestData.catalystRequest
    ? requestData.catalystRequest
    : requestData;

  return catalyst.initialize(catalystContext);
}

module.exports = { initializeCatalystApp };
