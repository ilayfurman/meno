import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

app
  .listen({ host: '0.0.0.0', port: env.PORT })
  .then(() => {
    app.log.info(`Meno backend listening on port ${env.PORT}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
