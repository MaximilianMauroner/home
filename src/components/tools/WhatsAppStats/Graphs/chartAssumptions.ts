export const CHART_ASSUMPTIONS = {
  activityByDay:
    "Counts every parsed message by local calendar day between the first and last message currently loaded. The optional moving average is trailing and includes zero-message days.",
  activityByHour:
    "Buckets every parsed message by the normalized local hour stored in the WhatsApp export. Media and deleted placeholders are included because this chart measures activity, not text content.",
  conversationInsights:
    "Uses the same normalized timestamps and conversation restart threshold as the other charts. Replies count only adjacent messages from different participants before a restart; normalized shares divide by each participant's active days.",
  conversationStarters:
    "Counts the first loaded message plus every message after a conversation restart. A restart is a gap over 4 hours, or over 1 hour when the date changes.",
  emojiUsage:
    "Counts emoji grapheme clusters in every parsed message, including messages that also contain text. The chart shows the top 30 emoji by total usage.",
  githubActivity:
    "Counts every parsed message by local calendar day across the full selected year. Color intensity is scaled to the busiest day in this year, so colors are comparable within the chart but not across different years.",
  mediaMessages:
    "Counts only WhatsApp export placeholder lines such as image, video, audio, document, sticker, GIF, contact, location, and '<Media omitted>'. Captions count separately as text when exported as text.",
  messagesPerPerson:
    "Counts every parsed message, including media and deleted placeholders. Tooltip messages per day are averaged across the loaded date span from first to last message.",
  responseTime:
    "Counts only adjacent messages from different participants inside the same conversation. A new conversation starts after a gap over 4 hours, or over 1 hour when the date changes.",
  runningAverage:
    "Averages the selected metric over trailing calendar-day windows. Days with no messages are included as zeroes, so dips represent real quiet periods in the loaded date range.",
  silentPeriods:
    "Counts gaps of at least 4 hours between consecutive messages. The reviver is the sender of the first message after the gap; the timeline shows the most recent 50 silent periods.",
  threadLength:
    "Splits threads at the shared conversation restart threshold: gaps over 4 hours, or over 1 hour when the date changes. Thread duration is measured from first to last message in each thread.",
  wordUsage:
    "Uses textual messages only. Emoji, punctuation, numbers, common words, and words shorter than four characters are removed before ranking the top 30 terms.",
  wordsPerPerson:
    "Counts only textual messages. Media, deleted messages, and emoji-only messages are excluded; emoji are removed before splitting remaining text on whitespace.",
} as const;
