import {
    component$,
    useBrowserVisibleTask$,
    useSignal,
} from "@builder.io/qwik";
import { DocumentHead, Link } from "@builder.io/qwik-city";
import dayjs from "dayjs";

export default component$(() => {
    return (
        <div class={"h-full min-h-screen dark:bg-indigo-500"}>
            <div class={"flex flex-col items-center justify-center"}>
                <AgeCalculator />
                <div>
                    <TechStackItem name="Test" href="Test" />
                </div>
            </div>
        </div>
    );
});

const AgeCalculator = component$(() => {
    const birthday = new Date("2000-03-13 04:00:00");
    const age = useSignal(
        dayjs().diff(dayjs(birthday), "year", true).toString().substring(0, 12)
    );

    useBrowserVisibleTask$(() => {
        // copied from https://ottomated.net/
        const interval = setInterval(() => {
            age.value = dayjs()
                .diff(dayjs(birthday), "year", true)
                .toString()
                .substring(0, 12);
        }, 50);
        return () => clearInterval(interval);
    });

    return (
        <>
            <span class={"font-mono dark:text-white"}>
                Hi, I'm Maximilian and <br /> I'm a {age.value} year-old
                developer. I'm currently studying software engineering at the{" "}
                <TechStackItem href="https://tuwien.at/" name="TU Wien" />
            </span>
        </>
    );
});

const TechStackItem = component$(
    ({ name, href }: { name: string; href: string }) => {
        const linearGradient = getLinearGradient();
        return (
            <Link href={href} class={"inline-block"}>
                <span
                    style={{
                        background: `linear-gradient( to right,${linearGradient.start},  ${linearGradient.middle}, ${linearGradient.end},${linearGradient.start})`,
                        "background-size": "200%",
                        "-webkit-background-clip": "text",
                        "-webkit-text-fill-color": "transparent",
                    }}
                    class="group animate-pan whitespace-nowrap bg-clip-text text-xl font-extrabold"
                >
                    {name}
                    {/* animation also stolen and modified from https://ottomated.net/ */}
                    <span
                        style={{
                            background: `linear-gradient( to right,${linearGradient.start},  ${linearGradient.middle}, ${linearGradient.end},${linearGradient.start})`,
                            "background-size": "200%",
                        }}
                        class={
                            "mx-auto block h-1 w-0 animate-pan rounded-3xl group-hover:w-full group-hover:animate-pan-underline"
                        }
                    ></span>
                </span>
            </Link>
        );
    }
);
export const head: DocumentHead = {
    title: "Maximilian Mauroner ",
    meta: [
        {
            name: "description",
            content: "Welcome to my Homepage - Maximilian Mauroner",
        },
    ],
};

const getLinearGradient = () => {
    const colors = [
        "#f87171",
        "#ef4444",
        "#dc2626",
        "#b91c1c",
        "#fb923c",
        "#f97316",
        "#ea580c",
        "#c2410c",
        "#fbbf24",
        "#f59e0b",
        "#d97706",
        "#b45309",
        "#facc15",
        "#eab308",
        "#ca8a04",
        "#a16207",
        "#a3e635",
        "#84cc16",
        "#65a30d",
        "#4d7c0f",
        "#4ade80",
        "#22c55e",
        "#16a34a",
        "#15803d",
        "#34d399",
        "#10b981",
        "#059669",
        "#047857",
        "#2dd4bf",
        "#14b8a6",
        "#0d9488",
        "#0f766e",
        "#22d3ee",
        "#06b6d4",
        "#0891b2",
        "#0e7490",
        "#38bdf8",
        "#0ea5e9",
        "#0284c7",
        "#0369a1",
        "#60a5fa",
        "#3b82f6",
        "#2563eb",
        "#1d4ed8",
        "#818cf8",
        "#6366f1",
        "#4f46e5",
        "#4338ca",
        "#a78bfa",
        "#8b5cf6",
        "#7c3aed",
        "#6d28d9",
        "#c084fc",
        "#a855f7",
        "#9333ea",
        "#7e22ce",
        "#e879f9",
        "#d946ef",
        "#c026d3",
        "#a21caf",
        "#f472b6",
        "#ec4899",
        "#db2777",
        "#be185d",
        "#fb7185",
        "#f43f5e",
        "#e11d48",
        "#be123c",
    ];
    const randomIndexes: number[] = [];
    while (randomIndexes.length < 3) {
        const randomIndex = Math.floor(Math.random() * colors.length);
        if (!randomIndexes.includes(randomIndex)) {
            randomIndexes.push(randomIndex);
        }
    }

    return {
        start: colors[randomIndexes[0]],
        middle: colors[randomIndexes[1]],
        end: colors[randomIndexes[2]],
    };
};
