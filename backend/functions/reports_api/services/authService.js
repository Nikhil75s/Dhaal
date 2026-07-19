/**
 * authService.js
 * 
 * Service responsible for authenticating the request via the Catalyst SDK
 * and authorizing the user against defined policies.
 */

const catalyst = require('zcatalyst-sdk-node');
const { logger } = require('../utils/logger');
const { hasPermission } = require('../utils/policies');

class AuthService {
  /**
   * Verifies the Catalyst authentication token/session and ensures
   * the user possesses the required permission.
   *
   * @param {object} req - The incoming Catalyst request object.
   * @param {string} requiredPermission - The capability required (e.g., 'generate_report').
   * @returns {Promise<object>} The authenticated ICatalystUser object.
   * @throws {Error} 401 Unauthorized or 403 Forbidden.
   */
  async verifyAndAuthorize(req, requiredPermission) {
    let catalystApp;
    let currentUser;

    try {
      catalystApp = catalyst.initialize(req);
      const userManagement = catalystApp.userManagement();
      
      // Fetch user profile based on implicitly forwarded Catalyst credentials
      currentUser = await userManagement.getCurrentUser();
    } catch (error) {
      // Log the failure securely (no tokens or request bodies)
      logger.error('Authentication failed: Missing or invalid Catalyst session', {
        errorMsg: error.message,
        timestamp: new Date().toISOString()
      });

      const authError = new Error('Authentication required');
      authError.statusCode = 401;
      throw authError;
    }

    if (!currentUser) {
      const authError = new Error('Authentication required: Session empty');
      authError.statusCode = 401;
      throw authError;
    }

    // The SDK contract guarantees role_details is present
    const roleDetails = currentUser.role_details;
    const roleId = roleDetails.role_id;
    const roleName = roleDetails.role_name;
    const userId = currentUser.user_id;

    // Log the authenticated request identity (role_name used for human-readable logging)
    logger.info('User authenticated', {
      userId: userId,
      role: roleName,
      timestamp: new Date().toISOString()
    });

    // Check PBAC (Permission-Based Access Control) using role_id
    if (!hasPermission(roleId, requiredPermission)) {
      logger.error('Authorization failed: Insufficient permissions', {
        userId: userId,
        role: roleName,
        requiredPermission: requiredPermission,
        timestamp: new Date().toISOString()
      });

      const authError = new Error('Insufficient permissions');
      authError.statusCode = 403;
      throw authError;
    }

    logger.info('User authorized', {
      userId: userId,
      permissionGranted: requiredPermission,
      timestamp: new Date().toISOString()
    });

    return currentUser;
  }
}

module.exports = AuthService;
