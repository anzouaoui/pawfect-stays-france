# Procédure de versement aux hébergeurs (phase de lancement)

Pendant le lancement, les hébergeurs sont payés **par virement bancaire manuel**. Ce document
décrit qui reçoit quoi, quand déclencher le virement et quelles pièces produire.

## 1. Qui paie quoi

| Montant | Calcul (fait par la base, à l'insertion) | Reçoit |
| --- | --- | --- |
| `subtotal` : séjour hébergeur | nuits × prix/nuit + nuits × supplément chien × nb de chiens + ménage | **Hébergeur, à 100 %** (aucune commission prélevée sur l'hôte) |
| `fee` : frais de service | `round(subtotal × 10 %)` | **PetInn** |
| **Total payé par le voyageur** | `subtotal + fee` | Encaissé sur le compte Stripe de PetInn quand l'hôte accepte |

Exemple : 3 nuits à 90 € + 10 € de ménage = **280 €** pour l'hôte ; frais PetInn **28 €** ; le voyageur paie **308 €**.

**Les montants sont figés.** Ils sont calculés par le trigger `prepare_booking_request`
(`SECURITY DEFINER`), qui écrase toute valeur envoyée par le navigateur. Les utilisateurs
n'ont le droit de modifier que le statut de la demande (`GRANT UPDATE (status)`). Seul le
serveur (service role) pourrait les changer, et aucun code ne le fait. Pour un verrou
complet en base, ajoutez dans `guard_booking_status` (via le chat Lovable) un
`RAISE EXCEPTION` si `NEW.subtotal`, `NEW.fee` ou `NEW.listing_id` diffèrent de `OLD`.

> Le taux de 10 % est écrit à deux endroits : `SERVICE_FEE_RATE` dans `src/lib/data.ts`
> (affichage du devis) et `0.1` dans le trigger SQL (montant réel). Si vous le changez,
> modifiez **les deux**.

**Frais Stripe** : Stripe prélève ses frais sur le total encaissé, et ils sont **à la charge de
PetInn**, sur la commission. À titre indicatif, pour une carte européenne standard
(≈ 1,5 % + 0,25 €), 308 € coûtent environ 4,87 € : PetInn garde ≈ 23,13 € sur 28 €.
Vérifiez le tarif réel dans le Dashboard Stripe.

Dans l'app, l'**Espace hébergeur → onglet « acceptée »** affiche pour chaque réservation le
total payé, les frais PetInn, le **montant net dû** et le statut du versement :

| Statut affiché | Quand |
| --- | --- |
| À verser à l'arrivée du voyageur | Avant la date d'arrivée |
| Virement en cours | Du jour d'arrivée à J+4 |
| Virement normalement reçu | À partir de J+5 (« Rien reçu ? Contactez PetInn ») |
| Paiement à vérifier | Demande acceptée mais paiement non `encaissé` : ne rien verser, enquêter |

L'app **n'enregistre pas** les virements effectués : la source de vérité est le registre (§ 4).

## 2. Collecter l'IBAN de l'hébergeur (une fois par hébergeur)

1. À la première réservation acceptée, demandez à l'hôte son **RIB** (document PDF de sa banque),
   pas un IBAN tapé à la main.
2. Vérifiez que **le titulaire du compte correspond à l'hôte** (même nom que le compte PetInn,
   ou sa société s'il est professionnel). Sinon, demandez un justificatif.
3. Rangez le RIB dans un **dossier à accès restreint** (2FA activée), jamais dans un e-mail
   transféré ni dans le dépôt Git. Notez seulement les 4 derniers chiffres dans le registre.
4. **Changement d'IBAN** : n'acceptez une modification qu'après confirmation par un autre
   canal (appel au numéro connu de l'hôte). C'est la fraude la plus courante.

Il s'agit de données personnelles (RGPD) : conservez-les le temps de la relation, plus les
obligations comptables, et supprimez-les à la fermeture du compte hôte.

## 3. Déclencher le virement (chaque jour)

**Quand** : sous **24 h après la date d'arrivée** (`check_in`). Le délai laisse au voyageur le
temps de signaler un problème grave à l'arrivée (logement inaccessible, non conforme).

1. **Lister les séjours dont l'arrivée est passée.** Dans Lovable Cloud, éditeur SQL en lecture seule :
   ```sql
   select id, listing_name, host_id, check_in, check_out, subtotal, fee, payment_intent_id
   from booking_requests
   where status = 'acceptée' and payment_status = 'encaissé'
     and check_in <= current_date
   order by check_in;
   ```
   Retirez ceux déjà présents dans le registre.
2. **Contrôler chaque ligne :**
   - Dans Stripe → Paiements, le PaymentIntent (`payment_intent_id`) est **Réussi** pour `subtotal + fee`, sans litige ni remboursement.
   - Aucun signalement du voyageur depuis son arrivée. S'il y en a un, **suspendez** le virement et traitez la réclamation (§ 5).
3. **Émettre le virement SEPA** depuis le compte professionnel de PetInn :
   - **montant** : `subtotal`, exactement, au centime ;
   - **bénéficiaire** : IBAN du RIB vérifié ;
   - **référence** : `PETINN-<8 premiers caractères de id>-<check_in>`, par exemple `PETINN-1a2b3c4d-2026-12-10`.

   Le virement instantané est conseillé s'il est gratuit chez votre banque.
4. **Consigner** le virement dans le registre (§ 4) et **envoyer le relevé de versement** à l'hôte (§ 4).

> **Trésorerie** : Stripe reverse les fonds sur le compte bancaire de PetInn selon son propre
> calendrier (Paramètres → Virements ; souvent plus long pour un compte récent). Les premiers
> versements aux hôtes peuvent donc devoir être avancés sur la trésorerie de PetInn.
> Vérifiez votre solde Stripe disponible avant chaque série de virements.

## 4. Pièces à produire et à conserver

**Registre des versements** (tableur à accès restreint), une ligne par réservation :
date du virement, id de réservation, hébergeur, dates de séjour, `subtotal` versé, `fee`,
id du PaymentIntent, référence du virement, 4 derniers chiffres de l'IBAN, n° de facture.

**Facture de commission** : les frais de service sont payés par le **voyageur**, la facture
lui est donc adressée. Numérotation continue (`PI-2026-0001`, …), avec :
- PetInn (raison sociale, adresse, SIREN), le voyageur (nom, e-mail), la date et le n° de réservation ;
- la désignation : « Frais de service PetInn — réservation du <check_in> au <check_out>, <listing_name> » ;
- le montant `fee` et la mention TVA adaptée : soit « TVA non applicable, art. 293 B du CGI »
  (franchise en base), soit le montant HT, la TVA à 20 % et le TTC. **À valider avec votre comptable.**

Envoyez la facture au voyageur dans les 24 h suivant l'acceptation.

**Relevé de versement à l'hôte** (e-mail ou PDF) : séjour, voyageur (prénom), total payé,
frais PetInn (payés par le voyageur), **montant versé**, date et référence du virement. Il
rappelle qu'aucune commission n'est prélevée sur l'hôte.

Conservez registre, factures et relevés **10 ans** (obligation comptable).

## 5. Cas particuliers

| Situation | Action |
| --- | --- |
| Réclamation sérieuse du voyageur à l'arrivée | Suspendre le virement, contacter les deux parties. En cas de remboursement : Stripe → Paiement → **Rembourser** (total ou partiel), puis verser à l'hôte le solde éventuel. |
| Annulation après acceptation | Pas encore gérée par l'app : remboursement manuel dans Stripe selon les conditions d'annulation (`/annulation`), sans virement à l'hôte (ou virement partiel). |
| Litige carte (chargeback) ouvert dans Stripe | Ne pas verser tant qu'il n'est pas tranché ; répondre au litige depuis Stripe avec la réservation et les échanges. |
| Virement rejeté (IBAN erroné, compte clos) | Recontacter l'hôte, revérifier un nouveau RIB (§ 2), réémettre. |
| « Paiement à vérifier » dans l'Espace hôte | Ne rien verser ; comparer avec Stripe et corriger avant tout virement. |

## 6. Points de conformité à valider (avant de passer à l'échelle)

Ce montage manuel est une solution de lancement. Faites valider ces points par un comptable
ou un juriste :

- **Encaissement pour le compte de tiers** : percevoir l'argent des voyageurs puis le reverser aux
  hôtes peut relever d'un statut réglementé (agent de prestataire de services de paiement).
  **Stripe Connect** (comptes hôtes vérifiés, versements automatiques) est la cible naturelle.
- **Taxe de séjour** : une plateforme qui encaisse le paiement pour des hébergeurs non
  professionnels doit en général **collecter et reverser** la taxe de séjour aux communes.
- **Déclaration des revenus des hôtes** (DAC7 / art. 242 bis du CGI) : envoi annuel aux hôtes et à
  l'administration fiscale du récapitulatif des montants perçus via la plateforme.
