import type { ApiResponse } from "@oc/types";
import axios, { type AxiosError, type AxiosInstance } from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
const API_TIMEOUT = 15_000;

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiResponseError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiResponseError";
  }
}

const client: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: API_TIMEOUT,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

function toError(err: unknown): ApiResponseError {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    return new ApiResponseError(
      body?.error?.code ?? "UNKNOWN",
      body?.error?.message ?? err.message,
      err.response?.status ?? 0,
      body
    );
  }
  return new ApiResponseError(
    "NETWORK_ERROR",
    err instanceof Error ? err.message : "Network error",
    0
  );
}

export const api = {
  async get<T>(path: string, params?: Record<string, string | number | boolean>) {
    try {
      const res = await client.get<ApiResponse<T>>(path, { params });
      return res.data;
    } catch (err) {
      throw toError(err);
    }
  },

  async post<T>(path: string, body?: unknown) {
    try {
      const res = await client.post<ApiResponse<T>>(path, body);
      return res.data;
    } catch (err) {
      throw toError(err);
    }
  },

  async put<T>(path: string, body?: unknown) {
    try {
      const res = await client.put<ApiResponse<T>>(path, body);
      return res.data;
    } catch (err) {
      throw toError(err);
    }
  },

  async patch<T>(path: string, body?: unknown) {
    try {
      const res = await client.patch<ApiResponse<T>>(path, body);
      return res.data;
    } catch (err) {
      throw toError(err);
    }
  },

  async del<T>(path: string) {
    try {
      const res = await client.delete<ApiResponse<T>>(path);
      return res.data;
    } catch (err) {
      throw toError(err);
    }
  },
};
