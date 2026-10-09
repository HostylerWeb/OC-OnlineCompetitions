import type { Competition } from "@oc/types";
import { createContext, type ReactNode, useContext } from "react";

interface HomeCompetitionsContextValue {
  competitions: Competition[];
  isLoading: boolean;
}

const HomeCompetitionsContext = createContext<HomeCompetitionsContextValue | null>(null);

export function HomeCompetitionsProvider({
  value,
  children,
}: {
  value: HomeCompetitionsContextValue;
  children: ReactNode;
}) {
  return (
    <HomeCompetitionsContext.Provider value={value}>{children}</HomeCompetitionsContext.Provider>
  );
}

export function useHomeCompetitions() {
  return useContext(HomeCompetitionsContext);
}
