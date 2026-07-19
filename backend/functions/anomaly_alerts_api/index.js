// Catalyst serverless entry point for anomaly_alerts_api.
// This file is the runtime adapter for the official Catalyst basicIO model.
// It extracts request data, delegates to the controller, and writes the response.

const AnomalyAlertsController = require('./controllers/anomalyalertsController');
const responseBuilder = require('./utils/responseBuilder');
const { AppError } = require('./utils/errorHandler');

const MODULE_NAME = 'anomaly_alerts';
const controller = new AnomalyAlertsController();

/**
 * Catalyst runtime adapter for the anomaly_alerts_api function.
 *
 * @param {object} context - Catalyst runtime context.
 * @param {object} basicIO - Catalyst basicIO object used for request/response handling.
 * @returns {Promise<void>} Resolves after the response has been written and the runtime has closed.
 */
module.exports = async function (context, basicIO) {
  try {
    // Normalize the Catalyst request object for the controller.
    const requestData = {
      arguments: basicIO && typeof basicIO.getAllArguments === 'function'
        ? basicIO.getAllArguments()
        : {},
      raw: basicIO,
      catalystRequest: context
    };

    // Delegate to the framework-independent controller.
    const result = await controller.handleRequest(requestData);

    // Write a consistent success envelope to the Catalyst runtime.
    basicIO.write(JSON.stringify(
      responseBuilder.success(result, { module: MODULE_NAME })
    ));
  } catch (error) {
    console.error('AnomalyAlerts runtime error:', error);

    // Format structured AppErrors with their code; fall back to generic for unexpected errors.
    const errorResponse = error instanceof AppError
      ? responseBuilder.fromAppError(error, MODULE_NAME)
      : responseBuilder.error({ module: MODULE_NAME });

    basicIO.write(JSON.stringify(errorResponse));
  } finally {
    context.close();
  }
};
