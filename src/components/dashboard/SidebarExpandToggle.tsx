"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";

import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SIDEBAR_NAV_BUTTON_CLASS } from "@/features/navigation/sidebar-nav-ui";

type SidebarExpandToggleProps = {
  isExpanded: boolean;
  onToggle: () => void;
};

export function SidebarExpandToggle({
  isExpanded,
  onToggle,
}: SidebarExpandToggleProps) {
  const label = isExpanded ? "Collapse menu" : "Expand menu";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        tooltip={label}
        className={SIDEBAR_NAV_BUTTON_CLASS}
        onClick={(event) => {
          event.preventDefault();
          onToggle();
        }}
      >
        {isExpanded ? (
          <PanelLeftCloseIcon className="size-4" />
        ) : (
          <PanelLeftOpenIcon className="size-4" />
        )}
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
