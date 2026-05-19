import { env } from "../config/env.js";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface InSalesImageAsset {
  id: number;
  original_url?: string;
  large_url?: string;
  medium_url?: string;
  small_url?: string;
}

export interface InSalesVariantSummary {
  id: number;
  title?: string;
  sku?: string;
  quantity?: number;
  available?: boolean;
  price?: string | number;
  base_price?: string | number;
  old_price?: string | number | null;
  option_values?: Array<{
    option_name_id: number;
    title?: string;
    value?: string;
  }>;
}

export interface InSalesProductResponse {
  id: number;
  category_id: number;
  title: string;
  description?: string | null;
  short_description?: string | null;
  permalink?: string | null;
  available?: boolean;
  is_hidden?: boolean;
  archived?: boolean;
  first_image?: InSalesImageAsset | null;
  images?: InSalesImageAsset[];
  option_names?: Array<{
    id: number;
    title?: string;
    permalink?: string | null;
    api_permalink?: string | null;
  }>;
  variants?: InSalesVariantSummary[];
}

export interface InSalesProductPayload {
  category_id: number;
  title: string;
  short_description?: string;
  description?: string;
  available?: boolean;
  archived?: boolean;
  is_hidden?: boolean;
  tags?: string[];
  variants_attributes: Array<{
    sku?: string;
    quantity: number;
    price: number;
    old_price?: number;
  }>;
}

export class InSalesClient {
  async getProductById(productId: number): Promise<InSalesProductResponse> {
    return this.request(`/admin/products/${productId}.json`, "GET");
  }

  async createProduct(payload: InSalesProductPayload): Promise<InSalesProductResponse> {
    return this.request("/admin/products.json", "POST", { product: payload });
  }

  async uploadMainImage(productId: number, previewBuffer: Buffer, fileName: string): Promise<InSalesImageAsset> {
    return this.request(`/admin/products/${productId}/images.json`, "POST", {
      image: {
        attachment: previewBuffer.toString("base64"),
        filename: fileName,
        title: fileName,
        position: 1
      }
    });
  }

  async fetchImageBuffer(url: string) {
    const resolvedUrl = resolveExternalUrl(url);
    let response: Response;

    try {
      response = await fetch(resolvedUrl);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch image ${resolvedUrl}: ${reason}`);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch image ${resolvedUrl}: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  private async request(path: string, method: HttpMethod, body?: unknown) {
    const requestUrl = new URL(path, env.INSALES_SHOP_URL).toString();
    let response: Response;

    try {
      response = await fetch(requestUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: buildAuthorizationHeader()
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`InSales API ${method} ${path} request failed: ${reason}`);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`InSales API ${method} ${path} failed: ${response.status} ${text}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return response.text();
  }
}

export const insalesClient = new InSalesClient();

function buildAuthorizationHeader() {
  if (env.INSALES_API_KEY && env.INSALES_API_PASSWORD) {
    const raw = `${env.INSALES_API_KEY}:${env.INSALES_API_PASSWORD}`;
    return `Basic ${Buffer.from(raw).toString("base64")}`;
  }

  return `Bearer ${env.INSALES_ACCESS_TOKEN}`;
}

function resolveExternalUrl(url: string) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  return new URL(url, env.INSALES_SHOP_URL).toString();
}
