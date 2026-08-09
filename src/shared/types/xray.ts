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

  /* ---------------------------------------------------------------------
   * Whole-sentence anatomy (VOC-122). Every field is optional: a sparser or
   * older model response still renders, just with fewer sections. None of
   * these are language-specific — the model describes the structure and
   * grammar of whatever language it detected, in the user's language.
   * ------------------------------------------------------------------- */

  /** How the sentence is built: clauses, phrases, subject, verb and their roles. */
  structure?: string;
  /** The important grammar patterns actually used (not an error check). */
  grammar?: string;
  /** The natural meaning of the sentence in its context. */
  meaning?: string;
  /** Why the writer chose this structure/wording: effect, emphasis, register. */
  why?: string;
  /** Notable words, collocations, idioms and expressions worth knowing. */
  vocabulary?: XRayVocabularyItem[];
  /** Approximate difficulty on the CEFR scale. */
  difficulty?: XRayDifficulty;
  /** A plainer rewrite, present only when it genuinely helps. */
  simplerVersion?: string;
}

/** One notable vocabulary item found in the text. */
export interface XRayVocabularyItem {
  /** The word, collocation, idiom or expression, in the original language. */
  term: string;
  /** What it means / how it is used here. */
  note: string;
  /** What kind of item it is, e.g. "idiom", "collocation", "phrasal verb". */
  kind?: string;
}

/** Approximate CEFR difficulty, used as a rough universal scale. */
export interface XRayDifficulty {
  /** One of A1, A2, B1, B2, C1, C2. */
  cefr: XRayCefrLevel;
  /** One line on what makes it that level. */
  reason?: string;
}

export type XRayCefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/** The valid CEFR levels, in ascending order. */
export const XRAY_CEFR_LEVELS: readonly XRayCefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

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
