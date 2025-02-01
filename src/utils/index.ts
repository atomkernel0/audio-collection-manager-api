/**
 * @module
 * @description
 * This file serves as the main entry point for the library, organizing exports into
 * distinct domains:
 * - Auth: Authentication related functions and types
 * - User: User management functionality
 * - Media: Media handling utilities
 * - Common: Shared utilities and helpers
 */

// Auth Domain Exports
export { default as createToken } from "./auth/createToken";
export { default as verifyToken } from "./auth/verifyToken";

// User Domain Exports
export { default as checkUser } from "./user/checkUser";
export { default as createUser } from "./user/createUser";

// Media Domain Exports
export { AlbumsFormatUtils } from "./media/albumsFormatUtils";
export { ImageColorUtils } from "./media/colorUtils";

// Common Utilities
export { sanitize } from "./common/sanitize";
