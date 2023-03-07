import { $, component$, useOn, useSignal } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

type Project = {
    name: string;
    contributors: string[];
    description: string;
    github: string;
    website: string;
    technologies: string[];
    images: { primary: string; secondary: string; tertiary: string };
    progress: number;
};
const projects: Project[] = [
    {
        name: "Danger Radar",
        contributors: ["Maximilian Mauroner"],
        description: "A web app to show the danger of a location",
        github: "https://github.com/MaximilianMauroner/danger-radar/",
        website: "https://danger-radar.mauroner.eu/",
        technologies: [
            "React",
            "TypeScript",
            "Leaflet",
            "Vercel",
            "Pusher",
            "Next-Auth",
            "tRPC",
            "Prisma",
        ],
        images: {
            primary: "/danger-radar-first.jpg",
            secondary: "/danger-radar-second.jpg",
            tertiary: "/danger-radar-third.jpg",
        },
        progress: 0.5,
    },
];
const ProjectList = component$(() => {
    return (
        <div class={"grid grid-flow-col grid-rows-4 gap-4"}>
            {projects.map((project) => (
                <SingleProject project={project} />
            ))}
        </div>
    );
});

const SingleProject = component$(({ project }: { project: Project }) => {
    return (
        <div class={"border-lg rounded-xl border bg-indigo-700"}>
            <main class="py-6 px-4 sm:p-6 md:py-10 md:px-8">
                <div class="mx-auto grid max-w-4xl grid-cols-1 lg:max-w-5xl lg:grid-cols-2 lg:gap-x-20">
                    <div class="relative col-start-1 row-start-1 flex flex-col-reverse rounded-lg bg-gradient-to-t from-black/75 via-black/0 p-3 sm:row-start-2 sm:bg-none sm:p-0 lg:row-start-1">
                        <Link
                            href={project.website}
                            title={project.name}
                            target="_blank"
                        >
                            <h1 class="mt-1 text-lg font-semibold text-white sm:text-slate-900 dark:sm:text-white md:text-2xl">
                                {project.name}
                            </h1>
                        </Link>
                        <p class="text-sm font-medium leading-4 text-white sm:text-slate-500 dark:sm:text-slate-400">
                            {project.contributors.join(", ")}
                        </p>
                    </div>
                    <div class="col-start-1 col-end-3 row-start-1 grid gap-4 sm:mb-6 sm:grid-cols-4 lg:col-start-2 lg:row-span-6 lg:row-end-6 lg:mb-0 lg:gap-6">
                        <ProjectImages project={project} />
                    </div>
                    <div class="row-start-2 mt-4 flex flex-col justify-center space-y-2 text-xs font-medium sm:row-start-3 sm:mt-1 md:mt-2.5 lg:row-start-2">
                        <span class="sr-only">Progress</span>
                        <div class="m-0 text-indigo-600 dark:text-indigo-400">
                            <span>{project.progress * 100}% complete</span>
                            <div class="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                                <div
                                    class="h-1.5 rounded-full bg-blue-600 dark:bg-blue-500"
                                    style={`width: ${project.progress * 100}%`}
                                ></div>
                            </div>
                        </div>
                        <span class="sr-only">Tech Stack</span>
                        <div class="flex items-center space-x-1 text-indigo-600 dark:text-indigo-400">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="1.5"
                                stroke="currentColor"
                                class="h-6 w-6"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3"
                                />
                            </svg>
                            <span>{project.technologies.join(", ")}</span>
                        </div>
                    </div>
                    <div class="col-start-1 row-start-3 mt-4 self-center sm:col-start-2 sm:row-span-2 sm:row-start-2 sm:mt-0 lg:col-start-1 lg:row-start-3 lg:row-end-4 lg:mt-6">
                        <Link
                            href={project.website}
                            title={"Website for " + project.name}
                            target="_blank"
                            class="inline-block rounded-lg bg-indigo-600 py-2 px-3 text-sm font-medium leading-6 text-white"
                        >
                            <div
                                class={
                                    "flex h-6 w-full items-center justify-between"
                                }
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    class={"mr-1 h-4 w-4"}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M6.115 5.19l.319 1.913A6 6 0 008.11 10.36L9.75 12l-.387.775c-.217.433-.132.956.21 1.298l1.348 1.348c.21.21.329.497.329.795v1.089c0 .426.24.815.622 1.006l.153.076c.433.217.956.132 1.298-.21l.723-.723a8.7 8.7 0 002.288-4.042 1.087 1.087 0 00-.358-1.099l-1.33-1.108c-.251-.21-.582-.299-.905-.245l-1.17.195a1.125 1.125 0 01-.98-.314l-.295-.295a1.125 1.125 0 010-1.591l.13-.132a1.125 1.125 0 011.3-.21l.603.302a.809.809 0 001.086-1.086L14.25 7.5l1.256-.837a4.5 4.5 0 001.528-1.732l.146-.292M6.115 5.19A9 9 0 1017.18 4.64M6.115 5.19A8.965 8.965 0 0112 3c1.929 0 3.716.607 5.18 1.64"
                                    />
                                </svg>
                                <span>Website</span>
                            </div>
                        </Link>

                        <Link
                            href={project.github}
                            title={"GitHub repository for " + project.name}
                            target="_blank"
                            class="ml-1 inline-block rounded-lg bg-indigo-600 py-2 px-3 text-sm font-medium leading-6 text-white"
                        >
                            <div class={"flex h-6 w-full items-center"}>
                                <img
                                    class={"mr-1 h-4 w-4"}
                                    src="/github-mark-white.svg"
                                    alt="GitHub"
                                />
                                <span>GitHub</span>
                            </div>
                        </Link>
                    </div>
                    <p class="col-start-1 mt-4 text-sm leading-6 dark:text-slate-400 sm:col-span-2 lg:col-span-1 lg:row-start-4 lg:mt-6">
                        {project.description}
                    </p>
                </div>
            </main>
        </div>
    );
});

const ProjectImages = component$(({ project }: { project: Project }) => {
    return (
        <>
            <SingleImage
                src={project.images.primary}
                alt=""
                imageClasses="h-60 w-full  object-cover sm:h-52"
                spacingClasses="rounded-lg sm:col-span-2 lg:col-span-full"
            />
            <SingleImage
                src={project.images.secondary}
                alt=""
                imageClasses="h-52 w-full  object-cover lg:h-32"
                spacingClasses="rounded-lg hidden sm:col-span-2 sm:block md:col-span-1 lg:col-span-2 lg:row-start-2 lg:h-32"
            />
            <SingleImage
                src={project.images.tertiary}
                alt=""
                imageClasses="h-52 w-full  object-cover lg:h-32"
                spacingClasses="rounded-lg hidden md:block lg:col-span-2 lg:row-start-2"
            />
        </>
    );
});

const SingleImage = component$(
    ({
        src,
        alt,
        imageClasses,
        spacingClasses,
    }: {
        src: string;
        alt: string;
        imageClasses: string;
        spacingClasses: string;
    }) => {
        const figureRef = useSignal<HTMLElement>();

        useOn(
            "mousemove",
            $((e: any) => {
                if (figureRef.value) {
                    const zoomer = figureRef.value;
                    const offsetX = e.offsetX ? e.offsetX : e.touches[0].pageX;
                    const offsetY = e.offsetY ? e.offsetY : e.touches[0].pageX;
                    const x = (offsetX / zoomer.offsetWidth) * 100;
                    const y = (offsetY / zoomer.offsetHeight) * 100;
                    zoomer.style.backgroundPosition = ` ${x}%  ${y}%`;
                }
            })
        );
        return (
            <div class={`${spacingClasses} overflow-hidden`}>
                <figure
                    ref={figureRef}
                    style={{
                        "background-image": `url(${src})`,
                    }}
                >
                    <img
                        src={src}
                        alt={alt}
                        class={`${imageClasses} bg-center hover:opacity-0`}
                        loading="lazy"
                    />
                </figure>
            </div>
        );
    }
);
export default ProjectList;
