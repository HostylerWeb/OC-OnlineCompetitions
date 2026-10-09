import { cn } from "@oc/utils";

export function mobileNavItemClass(active?: boolean) {
  return cn(
    "font-nav flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-semibold tracking-tight mb-1",
    "transition-[color,background-color,transform] duration-150 ease-out",
    "active:scale-[0.98] active:duration-75",
    "select-none touch-manipulation",
    active
      ? "text-gold bg-gold/10 ring-1 ring-gold/20"
      : "text-muted-foreground hover:text-gold hover:bg-gold/10"
  );
}

export function mobileNavIconWrapClass(active?: boolean) {
  return cn(
    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150",
    active ? "bg-gold/20" : "bg-gold/10"
  );
}

export function mobileNavSectionClass() {
  return "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-2";
}

export function mobileNavSheetPanelClass(isExiting: boolean) {
  return cn(
    "flex flex-col h-full transition-opacity duration-100 ease-out",
    isExiting && "opacity-0 pointer-events-none"
  );
}
