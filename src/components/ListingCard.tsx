import { Link } from "@tanstack/react-router";
import type { Listing } from "@/lib/data";
import { Button } from "@/components/ui/button";

export function ListingCard({ l }: { l: Listing }) {
  return (
    <div className="group overflow-hidden rounded-2xl border bg-card transition hover:shadow-lg">
      <Link to="/hebergement/$id" params={{ id: l.id }} className="block">
        <div className="aspect-[4/3] overflow-hidden">
          <img src={l.image} alt={l.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        </div>
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{l.type} · {l.city}, {l.region}</span><span>{l.rating ? `★ ${l.rating}` : "Nouveau"}</span>
          </div>
          <h3 className="mt-1 font-display text-lg font-semibold">{l.name}</h3>
          <div className="mt-2 flex flex-wrap gap-1">
            {l.fencedGarden && <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">Jardin clôturé</span>}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">Gabarits : {l.sizes.join(", ")}</span>
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between p-4">
        <p><span className="font-semibold">{l.price} €</span> <span className="text-sm text-muted-foreground">/ nuit</span></p>
        <Button asChild size="sm" className="bg-accent font-semibold text-accent-foreground hover:bg-accent/90"><Link to="/reserver/$id" params={{ id: l.id }}>Réserver</Link></Button>
      </div>
    </div>
  );
}
