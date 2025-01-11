import type { HeadingType } from "@/utils/types";
import { useEffect, useRef, useState } from "react";

export default function TableOfContents({
  headingsArr,
}: {
  headingsArr: HeadingType[];
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [headings, setHeadings] = useState(headingsArr);

  const [currentHeading, setCurrentHeading] = useState(headings[0]?.slug ?? "");
  const [isHovered, setIsHovered] = useState(false);

  const handleScroll = () => {
    if (headings.length === 0) return null;

    const offset = 80 + 16 + 1;
    let activeHeading = "";

    if (window.scrollY === 0) {
      activeHeading = headings[0].slug;
    } else if (
      window.innerHeight + window.scrollY >=
      document.body.offsetHeight - 2
    ) {
      activeHeading = headings[headings.length - 1].slug;
    } else {
      for (let i = headings.length - 1; i >= 0; i--) {
        const heading = headings[i];
        const headingElement = document.querySelector(
          `[id^="${heading.slug}"]`,
        );
        if (headingElement) {
          if (headingElement.id !== heading.slug) {
            setHeadings((prev) =>
              prev.map((h, idx) =>
                idx === i ? { ...h, id: headingElement.id } : h,
              ),
            );
          }
          const top = headingElement.getBoundingClientRect().top - offset;
          if (top <= 0) {
            activeHeading = heading.slug;
            break;
          }
        }
      }
    }

    if (currentHeading !== activeHeading) {
      setCurrentHeading(activeHeading);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsHovered(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [headings, currentHeading]);

  useEffect(() => {
    handleScroll();
  });

  if (headings.length === 0) return null;

  return (
    <div
      className="fixed bottom-2 z-10 sm:left-2 sm:top-1/2 sm:-translate-y-1/2"
      ref={wrapperRef}
    >
      {!isHovered && (
        <div
          onMouseEnter={() => setIsHovered(true)}
          className="relative"
          onTouchStart={() => setIsHovered(true)}
        >
          <div className="absolute left-0 flex flex-col gap-3 rounded-lg border bg-white p-2 transition-opacity duration-300">
            {headings.map((heading, index) => (
              <div
                key={index}
                className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                  currentHeading === heading.slug
                    ? "bg-blue-500"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
        </div>
      )}
      <div
        onMouseLeave={() => setIsHovered(false)}
        className={`flex flex-col gap-4 rounded-lg border bg-white p-2 transition-all duration-300 ${
          isHovered
            ? "-translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-4 opacity-0"
        }`}
      >
        {headings.map((heading, index) => (
          <a
            key={index}
            href={`#${heading.slug}`}
            className={`relative text-sm font-semibold ${
              currentHeading === heading.slug
                ? "text-blue-500"
                : "text-muted-foreground"
            } block scroll-mt-20 text-left transition-colors hover:text-blue-400`}
          >
            {heading.depth > 1 && (
              <span
                className="absolute border-l-2 border-gray-200 dark:border-gray-700"
                style={{
                  height: "100%",
                  left: `${(heading.depth - 1) * 1.5 - 0.75}rem`,
                }}
              />
            )}
            <span
              style={{ marginLeft: `${(heading.depth - 1) * 1.5}rem` }}
              className="w-20 overflow-hidden text-ellipsis whitespace-nowrap md:w-48"
            >
              {heading.text}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
