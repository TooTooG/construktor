import { buildApp } from "./create-app.js";
import { env } from "./config/env.js";

const app = buildApp();

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => {
    app.log.info({ port: env.PORT }, "server_started");
  })
  .catch((error) => {
    app.log.error(error, "server_start_failed");
    process.exit(1);
  });
