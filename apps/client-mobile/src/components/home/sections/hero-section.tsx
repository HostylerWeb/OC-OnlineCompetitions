import type { Competition } from "@oc/types";
import { HeroSlider } from "../HeroSlider";

export function HeroSection({ competitions }: { competitions: Competition[] }) {
  return <HeroSlider competitions={competitions} />;
}
