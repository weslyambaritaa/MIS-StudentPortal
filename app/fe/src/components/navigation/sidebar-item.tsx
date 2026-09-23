import Link from "next/link";

import type { ReactNode } from "react";

type SidebarItemProps = {
  label: string;

  href: string;

  icon: ReactNode;

  active?: boolean;

  collapsed?: boolean;

  onClick?: () => void;
};

export function SidebarItem({
  label,

  href,

  icon,

  active = false,

  collapsed = false,

  onClick,
}: SidebarItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={[
        "flex items-center",

        "transition-all duration-200",

        collapsed
          ? "h-10 w-10 justify-center rounded-full"
          : "min-h-10 w-full gap-3 rounded-full px-3",

        active
          ? [
              "text-white",
              "bg-[radial-gradient(circle_at_center,_#FF686B_0%,_#DE1641_100%)]",
              "hover:text-white",
              "hover:bg-[radial-gradient(circle_at_center,_#FF686B_0%,_#F90237_100%)]",
            ].join(" ")
          : [
              "bg-transparent",
              "text-[#45465F]",
              "hover:bg-[#DE16411A]",
              "hover:text-[#DE1641]",
            ].join(" "),
      ].join(" ")}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-current">{icon}</span>

      {!collapsed && <span className="truncate text-[15px] font-medium">{label}</span>}
    </Link>
  );
}
