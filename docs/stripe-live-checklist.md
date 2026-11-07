# Passage en paiements réels (Stripe live) — checklist KYC et pré-lancement

> **Statut (7 novembre 2026) : 🟡 compte Stripe non activé.** Les clés configurées sont des clés
> de **test** (`sk_test_` / `pk_test_`) : aucun argent réel n'est prélevé. L'activation du compte
> (KYC) est une démarche à faire dans le Dashboard Stripe. Le code ne la simule pas et ne la
> déclenche pas. **Bloquant pour la mise en production.**

Configuration technique (clés, moyens de paiement) : [stripe-configuration.md](stripe-configuration.md).

## 1. Ce que le produit fait tant que le live n'est pas prêt

| Situation | Comportement |
| --- | --- |
| Clés absentes, mal formées, test/live mélangées | Paiement indisponible **avant** toute création de demande ; carte non sollicitée. |
| Clés live sur un compte **non activé** (Stripe refuse : « cannot currently make live charges ») | La demande créée est **supprimée**, le voyageur voit « Le paiement en ligne est momentanément indisponible. Aucune demande n’a été créée et votre carte n’a pas été sollicitée. » Log serveur unique : `[stripe] configuration invalide (live_charges_disabled)`. |
| Toute autre erreur Stripe à la création de l'empreinte | Même message et même suppression : aucune demande orpheline. |
| Capture / libération qui échoue (décision hôte, annulation) | La demande n'est pas modifiée ; l'action peut être relancée (inchangé). |

> La détection du compte non activé repose sur le texte de l'erreur Stripe (pas de code dédié). Même
> si Stripe change ce texte, le voyageur voit le message « paiement indisponible » ci-dessus ; seul le
> libellé du log serait différent.

## 2. Activation du compte (Dashboard Stripe → « Activer les paiements »)

À faire par le représentant légal de l'entreprise. Préparer :

- [ ] **Type d'entreprise** et forme juridique (micro-entreprise, SAS, SARL…).
- [ ] **SIRET** (14 chiffres) et raison sociale exacte, adresse du siège — identiques à l'avis INSEE / Kbis.
- [ ] **Représentant légal** : nom, date de naissance, adresse, e-mail, téléphone ; **pièce d'identité**
      si Stripe la demande. Pour une société : bénéficiaires effectifs (> 25 %) et dirigeants.
- [ ] **IBAN** au nom de l'entreprise (France ou zone SEPA), devise **EUR**.
- [ ] **Activité** : description (« plateforme de réservation d'hébergements acceptant les chiens »),
      code MCC proposé par Stripe, **URL du site** (accessible publiquement, avec CGU, mentions légales et
      politique d'annulation visibles).
- [ ] **Libellé de relevé bancaire** : `PETINN`.
- [ ] **Assistance client** : e-mail et téléphone affichés aux clients.

## 3. Preuves à obtenir dans Stripe (à conserver, captures datées)

Aucune n'est disponible à ce jour.

- [ ] Dashboard → **Paramètres → Compte / Informations de l'entreprise** : statut sans bannière
      « Informations requises » ; aucune vérification en attente.
- [ ] Dashboard → **Paramètres → Comptes bancaires et devises** : IBAN vérifié, devise EUR.
- [ ] Bascule **mode live** possible (le sélecteur « Mode test » se désactive sans message d'activation).
- [ ] `bun run stripe:check` avec les clés **live** (clé secrète standard, pas une clé restreinte),
      sortie `✓ Compte prêt pour les paiements réels` :
      `Dossier soumis ✓  Paiements ✓  Virements ✓`, pays `FR`, devise `eur`, sans « informations en retard ».
      Le script est en **lecture seule** (`GET /v1/account`).

## 4. Bascule et recette live

1. Lovable Cloud → Secrets : remplacer **les deux** clés en même temps (`sk_live_…`, `pk_live_…`).
2. Relancer `bun run stripe:check` → code de sortie 0.
3. Recette réelle à faible montant (carte personnelle) :
   - [ ] la demande est créée, l'empreinte apparaît dans Stripe → **Paiements → Non capturé** ;
   - [ ] refus depuis l'Espace hôte → empreinte **annulée** dans Stripe, aucun débit ;
   - [ ] nouvelle demande acceptée → paiement **capturé** ; puis remboursement depuis le Dashboard ;
   - [ ] premier **virement** vers l'IBAN visible dans **Soldes → Virements** (délai Stripe initial de plusieurs jours).
4. Logs serveur sans `[stripe] configuration invalide`.

Tant que les sections 3 et 4 ne sont pas cochées avec des preuves réelles, le point reste **NO-GO**.
