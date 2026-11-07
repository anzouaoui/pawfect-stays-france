# Médiation de la consommation — adhésion et intégration

> **Statut (7 novembre 2026) : 🟡 adhésion requise.** Aucun médiateur n'a été choisi ni signé.
> `CONSUMER_MEDIATOR` vaut `null` dans [legal.ts](../src/lib/legal.ts) : `/mentions-legales` (section 6)
> et `/cgu` (article 10) affichent des marqueurs `[À COMPLÉTER : …]`.
> **Bloquant pour l'ouverture au public** (Code de la consommation L. 612-1 et L. 616-1 ; amende
> administrative jusqu'à 3 000 € pour une personne physique, art. L. 641-1).

## 1. Choisir et adhérer (décision de l'éditeur)

- Choisir un médiateur **référencé par la CECMC** (liste officielle sur economie.gouv.fr, rubrique
  médiation de la consommation), compétent pour la location / l'intermédiation d'hébergements
  entre particuliers et professionnels. Les pistes évoquées (CM2C, MED CONSO DEV…) sont à **vérifier**
  dans cette liste au jour de l'adhésion : ce dépôt n'en retient aucune.
- Comparer tarif d'adhésion et coût par dossier, puis signer la convention.
- Conserver comme preuves : **convention signée**, **attestation d'adhésion** (numéro, période de
  validité), capture datée de la fiche du médiateur sur la liste CECMC.

## 2. Informations à reporter (depuis l'attestation et le site officiel du médiateur)

| Champ `CONSUMER_MEDIATOR` | Source | Affiché |
| --- | --- | --- |
| `name` | Nom exact de la liste CECMC | CGU art. 10, mentions légales §6 |
| `postalAddress` | Attestation / site officiel | CGU art. 10, mentions légales §6 |
| `email` | Site officiel | CGU art. 10 |
| `website` (https) | Site officiel | CGU art. 10, mentions légales §6 |
| `onlineReferral` (https) | Page de saisine en ligne **propre à l'adhérent** si le médiateur en fournit une | CGU art. 10 |
| `membershipRef` | Numéro d'adhérent sur l'attestation | Non affiché (preuve) |
| `membershipValidUntil` | Fin de période sur l'attestation, si indiquée | Non affiché (contrôle d'expiration) |
| `addedOn` | Date de mise en ligne (AAAA-MM-JJ) | Non affiché |

## 3. Intégrer dans le site

1. Renseigner `CONSUMER_MEDIATOR` dans `src/lib/legal.ts` (aucune autre page à modifier : les deux
   pages lisent ce même objet, et l'entrée `mediateur` disparaît de `LEGAL_PENDING` automatiquement).
2. Mettre `LEGAL_VERSIONS.cgu` à la date de `addedOn` ou après : le texte des CGU change, les voyageurs
   doivent les accepter à nouveau (la version acceptée est enregistrée sur chaque empreinte Stripe).
3. Mettre à jour la date « Dernière mise à jour » de `/mentions-legales`.
4. `bun run test` : le test [consumer-mediator.test.tsx](../src/test/consumer-mediator.test.tsx) fait
   échouer la suite si un champ manque, si un lien n'est pas en https, si l'adhésion est expirée ou si
   la version des CGU n'a pas été mise à jour. Puis `bun run build`.
5. Mettre à jour la ligne `mediateur` de [mentions-legales-checklist.md](mentions-legales-checklist.md).

## 4. Hors site (process)

- Lorsqu'une réclamation écrite n'aboutit pas, communiquer au consommateur les coordonnées du médiateur
  (C. conso. L. 616-2) : prévoir un modèle de réponse au service client.
- Renouveler l'adhésion avant `membershipValidUntil` (la suite de tests échoue après cette date).

## Preuves exigées pour passer en GO (aucune disponible à ce jour)

- [ ] Convention / attestation d'adhésion signée, avec numéro et période de validité.
- [ ] Médiateur présent sur la liste CECMC au jour de l'adhésion.
- [ ] `CONSUMER_MEDIATOR` renseigné, `LEGAL_VERSIONS.cgu` mis à jour, tests et build verts.
- [ ] Vérification visuelle en production de `/cgu` (article 10) et `/mentions-legales` (section 6),
      liens du médiateur fonctionnels.
