"use client";

import { OpenRouterAiSettingsView } from "@/components/addons/OpenRouterAiSettingsView";
import { OpenRouterImageGenerationView } from "@/components/addons/OpenRouterImageGenerationView";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image, Sparkles } from "@oc/icons";
import Link from "next/link";

export function OpenRouterAiAddonView() {
  return (
    <PageShell
      title="OpenRouter AI"
      description="Customer personalisation and image generation via OpenRouter."
      actions={
        <Button type="button" variant="outline" asChild>
          <Link href="/addons">Back to addons</Link>
        </Button>
      }
    >
      <Tabs defaultValue="customer" className="flex min-w-0 flex-col gap-6">
        <TabsList className="grid h-auto w-full max-w-md grid-cols-2 gap-1 p-1">
          <TabsTrigger value="customer" className="gap-1.5 text-xs sm:text-sm">
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            Customer personalisation
          </TabsTrigger>
          <TabsTrigger value="images" className="gap-1.5 text-xs sm:text-sm">
            <Image className="size-3.5 shrink-0" aria-hidden />
            Image generation
          </TabsTrigger>
        </TabsList>
        <TabsContent value="customer" className="mt-0 min-w-0">
          <OpenRouterAiSettingsView embedded />
        </TabsContent>
        <TabsContent value="images" forceMount className="mt-0 min-w-0 data-[state=inactive]:hidden">
          <OpenRouterImageGenerationView />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
