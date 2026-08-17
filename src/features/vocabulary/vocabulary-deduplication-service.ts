/** Outcome of attempting to save a normalized word. */
export type SaveDecision =
  | { kind: 'saved'; entry: { userId: string; familyId: string } }
  | { kind: 'already-saved'; existingFamilyId: string };
