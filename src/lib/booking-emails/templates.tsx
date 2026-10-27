import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";

export type BookingEmailData = {
  recipientName?: string | undefined;
  listingName?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  dogNames?: string;
  total?: number;
  url?: string;
};

const fr = (d?: string) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");

function Layout({ preview, title, children, cta, d }: { preview: string; title: string; children: React.ReactNode; cta: string; d: BookingEmailData }) {
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>PetInn</Text>
          <Heading style={h1}>{title}</Heading>
          <Text style={text}>{d.recipientName ? `Bonjour ${d.recipientName},` : "Bonjour,"}</Text>
          {children}
          <Section style={box}>
            <Text style={boxTitle}>{d.listingName ?? "Votre hébergement"}</Text>
            <Text style={boxLine}>Du {fr(d.checkIn)} au {fr(d.checkOut)}{d.nights ? ` · ${d.nights} nuit${d.nights > 1 ? "s" : ""}` : ""}</Text>
            {d.dogNames && <Text style={boxLine}>Chien(s) : {d.dogNames}</Text>}
            {d.total != null && <Text style={boxLine}>Montant : {d.total} €</Text>}
          </Section>
          {d.url && <Button href={d.url} style={button}>{cta}</Button>}
          <Hr style={hr} />
          <Text style={footer}>PetInn — des séjours 100 % pet-friendly en France.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const HostNewRequest = (d: BookingEmailData) => (
  <Layout d={d} preview="Nouvelle demande de réservation" title="Nouvelle demande de réservation" cta="Voir la demande">
    <Text style={text}>Un voyageur souhaite séjourner chez vous avec son chien. Consultez son passeport canin puis acceptez ou refusez la demande. Sans réponse sous 24 heures, elle expire et l’empreinte bancaire est libérée.</Text>
  </Layout>
);

export const TravelerAccepted = (d: BookingEmailData) => (
  <Layout d={d} preview="Votre demande est acceptée" title="Votre séjour est confirmé" cta="Voir mes demandes">
    <Text style={text}>Bonne nouvelle : l’hôte a accepté votre demande. Le paiement a été encaissé.</Text>
  </Layout>
);

export const TravelerRefused = (d: BookingEmailData) => (
  <Layout d={d} preview="Votre demande n’a pas été acceptée" title="Demande non acceptée" cta="Chercher un autre hébergement">
    <Text style={text}>L’hôte n’a pas pu accepter votre demande. Aucun montant n’a été prélevé : l’empreinte bancaire est libérée.</Text>
  </Layout>
);

export const TravelerExpired = (d: BookingEmailData) => (
  <Layout d={d} preview="Votre demande a expiré" title="Demande expirée" cta="Chercher un autre hébergement">
    <Text style={text}>L’hôte n’a pas répondu dans les 24 heures. Votre demande a expiré et aucun montant n’a été prélevé : l’empreinte bancaire est libérée.</Text>
  </Layout>
);

export const BOOKING_EMAILS = {
  "host-new-request": { component: HostNewRequest, subject: "Nouvelle demande de réservation sur PetInn", displayName: "Hôte — nouvelle demande" },
  "traveler-accepted": { component: TravelerAccepted, subject: "Votre séjour PetInn est confirmé", displayName: "Voyageur — demande acceptée" },
  "traveler-refused": { component: TravelerRefused, subject: "Votre demande PetInn n’a pas été acceptée", displayName: "Voyageur — demande refusée" },
  "traveler-expired": { component: TravelerExpired, subject: "Votre demande PetInn a expiré", displayName: "Voyageur — demande expirée" },
} as const;

export type BookingEmailName = keyof typeof BOOKING_EMAILS;

const main = { backgroundColor: "#ffffff", fontFamily: "'DM Sans', Arial, sans-serif", color: "#2b2420" };
const container = { padding: "28px 24px", maxWidth: "560px" };
const brand = { color: "#c2562f", fontWeight: 700, fontSize: "20px", margin: "0 0 16px" };
const h1 = { fontSize: "24px", margin: "0 0 16px", color: "#2b2420" };
const text = { fontSize: "15px", lineHeight: "24px" };
const box = { border: "1px solid #eadfd6", borderRadius: "12px", padding: "12px 16px", margin: "16px 0" };
const boxTitle = { fontWeight: 700, fontSize: "16px", margin: "4px 0" };
const boxLine = { fontSize: "14px", margin: "4px 0", color: "#5c524b" };
const button = { backgroundColor: "#2f5d46", color: "#ffffff", borderRadius: "10px", padding: "12px 20px", fontWeight: 600, textDecoration: "none" };
const hr = { borderColor: "#eadfd6", margin: "24px 0 12px" };
const footer = { fontSize: "12px", color: "#8a7f77" };
