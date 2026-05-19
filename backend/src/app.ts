import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { env } from "./config/env.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerBuildRoutes } from "./routes/build.js";
import { closeDb, pingDb } from "./lib/db.js";

const app = Fastify({
  logger: true
});

app.register(cors, {
  origin: true,
  credentials: false
});

app.register(sensible);

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

export function buildApp() {
  return app;
}

export default app;
