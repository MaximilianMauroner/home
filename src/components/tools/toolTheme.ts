export const TOOL_THEME_CLASSES: Record<string, string> = {
  "ai-acceptability": "tool-theme-ai-acceptability",
  "ai-city-simulator": "tool-theme-ai-city",
  "colour-game": "tool-theme-colour",
  "microphone-tester": "tool-theme-microphone",
  leaveify: "tool-theme-leaveify",
  "pace-calculator": "tool-theme-pace",
  "readwise-tags-mapper": "tool-theme-readwise",
  "spotify-stats": "tool-theme-spotify",
  stretching: "tool-theme-stretching",
  "whatsapp-stats": "tool-theme-whatsapp",
};

export function getToolThemeClass(slug: string) {
  return TOOL_THEME_CLASSES[slug] ?? "";
}
