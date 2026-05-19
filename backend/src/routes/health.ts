import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      status: "ok"
    };
  });

  app.get("/api/health", async () => {
    return {
      status: "ok"
    };
  });
}
