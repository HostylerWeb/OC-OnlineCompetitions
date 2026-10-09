"use client";

import { ADDON_CATALOG } from "@/components/addons/addon-catalog";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "@oc/icons";
import Link from "next/link";

export default function AddonsAdminPage() {
  return (
    <PageShell
      title="Addons"
      description="Optional extensions for media, performance, and operations. Open an addon to configure it."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ADDON_CATALOG.map((addon) => {
          const Icon = addon.icon;
          const isAvailable = addon.status === "available";

          return (
            <Card key={addon.id} className="flex flex-col">
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-5 text-muted-foreground" />
                  </div>
                  <Badge variant={isAvailable ? "default" : "secondary"}>
                    {isAvailable ? "Available" : "Coming soon"}
                  </Badge>
                </div>
                <CardTitle className="text-base">{addon.title}</CardTitle>
                <CardDescription>{addon.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {addon.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs font-normal">
                    {tag}
                  </Badge>
                ))}
              </CardContent>
              <CardFooter className="mt-auto pt-0">
                {isAvailable ? (
                  <Button asChild className="w-full sm:w-auto">
                    <Link href={addon.href}>
                      <Settings className="size-4" />
                      Settings
                    </Link>
                  </Button>
                ) : (
                  <Button type="button" variant="outline" disabled className="w-full sm:w-auto">
                    <Settings className="size-4" />
                    Settings
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
