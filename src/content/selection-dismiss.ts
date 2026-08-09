/**
 * When the floating selection card should be dismissed.
 *
 * Clicking a control inside the card (a button, or an X-Ray disclosure) puts
 * focus in the card and collapses the page selection. That fires
 * `selectionchange` with an empty selection, which used to hide the card
 * instantly — so the panel closed the moment the user tried to interact with
 * it and nothing inside it could be clicked twice (VOC-123).
 *
 * The rule: an empty selection only dismisses the card when the interaction is
 * happening OUTSIDE the card. While the pointer or focus is inside it, the card
 * stays open and is dismissed by the usual means (outside mousedown, Escape,
 * or a genuinely new selection elsewhere).
 */
export interface SelectionDismissContext {
  /** Whether the current selection is empty/collapsed. */
  selectionEmpty: boolean;
  /** Whether the user is currently interacting inside the card. */
  interactingWithCard: boolean;
}

export function shouldHideOnSelectionChange(ctx: SelectionDismissContext): boolean {
  if (!ctx.selectionEmpty) return false;
  return !ctx.interactingWithCard;
}

/** True when `node` lives inside the card element. */
export function isInsideCard(node: Node | null, card: HTMLElement | null): boolean {
  if (!node || !card) return false;
  return card === node || card.contains(node);
}

/**
 * True when the card currently owns the interaction: it contains the active
 * element, or the pointer went down inside it. Both matter — a click gives the
 * card focus, but a `<summary>` toggle can move focus around within it.
 */
export function cardOwnsInteraction(
  card: HTMLElement | null,
  activeElement: Element | null,
  pointerInsideCard: boolean,
): boolean {
  if (!card) return false;
  if (pointerInsideCard) return true;
  return isInsideCard(activeElement, card);
}
