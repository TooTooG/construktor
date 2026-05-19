import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import { closeDb, pingDb } from "./lib/db.js";
import { registerBuildRoutes } from "./routes/build.js";
import { registerHealthRoutes } from "./routes/health.js";

const app = Fastify({
  logger: true
});

app.register(cors, {
  origin: true,
  credentials: false
});

app.get("/", async () => {
  return {
    service: "dakimakura-constructor-backend",
    status: "ok"
  };
});

registerHealthRoutes(app);
registerBuildRoutes(app);

app.addHook("onReady", async () => {
  await pingDb();
});

app.addHook("onClose", async () => {
  await closeDb();
});

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => {
    app.log.info({ port: env.PORT }, "server_started");
  })
  .catch((error) => {
    app.log.error(error, "server_start_failed");
    process.exit(1);
  });
