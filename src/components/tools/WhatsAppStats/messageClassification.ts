import { EMOJI_PATTERN } from "./Graphs/utils";

export const isMediaPlaceholder = (text: string): boolean => {
  const mediaPatterns = [
    /^(image|video|audio|document|sticker|gif|contact|location) omitted$/i,
    /^<Media omitted>$/i,
  ];

  return mediaPatterns.some((pattern) => pattern.test(text.trim()));
};

const isDeletedPlaceholder = (text: string): boolean => {
  const deletedPatterns = [
    /^this message was deleted\.?$/i,
    /^you deleted this message\.?$/i,
    /^message deleted\.?$/i,
  ];

  return deletedPatterns.some((pattern) => pattern.test(text.trim()));
};

export const isTextualMessage = (text: string): boolean => {
  if (isMediaPlaceholder(text) || isDeletedPlaceholder(text)) return false;
  return text.replace(EMOJI_PATTERN, "").trim().length > 0;
};
