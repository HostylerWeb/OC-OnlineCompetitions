import { setApiBaseUrl } from "@oc/api-client";
import { setAuthBaseUrl } from "@oc/auth-client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

function resolveApiUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (import.meta.env.DEV) return "http://127.0.0.1:3555";
  throw new Error("VITE_API_URL must be set for production mobile builds");
}

const API_URL = resolveApiUrl();
setApiBaseUrl(API_URL);
setAuthBaseUrl(API_URL);

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
