# Mentions légales et CGU — informations à obtenir avant publication

> **Statut (7 novembre 2026) : 🟡 remplissage requis.** Les pages `/mentions-legales` et `/cgu`
> affichent encore des marqueurs `[À COMPLÉTER : …]` et une mention téléphonique temporaire.
> **Bloquant pour l'ouverture au public** (LCEN art. 6-III : jusqu'à 1 an d'emprisonnement et
> 75 000 € d'amende pour une personne physique ; Code de la consommation : amende administrative
> jusqu'à 3 000 € pour une personne physique en l'absence de médiateur).

La liste de référence est `LEGAL_PENDING` dans [legal.ts](../src/lib/legal.ts). Un test
([legal-pending.test.tsx](../src/test/legal-pending.test.tsx)) vérifie que les marqueurs affichés et
cette liste correspondent, et que chaque élément figure ci-dessous.

## Déjà renseigné (fourni par l'éditeur, non revérifié ici)

| Information | Valeur affichée | Vérification à faire |
| --- | --- | --- |
| Éditeur, forme juridique | Anouk Zouaoui, entrepreneur individuel (EI) | Conforme à l'avis de situation INSEE |
| Siège | 9 Place de la Piscine, 95300 Pontoise, France | Adresse identique à celle déclarée à l'INSEE / guichet unique |
| SIRET / SIREN | 982 286 650 00022 / 982 286 650 | Recherche sur [annuaire-entreprises.data.gouv.fr](https://annuaire-entreprises.data.gouv.fr) : établissement **actif** à cette adresse. Le test ne contrôle que la clé de Luhn (faute de frappe), pas l'existence. |
| TVA | « TVA non applicable, art. 293 B du CGI » | Valable seulement en franchise en base de TVA : à revoir si le chiffre d'affaires dépasse le seuil (un n° de TVA intracommunautaire devient alors obligatoire). |
| Contact | contact@bricapattes.fr | **Provisoire** : domaine d'un autre projet de l'éditeur, déjà en ligne. À remplacer par une adresse `@petinn.fr` une fois ce domaine acheté (pages `/mentions-legales`, `/cgu`, `/annulation`). Ne pas utiliser `bricapattes.fr` comme domaine d'envoi Resend de PetInn ([email-domain-setup.md](email-domain-setup.md)). |

## À obtenir (aucune valeur n'est inventée dans le code)

| Id | Information | Page(s) | Base légale | Bloquant | Où l'obtenir |
| --- | --- | --- | --- | --- | --- |
| `editeur-telephone` | Numéro de téléphone de l'éditeur | /mentions-legales | LCEN art. 6-III-1 a) | **Oui** | Numéro professionnel dédié (ligne mobile ou numéro virtuel). Remplace « communiqué sur demande ». |
| `hebergeur-telephone` | Téléphone de l'hébergeur Lovable Labs Sweden AB | /mentions-legales | LCEN art. 6-III-1 d) | **Oui** | Support Lovable / page légale de Lovable. |
| `hebergeur-region` | Région d'hébergement des données | /mentions-legales | RGPD art. 13 | Non (recommandé) | Paramètres du projet Lovable Cloud ou support Lovable. |
| `mediateur` | Médiateur de la consommation : nom, adresse postale, e-mail, site, lien de saisine | /mentions-legales, /cgu (art. 10) | C. conso. L. 612-1, L. 616-1 | **Oui** | Adhésion à un médiateur référencé par la CECMC ; renseigner `CONSUMER_MEDIATOR` (legal.ts). Procédure : [mediation-consommation.md](mediation-consommation.md). |

## Remplir une information

1. Obtenir la valeur et sa preuve (contrat, attestation, capture datée).
2. Remplacer le marqueur `LegalTodo` (ou la mention temporaire `data-legal-pending`) par la valeur.
3. Supprimer l'entrée correspondante de `LEGAL_PENDING` et mettre à jour ce tableau.
4. Mettre à jour la date « Dernière mise à jour » de la page. Pour `/cgu`, mettre aussi à jour
   `LEGAL_VERSIONS.cgu` : les voyageurs devront accepter à nouveau les conditions.
5. `bun run test` puis `bun run build`.

Publication possible seulement quand `LEGAL_PENDING` ne contient plus d'élément bloquant et que
`git grep "À COMPLÉTER" src/routes` ne renvoie plus rien.
