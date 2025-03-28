import { useState, useEffect, useRef } from "react";

interface Technology {
  name: string;
  href: string;
}

interface Contributor {
  name: string;
  href: string;
}

interface ProjectImage {
  src: string;
  alt: string;
}

interface ProjectImages {
  primary?: ProjectImage;
  secondary?: ProjectImage;
  tertiary?: ProjectImage;
}

interface Project {
  name: string;
  slug: string;
  description: string;
  github?: string;
  website?: string;
  progress: number;
  contributors?: Contributor[];
  technologies?: Technology[];
  images?: ProjectImages;
}

interface ProjectsListProps {
  projects: Project[];
}

export default function ProjectsList({
  projects: initialProjects,
}: ProjectsListProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [currentFilter, setCurrentFilter] = useState("all");
  const [currentSort, setCurrentSort] = useState("progress");
  const [searchTerm, setSearchTerm] = useState("");
  const [noResults, setNoResults] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [focusedProject, setFocusedProject] = useState<string | null>(null);
  const projectsGridRef = useRef<HTMLDivElement>(null);

  // Filter projects based on current filter and search term
  useEffect(() => {
    const filteredProjects = initialProjects.filter((project) => {
      let passesFilter = false;
      const progress = project.progress;

      switch (currentFilter) {
        case "all":
          passesFilter = true;
          break;
        case "completed":
          passesFilter = progress >= 0.9;
          break;
        case "ongoing":
          passesFilter = progress >= 0.2 && progress < 0.9;
          break;
        case "early":
          passesFilter = progress < 0.2;
          break;
      }

      const passesSearch =
        searchTerm === "" ||
        project.name.toLowerCase().includes(searchTerm.toLowerCase());
      return passesFilter && passesSearch;
    });

    // Sort the filtered projects
    const sortedProjects = [...filteredProjects].sort((a, b) => {
      if (currentSort === "progress") {
        return b.progress - a.progress;
      } else if (currentSort === "name") {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    setProjects(sortedProjects);
    setNoResults(sortedProjects.length === 0);
  }, [initialProjects, currentFilter, currentSort, searchTerm]);

  const handleMouseMove = (
    e: React.MouseEvent<HTMLDivElement>,
    cardRef: HTMLDivElement,
  ) => {
    const inner = cardRef.querySelector(".project-inner") as HTMLElement;
    if (!inner) return;

    const rect = cardRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xRotation = ((y - rect.height / 2) / rect.height) * 8;
    const yRotation = ((x - rect.width / 2) / rect.width) * -8;

    inner.style.transform = `perspective(1000px) rotateX(${xRotation}deg) rotateY(${yRotation}deg) translateY(-5px)`;
  };

  const handleMouseOut = (cardRef: HTMLDivElement) => {
    const inner = cardRef.querySelector(".project-inner") as HTMLElement;
    if (inner) {
      inner.style.transform =
        "perspective(1000px) rotateX(0) rotateY(0) translateY(0)";
    }
  };

  // Add simpler space particles with reduced count
  useEffect(() => {
    const createSpaceParticles = () => {
      const container = document.querySelector(".space-container");
      if (!container) return;

      // Clear existing stars
      const existingStars = container.querySelectorAll(".space-star");
      existingStars.forEach((star) => star.remove());

      // Fewer stars for a cleaner look
      for (let i = 0; i < 20; i++) {
        const star = document.createElement("div");
        star.classList.add("space-star");

        const size = 1 + Math.floor(Math.random() * 3);
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;

        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.left = `${posX}%`;
        star.style.top = `${posY}%`;

        // Fewer square stars
        if (Math.random() > 0.85) {
          star.style.borderRadius = "0";
        }

        container.appendChild(star);
      }
    };

    createSpaceParticles();
    window.addEventListener("resize", createSpaceParticles);

    return () => {
      window.removeEventListener("resize", createSpaceParticles);
    };
  }, []);

  const handleCardClick = (slug: string) => {
    if (focusedProject === slug) {
      setFocusedProject(null);
    } else {
      setFocusedProject(slug);
    }
    setSelectedCard((prevSelected) => (prevSelected === slug ? null : slug));
  };

  // Function to generate random blinking lights
  const generateRandomBlinkingLights = (count: number) => {
    return Array.from({ length: count }, (_, i) => (
      <div
        key={`light-${i}`}
        className={`absolute h-1.5 w-1.5 rounded-full ${
          Math.random() > 0.5 ? "bg-green-500" : "bg-red-500"
        } animate-blink-${Math.floor(Math.random() * 5) + 1}`}
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 5}s`,
        }}
      />
    ));
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#07051a]">
      {/* Slightly less dark space background */}
      <div className="space-container absolute inset-0 z-0 bg-[#07051a]"></div>

      {/* Almost invisible structural elements */}
      <div className="z-1 pointer-events-none absolute inset-0">
        <div className="absolute left-8 top-0 h-screen w-1 bg-[#5d3fd3] opacity-5"></div>
        <div className="absolute right-8 top-0 h-screen w-1 bg-[#e83a99] opacity-5"></div>
      </div>

      <div className="container relative z-10 mx-auto px-4 py-6">
        {/* More subtle header */}
        <div className="relative mb-8">
          <div className="relative border border-[#c2a5ff] bg-[#0c0521] bg-opacity-80 p-5 shadow-[3px_3px_0px_0px_rgba(114,137,218,0.2)]">
            <h1 className="mb-2 font-mono text-2xl font-medium tracking-normal text-[#e2e8ff]">
              Space<span className="text-[#00d9ff] text-opacity-80">.</span>
              Projects
            </h1>

            {/* Subtle decorative element */}
            <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-[#ffdb4d] opacity-50"></div>
          </div>
        </div>

        {/* More subtle control panel */}
        <div className="mb-8">
          <div className="border border-[#c2a5ff] border-opacity-50 bg-[#1a1040] bg-opacity-70 p-3 shadow-[2px_2px_0px_0px_rgba(244,104,221,0.15)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Filter Section */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-[#0c0521] bg-opacity-80 px-2 py-0.5 text-xs text-[#c2a5ff] text-opacity-90">
                  Status
                </span>
                {["all", "completed", "ongoing", "early"].map((filter) => (
                  <button
                    key={filter}
                    className={`px-2 py-1 text-xs transition-all ${
                      currentFilter === filter
                        ? "bg-[#c2a5ff] bg-opacity-40 text-[#ffffff] shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)]"
                        : "border border-[#5d3fd3] border-opacity-30 bg-[#1a1040] bg-opacity-50 text-[#e2e8ff] text-opacity-80 hover:bg-[#301b6e] hover:bg-opacity-50"
                    }`}
                    onClick={() => setCurrentFilter(filter)}
                  >
                    {filter === "all"
                      ? "All"
                      : filter === "completed"
                        ? "Done"
                        : filter === "ongoing"
                          ? "WIP"
                          : "New"}
                  </button>
                ))}
              </div>

              {/* Sort Section */}
              <div className="flex items-center gap-2">
                <span className="bg-[#0c0521] bg-opacity-80 px-2 py-0.5 text-xs text-[#c2a5ff] text-opacity-90">
                  Sort
                </span>
                {["progress", "name"].map((sort) => (
                  <button
                    key={sort}
                    className={`px-2 py-1 text-xs transition-all ${
                      currentSort === sort
                        ? "bg-[#c2a5ff] bg-opacity-40 text-[#ffffff] shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)]"
                        : "border border-[#5d3fd3] border-opacity-30 bg-[#1a1040] bg-opacity-50 text-[#e2e8ff] text-opacity-80 hover:bg-[#301b6e] hover:bg-opacity-50"
                    }`}
                    onClick={() => setCurrentSort(sort)}
                  >
                    {sort === "progress" ? "Progress" : "Name"}
                  </button>
                ))}
              </div>

              {/* Search Section */}
              <div className="relative ml-auto">
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full border border-[#c2a5ff] border-opacity-30 bg-[#0c0521] bg-opacity-60 px-3 py-1 text-xs text-[#e2e8ff] placeholder-[#5d3fd3] placeholder-opacity-50 focus:outline-none"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Project cards with toned-down styling */}
        <div className="projects-container">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.slug}
                className="relative cursor-pointer transition-transform hover:translate-y-[-3px]"
                onClick={() => handleCardClick(project.slug)}
              >
                {/* More subtle status badge */}
                <div
                  className={`absolute right-0 top-0 z-10 h-7 w-7 -translate-y-1 translate-x-1 transform ${
                    project.progress < 0.2
                      ? "bg-[#ff2d55] bg-opacity-70" // Mars red
                      : project.progress >= 0.9
                        ? "bg-[#36f1cd] bg-opacity-70" // Nebula teal
                        : "bg-[#ffdb4d] bg-opacity-70" // Saturn yellow
                  }`}
                >
                  <div className="flex h-full items-center justify-center text-xs text-[#0c0521]">
                    {Math.round(project.progress * 100)}%
                  </div>
                </div>

                <div
                  className={`border bg-[#13102a] bg-opacity-90 ${
                    project.progress < 0.2
                      ? "border-[#ff2d55] border-opacity-40 shadow-[2px_2px_0px_0px_rgba(255,45,85,0.15)]"
                      : project.progress >= 0.9
                        ? "border-[#36f1cd] border-opacity-40 shadow-[2px_2px_0px_0px_rgba(54,241,205,0.15)]"
                        : "border-[#ffdb4d] border-opacity-40 shadow-[2px_2px_0px_0px_rgba(255,219,77,0.15)]"
                  } p-4`}
                >
                  {/* Header */}
                  <div className="mb-3 border-b border-[#c2a5ff] border-opacity-30 pb-2">
                    <h3 className="text-base font-medium tracking-normal text-[#e2e8ff]">
                      {project.name}
                    </h3>
                  </div>

                  {/* Content */}
                  <div className="mb-4 text-xs leading-relaxed text-[#c2a5ff] text-opacity-90">
                    {project.description}
                  </div>

                  {/* Technologies with softer colors */}
                  <div className="mb-4">
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {project.technologies?.slice(0, 3).map((tech) => (
                        <span
                          key={tech.name}
                          className="bg-[#0c0521] bg-opacity-70 px-1.5 py-0.5 text-xs text-[#00d9ff] text-opacity-90"
                        >
                          {tech.name}
                        </span>
                      ))}
                      {project.technologies &&
                        project.technologies.length > 3 && (
                          <span className="bg-[#0c0521] bg-opacity-70 px-1.5 py-0.5 text-xs text-[#c2a5ff] text-opacity-80">
                            +{project.technologies.length - 3}
                          </span>
                        )}
                    </div>
                  </div>

                  {/* Links with softer styling */}
                  <div className="mt-auto flex gap-2">
                    {project.github && (
                      <a
                        href={project.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-[#5d3fd3] border-opacity-30 bg-[#1a1040] bg-opacity-50 px-2 py-1 text-xs text-[#e2e8ff] text-opacity-90 hover:bg-opacity-70"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Github
                      </a>
                    )}

                    {project.website && (
                      <a
                        href={project.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-[#c2a5ff] border-opacity-30 bg-[#4c0c40] bg-opacity-50 px-2 py-1 text-xs text-[#e2e8ff] text-opacity-90 hover:bg-opacity-70"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Website
                      </a>
                    )}

                    <a
                      href={`/projects/${project.slug}`}
                      className="ml-auto border border-[#c2a5ff] border-opacity-30 bg-[#0c0521] bg-opacity-70 px-2 py-1 text-xs text-[#e2e8ff] text-opacity-90 hover:bg-opacity-90"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Details
                    </a>
                  </div>

                  {/* Progress bar with even softer styling */}
                  <div className="absolute bottom-0 left-0 h-0.5 w-full bg-[#0c0521]">
                    <div
                      className={`h-full ${
                        project.progress < 0.2
                          ? "bg-[#ff2d55] bg-opacity-60"
                          : project.progress >= 0.9
                            ? "bg-[#36f1cd] bg-opacity-60"
                            : "bg-[#ffdb4d] bg-opacity-60"
                      }`}
                      style={{ width: `${project.progress * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* No results message with softer styling */}
          {noResults && (
            <div className="mx-auto my-10 max-w-md border border-[#c2a5ff] border-opacity-30 bg-[#0c0521] bg-opacity-80 p-5 text-center shadow-[2px_2px_0px_0px_rgba(255,45,85,0.15)]">
              <div className="mb-3">
                <div className="mx-auto h-8 w-8 bg-[#ff2d55] bg-opacity-60"></div>
              </div>
              <p className="text-base font-normal text-[#e2e8ff]">
                No Projects Found
              </p>
              <p className="mt-1 text-xs text-[#c2a5ff] text-opacity-80">
                Try different search parameters
              </p>
            </div>
          )}
        </div>

        {/* Very subtle footer */}
        <div className="mt-10 border-t border-[#c2a5ff] border-opacity-20 pt-3">
          <div className="flex items-center justify-end font-sans text-xs text-[#c2a5ff] text-opacity-50">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-[#c2a5ff] opacity-40"></div>
              <div className="h-2 w-2 bg-[#00d9ff] opacity-40"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Space stars with more subtle appearance */}
      <style>{`
        .space-container {
          overflow: hidden;
        }

        .space-star {
          position: absolute;
          background-color: white;
          border-radius: 50%;
          opacity: 0.4;
        }
        
        /* Color some stars with very subtle opacity */
        .space-star:nth-child(3n) {
          background-color: #00d9ff;
          opacity: 0.3;
        }
        
        .space-star:nth-child(4n) {
          background-color: #f468dd;
          opacity: 0.3;
        }
        
        .space-star:nth-child(5n) {
          background-color: #c2a5ff;
          opacity: 0.3;
        }
        
        .space-star:nth-child(6n) {
          background-color: #ffdb4d;
          opacity: 0.25;
        }
      `}</style>
    </div>
  );
}
