export type Size = "petit" | "moyen" | "grand";
export type Listing = {
  id: string; name: string; type: string; city: string; region: string;
  price: number; rating: number; image: string; description: string;
  fencedGarden: boolean; sizes: Size[]; maxDogs: number; equipment: string[]; host: string;
};

export const SERVICE_FEE_RATE = 0.1;
export const EQUIPMENT = ["Gamelles", "Panier", "Serviettes", "Sacs à déjections", "Douche pour chien", "Plage à proximité"];
export const TYPES = ["Hôtel", "Camping", "Villa", "Village vacances", "Gîte"];

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=70`;

export const LISTINGS: Listing[] = [
  { id: "mas-luberon", name: "Le Mas des Truffes", type: "Villa", city: "Gordes", region: "Provence", price: 185, rating: 4.9, image: img("photo-1568605114967-8130f3a36994"), description: "Mas provençal avec piscine et 2 000 m² de jardin entièrement clôturé, au cœur du Luberon.", fencedGarden: true, sizes: ["petit", "moyen", "grand"], maxDogs: 3, equipment: ["Gamelles", "Panier", "Serviettes", "Douche pour chien"], host: "Claire" },
  { id: "camping-bretagne", name: "Camping Les Dunes", type: "Camping", city: "Carnac", region: "Bretagne", price: 48, rating: 4.6, image: img("photo-1504280390367-361c6d9f38f4"), description: "Emplacements ombragés à 300 m d'une plage autorisée aux chiens toute l'année.", fencedGarden: false, sizes: ["petit", "moyen", "grand"], maxDogs: 2, equipment: ["Sacs à déjections", "Plage à proximité", "Douche pour chien"], host: "Yann" },
  { id: "hotel-annecy", name: "Hôtel du Lac Bleu", type: "Hôtel", city: "Annecy", region: "Alpes", price: 132, rating: 4.7, image: img("photo-1566073771259-6a8506099945"), description: "Hôtel de charme face au lac, sentiers de randonnée accessibles depuis la porte.", fencedGarden: false, sizes: ["petit", "moyen"], maxDogs: 1, equipment: ["Gamelles", "Panier", "Sacs à déjections"], host: "Marc" },
  { id: "gite-dordogne", name: "Gîte du Moulin", type: "Gîte", city: "Sarlat", region: "Dordogne", price: 95, rating: 4.8, image: img("photo-1449844908441-8829872d2607"), description: "Ancien moulin rénové au bord de la rivière, jardin clos de murs en pierre.", fencedGarden: true, sizes: ["petit", "moyen", "grand"], maxDogs: 2, equipment: ["Gamelles", "Serviettes", "Panier"], host: "Sophie" },
  { id: "village-landes", name: "Village Océane", type: "Village vacances", city: "Biscarrosse", region: "Landes", price: 78, rating: 4.5, image: img("photo-1582719478250-c89cae4dc85b"), description: "Cottages dans la pinède avec parc canin de 1 ha et agility.", fencedGarden: true, sizes: ["petit", "moyen", "grand"], maxDogs: 2, equipment: ["Sacs à déjections", "Gamelles", "Plage à proximité"], host: "Julien" },
  { id: "hotel-paris", name: "Maison Canaille", type: "Hôtel", city: "Paris", region: "Île-de-France", price: 165, rating: 4.4, image: img("photo-1551882547-ff40c63fe5fa"), description: "Boutique-hôtel à deux pas du Canal Saint-Martin, kit de bienvenue pour chien.", fencedGarden: false, sizes: ["petit"], maxDogs: 1, equipment: ["Gamelles", "Panier"], host: "Inès" },
];
