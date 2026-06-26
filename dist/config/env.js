"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function required(name) {
    const value = process.env[name];
    if (value === undefined || value === '') {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
function optional(name, fallback) {
    const value = process.env[name];
    return value === undefined || value === '' ? fallback : value;
}
function toInt(value, name) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        throw new Error(`Environment variable ${name} must be an integer, got: ${value}`);
    }
    return parsed;
}
exports.config = {
    port: toInt(optional('PORT', '3000'), 'PORT'),
    nodeEnv: optional('NODE_ENV', 'development'),
    databaseUrl: required('DATABASE_URL'),
    jwtSecret: required('JWT_SECRET'),
    jwtExpiresIn: optional('JWT_EXPIRES_IN', '1h'),
    bcryptSaltRounds: toInt(optional('BCRYPT_SALT_ROUNDS', '10'), 'BCRYPT_SALT_ROUNDS'),
    systemApiSecretKey: optional('SYSTEM_API_SECRET_KEY', 'your_32_character_security_key_here'),
    demoTenantId: optional('DEMO_TENANT_ID', '77777777-7777-7777-7777-777777777777'),
    demoOwnerId: optional('DEMO_OWNER_ID', '11111111-1111-1111-1111-111111111111'),
};
//# sourceMappingURL=env.js.map