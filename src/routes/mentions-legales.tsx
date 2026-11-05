import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — PetInn" },
      { name: "description", content: "Éditeur, directeur de la publication, hébergeur, propriété intellectuelle et protection des données personnelles du site PetInn." },
      { property: "og:title", content: "Mentions légales — PetInn" },
      { property: "og:description", content: "Informations légales du site PetInn (loi pour la confiance dans l’économie numérique)." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MentionsLegales,
});

/**
 * Information still to be provided by the publisher. Rendered highlighted so a missing
 * value cannot go unnoticed; search the codebase for "À COMPLÉTER" before going live.
 */
function Todo({ children }: { children: ReactNode }) {
  return (
    <mark data-placeholder className="rounded bg-yellow-200 px-1 text-yellow-950 dark:bg-yellow-300">
      [À COMPLÉTER : {children}]
    </mark>
  );
}

function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales" updated="5 novembre 2026">
      <p>
        Conformément aux articles 6-III et 19 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie
        numérique (LCEN), les informations suivantes sont portées à la connaissance des utilisateurs du site PetInn
        (ci-après « le Site »).
      </p>

      <h2>1. Éditeur du site</h2>
      <ul>
        <li>Raison sociale : <Todo>raison sociale, ou nom et prénom si entrepreneur individuel</Todo></li>
        <li>Forme juridique : <Todo>SAS, SASU, SARL, EURL, entreprise individuelle (micro-entreprise)…</Todo></li>
        <li>Capital social : <Todo>montant en euros — à supprimer pour une entreprise individuelle</Todo></li>
        <li>Siège social : <Todo>adresse postale complète</Todo></li>
        <li>Immatriculation : <Todo>SIRET (14 chiffres) et RCS de la ville, ou RNE pour un entrepreneur individuel</Todo></li>
        <li>N° de TVA intracommunautaire : <Todo>FR + 11 caractères, ou « TVA non applicable, art. 293 B du CGI »</Todo></li>
        <li>E-mail : <Todo>adresse de contact, ex. contact@domaine.fr</Todo></li>
        <li>Téléphone : <Todo>numéro de téléphone</Todo></li>
      </ul>

      <h2>2. Directeur de la publication</h2>
      <p>
        <Todo>nom et prénom du directeur de la publication</Todo>, en qualité de{" "}
        <Todo>fonction : président, gérant, entrepreneur individuel…</Todo>. Contact : <Todo>e-mail</Todo>.
      </p>

      <h2>3. Hébergement</h2>
      <p>Le Site et ses données sont hébergés par :</p>
      <ul>
        <li>
          Hébergement de l’application : <Todo>nom et raison sociale de l’hébergeur</Todo>, <Todo>adresse</Todo>,{" "}
          <Todo>téléphone</Todo>.
        </li>
        <li>
          Base de données et stockage des fichiers (Lovable Cloud) : <Todo>raison sociale du fournisseur</Todo>,{" "}
          <Todo>adresse</Todo>, <Todo>téléphone</Todo>, <Todo>région d’hébergement des données, ex. Union européenne</Todo>.
        </li>
      </ul>
      <p>
        Les paiements sont traités par Stripe Payments Europe, Limited, 1 Grand Canal Street Lower, Grand Canal Dock,
        Dublin, D02 H210, Irlande. PetInn ne conserve aucun numéro de carte bancaire.
      </p>

      <h2>4. Propriété intellectuelle et marques</h2>
      <ul>
        <li>
          La structure du Site, ses textes, son code, son logo et la dénomination « PetInn » sont la propriété exclusive
          de l’éditeur, sauf mention contraire. « PetInn » est <Todo>une marque déposée à l’INPI sous le n° …, ou retirer
          cette phrase si aucune marque n’est déposée</Todo>.
        </li>
        <li>
          Toute reproduction, représentation, modification ou exploitation de tout ou partie du Site, par quelque procédé
          que ce soit, sans autorisation écrite préalable de l’éditeur, est interdite et constitue une contrefaçon
          sanctionnée par les articles L. 335-2 et suivants du Code de la propriété intellectuelle.
        </li>
        <li>
          Les photos et descriptions des logements publiées par les Hôtes restent leur propriété. En les publiant, l’Hôte
          garantit en détenir les droits et autorise PetInn à les afficher sur le Site pour la durée de l’annonce.
        </li>
        <li>
          Certaines images d’illustration ne représentent pas des logements réels ; elles sont signalées comme telles.
          Crédits : <Todo>banques d’images et auteurs des illustrations utilisées</Todo>.
        </li>
      </ul>

      <h2>5. Données personnelles (RGPD)</h2>
      <p>
        Le responsable du traitement des données personnelles collectées sur le Site est l’éditeur mentionné à l’article
        1. Pour toute question ou pour exercer vos droits : <Todo>e-mail dédié aux données personnelles, ex.
        donnees@domaine.fr</Todo>
        {" "}(ou <Todo>coordonnées du délégué à la protection des données, s’il en a été désigné un</Todo>).
      </p>

      <h3 className="mt-6 font-semibold">Données traitées et finalités</h3>
      <ul>
        <li><b>Compte</b> (e-mail, nom, rôle voyageur ou hôte) : création et gestion du compte — exécution du contrat.</li>
        <li><b>Passeport canin</b> (nom, race, taille, poids, comportement de vos chiens) : transmis à l’Hôte avec chaque demande pour qu’il vérifie l’accueil — exécution du contrat.</li>
        <li><b>Demandes et réservations</b> (dates, logement, message, montants) : gestion des réservations, notifications par e-mail, comptabilité — exécution du contrat et obligations légales.</li>
        <li><b>Paiement</b> : empreinte bancaire et encaissement réalisés par Stripe ; PetInn ne reçoit pas vos numéros de carte — exécution du contrat.</li>
        <li><b>Annonces</b> des Hôtes (description, photos, tarifs, disponibilités) : publication sur le Site — exécution du contrat.</li>
        <li><b>Coordonnées bancaires des Hôtes</b> : versement du prix des séjours — exécution du contrat et obligations comptables.</li>
      </ul>

      <h3 className="mt-6 font-semibold">Destinataires</h3>
      <p>
        Vos données sont accessibles à l’équipe PetInn et, pour une réservation, à l’autre partie (l’Hôte voit le
        passeport canin et le message du Voyageur ; le Voyageur voit l’annonce). Elles sont traitées par nos sous-traitants
        techniques : hébergement (article 3), paiement (Stripe), envoi des e-mails transactionnels{" "}
        (<Todo>prestataire e-mail, ex. Resend, Inc.</Todo>). Lorsque l’un d’eux traite des données hors de l’Union
        européenne, le transfert est encadré par les clauses contractuelles types de la Commission européenne ou une
        décision d’adéquation. Vos données ne sont ni vendues ni utilisées à des fins publicitaires.
      </p>

      <h3 className="mt-6 font-semibold">Durées de conservation</h3>
      <ul>
        <li>Compte et passeport canin : jusqu’à la suppression du compte, puis 3 ans pour les éléments nécessaires en cas de litige.</li>
        <li>Réservations, factures et pièces comptables : 10 ans (obligation comptable).</li>
        <li>Coordonnées bancaires des Hôtes : durée de la relation, puis durée des obligations comptables.</li>
      </ul>

      <h3 className="mt-6 font-semibold">Vos droits</h3>
      <p>
        Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité
        de vos données, ainsi que du droit de définir des directives relatives à leur sort après votre décès. Vous pouvez
        les exercer à l’adresse indiquée ci-dessus ; une réponse vous sera apportée sous un mois. Vous pouvez également
        introduire une réclamation auprès de la CNIL (<a href="https://www.cnil.fr" className="underline">www.cnil.fr</a>).
      </p>

      <h3 className="mt-6 font-semibold">Cookies et stockage local</h3>
      <p>
        Le Site n’utilise ni cookie publicitaire ni outil de mesure d’audience. Il enregistre uniquement dans votre
        navigateur les informations strictement nécessaires à son fonctionnement (session de connexion, préférences et
        demandes d’exemple), exemptées de consentement au titre de l’article 82 de la loi Informatique et Libertés.
      </p>

      <h2>6. Médiation de la consommation</h2>
      <p>
        Conformément aux articles L. 612-1 et suivants du Code de la consommation, tout consommateur peut recourir
        gratuitement à un médiateur de la consommation en vue de la résolution amiable d’un litige, après réclamation
        écrite préalable auprès de PetInn restée sans réponse satisfaisante. Médiateur : <Todo>nom, adresse postale et
        site internet du médiateur auquel l’éditeur a adhéré</Todo>.
      </p>

      <h2>7. Documents liés</h2>
      <p>
        Consultez également les <Link to="/cgu" className="underline">conditions générales d’utilisation</Link> et la{" "}
        <Link to="/annulation" className="underline">politique d’annulation</Link>.
      </p>
    </LegalPage>
  );
}
