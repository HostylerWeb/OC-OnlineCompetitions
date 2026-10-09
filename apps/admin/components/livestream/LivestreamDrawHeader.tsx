"use client";

import { RefreshCw } from "@oc/icons";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LivestreamDrawHeaderProps {
  currentTime: Date | null;
  onRefresh: () => void;
}

function LivestreamDrawHeader({ currentTime, onRefresh }: LivestreamDrawHeaderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <Card className="mx-auto flex max-w-7xl flex-row items-center justify-between rounded-none border-0 bg-transparent py-0 shadow-none">
        <CardHeader className="flex flex-row items-center gap-4 px-6 py-4">
          <Badge variant="outline" className="shrink-0">
            Livestream Draws
          </Badge>
          <CardTitle className="text-sm font-medium">
            {mounted && currentTime
              ? currentTime.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "--:--:--"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 px-6 py-4">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    </header>
  );
}

export { LivestreamDrawHeader };
