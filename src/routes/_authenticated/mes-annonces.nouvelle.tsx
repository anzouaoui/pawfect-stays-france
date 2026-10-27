import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ListingWizard } from "@/components/ListingWizard";

export const Route = createFileRoute("/_authenticated/mes-annonces/nouvelle")({
  validateSearch: z.object({ id: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Ajouter un logement — PetInn" },
      { name: "description", content: "Publiez un logement pet-friendly : photos, tarifs, disponibilités et règles canines." },
      { property: "og:title", content: "Ajouter un logement — PetInn" },
      { property: "og:description", content: "Publiez votre logement pet-friendly sur PetInn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewListing,
});

function NewListing() {
  const { user } = Route.useRouteContext();
  const { id } = Route.useSearch();
  return <ListingWizard key={id ?? "new"} userId={user.id} draftId={id} />;
}
