"use client";
import { Edit, MoreHorizontal, Trash2 } from "@oc/icons";
import type { ReactNode } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { AdminConfirmDialog } from "./AdminConfirmDialog";

interface EntityActionMenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}

interface EntityActionMenuProps {
  editLabel?: string;
  deleteLabel?: string;
  deleteTitle?: string;
  deleteDescription?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  disabled?: boolean;
  items?: EntityActionMenuItem[];
  triggerLabel?: string;
  className?: string;
}

function EntityActionMenu({
  editLabel = "Edit",
  deleteLabel = "Delete",
  deleteTitle = "Delete item",
  deleteDescription = "This action cannot be undone.",
  onEdit,
  onDelete,
  isDeleting = false,
  disabled = false,
  items,
  triggerLabel = "Actions",
  className,
}: EntityActionMenuProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            className={className}
          >
            <MoreHorizontal aria-hidden="true" />
            <span className="sr-only">{triggerLabel}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={cn("w-44")}>
          <DropdownMenuGroup>
            {onEdit ? (
              <DropdownMenuItem onSelect={onEdit}>
                <Edit aria-hidden="true" />
                {editLabel}
              </DropdownMenuItem>
            ) : null}
            {items?.map((item) => (
              <DropdownMenuItem
                key={item.label}
                disabled={item.disabled}
                variant={item.destructive ? "destructive" : "default"}
                onSelect={item.onSelect}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ))}
            {onDelete ? (
              <>
                {onEdit || (items && items.length > 0) ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem variant="destructive" onSelect={() => setShowDeleteConfirm(true)}>
                  <Trash2 aria-hidden="true" />
                  {deleteLabel}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {onDelete ? (
        <AdminConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title={deleteTitle}
          description={deleteDescription}
          confirmLabel={deleteLabel}
          isDestructive
          isLoading={isDeleting}
          onConfirm={() => onDelete()}
        />
      ) : null}
    </>
  );
}

export type { EntityActionMenuItem, EntityActionMenuProps };
export { EntityActionMenu };
