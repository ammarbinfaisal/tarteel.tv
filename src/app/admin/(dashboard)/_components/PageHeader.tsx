import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

type PageHeaderProps = {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  /** Right-aligned slot on desktop; stacks under title on mobile (thumb-reachable). */
  actions?: React.ReactNode;
  className?: string;
};

export default function PageHeader({
  title,
  description,
  crumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6", className)}>
      <div className="space-y-1">
        {crumbs && crumbs.length > 0 && <Breadcrumbs crumbs={crumbs} />}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1">
            {c.href && !isLast ? (
              <Link href={c.href as any} className="hover:text-foreground transition-colors">
                {c.label}
              </Link>
            ) : (
              <span className={isLast ? "text-foreground/80" : undefined}>{c.label}</span>
            )}
            {!isLast && <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden="true" />}
          </span>
        );
      })}
    </nav>
  );
}
