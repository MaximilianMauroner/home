import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import ContentPreview from "../src/components/content/ContentPreview";

const classesOf = (props: Partial<Parameters<typeof ContentPreview>[0]>) => {
  const markup = renderToStaticMarkup(
    createElement(ContentPreview, {
      family: "blog",
      title: "A post",
      description: "About it",
      tags: ["ai"],
      releaseDate: new Date("2026-10-08T00:00:00Z"),
      href: "/blog/a-post/",
      entryId: "008-a-post",
      titleTransitionId: "a-post",
      ...props,
    }),
  );
  const className = markup.match(/^<article class="([^"]+)"/)?.[1] ?? "";
  return className.split(" ");
};

describe("content preview card", () => {
  test("keeps the blog and cover classes as separate tokens", () => {
    expect(classesOf({ imageUrl: "/cover.webp" })).toEqual(
      expect.arrayContaining(["content-preview--blog", "content-preview--cover"]),
    );
  });

  test("adds the cover class only to blog cards with an image", () => {
    expect(classesOf({})).not.toContain("content-preview--cover");
    expect(classesOf({ family: "snack", imageUrl: "/cover.webp" })).toEqual(
      expect.not.arrayContaining(["content-preview--cover"]),
    );
  });
});
