export type BuildStatus = "pending" | "building" | "ready" | "failed";

export interface ConstructorSelection {
  [key: string]: string;
}

export interface ConstructorBuildRequest {
  templateProductId: number;
  frontProductId: number;
  backProductId: number;
  quantity: number;
  selection: ConstructorSelection;
}

export interface BuildRecord {
  id: string;
  status: BuildStatus;
  templateProductId: number;
  frontProductId: number;
  backProductId: number;
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
