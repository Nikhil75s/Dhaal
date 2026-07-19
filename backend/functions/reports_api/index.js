// Catalyst serverless entry point for reports_api.
// This file routes incoming requests to the controller layer.

const ReportsController = require('./controllers/reportsController.js');

const controller = new ReportsController();

module.exports = async function (context, req) {
  // The controller handles parsing, validation, and response shaping.
  return controller.handleRequest(req, context);
};
