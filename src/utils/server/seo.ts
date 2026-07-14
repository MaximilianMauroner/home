export function serializeJsonLd(value: object): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
