/**
 * X-Ray Reading: the structured result of "seeing through" a piece of selected
 * text — the simple idea hidden inside complex language.
 *
 * The shape is deliberately language-agnostic: nothing here assumes English,
 * Vietnamese, or a subject-verb-object sentence. `core.representation` is a
 * free-form arrow diagram the model picks per text (actor → action → result,
 * cause → effect, condition → consequence, reference → referent, …), so a new
 * language never needs a new frontend branch.
 */
export interface XRayReadingResult {
  /** Language the model detected in the ORIGINAL text (human-readable label). */
  detectedLanguage: string;
  /** The analysed text, preserved in its original language. */
  originalText: string;
  /** The simple idea the text is actually expressing. */
  core: {
    /** Compact arrow/relationship diagram, e.g. "The report → has raised → concerns". */
    representation: string;
    /** One plain sentence: what the text boils down to. */
    simpleMeaning: string;
  };
  /** The parts that create the comprehension bottleneck — only the ones that matter. */
  complexity: XRayComplexityLayer[];
  /** Explicit relationships between the pieces, when useful. */
  relationships: XRayRelationship[];
  /** The whole text reconstructed in simpler form. */
  fullExplanation: string;
}

/** One layer of difficulty inside the text. */
export interface XRayComplexityLayer {
  /** The exact fragment of the original text that is hard. */
  text: string;
  /** What that fragment means or does. */
  explanation: string;
  /** Which part of the core it attaches to, when applicable. */
  relatesTo?: string;
}

/** A from → relation → to link the reader needs in order to follow the text. */
export interface XRayRelationship {
  from: string;
  relation: string;
  to: string;
}
