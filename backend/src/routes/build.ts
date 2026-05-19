import type { FastifyInstance } from "fastify";
import { createPendingBuild, findBuildById } from "../repositories/builds-repository.js";
import { buildRequestSchema } from "../schemas/build.js";
import { processBuild } from "../services/product-builder.js";

export function registerBuildRoutes(app: FastifyInstance) {
  app.post("/api/constructor/build", async (request, reply) => {
    const payload = buildRequestSchema.parse(request.body);
    const build = await createPendingBuild(payload);

    try {
      await processBuild(build);

      return reply.code(202).send({
        buildId: build.id,
        status: "ready"
      });
    } catch (error) {
      if (error instanceof Error) {
        request.log.error(
          {
            buildId: build.id,
            errorMessage: error.message,
            errorStack: error.stack
          },
          "build_processing_failed"
        );

        return reply.code(500).send({
          message: error.message,
          buildId: build.id
        });
      }

      request.log.error({ buildId: build.id, error }, "build_processing_failed");
      return reply.code(500).send({
        message: "Build processing failed",
        buildId: build.id
      });
    }
  });

  app.get("/api/constructor/build/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const build = await findBuildById(params.id);

    if (!build) {
      return reply.code(404).send({
        message: "Build not found"
      });
    }

    return {
      buildId: build.id,
      status: build.status,
      generatedProductId: build.generatedProductId,
      generatedVariantId: build.generatedVariantId,
      productId: build.generatedProductId,
      variantId: build.generatedVariantId,
      productHandle: build.generatedProductHandle,
      errorText: build.errorText,
      error: build.errorText
    };
  });
}
