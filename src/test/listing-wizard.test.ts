import { describe, it, expect } from "vitest";
import {
  FENCE_RULE_TITLE, MIN_PHOTOS, STEP_OF_FIELD, fenceRule, splitFenceRule, validateWizard, type WizardInput,
} from "@/lib/listing-schema";

const TODAY = "2026-11-06";

const valid = (over: Partial<WizardInput> = {}): WizardInput => ({
  name: "Gîte du Moulin", type: "Gîte", city: "Sarlat", region: "Dordogne",
  description: "Maison en pierre avec grand jardin clos, au calme près des sentiers.",
  price_per_night: 95, dog_fee_per_night: 8, cleaning_fee: 45, min_nights: 2,
  available_from: "2026-12-01", available_to: "2027-09-30", blocked_dates: ["2026-12-25"],
  fenced_garden: true, fence_height_m: 1.5, sizes: ["petit", "moyen"], max_dogs: 2,
  equipment: ["Gamelles", "Panier"], dog_rules: [{ title: "Absences", description: "Pas plus de 3 heures seul au logement." }],
  photos: ["u/1.jpg", "u/2.jpg", "u/3.jpg"],
  ...over,
});

/** Errors of an invalid input (fails the test if the input is unexpectedly valid). */
function errorsOf(input: WizardInput) {
  const r = validateWizard(input, TODAY);
  if (r.ok) throw new Error("expected validation to fail");
  return r;
}

describe("Listing wizard schema — valid listing", () => {
  it("accepts a complete listing", () => {
    expect(validateWizard(valid(), TODAY)).toMatchObject({ ok: true, data: { name: "Gîte du Moulin", fenced_garden: true } });
  });

  it("accepts no garden without a fence height, and zero fees", () => {
    expect(validateWizard(valid({ fenced_garden: false, fence_height_m: null, dog_fee_per_night: 0, cleaning_fee: 0 }), TODAY).ok).toBe(true);
  });
});

describe("Listing wizard schema — required fields (step 1: Logement)", () => {
  it.each([
    ["name", { name: "  " }, "Nom de l’annonce trop court (3 caractères min.)"],
    ["type", { type: "" }, "Choisissez le type de logement"],
    ["type", { type: "Château" }, "Choisissez le type de logement"],
    ["city", { city: "" }, "Indiquez la ville"],
    ["description", { description: "Trop court" }, "Décrivez le logement (20 caractères min.)"],
  ] as const)("%s → %s", (key, over, message) => {
    const r = errorsOf(valid(over as Partial<WizardInput>));
    expect(r.errors[key]).toBe(message);
    expect(r.firstStep).toBe(0);
  });
});

describe("Listing wizard schema — photos (step 2)", () => {
  it(`requires at least ${MIN_PHOTOS} photos uploaded to listing-photos`, () => {
    for (const photos of [[], ["u/1.jpg"], ["u/1.jpg", "u/2.jpg"]]) {
      const r = errorsOf(valid({ photos }));
      expect(r.errors["photos"]).toBe(`Ajoutez au moins ${MIN_PHOTOS} photos réelles du logement`);
      expect(r.firstStep).toBe(1);
    }
    expect(errorsOf(valid({ photos: Array.from({ length: 11 }, (_, i) => `u/${i}.jpg`) })).errors["photos"]).toBe("10 photos maximum");
  });
});

describe("Listing wizard schema — prices (step 3)", () => {
  it.each([
    [NaN, "Prix par nuit : indiquez un montant en euros"],
    [0, "Prix par nuit : le montant doit être supérieur à 0 €"],
    [-20, "Prix par nuit : le montant doit être supérieur à 0 €"],
    [12000, "Prix par nuit : 10 000 € maximum"],
  ])("price %s → %s", (price, message) => {
    const r = errorsOf(valid({ price_per_night: price }));
    expect(r.errors["price_per_night"]?.replace(/ /g, " ")).toBe(message);
    expect(r.firstStep).toBe(2);
  });

  it("rejects negative or invalid fees and a non-integer minimum stay", () => {
    const r = errorsOf(valid({ dog_fee_per_night: -1, cleaning_fee: NaN, min_nights: 1.5 }));
    expect(r.errors).toMatchObject({
      dog_fee_per_night: "Supplément par chien : le montant ne peut pas être négatif",
      cleaning_fee: "Frais de ménage : indiquez un montant en euros",
      min_nights: "Séjour minimum : indiquez un nombre entier",
    });
  });
});

describe("Listing wizard schema — availability (step 4)", () => {
  it("requires both dates", () => {
    const r = errorsOf(valid({ available_from: "", available_to: "" }));
    expect(r.errors).toMatchObject({ available_from: "Date d’ouverture : date requise", available_to: "Date de fin : date requise" });
    expect(r.firstStep).toBe(3);
  });

  it("rejects an end before the start, blocked dates outside the period and a period already over", () => {
    expect(errorsOf(valid({ available_to: "2026-11-30" })).errors["available_to"]).toBe("La date de fin doit suivre la date d’ouverture");
    expect(errorsOf(valid({ blocked_dates: ["2028-01-01"] })).errors["blocked_dates"]).toBe("Les dates indisponibles doivent être comprises dans la période d’ouverture");
    expect(errorsOf(valid({ available_from: "2026-01-01", available_to: "2026-06-30", blocked_dates: [] })).errors["available_to"])
      .toBe("La période d’ouverture est déjà terminée : choisissez une date de fin à venir");
  });
});

describe("Listing wizard schema — dogs (step 5)", () => {
  it("requires an explicit yes/no answer for the fenced garden", () => {
    const r = errorsOf(valid({ fenced_garden: null, fence_height_m: null }));
    expect(r.errors["fenced_garden"]).toBe("Précisez si le jardin est entièrement clôturé (oui ou non)");
    expect(r.firstStep).toBe(4);
  });

  it("requires a fence height between 0.5 and 3 m when the garden is fenced", () => {
    expect(errorsOf(valid({ fence_height_m: null })).errors["fence_height_m"]).toBe("Indiquez la hauteur de la clôture (en mètres)");
    expect(errorsOf(valid({ fence_height_m: NaN })).errors["fence_height_m"]).toBe("Indiquez la hauteur de la clôture (en mètres)");
    for (const h of [0.3, 4]) {
      expect(errorsOf(valid({ fence_height_m: h })).errors["fence_height_m"]).toBe("Hauteur de clôture entre 0,50 m et 3,00 m");
    }
  });

  it("requires at least one accepted dog size, a valid dog count and known equipment", () => {
    const r = errorsOf(valid({ sizes: [], max_dogs: 0, equipment: ["Jacuzzi"] }));
    expect(r.errors).toMatchObject({
      sizes: "Choisissez au moins un gabarit accepté",
      max_dogs: "Nombre de chiens maximum : 1 minimum",
      "equipment.0": "Équipement inconnu",
    });
  });
});

describe("Listing wizard schema — dog rules (step 6)", () => {
  it("points at the incomplete rule", () => {
    const r = errorsOf(valid({ dog_rules: [{ title: "Absences", description: "Pas plus de 3 heures seul." }, { title: "", description: "" }] }));
    expect(r.errors).toMatchObject({
      "dog_rules.1.title": "Titre de la règle trop court (2 caractères min.)",
      "dog_rules.1.description": "Décrivez la règle (10 caractères min.)",
    });
    expect(r.firstStep).toBe(5);
  });

  it("requires at least one rule and refuses a manual fence rule", () => {
    expect(errorsOf(valid({ dog_rules: [] })).errors["dog_rules"]).toBe("Ajoutez au moins une règle d’accueil des chiens");
    expect(errorsOf(valid({ dog_rules: [fenceRule(1.5)] })).errors["dog_rules"]).toContain("ajouté automatiquement");
  });
});

describe("Listing wizard schema — error reporting", () => {
  it("lists every failing step in order and starts with the first one", () => {
    const r = errorsOf(valid({ name: "", photos: [], fenced_garden: null, dog_rules: [] }));
    expect(r.stepsWithErrors).toEqual([0, 1, 4, 5]);
    expect(r.firstStep).toBe(0);
  });

  it("reports cross-field errors together with basic field errors", () => {
    const r = errorsOf(valid({ name: "", fence_height_m: null, available_to: "2026-11-30" }));
    // The blocked 25 December also falls outside a period ending on 30 November.
    expect(Object.keys(r.errors).sort()).toEqual(["available_to", "blocked_dates", "fence_height_m", "name"]);
  });

  it("only ever shows French messages, even for an empty form", () => {
    const empty: WizardInput = {
      name: "", type: "", city: "", region: "x".repeat(81), description: "", price_per_night: NaN, dog_fee_per_night: NaN, cleaning_fee: -1,
      min_nights: NaN, available_from: "", available_to: "", blocked_dates: ["bad"], fenced_garden: null, fence_height_m: null,
      sizes: [], max_dogs: 99, equipment: ["?"], dog_rules: [{ title: "", description: "" }], photos: [],
    };
    const messages = Object.values(errorsOf(empty).errors);
    expect(messages.length).toBeGreaterThan(12);
    for (const m of messages) expect(m).not.toMatch(/Expected|Required|Invalid|must|received|String|Number|Array/);
  });

  it("maps every validated field to a wizard step", () => {
    const keys = Object.keys(errorsOf({ ...valid(), name: "", type: "", city: "", region: "x".repeat(81), description: "",
      price_per_night: NaN, dog_fee_per_night: NaN, cleaning_fee: NaN, min_nights: NaN, available_from: "", available_to: "",
      fenced_garden: null, sizes: [], max_dogs: NaN, dog_rules: [], photos: [] }).errors);
    for (const k of keys) expect(STEP_OF_FIELD[k.split(".")[0]!], k).toBeTypeOf("number");
  });
});

describe("Fence height stored as a dog rule", () => {
  it("is published as a readable rule and read back when the draft is resumed", () => {
    const rule = fenceRule(1.5);
    expect(rule).toEqual({ title: FENCE_RULE_TITLE, description: "Jardin entièrement clôturé, clôture de 1,50 m de hauteur." });
    const own = [{ title: "Absences", description: "Pas plus de 3 heures seul au logement." }];
    expect(splitFenceRule([...own, rule])).toEqual({ rules: own, fenceHeightM: 1.5 });
    expect(splitFenceRule(own)).toEqual({ rules: own, fenceHeightM: null });
  });
});
