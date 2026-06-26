import { createApp } from './app';
import { config } from './config/env';
import { closePool } from './config/pool';
import type { Server } from 'http';

const app = createApp();
let server: Server;

function startServer(port: number): void {
  server = app.listen(port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`CRM API listening on network interface 0.0.0.0:${port} (${config.nodeEnv})`);
  });

  server.once('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE' && config.nodeEnv === 'development') {
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

startServer(config.port);

async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}, shutting down...`);
  
  // Directly calling close on our active server instance
  server.close(() => undefined);
  await closePool();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
