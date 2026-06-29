"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const pool_1 = require("./config/pool");
const app = (0, app_1.createApp)();
let server;
function startServer(port) {
    server = app.listen(port, '0.0.0.0', () => {
        // eslint-disable-next-line no-console
        console.log(`CRM API listening on network interface 0.0.0.0:${port} (${env_1.config.nodeEnv})`);
    });
    server.once('error', (error) => {
        if (error.code === 'EADDRINUSE' && env_1.config.nodeEnv === 'development') {
            const fallbackPort = port + 1;
            // eslint-disable-next-line no-console
            console.warn(`Port ${port} is already in use; retrying on ${fallbackPort}.`);
            startServer(fallbackPort);
            return;
        }
        // eslint-disable-next-line no-console
        console.error(error);
        process.exit(1);
    });
}
startServer(env_1.config.port);
async function shutdown(signal) {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, shutting down...`);
    // Directly calling close on our active server instance
    server.close(() => undefined);
    await (0, pool_1.closePool)();
    process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
//# sourceMappingURL=server.js.map