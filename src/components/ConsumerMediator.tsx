import { CONSUMER_MEDIATOR, type ConsumerMediator } from "@/lib/legal";
import { LegalTodo } from "@/components/LegalPage";

/**
 * Consumer mediator details, rendered from CONSUMER_MEDIATOR (src/lib/legal.ts) on both legal pages.
 * Until a membership is recorded, every field stays a visible "À COMPLÉTER" marker.
 */
const link = "underline break-words";

/** CGU, article 10: one line per detail. */
export function MediatorDetailsList({ mediator = CONSUMER_MEDIATOR }: { mediator?: ConsumerMediator | null }) {
  const m = mediator;
  return (
    <ul>
      <li>Entité de médiation : {m ? m.name : <LegalTodo id="mediateur">nom du médiateur agréé auquel l’éditeur a adhéré</LegalTodo>}</li>
      <li>Adresse postale : {m ? m.postalAddress : <LegalTodo id="mediateur">adresse postale du médiateur</LegalTodo>}</li>
      <li>E-mail : {m ? <a href={`mailto:${m.email}`} className={link}>{m.email}</a> : <LegalTodo id="mediateur">adresse e-mail du médiateur</LegalTodo>}</li>
      <li>Site internet : {m ? <a href={m.website} className={link} rel="noopener noreferrer" target="_blank">{m.website}</a> : <LegalTodo id="mediateur">site officiel du médiateur (lien)</LegalTodo>}</li>
      <li>Saisine en ligne : {m ? <a href={m.onlineReferral} className={link} rel="noopener noreferrer" target="_blank">{m.onlineReferral}</a> : <LegalTodo id="mediateur">lien direct vers le formulaire de saisine en ligne du médiateur</LegalTodo>}</li>
    </ul>
  );
}

/** Mentions légales, section 6: name, address and site in the sentence. */
export function MediatorInline({ mediator = CONSUMER_MEDIATOR }: { mediator?: ConsumerMediator | null }) {
  if (!mediator) {
    return <LegalTodo id="mediateur">nom, adresse postale et site internet du médiateur auquel l’éditeur a adhéré</LegalTodo>;
  }
  return (
    <>
      {mediator.name}, {mediator.postalAddress} (
      <a href={mediator.website} className={link} rel="noopener noreferrer" target="_blank">{mediator.website}</a>)
    </>
  );
}
