import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const db = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (v: unknown) => { db.insert(v); return { select: () => ({ single: async () => ({ data: { id: "draft-1" }, error: null }) }) }; },
      update: (v: unknown) => { db.update(v); return { eq: async () => ({ error: null }) }; },
    }),
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }), upload: vi.fn(), remove: vi.fn() }) },
  },
}));

import { ListingWizard } from "@/components/ListingWizard";

const step = (name: RegExp) => screen.getByRole("button", { name });

beforeEach(() => { vi.clearAllMocks(); window.scrollTo = vi.fn(); });

describe("ListingWizard — publishing an incomplete listing", () => {
  it("blocks publication, jumps to the first step with errors and shows French messages inline", async () => {
    render(<ListingWizard userId="host-1" />);
    fireEvent.click(step(/^6\. Règles/));
    fireEvent.click(await screen.findByRole("button", { name: "Publier le logement" }));

    await screen.findByRole("heading", { level: 2, name: "Logement" });
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/points à corriger avant de publier/), expect.anything());
    expect(db.update).not.toHaveBeenCalledWith({ status: "publiée" });

    expect(screen.getByText("Nom de l’annonce trop court (3 caractères min.)")).toBeInTheDocument();
    expect(screen.getByText("Choisissez le type de logement")).toBeInTheDocument();
    expect(screen.getByLabelText("Nom de l'annonce")).toHaveAttribute("aria-invalid", "true");
    for (const s of [/^1\. Logement/, /^2\. Photos/, /^3\. Tarifs/, /^4\. Disponibilités/, /^5\. Chiens/]) {
      expect(step(s)).toHaveAccessibleName(expect.stringContaining("à corriger"));
    }
  });

  it("updates errors live as fields are fixed", async () => {
    render(<ListingWizard userId="host-1" />);
    fireEvent.click(step(/^6\. Règles/));
    fireEvent.click(await screen.findByRole("button", { name: "Publier le logement" }));
    await screen.findByText("Nom de l’annonce trop court (3 caractères min.)");
    fireEvent.change(screen.getByLabelText("Nom de l'annonce"), { target: { value: "Gîte du Moulin" } });
    await waitFor(() => expect(screen.queryByText("Nom de l’annonce trop court (3 caractères min.)")).toBeNull());
  });

  it("requires a yes/no garden answer, then the fence height when fenced", async () => {
    render(<ListingWizard userId="host-1" />);
    fireEvent.click(step(/^6\. Règles/));
    fireEvent.click(await screen.findByRole("button", { name: "Publier le logement" }));
    fireEvent.click(step(/^5\. Chiens/));

    expect(await screen.findByText("Précisez si le jardin est entièrement clôturé (oui ou non)")).toBeInTheDocument();
    expect(screen.getByText("Choisissez au moins un gabarit accepté")).toBeInTheDocument();
    const garden = screen.getByRole("radiogroup", { name: "Jardin entièrement clôturé" });
    for (const r of within(garden).getAllByRole("radio")) expect(r).toHaveAttribute("aria-checked", "false");

    fireEvent.click(within(garden).getByRole("radio", { name: "Oui, entièrement clôturé" }));
    expect(await screen.findByText("Indiquez la hauteur de la clôture (en mètres)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Hauteur de la clôture (m)"), { target: { value: "4" } });
    expect(await screen.findByText("Hauteur de clôture entre 0,50 m et 3,00 m")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Hauteur de la clôture (m)"), { target: { value: "1,5" } });
    await waitFor(() => expect(screen.queryByText(/Hauteur de clôture entre/)).toBeNull());

    fireEvent.click(within(garden).getByRole("radio", { name: "Non, ou pas de jardin" }));
    await waitFor(() => expect(screen.queryByLabelText("Hauteur de la clôture (m)")).toBeNull());
  });

  it("requires the photos on the photo step", async () => {
    render(<ListingWizard userId="host-1" />);
    fireEvent.click(step(/^6\. Règles/));
    fireEvent.click(await screen.findByRole("button", { name: "Publier le logement" }));
    fireEvent.click(step(/^2\. Photos/));
    expect(await screen.findByText("Ajoutez au moins 3 photos réelles du logement")).toBeInTheDocument();
  });
});
