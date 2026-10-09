import {
  BarChart3,
  Bell,
  Clock,
  CreditCard,
  Gamepad2,
  Gem,
  Headphones,
  Lock,
  Mail,
  Search,
  Shield,
  Ticket,
  Trophy,
  Users,
} from "@oc/icons";
import type { ComponentType } from "react";

export const HOW_IT_WORKS_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  Search,
  Ticket,
  Gamepad2,
  CreditCard,
  Clock,
  Trophy,
  Users,
  Mail,
  Shield,
  Gem,
  Bell,
  BarChart3,
  Lock,
  Headphones,
};

export function getHowItWorksIcon(name: string, fallback: ComponentType<{ className?: string }>) {
  return HOW_IT_WORKS_ICON_MAP[name] ?? fallback;
}
