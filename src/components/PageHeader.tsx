import { NAV_ICONS, NavIcon } from "./NavIcons";

/** Standard page title block: the section's nav icon, small eyebrow, title, description and optional actions. */
export function PageHeader({ eyebrow, title, description, children, icon }: { eyebrow?: string; title: string; description?: React.ReactNode; children?: React.ReactNode; icon?: keyof typeof NAV_ICONS }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5 sm:mb-8 sm:pb-6">
      <div className="flex min-w-0 max-w-2xl items-start gap-3 sm:gap-4">
        {icon && <span className="mt-1 grid h-11 w-11 shrink-0 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-brand/15 text-brand ring-1 ring-brand/30"><NavIcon d={NAV_ICONS[icon]} size={30} maxW={42} /></span>}
        <div className="min-w-0">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-widest text-brand">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-zinc-500 sm:text-base">{description}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
