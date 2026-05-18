import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { getDb } from "../lib/db.js";
import type { BuildRecord, BuildStatus, ConstructorBuildRequest } from "../types/build.js";

export async function createPendingBuild(payload: ConstructorBuildRequest): Promise<BuildRecord> {
  const id = `bld_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const signature = buildSignature(payload);
  const db = getDb();

  const result = await db.query(
    `
      insert into constructor_builds (
        id, status, template_product_id, front_product_id, back_product_id,
        quantity, selection_json, build_signature
      )
      values ($1, 'pending', $2, $3, $4, $5, $6::jsonb, $7)
      returning *
    `,
    [
      id,
      payload.templateProductId,
      payload.frontProductId,
      payload.backProductId,
      payload.quantity,
      JSON.stringify(payload.selection),
      signature
    ]
  );

  return mapRow(result.rows[0]);
}

export async function findBuildById(id: string): Promise<BuildRecord | null> {
  const db = getDb();
  const result = await db.query("select * from constructor_builds where id = $1 limit 1", [id]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function updateBuildStatus(
  id: string,
  status: BuildStatus,
  client?: PoolClient
): Promise<void> {
  const executor = client ?? getDb();
  await executor.query(
    "update constructor_builds set status = $2, updated_at = now() where id = $1",
    [id, status]
  );
}

export async function markBuildReady(
  id: string,
  params: {
    generatedProductId: number;
    generatedVariantId: number;
    generatedProductHandle: string | null;
    previewSourceUrl: string | null;
  }
): Promise<void> {
  const db = getDb();
  await db.query(
    `
      update constructor_builds
      set
        status = 'ready',
        generated_product_id = $2,
        generated_variant_id = $3,
        generated_product_handle = $4,
        preview_source_url = $5,
        updated_at = now()
      where id = $1
    `,
    [
      id,
      params.generatedProductId,
      params.generatedVariantId,
      params.generatedProductHandle,
      params.previewSourceUrl
    ]
  );
}

export async function markBuildFailed(id: string, errorText: string): Promise<void> {
  const db = getDb();
  await db.query(
    `
      update constructor_builds
      set
        status = 'failed',
        error_text = $2,
        updated_at = now()
      where id = $1
    `,
    [id, errorText]
  );
}

function buildSignature(payload: ConstructorBuildRequest) {
  const normalizedSelection = Object.keys(payload.selection)
    .sort()
    .map((key) => `${key}:${payload.selection[key]}`)
    .join("|");

  return [
    payload.templateProductId,
    payload.frontProductId,
    payload.backProductId ?? "none",
    payload.quantity,
    normalizedSelection
  ].join("::");
}

function mapRow(row: Record<string, unknown>): BuildRecord {
  return {
    id: String(row.id),
    status: row.status as BuildStatus,
    templateProductId: Number(row.template_product_id),
    frontProductId: Number(row.front_product_id),
    backProductId: row.back_product_id ? Number(row.back_product_id) : null,
    quantity: Number(row.quantity),
    selection: row.selection_json as Record<string, string>,
    buildSignature: String(row.build_signature),
    generatedProductId: row.generated_product_id ? Number(row.generated_product_id) : null,
    generatedVariantId: row.generated_variant_id ? Number(row.generated_variant_id) : null,
    generatedProductHandle: row.generated_product_handle ? String(row.generated_product_handle) : null,
    previewSourceUrl: row.preview_source_url ? String(row.preview_source_url) : null,
    errorText: row.error_text ? String(row.error_text) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}
