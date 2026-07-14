export const getParticipantColors = (participantList: string[]) => {
  const colors = [
    { bg: "rgba(20, 184, 166, 0.52)", border: "rgba(13, 148, 136, 1)" },
    { bg: "rgba(59, 130, 246, 0.5)", border: "rgba(37, 99, 235, 1)" },
    { bg: "rgba(139, 92, 246, 0.5)", border: "rgba(124, 58, 237, 1)" },
    { bg: "rgba(245, 158, 11, 0.52)", border: "rgba(217, 119, 6, 1)" },
    { bg: "rgba(100, 116, 139, 0.52)", border: "rgba(71, 85, 105, 1)" },
    { bg: "rgba(34, 197, 94, 0.5)", border: "rgba(22, 163, 74, 1)" },
  ];

  return participantList.reduce(
    (acc, participant, index) => {
      acc[participant] = colors[index % colors.length];
      return acc;
    },
    {} as Record<string, { bg: string; border: string }>,
  );
};

// Add emoji regex pattern
export const EMOJI_PATTERN =
  /(?<!\d)[\p{Emoji_Presentation}\p{Emoji}\u{20E3}\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}](?!\d)/gu;
