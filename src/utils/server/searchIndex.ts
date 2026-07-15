import { buildPostSearchDocuments } from "@/utils/searchIndex";
import { getAllArticles, getArticleUrl } from "@/utils/server/content";

export const getPostSearchDocuments = async () => {
  const articles = await getAllArticles();
  return buildPostSearchDocuments(
    articles.map((entry) => ({
      body: entry.body ?? "",
      collection: entry.collection,
      description: entry.data.description,
      id: entry.id,
      releaseDate: entry.data.releaseDate,
      tags: entry.data.tags,
      title: entry.data.title,
      url: getArticleUrl(entry),
    })),
  );
};
