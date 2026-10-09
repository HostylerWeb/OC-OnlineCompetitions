import { createQueryClient } from "@oc/api-client";
import { cache } from "react";

export const getQueryClient = cache(() => createQueryClient());
