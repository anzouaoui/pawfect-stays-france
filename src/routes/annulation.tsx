import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/annulation")({
  head: () => ({
    meta: [
      { title: "Politique d’annulation — PetInn" },
      { name: "description", content: "Ce qui se passe en cas d’annulation, de refus ou d’expiration d’une réservation PetInn, et les remboursements." },
      { property: "og:title", content: "Politique d’annulation — PetInn" },
      { property: "og:description", content: "Empreinte bancaire, remboursements et délais d’annulation pour les séjours avec chien sur PetInn." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Annulation,
});

function Annulation() {
  return (
    <LegalPage title="Politique d’annulation" updated="27 octobre 2026">
      <h2>Avant la réponse de l’Hôte</h2>
      <ul>
        <li><strong>Annulation par le Voyageur :</strong> gratuite depuis « Mes demandes » tant que la demande est en attente. L’empreinte bancaire est libérée immédiatement.</li>
        <li><strong>Refus par l’Hôte :</strong> aucun montant n’est débité, l’empreinte est libérée.</li>
        <li><strong>Sans réponse sous 24 heures :</strong> la demande expire, l’empreinte est libérée.</li>
      </ul>
      <p>Selon les banques, la disparition de l’empreinte sur le relevé peut prendre quelques jours.</p>

      <h2>Après acceptation : annulation par le Voyageur</h2>
      <ul>
        <li><strong>Plus de 30 jours avant l’arrivée :</strong> remboursement intégral du séjour.</li>
        <li><strong>Entre 30 et 7 jours avant l’arrivée :</strong> remboursement de 50 % du séjour.</li>
        <li><strong>Moins de 7 jours avant l’arrivée ou non-présentation :</strong> aucun remboursement du séjour.</li>
        <li>Les frais de ménage sont remboursés si le séjour n’a pas commencé.</li>
        <li>La commission de service PetInn est remboursée si l’annulation intervient dans les 48 heures suivant l’acceptation et plus de 14 jours avant l’arrivée ; sinon elle reste due.</li>
      </ul>

      <h2>Après acceptation : annulation par l’Hôte</h2>
      <p>Le Voyageur est remboursé intégralement, commission PetInn comprise. Une annulation répétée par un Hôte peut entraîner la suspension de ses annonces.</p>

      <h2>Chien non conforme ou règles non respectées</h2>
      <p>Si le chien présenté ne correspond manifestement pas au passeport canin (gabarit, nombre, comportement déclaré) ou si les règles d’accueil ne sont pas respectées, l’Hôte peut refuser l’accès ou mettre fin au séjour. Aucun remboursement n’est alors dû, sauf accord de l’Hôte.</p>

      <h2>Circonstances exceptionnelles</h2>
      <p>En cas d’événement imprévisible et inévitable empêchant le séjour (catastrophe naturelle, interdiction administrative de déplacement, logement devenu inhabitable), le Voyageur est remboursé intégralement.</p>

      <h2>Comment annuler</h2>
      <p>Une demande en attente s’annule depuis <Link to="/mes-demandes" className="underline">Mes demandes</Link>. Pour un séjour déjà accepté, contactez PetInn à bricapattes@gmail.com (service client, Anouk Zouaoui) ; le remboursement est effectué sur la carte utilisée, sous 14 jours maximum.</p>
      <p>Voir aussi les <Link to="/cgu" className="underline">conditions générales d’utilisation</Link>.</p>
    </LegalPage>
  );
}
