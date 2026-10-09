import { getBool } from "@oc/env/next";

export const CACHING_ENABLED = getBool("CACHING_ENABLED", true);
export const PWA_ENABLED = true;
