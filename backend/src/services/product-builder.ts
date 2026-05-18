import { markBuildFailed, markBuildReady, updateBuildStatus } from "../repositories/builds-repository.js";
import type { BuildRecord } from "../types/build.js";
import { insalesClient } from "./insales-client.js";
import { composeDakimakuraPreview } from "./image-composer.js";

export async function processBuild(build: BuildRecord) {
  await updateBuildStatus(build.id, "building");

  try {
    const templateProduct = await insalesClient.getProductById(build.templateProductId);
    const frontProduct = await insalesClient.getProductById(build.frontProductId);
    const backProduct = await insalesClient.getProductById(build.backProductId);

    const frontImageUrl = pickPrimaryImage(frontProduct);
    const backImageUrl = pickPrimaryImage(backProduct);

    if (!frontImageUrl || !backImageUrl) {
      throw new Error("Front or back image is missing");
    }

    const [frontBuffer, backBuffer] = await Promise.all([
      insalesClient.fetchImageBuffer(frontImageUrl),
      insalesClient.fetchImageBuffer(backImageUrl)
    ]);

    const previewBuffer = await composeDakimakuraPreview({
      frontImageBuffer: frontBuffer,
      backImageBuffer: backBuffer
    });

    const generatedTitle = buildGeneratedTitle(templateProduct?.product ?? templateProduct, build);
    const generatedSku = buildGeneratedSku(build);

    const createdProductResponse = await insalesClient.createProduct({
      title: generatedTitle,
      description: templateProduct?.product?.description ?? templateProduct?.description ?? "",
      short_description: templateProduct?.product?.short_description ?? templateProduct?.short_description ?? "",
      available: true,
      hidden: true,
      tags: ["generated-daki", `template-${build.templateProductId}`]
    });

    const createdProduct = createdProductResponse.product ?? createdProductResponse;
    const matchedTemplateVariant = pickTemplateVariant(templateProduct?.product ?? templateProduct, build.selection);

    const createdVariantResponse = await insalesClient.createVariant(createdProduct.id, {
      title: generatedTitle,
      sku: generatedSku,
      available: true,
      quantity: matchedTemplateVariant?.quantity ?? 999,
      price: matchedTemplateVariant?.price ?? templateProduct?.product?.price ?? templateProduct?.price ?? 0,
      old_price: matchedTemplateVariant?.old_price ?? templateProduct?.product?.old_price ?? templateProduct?.old_price
    });

    const createdVariant = createdVariantResponse.variant ?? createdVariantResponse;

    await insalesClient.uploadMainImage(
      createdProduct.id,
      previewBuffer,
      `${generatedSku || `daki-${build.id}`}.jpg`
    );

    await markBuildReady(build.id, {
      generatedProductId: Number(createdProduct.id),
      generatedVariantId: Number(createdVariant.id),
      generatedProductHandle: createdProduct.handle ? String(createdProduct.handle) : null,
      previewSourceUrl: frontImageUrl
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown build error";
    await markBuildFailed(build.id, message);
    throw error;
  }
}

function pickPrimaryImage(product: any): string | null {
  const source = product?.product ?? product;
  const image = source?.first_image ?? source?.images?.[0];
  return image?.original_url ?? image?.large_url ?? image?.medium_url ?? image?.small_url ?? null;
}

function pickTemplateVariant(product: any, selection: Record<string, string>) {
  const variants = product?.variants ?? [];
  return variants.find((variant: any) => {
    const optionValues = variant.option_values ?? [];
    const variantMap = Object.fromEntries(
      optionValues.map((value: any) => {
        const key = value.option_name?.handle
          ?? value.option_name?.title
          ?? value.option_name_title
          ?? value.option_name_id;
        const normalizedKey = String(key).trim().toLowerCase();
        return [normalizedKey, String(value.title ?? value.value ?? "").trim().toLowerCase()];
      })
    );

    return Object.entries(selection).every(([key, value]) => {
      return variantMap[String(key).trim().toLowerCase()] === String(value).trim().toLowerCase();
    });
  }) ?? variants[0] ?? null;
}

function buildGeneratedTitle(templateProduct: any, build: BuildRecord) {
  const baseTitle = templateProduct?.title ?? "Дакимакура";
  const selectionText = Object.values(build.selection).join(" / ");
  return `${baseTitle} / ${selectionText} / ${build.id.slice(-6)}`;
}

function buildGeneratedSku(build: BuildRecord) {
  const selection = Object.values(build.selection)
    .join("-")
    .toUpperCase()
    .replace(/[^A-Z0-9А-ЯЁ]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `DAKI-${selection}-${build.frontProductId}-${build.backProductId}`.slice(0, 64);
}
