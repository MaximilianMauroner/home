export const getParticipantColors = (participantList: string[]) => {
    const colors = [
        { bg: "rgba(255, 99, 132, 0.5)", border: "rgba(255, 99, 132, 1)" },
        { bg: "rgba(54, 162, 235, 0.5)", border: "rgba(54, 162, 235, 1)" },
        { bg: "rgba(255, 206, 86, 0.5)", border: "rgba(255, 206, 86, 1)" },
        { bg: "rgba(75, 192, 192, 0.5)", border: "rgba(75, 192, 192, 1)" },
        { bg: "rgba(153, 102, 255, 0.5)", border: "rgba(153, 102, 255, 1)" },
        { bg: "rgba(255, 159, 64, 0.5)", border: "rgba(255, 159, 64, 1)" },
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
