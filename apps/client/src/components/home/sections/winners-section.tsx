import type { Winner } from "@oc/types";
import { takeRecentWinners } from "@/lib/home-winners";
import { WinnersShowcase } from "../WinnersShowcase";

export function WinnersSection({ winners }: { winners: Winner[] }) {
  return <WinnersShowcase winners={takeRecentWinners(winners)} />;
}
