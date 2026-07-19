// Barrel file for constants.
// Exports all shared constant modules for convenient access.

const commonMessages = require('./commonMessages');
const httpMessages = require('./httpMessages');
const errorMessages = require('./errorMessages');
const districts = require('./districts');
const crimeCategories = require('./crimeCategories');
const severityLevels = require('./severityLevels');
const errorCodes = require('./errorCodes');

module.exports = {
  commonMessages,
  httpMessages,
  errorMessages,
  districts,
  crimeCategories,
  severityLevels,
  errorCodes
};
