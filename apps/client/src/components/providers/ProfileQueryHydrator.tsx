"use client";

import { queryKeys } from "@oc/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect } from "react";
import { useProfileInitialData } from "@/hooks/useProfileInitialData";

export function ProfileQueryHydrator() {
  const queryClient = useQueryClient();
  const profileInitialData = useProfileInitialData();

  useLayoutEffect(() => {
    if (profileInitialData?.data) {
      queryClient.setQueryData(queryKeys.my.profile(), profileInitialData);
    }
  }, [profileInitialData, queryClient]);

  return null;
}
