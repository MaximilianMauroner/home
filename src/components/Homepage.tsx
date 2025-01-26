import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import dayjs from "dayjs";
import type { BlogType, LogType } from "@/utils/server/content";

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";
const ogFirst = "maximilian";
const ogLast = "mauroner";

interface ContentItem {
  id: string;
  slug: string;
  collection: "blog" | "dev-log";
  data: {
    title: string;
    description: string;
    tags: string[];
    image: string;
    published: boolean;
    releaseDate: Date;
  };
}

interface LetterCardProps {
  letter: string;
  position: { x: number; y: number };
  onClose: () => void;
  blogs: ContentItem[];
  logs: ContentItem[];
  onPositionChange: (position: { x: number; y: number }) => void;
}

interface HomepageProps {
  blogs: BlogType[];
  logs: LogType[];
}

const LetterCard = ({
  letter,
  position,
  onClose,
  blogs,
  logs,
  onPositionChange,
}: LetterCardProps) => {
  const [content, setContent] = useState<ContentItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const allContent = [...blogs, ...logs];

    if (allContent.length > 0) {
      // Create a deterministic hash based on the letter
      const getHash = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
      };

      // Use just the letter for hashing to get a random but consistent selection
      const hash = getHash(letter);

      // Try to distribute items evenly by using the letter's position in the name
      // as an offset into different sections of the content
      const letterPosition = (ogFirst + ogLast).indexOf(letter.toLowerCase());
      const sectionSize = Math.ceil(
        allContent.length / (ogFirst + ogLast).length,
      );
      const sectionStart = (letterPosition * sectionSize) % allContent.length;

      // Use the hash to select within the section
      const sectionOffset =
        hash % Math.min(sectionSize, allContent.length - sectionStart);
      const selectedIndex = (sectionStart + sectionOffset) % allContent.length;

      setContent(allContent[selectedIndex]);
    } else {
      setContent(null);
    }
  }, [letter, blogs, logs]);

  const handleMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    });
  };

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (isDragging) {
        const newX = event.clientX - dragOffset.x;
        const newY = event.clientY - dragOffset.y;
        onPositionChange({ x: newX, y: newY });
      }
    },
    [isDragging, dragOffset, onPositionChange],
  );

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove]);

  if (!content) {
    return (
      <div
        className="fixed z-50 w-96 select-none rounded-lg border border-indigo-500/30 bg-black/95 p-4 text-center shadow-lg backdrop-blur-sm dark:border-indigo-500/30 dark:bg-black/95 dark:text-indigo-300"
        style={{
          top: `${position.y}px`,
          left: `${position.x + 40}px`,
        }}
        onMouseDown={handleMouseDown}
      >
        <p>No content found for letter: {letter}</p>
        <button
          onClick={onClose}
          className="mt-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed z-50 w-96 select-none rounded-lg border border-indigo-500/20 bg-white/95 p-4 text-indigo-700 shadow-lg backdrop-blur-sm dark:border-indigo-500/30 dark:bg-black/95 dark:text-indigo-300"
      style={{
        top: `${position.y}px`,
        left: `${position.x + 40}px`,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-center justify-between border-b border-indigo-500/30 p-2">
        <span className="text-sm text-indigo-300">
          Found in:{" "}
          <a
            href={content.slug.startsWith("blog") ? "/blog/" : "/dev-log/"}
            className="hover:text-indigo-200 hover:underline"
          >
            {content.slug.startsWith("blog") ? "blog" : "dev-log"}
          </a>
        </span>
        <button
          onClick={onClose}
          className="text-indigo-400 hover:text-indigo-200 dark:text-indigo-600 dark:hover:text-indigo-800"
        >
          ✕
        </button>
      </div>
      <div className="p-4">
        <h3 className="mb-2 text-lg font-bold text-indigo-200">
          {content.data.title}
        </h3>
        <p className="text-sm text-indigo-400">{content.data.description}</p>
        <a
          href={`/${content.slug}`}
          className="mt-4 block rounded border border-indigo-500/30 px-4 py-2 text-center text-sm text-indigo-300 transition-colors hover:bg-indigo-500/10"
        >
          Read More
        </a>
      </div>
    </div>
  );
};

const Homepage = ({ blogs, logs }: HomepageProps) => {
  const [firstname, setFirstname] = useState(ogFirst);
  const [lastname, setLastname] = useState(ogLast);
  const [activeCard, setActiveCard] = useState<{
    letter: string;
    position: { x: number; y: number };
  } | null>(null);
  const [showHint, setShowHint] = useState(true);

  // Transform the entries to match ContentItem format
  const transformedBlogs: ContentItem[] = blogs.map((blog) => ({
    ...blog,
    slug: `blog/${blog.id}`,
    collection: "blog",
  }));

  const transformedLogs: ContentItem[] = logs.map((log) => ({
    ...log,
    slug: `dev-log/${log.id}`,
    collection: "dev-log",
  }));

  const handleLetterClick = useCallback(
    (letter: string, event: React.MouseEvent) => {
      // Get click position for card placement
      const rect = event.currentTarget.getBoundingClientRect();

      setActiveCard((current) =>
        current?.letter === letter
          ? null
          : {
              letter,
              position: {
                x: rect.left,
                y: rect.top,
              },
            },
      );
    },
    [],
  );

  const loadByName = (
    setName: Dispatch<SetStateAction<string>>,
    ogValue: string,
  ) => {
    let iteration = 0;

    const stringRemap = (str: string, iteration: number) => {
      return str
        .split("")
        .map((_, index) => {
          if (index < iteration) {
            return ogValue[index];
          }
          return letters[Math.floor(Math.random() * letters.length)];
        })
        .join("");
    };

    const unmask = () => {
      const interval = setInterval(() => {
        setName((prev) => stringRemap(prev, Math.floor(iteration)));

        if (iteration >= ogValue.length) {
          clearInterval(interval);
          setName(ogValue); // Ensure final value is correct
        }

        iteration += 1 / 3;
      }, 45);
    };
    setTimeout(unmask, 50);
  };

  useEffect(() => {
    loadByName(setFirstname, ogFirst);
    loadByName(setLastname, ogLast);

    // Hide the hint after first interaction or after 10 seconds
    const timer = setTimeout(() => setShowHint(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  const downArrow = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="size-4 md:size-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25 12 21m0 0-3.75-3.75M12 21V3"
      />
    </svg>
  );

  const rightUpArrow = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="size-4 md:size-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
      />
    </svg>
  );

  const handlePositionChange = useCallback(
    (newPosition: { x: number; y: number }) => {
      setActiveCard((prev) =>
        prev ? { ...prev, position: newPosition } : null,
      );
    },
    [],
  );

  return (
    <div className="relative min-h-screen bg-transparent text-indigo-700 dark:text-indigo-300">
      {activeCard && (
        <LetterCard
          letter={activeCard.letter}
          position={activeCard.position}
          onClose={() => {
            setActiveCard(null);
            setShowHint(false);
          }}
          blogs={transformedBlogs}
          logs={transformedLogs}
          onPositionChange={handlePositionChange}
        />
      )}
      <div className="relative z-10 mx-auto max-w-7xl px-4">
        <div className="py-1">
          <div className="my-10 grid w-full grid-flow-col grid-cols-5 grid-rows-2 items-center justify-center gap-y-3 text-center font-mono text-4xl font-extrabold [text-shadow:_0_0_10px_#818cf8] sm:text-6xl md:text-8xl">
            {firstname.split("").map((letter, index) => (
              <span
                key={index}
                className="relative text-center transition-all hover:text-indigo-200"
              >
                <span
                  data-letter={letter}
                  onClick={(e) => {
                    handleLetterClick(letter, e);
                    setShowHint(false);
                  }}
                  className={`cursor-pointer transition-all hover:scale-110 hover:text-violet-300 ${
                    index === 0 && showHint
                      ? "relative before:absolute before:-inset-6 before:animate-wave-pulse-delayed before:rounded-full before:border before:border-violet-400/10 after:absolute after:-inset-3 after:animate-wave-pulse after:rounded-full after:border after:border-violet-400/20"
                      : ""
                  }`}
                >
                  {letter}
                </span>
                {index % 2 === 0 ? (
                  <div className="absolute -bottom-2 left-[50%] -translate-x-[50%] translate-y-[50%] text-indigo-600 md:-bottom-4">
                    {downArrow}
                  </div>
                ) : index !== firstname.length - 1 ? (
                  <div className="absolute right-0 top-0 text-indigo-600">
                    {rightUpArrow}
                  </div>
                ) : null}
              </span>
            ))}
          </div>
          <div className="my-10 grid w-full grid-flow-col grid-cols-4 grid-rows-2 items-center justify-center gap-y-3 text-center font-mono text-4xl font-extrabold [text-shadow:_0_0_10px_#818cf8] sm:text-6xl md:text-8xl">
            {lastname.split("").map((letter, index) => (
              <span
                key={index}
                className="relative text-center transition-all hover:text-indigo-200"
              >
                <span
                  data-letter={letter}
                  onClick={(e) => handleLetterClick(letter, e)}
                  className="cursor-pointer transition-all hover:scale-110 hover:text-violet-300"
                >
                  {letter}
                </span>
                {index % 2 === 0 ? (
                  <div className="absolute -bottom-2 left-[50%] -translate-x-[50%] translate-y-[50%] text-indigo-600 md:-bottom-4">
                    {downArrow}
                  </div>
                ) : index !== lastname.length - 1 ? (
                  <div className="absolute right-0 top-0 text-indigo-600">
                    {rightUpArrow}
                  </div>
                ) : null}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-8">
          <div className="relative max-w-prose rounded-lg border border-indigo-500/20 bg-white/70 p-6 font-mono text-indigo-700 shadow-[0_0_15px_rgba(99,102,241,0.1)] backdrop-blur-sm dark:border-indigo-500/30 dark:bg-black/70 dark:text-indigo-300 dark:shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <div className="absolute -top-3 left-4 bg-black px-2 text-sm text-indigo-400">
              <span className="text-violet-400">$</span> cat{" "}
              <span className="text-indigo-300">profile.txt</span>
            </div>
            <div className="block space-y-4">
              <p className="typing-animation relative">
                <span className="animate-terminal-blink absolute -left-3">
                  ▌
                </span>
                hi, i'm a <AgeCalculator /> year-old developer. currently
                studying software engineering at the&nbsp;
                <TechStackItem href="https://tuwien.at/" name="TU Wien" />.
              </p>
              <p className="typing-animation-delayed">
                i'm usually working on multiple&nbsp;
                <TechStackItem href="/tools" name="Tools" />. for more info
                check them out on&nbsp;
                <TechStackItem
                  href="https://github.com/MaximilianMauroner"
                  name="GitHub"
                />
                &nbsp;or send me a message via&nbsp;
                <TechStackItem
                  href="mailto:home@relay.mauroner.net"
                  name="Email"
                />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AgeCalculator = () => {
  const birthday = new Date("2000-03-13 04:00:00");

  const getDiff = (precision = 9) => {
    const now = dayjs();
    const birth = dayjs(birthday);
    const currentAge = now.diff(birth, "year", true).toFixed(precision);
    return currentAge;
  };
  const [age, setAge] = useState(getDiff(2) + "0000000");

  useEffect(() => {
    // Small delay for smoother transition
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setAge(getDiff());
      }, 50);

      return () => clearInterval(interval);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return <>{age}</>;
};

const TechStackItem = ({ name, href }: { name: string; href: string }) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow"
      className="inline-block"
      title={name}
    >
      <span className="group relative inline-block whitespace-nowrap font-bold text-violet-600 transition-colors hover:text-indigo-500 dark:text-violet-300 dark:hover:text-indigo-200">
        {name}
        <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-violet-700 via-indigo-500 to-purple-500 transition-all duration-300 group-hover:w-full"></span>
      </span>
    </a>
  );
};

export default Homepage;
