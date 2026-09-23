import type { ReactNode } from "react";

type SidebarSectionProps = {
  title: string;
  collapsed?: boolean;
  children: ReactNode;
};

export function SidebarSection({ title, collapsed = false, children }: SidebarSectionProps) {
  return (
    <section className="w-full">
      {collapsed ? (
        <div className="mb-3 px-1 text-center text-xs text-[#9ca0b3]">---</div>
      ) : (
        <p className="mb-2 px-1 text-xs font-medium uppercase text-[#9ca0b3]">{title}</p>
      )}

      <div className={["flex flex-col", collapsed ? "items-center gap-2" : "gap-1"].join(" ")}>
        {children}
      </div>
    </section>
  );
}
