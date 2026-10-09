const homepage = "https://www.mauroner.net/";

// One Person node shared by article and homepage schemas. The @id is a stable
// identifier for search engines; people follow the homepage link.
export const authorPerson = {
  "@type": "Person",
  "@id": `${homepage}#person`,
  name: "Maximilian Mauroner",
  url: homepage,
  sameAs: ["https://github.com/MaximilianMauroner"],
} as const;
