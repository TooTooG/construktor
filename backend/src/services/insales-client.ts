import { env } from "../config/env.js";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface InSalesImageAsset {
  id: number;
  original_url?: string;
  medium_url?: string;
  small_url?: string;
}

export interface InSalesProductPayload {
  title: string;
  short_description?: string;
  description?: string;
  available?: boolean;
  archived?: boolean;
  hidden?: boolean;
  tags?: string[];
}

export interface InSalesVariantPayload {
  title: string;
  sku?: string;
  quantity?: number;
  available?: boolean;
  price: number;
  old_price?: number;
}

export class InSalesClient {
  async getProductById(productId: number) {
    return this.request(`/admin/products/${productId}.json`, "GET");
  }

  async createProduct(payload: InSalesProductPayload) {
    return this.request("/admin/products.json", "POST", { product: payload });
  }

  async createVariant(productId: number, payload: InSalesVariantPayload) {
    return this.request(`/admin/products/${productId}/variants.json`, "POST", { variant: payload });
  }

  async uploadMainImage(productId: number, previewBuffer: Buffer, fileName: string) {
    return this.request(`/admin/products/${productId}/images.json`, "POST", {
      image: {
        attachment: previewBuffer.toString("base64"),
        filename: fileName
      }
    });
  }

  async fetchImageBuffer(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  private async request(path: string, method: HttpMethod, body?: unknown) {
    const requestUrl = new URL(path, env.INSALES_SHOP_URL).toString();
    const response = await fetch(requestUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.INSALES_ACCESS_TOKEN}`
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`InSales API ${method} ${path} failed: ${response.status} ${text}`);
    }

    return response.json();
  }
}

export const insalesClient = new InSalesClient();
