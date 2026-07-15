import { useEffect, useState } from "react";
import type { ContentFamily } from "./ContentPreview";

const progressStyles: Record<ContentFamily, string> = {
  blog: "from-orange-700 via-red-500 to-orange-400",
  log: "from-lime-400 via-emerald-500 to-teal-600",
  snack: "from-amber-600 via-orange-500 to-yellow-400",
};

/**
 * Fixed scroll progress bar for article pages.
 */
export default function ReadingProgress({ family }: { family: ContentFamily }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, pct)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[70] h-1 bg-transparent"
    >
      <div
        className={`h-full origin-left bg-gradient-to-r transition-[width] duration-75 ease-out ${progressStyles[family]}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
