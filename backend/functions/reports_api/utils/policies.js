/**
 * policies.js
 * 
 * Centralized Policy Registry for Permission-Based Access Control (PBAC).
 * Maps Catalyst role_id to an array of granted permissions.
 * 
 * Configuration Approach: Actual Catalyst Role IDs are often generated dynamically 
 * during deployment and are immutable. By mapping configuration variables 
 * (like process.env.ROLE_ID_APP_ADMIN) to permissions, the environment variables 
 * can be substituted at runtime without modifying this authorization logic.
 */

// Use environment variables for dynamic Role IDs, falling back to mock IDs for development
const ROLE_ID_APP_ADMIN = process.env.ROLE_ID_APP_ADMIN || 'ROLE_ID_APP_ADMIN';
const ROLE_ID_ANALYST   = process.env.ROLE_ID_ANALYST   || 'ROLE_ID_ANALYST';
const ROLE_ID_APP_USER  = process.env.ROLE_ID_APP_USER  || 'ROLE_ID_APP_USER';

const ROLE_PERMISSIONS = {
  [ROLE_ID_APP_ADMIN]: [
    'generate_report',
    'view_report',
    'delete_report'
  ],
  [ROLE_ID_ANALYST]: [
    'generate_report',
    'view_report'
  ],
  [ROLE_ID_APP_USER]: [
    'view_report'
  ]
};

/**
 * Checks if a given role possesses the required permission.
 * 
 * @param {string} roleId - The Catalyst role ID of the user.
 * @param {string} permission - The permission required for the action.
 * @returns {boolean} True if the role has the permission, otherwise false.
 */
function hasPermission(roleId, permission) {
  if (!roleId || !permission) return false;
  
  const permissions = ROLE_PERMISSIONS[roleId];
  if (!Array.isArray(permissions)) return false;

  return permissions.includes(permission);
}

module.exports = {
  ROLE_PERMISSIONS,
  hasPermission
};
