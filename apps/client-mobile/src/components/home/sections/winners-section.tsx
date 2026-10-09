import type { Winner } from "@oc/types";
import { WinnersShowcase } from "../WinnersShowcase";

export function WinnersSection({ winners }: { winners: Winner[] }) {
  return <WinnersShowcase winners={winners} />;
}
