"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.signToken = signToken;
exports.verifyToken = verifyToken;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const types_1 = require("../types");
async function hashPassword(plain) {
    return bcrypt_1.default.hash(plain, env_1.config.bcryptSaltRounds);
}
async function verifyPassword(plain, hash) {
    return bcrypt_1.default.compare(plain, hash);
}
/** Sign a stateless JWT carrying the tenant + role claims used for AuthZ. */
function signToken(payload) {
    // Cast the whole literal: jsonwebtoken types `expiresIn` as a branded
    // StringValue union that a plain string is not directly assignable to.
    const options = { expiresIn: env_1.config.jwtExpiresIn };
    return jsonwebtoken_1.default.sign(payload, env_1.config.jwtSecret, options);
}
function isRole(value) {
    return typeof value === 'string' && types_1.ROLES.includes(value);
}
/**
 * Verify a token's signature/expiry and return a strongly-typed principal.
 * Throws if the token is invalid or the payload is malformed.
 */
function verifyToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, env_1.config.jwtSecret);
    if (typeof decoded !== 'object' || decoded === null) {
        throw new Error('Invalid token payload');
    }
    const { userId, tenantId, role } = decoded;
    if (typeof userId !== 'string' || typeof tenantId !== 'string' || !isRole(role)) {
        throw new Error('Invalid token claims');
    }
    return { userId, tenantId, role };
}
//# sourceMappingURL=security.js.map