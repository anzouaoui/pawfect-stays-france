export type Size = "petit" | "moyen" | "grand";
export type ListingPhoto = { src: string; caption: string };
export type DogRule = { title: string; description: string };
export type Listing = {
  id: string; name: string; type: string; city: string; region: string;
  price: number; rating: number; image: string; description: string;
  fencedGarden: boolean; sizes: Size[]; maxDogs: number; equipment: string[]; host: string;
  photos: ListingPhoto[]; dogEquipment: DogRule[]; dogRules: DogRule[];
  /** Set for listings published by hosts (real photos, live pricing and availability). */
  hosted?: { dogFee: number; cleaningFee: number; minNights: number; availableFrom: string; availableTo: string; blockedDates: string[] };
};

export const SERVICE_FEE_RATE = 0.1;
export const EQUIPMENT = ["Gamelles", "Panier", "Serviettes", "Sacs à déjections", "Douche pour chien", "Plage à proximité"];
export const TYPES = ["Hôtel", "Camping", "Villa", "Village vacances", "Gîte"];

export const equipmentDescriptions: Record<string, string> = {
  "Gamelles": "Deux gamelles pour l’eau et les repas, nettoyées entre chaque séjour.",
  "Panier": "Un couchage lavable est mis à disposition. Indiquez le gabarit de votre chien dans votre demande.",
  "Serviettes": "Des serviettes réservées aux chiens pour le retour des promenades.",
  "Sacs à déjections": "Des sacs sont disponibles à l’accueil ; les déjections doivent être ramassées.",
  "Douche pour chien": "Un point de rinçage permet de nettoyer les pattes après une sortie.",
  "Plage à proximité": "Une plage se trouve à proximité. Les périodes d’accès et les règles locales sont à vérifier avant votre sortie.",
};

/** Sample listings were removed for launch: only host-published listings (Cloud) are shown. */
export const LISTINGS: Listing[] = [];
