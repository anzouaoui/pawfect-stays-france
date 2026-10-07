import masPhoto from "@/assets/mas-luberon.jpg.asset.json";
import campingPhoto from "@/assets/camping-bretagne.jpg.asset.json";
import annecyPhoto from "@/assets/hotel-annecy.jpg.asset.json";
import gitePhoto from "@/assets/gite-dordogne.jpg.asset.json";
import villagePhoto from "@/assets/village-landes.jpg.asset.json";
import parisPhoto from "@/assets/hotel-paris.jpg.asset.json";
import gardenPhoto from "@/assets/garden.jpg.asset.json";
import bedroomPhoto from "@/assets/bedroom.jpg.asset.json";
import livingPhoto from "@/assets/living-room.jpg.asset.json";
import coastPhoto from "@/assets/coast.jpg.asset.json";

export type Size = "petit" | "moyen" | "grand";
export type ListingPhoto = { src: string; caption: string };
export type DogRule = { title: string; description: string };
export type Listing = {
  id: string; name: string; type: string; city: string; region: string;
  price: number; rating: number; image: string; description: string;
  fencedGarden: boolean; sizes: Size[]; maxDogs: number; equipment: string[]; host: string;
  photos: ListingPhoto[]; dogEquipment: DogRule[]; dogRules: DogRule[];
};

export const SERVICE_FEE_RATE = 0.1;
export const EQUIPMENT = ["Gamelles", "Panier", "Serviettes", "Sacs à déjections", "Douche pour chien", "Plage à proximité"];
export const TYPES = ["Hôtel", "Camping", "Villa", "Village vacances", "Gîte"];

const photoAssets = [masPhoto, campingPhoto, annecyPhoto, gitePhoto, villagePhoto, parisPhoto];
const img = (id: string) => ({
  "photo-1568605114967-8130f3a36994": masPhoto.url,
  "photo-1504280390367-361c6d9f38f4": campingPhoto.url,
  "photo-1566073771259-6a8506099945": annecyPhoto.url,
  "photo-1449844908441-8829872d2607": gitePhoto.url,
  "photo-1582719478250-c89cae4dc85b": villagePhoto.url,
  "photo-1551882547-ff40c63fe5fa": parisPhoto.url,
})[id] ?? masPhoto.url;

const BASE_LISTINGS: Omit<Listing, "photos" | "dogEquipment" | "dogRules">[] = [
  { id: "mas-luberon", name: "Le Mas des Truffes", type: "Villa", city: "Gordes", region: "Provence", price: 185, rating: 4.9, image: img("photo-1568605114967-8130f3a36994"), description: "Mas provençal avec piscine et 2 000 m² de jardin entièrement clôturé, au cœur du Luberon.", fencedGarden: true, sizes: ["petit", "moyen", "grand"], maxDogs: 3, equipment: ["Gamelles", "Panier", "Serviettes", "Douche pour chien"], host: "Claire" },
  { id: "camping-bretagne", name: "Camping Les Dunes", type: "Camping", city: "Carnac", region: "Bretagne", price: 48, rating: 4.6, image: img("photo-1504280390367-361c6d9f38f4"), description: "Emplacements ombragés à 300 m d'une plage autorisée aux chiens toute l'année.", fencedGarden: false, sizes: ["petit", "moyen", "grand"], maxDogs: 2, equipment: ["Sacs à déjections", "Plage à proximité", "Douche pour chien"], host: "Yann" },
  { id: "hotel-annecy", name: "Hôtel du Lac Bleu", type: "Hôtel", city: "Annecy", region: "Alpes", price: 132, rating: 4.7, image: img("photo-1566073771259-6a8506099945"), description: "Hôtel de charme face au lac, sentiers de randonnée accessibles depuis la porte.", fencedGarden: false, sizes: ["petit", "moyen"], maxDogs: 1, equipment: ["Gamelles", "Panier", "Sacs à déjections"], host: "Marc" },
  { id: "gite-dordogne", name: "Gîte du Moulin", type: "Gîte", city: "Sarlat", region: "Dordogne", price: 95, rating: 4.8, image: img("photo-1449844908441-8829872d2607"), description: "Ancien moulin rénové au bord de la rivière, jardin clos de murs en pierre.", fencedGarden: true, sizes: ["petit", "moyen", "grand"], maxDogs: 2, equipment: ["Gamelles", "Serviettes", "Panier"], host: "Sophie" },
  { id: "village-landes", name: "Village Océane", type: "Village vacances", city: "Biscarrosse", region: "Landes", price: 78, rating: 4.5, image: img("photo-1582719478250-c89cae4dc85b"), description: "Cottages dans la pinède avec parc canin de 1 ha et agility.", fencedGarden: true, sizes: ["petit", "moyen", "grand"], maxDogs: 2, equipment: ["Sacs à déjections", "Gamelles", "Plage à proximité"], host: "Julien" },
  { id: "hotel-paris", name: "Maison Canaille", type: "Hôtel", city: "Paris", region: "Île-de-France", price: 165, rating: 4.4, image: img("photo-1551882547-ff40c63fe5fa"), description: "Boutique-hôtel à deux pas du Canal Saint-Martin, kit de bienvenue pour chien.", fencedGarden: false, sizes: ["petit"], maxDogs: 1, equipment: ["Gamelles", "Panier"], host: "Inès" },
];

const equipmentDescriptions: Record<string, string> = {
  "Gamelles": "Deux gamelles pour l’eau et les repas, nettoyées entre chaque séjour.",
  "Panier": "Un couchage lavable est mis à disposition. Indiquez le gabarit de votre chien dans votre demande.",
  "Serviettes": "Des serviettes réservées aux chiens pour le retour des promenades.",
  "Sacs à déjections": "Des sacs sont disponibles à l’accueil ; les déjections doivent être ramassées.",
  "Douche pour chien": "Un point de rinçage permet de nettoyer les pattes après une sortie.",
  "Plage à proximité": "Une plage se trouve à proximité. Les périodes d’accès et les règles locales sont à vérifier avant votre sortie.",
};

const specificRules: DogRule[][] = [
  [
    { title: "Jardin et piscine", description: "Le jardin est clôturé, mais votre chien reste sous votre surveillance. L’accès à la piscine est interdit aux animaux." },
    { title: "À l’intérieur", description: "Les chiens sont admis dans les pièces de vie. Merci de prévoir une protection pour le canapé ; les lits sont réservés aux voyageurs." },
    { title: "Absences", description: "Ne laissez pas votre chien seul dans la villa sans accord préalable de Claire." },
  ],
  [
    { title: "En laisse dans le camping", description: "La laisse est obligatoire dans les allées et les espaces communs. Les emplacements ne sont pas clôturés." },
    { title: "Espaces partagés", description: "Les chiens ne sont pas admis dans les sanitaires ni les espaces de baignade. Rincez votre chien au point prévu à cet effet." },
    { title: "Calme et absences", description: "Ne laissez pas votre chien seul sur l’emplacement. Veillez à limiter les aboiements, notamment la nuit." },
  ],
  [
    { title: "Circulation dans l’hôtel", description: "Gardez votre chien en laisse dans le hall et les couloirs. L’accès au restaurant et à l’espace bien-être n’est pas autorisé." },
    { title: "Dans la chambre", description: "Utilisez le panier fourni ; les lits et fauteuils ne sont pas accessibles aux chiens." },
    { title: "Absences et ménage", description: "Votre chien ne doit pas rester seul en chambre. Convenez du passage du ménage avec Marc." },
  ],
  [
    { title: "Jardin et rivière", description: "Le jardin est clos, mais la proximité de la rivière exige une surveillance constante. Vérifiez les accès à votre arrivée." },
    { title: "Mobilier", description: "Les chiens sont les bienvenus dans les pièces de vie, au sol ou sur leur panier. Les lits et canapés leur sont interdits." },
    { title: "Absences", description: "Toute absence sans votre chien doit être discutée avec Sophie avant le séjour." },
  ],
  [
    { title: "Parc canin et agility", description: "La liberté est permise dans le parc canin clôturé, sous votre surveillance. Les chiens doivent être tenus en laisse ailleurs dans le village." },
    { title: "Espaces de loisirs", description: "Les animaux ne sont pas admis dans les piscines et les aires de jeux pour enfants. Respectez les indications sur place." },
    { title: "Dans les cottages", description: "Prévoyez le couchage de votre chien. Ne le laissez pas seul sans accord préalable de Julien." },
  ],
  [
    { title: "Petit gabarit uniquement", description: "Un seul chien de petit gabarit est accueilli par chambre. Son poids et son comportement seront examinés avec le passeport canin." },
    { title: "Espaces communs", description: "Les chiens doivent être tenus en laisse dans l’hôtel. Le service du petit-déjeuner est réservé aux voyageurs." },
    { title: "Repos en chambre", description: "Le panier fourni est réservé à votre chien. Ne le laissez pas seul dans la chambre ; les lits ne lui sont pas accessibles." },
  ],
];

export const LISTINGS: Listing[] = BASE_LISTINGS.map((listing, index) => ({
  ...listing,
  photos: [
    { src: photoAssets[index]?.url ?? listing.image, caption: "Vue de l’hébergement" },
    ...(listing.type === "Camping" ? [
      { src: coastPhoto.url, caption: "Évasion en bord de mer" },
      { src: gardenPhoto.url, caption: "Espaces extérieurs" },
    ] : [
      { src: bedroomPhoto.url, caption: "Ambiance de la chambre" },
      { src: livingPhoto.url, caption: "Ambiance des espaces de vie" },
      { src: listing.fencedGarden ? gardenPhoto.url : coastPhoto.url, caption: listing.fencedGarden ? "Ambiance du jardin" : "Envie de promenade" },
    ]),
  ],
  dogEquipment: listing.equipment.map((title) => ({ title, description: equipmentDescriptions[title] ?? title })),
  dogRules: [
    { title: "Chiens accueillis", description: `Jusqu’à ${listing.maxDogs} chien${listing.maxDogs > 1 ? "s" : ""}, de gabarit ${listing.sizes.join(", ")}. Présentez chaque chien dans votre passeport canin pour permettre à ${listing.host} de confirmer l’accueil.` },
    ...(specificRules[index] ?? []),
    { title: "Santé et bonne entente", description: "Prévoyez le carnet de santé et signalez tout besoin particulier, difficulté de cohabitation ou comportement à prendre en compte avant votre arrivée." },
    { title: "Propreté et respect des lieux", description: "Ramassez les déjections et utilisez les équipements réservés aux animaux. Signalez immédiatement à l’hôte tout dommage ou incident." },
  ],
}));
