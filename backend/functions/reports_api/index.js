// Catalyst serverless entry point for reports_api.
// This file routes incoming requests to the controller layer.
// TODO: wire this function to the appropriate Catalyst route in the console.

const {controllerName} = require('./controllers/reportsController.js');

const controller = new {controllerName}();

module.exports = async function (context, req) {
  // The controller handles parsing, validation, and response shaping.
  // TODO: add route-specific branching when business logic is introduced.
  return controller.handleRequest(req, context);
};
