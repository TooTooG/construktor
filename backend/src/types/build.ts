export type BuildStatus = "pending" | "building" | "ready" | "failed";

export interface ConstructorSelection {
  [key: string]: string;
}

export interface ConstructorBuildRequest {
  templateProductId: number;
  templateVariantId?: number | null;
  frontProductId: number;
  backProductId: number | null;
  quantity: number;
  selection: ConstructorSelection;
}

export interface BuildRecord {
  id: string;
  status: BuildStatus;
  templateProductId: number;
  templateVariantId?: number | null;
  frontProductId: number;
  backProductId: number | null;
  quantity: number;
  selection: ConstructorSelection;
  buildSignature: string;
  generatedProductId: number | null;
  generatedVariantId: number | null;
  generatedProductHandle: string | null;
  previewSourceUrl: string | null;
  errorText: string | null;
  createdAt: string;
  updatedAt: string;
}
