import crypto from "node:crypto";
import { markBuildFailed, markBuildReady, updateBuildStatus } from "../repositories/builds-repository.js";
import type { BuildRecord, ConstructorSelection } from "../types/build.js";
import type { InSalesImageAsset, InSalesProductResponse, InSalesVariantSummary } from "./insales-client.js";
import { insalesClient } from "./insales-client.js";
import { composeDakimakuraPreview } from "./image-composer.js";

export async function processBuild(build: BuildRecord) {
  await updateBuildStatus(build.id, "building");

  try {
    const templateProduct = await insalesClient.getProductById(build.templateProductId);
    const frontProduct = await insalesClient.getProductById(build.frontProductId);
    const backProduct = build.backProductId
      ? await insalesClient.getProductById(build.backProductId)
      : frontProduct;

    const frontImageUrl = pickPrimaryImage(frontProduct);
    const backImageUrl = pickPrimaryImage(backProduct);

    if (!frontImageUrl || !backImageUrl) {
      throw new Error("Preview source images were not found.");
    }

    const [frontBuffer, backBuffer] = await Promise.all([
      insalesClient.fetchImageBuffer(frontImageUrl),
      insalesClient.fetchImageBuffer(backImageUrl)
    ]);

    const previewBuffer = await composeDakimakuraPreview({
      frontImageBuffer: frontBuffer,
      backImageBuffer: backBuffer
    });

    const matchedTemplateVariant = pickTemplateVariant(templateProduct, build);
    if (!matchedTemplateVariant) {
      throw new Error("The selected configuration could not be matched to a template variant.");
    }

    if (!templateProduct.category_id) {
      throw new Error("Template product category_id is missing.");
    }

    const generatedTitle = buildGeneratedTitle(templateProduct, build);
    const generatedSku = buildGeneratedSku(build);
    const variantPayload = buildGeneratedVariantPayload(matchedTemplateVariant, generatedSku, build.quantity);

    const createdProduct = await insalesClient.createProduct({
      category_id: Number(templateProduct.category_id),
      title: generatedTitle,
      description: templateProduct.description ?? "",
      short_description: templateProduct.short_description ?? "",
      available: variantPayload.available,
      is_hidden: true,
      tags: buildGeneratedTags(build),
      variants_attributes: [
        {
          sku: variantPayload.sku,
          quantity: variantPayload.quantity,
          price: variantPayload.price,
          old_price: variantPayload.old_price
        }
      ]
    });

    const createdVariant = createdProduct.variants?.[0];
    if (!createdVariant?.id) {
      throw new Error("InSales did not return a created variant in product response.");
    }

    const uploadedImage = await insalesClient.uploadMainImage(
      createdProduct.id,
      previewBuffer,
      `${generatedSku}.jpg`
    );

    const refreshedProduct = await insalesClient.getProductById(createdProduct.id);

    await markBuildReady(build.id, {
      generatedProductId: Number(refreshedProduct.id),
      generatedVariantId: Number(createdVariant.id),
      generatedProductHandle: refreshedProduct.permalink
        ? String(refreshedProduct.permalink)
        : createdProduct.permalink
          ? String(createdProduct.permalink)
          : null,
      previewSourceUrl: pickPrimaryImage(refreshedProduct) ?? pickPrimaryImage(uploadedImage) ?? frontImageUrl
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown build error";
    await markBuildFailed(build.id, message);
    throw error;
  }
}

function pickPrimaryImage(source: InSalesProductResponse | InSalesImageAsset | null | undefined): string | null {
  if (!source) {
    return null;
  }

  if (isProductResponse(source)) {
    const image = source.first_image ?? source.images?.[0] ?? null;
    return image?.original_url ?? image?.large_url ?? image?.medium_url ?? image?.small_url ?? null;
  }

  return source.original_url ?? source.large_url ?? source.medium_url ?? source.small_url ?? null;
}

function pickTemplateVariant(product: InSalesProductResponse, build: BuildRecord) {
  const explicitVariantId = build.templateVariantId ? Number(build.templateVariantId) : null;
  const variants = product.variants ?? [];

  if (explicitVariantId) {
    const exactVariant = variants.find((variant) => Number(variant.id) === explicitVariantId) ?? null;
    if (exactVariant) {
      return exactVariant;
    }
  }

  return pickTemplateVariantBySelection(product, build.selection);
}

function pickTemplateVariantBySelection(product: InSalesProductResponse, selection: ConstructorSelection) {
  const selectionByOptionId = normalizeSelection(product, selection);
  const variants = product.variants ?? [];

  if (!selectionByOptionId.size) {
    return null;
  }

  return variants.find((variant) => {
    const variantMap = new Map<number, string>();

    for (const optionValue of variant.option_values ?? []) {
      variantMap.set(
        Number(optionValue.option_name_id),
        String(optionValue.title ?? optionValue.value ?? "").trim().toLowerCase()
      );
    }

    for (const [optionId, selectedValue] of selectionByOptionId.entries()) {
      if (variantMap.get(optionId) !== selectedValue) {
        return false;
      }
    }

    return true;
  }) ?? null;
}

function normalizeSelection(product: InSalesProductResponse, selection: ConstructorSelection) {
  const result = new Map<number, string>();
  const optionNames = product.option_names ?? [];
  const optionNameLookup = new Map<string, number>();

  for (const optionName of optionNames) {
    const optionId = Number(optionName.id);
    const aliases = [
      optionName.permalink,
      optionName.api_permalink,
      optionName.title
    ];

    for (const alias of aliases) {
      const normalizedAlias = normalizeOptionKey(alias);
      if (normalizedAlias) {
        optionNameLookup.set(normalizedAlias, optionId);
      }
    }
  }

  for (const [key, value] of Object.entries(selection)) {
    const match = key.match(/^option-(\d+)(?:-|$)/i);
    let optionId: number | null = null;

    if (match) {
      optionId = Number(match[1]);
    } else {
      optionId = optionNameLookup.get(normalizeOptionKey(key)) ?? null;
    }

    if (!optionId) {
      continue;
    }

    result.set(optionId, String(value).trim().toLowerCase());
  }

  return result;
}

function normalizeOptionKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function buildGeneratedTitle(templateProduct: InSalesProductResponse, build: BuildRecord) {
  const baseTitle = templateProduct.title ?? "Dakimakura";
  const selectionText = Object.values(build.selection).join(" / ");
  return selectionText
    ? `${baseTitle} / ${selectionText} / ${build.id.slice(-6)}`
    : `${baseTitle} / ${build.id.slice(-6)}`;
}

function buildGeneratedSku(build: BuildRecord) {
  const digest = crypto
    .createHash("sha1")
    .update(JSON.stringify({
      frontProductId: build.frontProductId,
      backProductId: build.backProductId,
      selection: build.selection
    }))
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();

  return `DAKI-${build.id.slice(-6).toUpperCase()}-${digest}`;
}

function buildGeneratedVariantPayload(
  templateVariant: InSalesVariantSummary,
  sku: string,
  requestedQuantity: number
) {
  const price = Number(templateVariant.price ?? templateVariant.base_price ?? 0);
  const oldPrice = templateVariant.old_price ? Number(templateVariant.old_price) : undefined;
  const templateQuantity = Number(templateVariant.quantity ?? 0);

  return {
    sku,
    quantity: Math.max(templateQuantity, requestedQuantity, 1),
    available: templateVariant.available !== false,
    price,
    old_price: oldPrice
  };
}

function buildGeneratedTags(build: BuildRecord) {
  return [
    "generated-daki",
    "constructor",
    `template-${build.templateProductId}`,
    `front-${build.frontProductId}`,
    build.backProductId ? `back-${build.backProductId}` : "back-none"
  ];
}

function isProductResponse(source: InSalesProductResponse | InSalesImageAsset): source is InSalesProductResponse {
  return "category_id" in source;
}
