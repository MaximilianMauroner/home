const PAGE_GUTTER = 16;
const MAX_CARD_WIDTH = 384;

interface LetterCardPositionInput {
  cardHeight?: number;
  cardWidth?: number;
  left: number;
  top: number;
  viewportHeight: number;
  viewportWidth: number;
}

export function getLetterCardWidth(viewportWidth: number) {
  return Math.min(MAX_CARD_WIDTH, Math.max(0, viewportWidth - PAGE_GUTTER * 2));
}

export function clampLetterCardPosition({
  cardHeight = 300,
  cardWidth = MAX_CARD_WIDTH,
  left,
  top,
  viewportHeight,
  viewportWidth,
}: LetterCardPositionInput) {
  const availableWidth = Math.max(0, viewportWidth - PAGE_GUTTER * 2);
  const availableHeight = Math.max(0, viewportHeight - PAGE_GUTTER * 2);
  const effectiveWidth = Math.min(cardWidth, availableWidth);
  const effectiveHeight = Math.min(cardHeight, availableHeight);

  return {
    x: Math.max(
      PAGE_GUTTER,
      Math.min(viewportWidth - effectiveWidth - PAGE_GUTTER, left),
    ),
    y: Math.max(
      PAGE_GUTTER,
      Math.min(viewportHeight - effectiveHeight - PAGE_GUTTER, top),
    ),
  };
}
