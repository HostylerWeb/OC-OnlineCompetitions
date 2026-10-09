import { createQueryClient } from "@oc/api-admin";
import { cache } from "react";

export const getQueryClient = cache(() => createQueryClient());
