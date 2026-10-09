// Local utilities barrel  -  re-exports common helpers from @oc/utils
// and the local cn() helper.
//
// Components that previously imported from "@/lib/utils" get:
//   - `cn` from local
//   - everything else from "@oc/utils" (so formatCurrency, getDisplayName,
//     getMaxCartQuantity, SOCIAL_LINKS, etc. all work)

export * from "@oc/utils";
export { cn } from "@/lib/cn";
