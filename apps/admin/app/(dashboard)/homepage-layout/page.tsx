"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAdminHomepageLayoutSettings, useHomepageLayoutMutations } from "@oc/api-admin";
import { GripVertical, LayoutTemplate } from "@oc/icons";
import {
  DEFAULT_HOMEPAGE_SECTIONS,
  type HomepageSectionConfig,
  type HomepageSectionId,
} from "@oc/types";
import { HOMEPAGE_SECTION_LABELS } from "@oc/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

interface SortableSectionRowProps {
  section: HomepageSectionConfig;
  onToggle: (id: HomepageSectionId, enabled: boolean) => void;
}

function SortableSectionRow({ section, onToggle }: SortableSectionRowProps) {
  const meta = HOMEPAGE_SECTION_LABELS[section.id];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 transition-colors hover:border-primary/30"
    >
      <button
        type="button"
        className="touch-none cursor-grab rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
        aria-label={`Drag ${meta.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{meta.title}</p>
        <p className="text-xs text-muted-foreground">{meta.description}</p>
        {section.id === "hero" && !section.enabled ? (
          <p className="mt-1 text-xs text-amber-500">
            Disabling the hero removes the main featured carousel.
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{section.enabled ? "On" : "Off"}</span>
        <Switch
          checked={section.enabled}
          onCheckedChange={(checked) => onToggle(section.id, checked)}
          aria-label={`Enable ${meta.title}`}
          data-umami-event="homepage:toggle-section"
          data-umami-event-section={section.id}
        />
      </div>
    </li>
  );
}

export default function HomepageLayoutAdminPage() {
  const [sections, setSections] = useState<HomepageSectionConfig[]>(DEFAULT_HOMEPAGE_SECTIONS);
  const [error, setError] = useState("");

  const { data, isLoading } = useAdminHomepageLayoutSettings();
  const { saveSettingsMutation } = useHomepageLayoutMutations();

  useEffect(() => {
    if (data?.data?.sections?.length) {
      setSections(data.data.sections);
    }
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function toggleSection(id: HomepageSectionId, enabled: boolean) {
    setSections((prev) =>
      prev.map((section) => (section.id === id ? { ...section, enabled } : section))
    );
  }

  function handleSave() {
    setError("");
    const enabledCount = sections.filter((s) => s.enabled).length;
    if (enabledCount === 0) {
      setError("At least one homepage section must remain enabled.");
      return;
    }
    saveSettingsMutation.mutate(
      { sections },
      {
        onSuccess: () => toast.success("Layout saved"),
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to save homepage layout");
        },
      }
    );
  }

  return (
    <PageShell
      title="Homepage Layout"
      description="Control which sections appear on the customer homepage and in what order."
      actions={
        <Button
          onClick={handleSave}
          disabled={saveSettingsMutation.isPending}
          data-umami-event="homepage:save-layout"
        >
          Save layout
        </Button>
      }
    >
      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <LayoutTemplate className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Customer homepage</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Drag the handle to reorder sections. Category order within the Categories block is
            managed on the{" "}
            <Link href="/categories" className="text-primary underline-offset-4 hover:underline">
              Categories
            </Link>{" "}
            page. Ending Soon thresholds are configured in{" "}
            <Link href="/competitions" className="text-primary underline-offset-4 hover:underline">
              Competitions → Settings
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
              {sections.map((section) => (
                <SortableSectionRow key={section.id} section={section} onToggle={toggleSection} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </PageShell>
  );
}
