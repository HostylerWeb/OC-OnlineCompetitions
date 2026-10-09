"use client";

import type { AdminCategory } from "@oc/types";
import { Combobox } from "@/components/ui/combobox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { slugifyName } from "@/lib/slug";
import type { CompetitionFormState, CompetitionStatus } from "./types";
import { STATUS_OPTIONS } from "./types";

interface CompetitionDetailsTabProps {
  form: CompetitionFormState;
  categories: AdminCategory[];
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFormUpdate: (updater: (prev: CompetitionFormState) => CompetitionFormState) => void;
}

function shouldAutoUpdateSlug(currentSlug: string, previousTitle: string): boolean {
  if (!currentSlug.trim()) return true;
  return currentSlug === slugifyName(previousTitle);
}

function CompetitionDetailsTab({
  form,
  categories,
  onChange,
  onFormUpdate,
}: CompetitionDetailsTabProps) {
  return (
    <FieldGroup>
      <FieldSeparator>General</FieldSeparator>

      <div className="flex flex-col gap-5 @md/field-group:flex-row">
        <Field className="@md/field-group:flex-1">
          <FieldLabel htmlFor="title">
            Title <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="title"
            name="title"
            value={form.title}
            onChange={(e) => {
              const title = e.target.value;
              const previousTitle = form.title;
              onFormUpdate((p) => {
                if (!shouldAutoUpdateSlug(p.slug, previousTitle)) {
                  return { ...p, title };
                }
                return { ...p, title, slug: slugifyName(title) };
              });
            }}
            placeholder="Competition title"
            autoComplete="off"
            required
          />
        </Field>
        <Field className="@md/field-group:flex-1">
          <FieldLabel htmlFor="slug">Slug</FieldLabel>
          <Input
            id="slug"
            name="slug"
            value={form.slug}
            onChange={onChange}
            placeholder={form.title ? slugifyName(form.title) : "generated-from-title"}
            autoComplete="off"
          />
          <FieldDescription>
            {form.slug
              ? "Edit to override the auto-generated slug."
              : "Generated from the title as you type."}
          </FieldDescription>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="category">Category</FieldLabel>
        <Combobox
          options={categories.map((c) => ({ value: c.slug, label: c.name }))}
          value={form.category}
          onValueChange={(v: string) => onFormUpdate((p) => ({ ...p, category: v }))}
          placeholder="Select category"
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
        />
      </Field>

      <Field>
        <FieldLabel>Status</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={form.status}
          onValueChange={(v: string) => {
            if (v) onFormUpdate((p) => ({ ...p, status: v as CompetitionStatus }));
          }}
          className="grid w-full grid-cols-5"
        >
          {STATUS_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value} className="w-full">
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <FieldDescription>
          Tap a status to set how this competition appears in admin.
        </FieldDescription>
      </Field>

      <FieldSeparator>Description</FieldSeparator>

      <Field>
        <FieldLabel htmlFor="shortDescription">Short Description</FieldLabel>
        <Input
          id="shortDescription"
          name="shortDescription"
          value={form.shortDescription}
          onChange={onChange}
          placeholder="Brief tagline for cards and listings"
        />
        <FieldDescription>Shown on competition cards and listing pages.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="description">Full Description</FieldLabel>
        <Textarea
          id="description"
          name="description"
          value={form.description}
          onChange={onChange}
          rows={5}
          placeholder="Detailed competition description..."
        />
      </Field>
    </FieldGroup>
  );
}

export { CompetitionDetailsTab };
