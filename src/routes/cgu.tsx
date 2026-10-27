import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/cgu")({
  head: () => ({
    meta: [
      { title: "Conditions générales d’utilisation — PetInn" },
      { name: "description", content: "Règles d’utilisation de PetInn pour les voyageurs avec chien et les hébergeurs pet-friendly." },
      { property: "og:title", content: "Conditions générales d’utilisation — PetInn" },
      { property: "og:description", content: "Comptes, réservations, paiement par empreinte bancaire, commission et responsabilités sur PetInn." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cgu,
});

function Cgu() {
  return (
    <LegalPage title="Conditions générales d’utilisation" updated="27 octobre 2026">
      <h2>1. Objet</h2>
      <p>PetInn est une plateforme qui met en relation des voyageurs accompagnés de leur chien (« Voyageurs ») et des hébergeurs proposant des logements pet-friendly en France (« Hôtes »). Les présentes conditions encadrent l’utilisation du site par tous ses utilisateurs. PetInn n’est pas l’exploitant des logements ; le contrat de séjour est conclu directement entre le Voyageur et l’Hôte.</p>

      <h2>2. Compte utilisateur</h2>
      <ul>
        <li>La création d’un compte est nécessaire pour envoyer une demande, enregistrer un passeport canin ou publier une annonce.</li>
        <li>L’utilisateur doit être majeur et fournir des informations exactes. Il est responsable de la confidentialité de ses identifiants.</li>
        <li>PetInn peut suspendre un compte en cas d’usage frauduleux, abusif ou contraire aux présentes conditions.</li>
      </ul>

      <h2>3. Annonces publiées par les Hôtes</h2>
      <ul>
        <li>L’Hôte garantit qu’il est autorisé à louer le logement et que ses photos, tarifs, disponibilités, équipements et règles canines sont exacts et à jour.</li>
        <li>Les photos doivent représenter le logement réel. Tout logement doit réellement accueillir les chiens dans les conditions annoncées (gabarit, nombre, jardin clôturé…).</li>
        <li>L’Hôte respecte la réglementation applicable (déclaration en mairie, taxe de séjour, assurance, sécurité).</li>
      </ul>

      <h2>4. Demande de réservation</h2>
      <ul>
        <li>Le Voyageur envoie une demande précisant les dates et les chiens concernés, à partir de leurs passeports canins. Les informations sur les chiens (taille, poids, race, comportement) doivent être sincères.</li>
        <li>L’Hôte dispose de 24 heures pour accepter ou refuser. Sans réponse, la demande expire automatiquement.</li>
        <li>La réservation est ferme uniquement après acceptation par l’Hôte. Les dates sont alors bloquées sur le logement.</li>
      </ul>

      <h2>5. Prix, commission et paiement</h2>
      <ul>
        <li>Le prix du séjour comprend le prix par nuit, le supplément par chien et par nuit et les éventuels frais de ménage fixés par l’Hôte.</li>
        <li>Une commission de service PetInn de 10 % du prix du séjour est payée uniquement par le Voyageur. Aucune commission n’est prélevée sur le Voyageur au-delà de ce montant affiché avant l’envoi.</li>
        <li>À l’envoi de la demande, une empreinte bancaire du montant total (séjour + commission) est réalisée via notre prestataire de paiement Stripe. Le montant est bloqué mais non débité.</li>
        <li>Le paiement est débité lorsque l’Hôte accepte la demande. L’empreinte est libérée en cas de refus, d’annulation par le Voyageur avant réponse ou d’expiration de la demande.</li>
        <li>PetInn ne conserve pas les numéros de carte bancaire.</li>
      </ul>

      <h2>6. Annulation</h2>
      <p>Les conditions d’annulation et de remboursement sont détaillées dans la <Link to="/annulation" className="underline">politique d’annulation</Link>, qui fait partie intégrante des présentes conditions.</p>

      <h2>7. Séjour et responsabilité liée aux chiens</h2>
      <ul>
        <li>Le Voyageur reste responsable de son chien pendant tout le séjour, y compris des dommages qu’il pourrait causer. Une assurance responsabilité civile couvrant l’animal est recommandée.</li>
        <li>Le Voyageur respecte les règles d’accueil de l’Hôte et présente sur demande le carnet de santé ou passeport européen à jour de l’animal.</li>
        <li>Les chiens de 1re catégorie ne peuvent être accueillis ; ceux de 2e catégorie uniquement avec l’accord préalable de l’Hôte et dans le respect de la loi.</li>
        <li>L’Hôte peut refuser l’accès si le chien présenté ne correspond manifestement pas au passeport canin transmis.</li>
      </ul>

      <h2>8. Rôle et responsabilité de PetInn</h2>
      <p>PetInn fournit un service d’intermédiation technique. PetInn ne peut être tenu responsable de l’exécution du séjour, de l’état du logement ou du comportement des animaux, sans préjudice des droits dont dispose le consommateur au titre de la loi. PetInn s’efforce d’assurer la disponibilité du site sans pouvoir la garantir en permanence.</p>

      <h2>9. Données personnelles</h2>
      <p>Les données (compte, passeports canins, demandes) sont utilisées pour le fonctionnement du service. Les informations des chiens et les dates sont transmises à l’Hôte concerné par une demande. Chaque utilisateur peut demander l’accès, la rectification ou la suppression de ses données.</p>

      <h2>10. Droit applicable et litiges</h2>
      <p>Les présentes conditions sont soumises au droit français. En cas de litige, le consommateur peut recourir gratuitement à un médiateur de la consommation avant toute action devant les juridictions compétentes.</p>
    </LegalPage>
  );
}
