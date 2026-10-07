import { useState } from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ListingPhoto } from "@/lib/data";

export function ListingGallery({ photos, name }: { photos: ListingPhoto[]; name: string }) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const current = photos[active];
  if (!current) return null;
  const move = (step: number) => setActive((value) => (value + step + photos.length) % photos.length);
  return (
    <>
      <div className="relative grid h-[280px] grid-cols-[2fr_1fr] grid-rows-2 gap-2 overflow-hidden rounded-2xl sm:h-[380px] sm:grid-cols-[2fr_1fr_1fr]">
        {photos.map((photo, index) => (
          <Button key={photo.src} variant="ghost" className={`h-full min-h-0 min-w-0 w-full overflow-hidden rounded-none p-0 ${index === 0 ? "row-span-2" : ""} ${index === 3 ? "hidden sm:col-span-2 sm:flex" : ""} ${photos.length === 3 && index > 0 ? "sm:col-span-2" : ""}`} onClick={() => { setActive(index); setOpen(true); }} aria-label={`Ouvrir la photo ${index + 1} : ${photo.caption}`}>
            <img src={photo.src} alt={`${name} — ${photo.caption} (illustration)`} className="h-full w-full object-cover transition-transform duration-300 motion-safe:hover:scale-105" loading={index === 0 ? "eager" : "lazy"} />
          </Button>
        ))}
        <Button variant="secondary" className="absolute bottom-3 right-3 shadow-sm" onClick={() => { setActive(0); setOpen(true); }}><Images />{photos.length} photos</Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Photos d’illustration — les photos réelles seront fournies par l’hébergeur.</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-4xl rounded-lg p-4 sm:p-6" onKeyDown={(event) => { if (event.key === "ArrowLeft") move(-1); if (event.key === "ArrowRight") move(1); }}>
          <DialogTitle className="pr-6 font-display">{name}</DialogTitle>
          <DialogDescription>Photos d’illustration · {active + 1} / {photos.length}</DialogDescription>
          <img src={current.src} alt={`${name} — ${current.caption} (illustration)`} className="aspect-[4/3] max-h-[60vh] w-full rounded-md object-contain" />
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" size="icon" aria-label="Photo précédente" onClick={() => move(-1)}><ChevronLeft /></Button>
            <p className="text-center text-sm">{current.caption}</p>
            <Button variant="outline" size="icon" aria-label="Photo suivante" onClick={() => move(1)}><ChevronRight /></Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}