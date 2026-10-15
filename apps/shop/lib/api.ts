import { serverFetch } from "@/lib/server-fetch";

export interface ShopProductOptionValue {
  value: string;
  metadata?: Record<string, unknown>;
}

export interface ShopProductOption {
  name: string;
  values: ShopProductOptionValue[];
}

export interface ShopProductVariantData {
  _id: string;
  productId: string;
  name: string;
  sku: string;
  price?: number;
  compareAtPrice?: number;
  inventory: number;
  inventoryTracked: boolean;
  images: string[];
  optionValues: { optionName: string; value: string }[];
  isActive: boolean;
  sortOrder: number;
  metadata?: Record<string, unknown>;
}

export interface ShopProductData {
  _id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  sku: string;
  inventory: number;
  inventoryTracked: boolean;
  categoryId?: string;
  images: string[];
  options?: ShopProductOption[];
  variants?: ShopProductVariantData[];
  lowStockThreshold?: number;
  metadata?: { imageBlurs?: Record<string, string> };
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShopCategoryData {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  sortOrder: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
}

export async function fetchProducts(params?: {
  page?: number;
  limit?: number;
  categoryId?: string;
  search?: string;
  sort?: string;
  dir?: "asc" | "desc";
}): Promise<PaginatedResponse<ShopProductData>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.categoryId) searchParams.set("categoryId", params.categoryId);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.sort) searchParams.set("sort", params.sort);
  if (params?.dir) searchParams.set("dir", params.dir);

  const qs = searchParams.toString();
  return serverFetch<PaginatedResponse<ShopProductData>>(`/api/shop/products${qs ? `?${qs}` : ""}`);
}

export async function fetchProductBySlug(slug: string): Promise<{ data: ShopProductData }> {
  return serverFetch<{ data: ShopProductData }>(`/api/shop/products/${slug}`);
}

export async function fetchCategories(): Promise<{ data: ShopCategoryData[] }> {
  return serverFetch("/api/shop/categories");
}

export interface CartItemData {
  productId: string;
  variantId?: string;
  quantity: number;
  priceAtAdd: number;
  product: ShopProductData | null;
}

export interface CartData {
  items: CartItemData[];
}

export async function fetchCart(): Promise<{ data: CartData }> {
  return serverFetch<{ data: CartData }>("/api/shop/cart");
}

export interface ShopOrderData {
  _id: string;
  orderNumber: number;
  status: string;
  providerSessionId?: string;
  items: {
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
    productSnapshot: { name: string; sku: string; price: number; variantName?: string };
  }[];
  subtotal: number;
  total: number;
  shippingAddress: {
    firstName: string;
    lastName: string;
    addressLine1: string;
    city: string;
    postcode: string;
    country: string;
  };
  createdAt: string;
}

export async function fetchOrders(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<ShopOrderData>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return serverFetch<PaginatedResponse<ShopOrderData>>(`/api/shop/orders${qs ? `?${qs}` : ""}`);
}

export async function fetchOrder(id: string): Promise<{ data: ShopOrderData }> {
  return serverFetch<{ data: ShopOrderData }>(`/api/shop/orders/${id}`);
}
