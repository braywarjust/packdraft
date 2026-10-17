import { NAV_ICONS, NavIcon } from "./NavIcons";

/** Standard page title block: the section's nav icon, small eyebrow, title, description and optional actions. */
export function PageHeader({ eyebrow, title, description, children, icon }: { eyebrow?: string; title: string; description?: React.ReactNode; children?: React.ReactNode; icon?: keyof typeof NAV_ICONS }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div className="flex max-w-2xl items-start gap-4">
        {icon && <span className="mt-1 grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand ring-1 ring-brand/30"><NavIcon d={NAV_ICONS[icon]} size={30} maxW={42} /></span>}
        <div className="min-w-0">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-widest text-brand">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl font-black tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-zinc-500">{description}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
