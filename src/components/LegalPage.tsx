import type { ReactNode } from "react";

/**
 * Information still to be provided by the publisher. Rendered highlighted so a missing
 * value cannot go unnoticed; search the codebase for "À COMPLÉTER" before going live.
 */
export function LegalTodo({ children }: { children: ReactNode }) {
  return (
    <mark data-placeholder className="rounded bg-yellow-200 px-1 text-yellow-950 dark:bg-yellow-300">
      [À COMPLÉTER : {children}]
    </mark>
  );
}

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 text-foreground/90 leading-relaxed">
      <h1 className="font-display text-3xl font-bold md:text-4xl">{title}</h1>
      <p className="text-sm text-muted-foreground">Dernière mise à jour : {updated}</p>
      {children}
    </article>
  );
}
