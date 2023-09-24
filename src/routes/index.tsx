import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { type DocumentHead, Link } from "@builder.io/qwik-city";
import dayjs from "dayjs";

export default component$(() => {
    return (
        <div>
            <h1 class="invisible h-0">Maximilian Mauroner</h1>
            <div class={"flex flex-col items-center justify-center py-4"}>
                <span class="sr-only">
                    This page is intentionally ugly until it is done
                </span>
                <div class={"max-w-prose px-4 font-mono dark:text-white"}>
                    <span>
                        Hi, I'm Maximilian a <AgeCalculator /> year-old
                        developer. Currently studying software engineering at
                        the&nbsp;
                        <TechStackItem
                            href="https://tuwien.at/"
                            name="TU Wien"
                        />
                        <br />
                    </span>
                    <span class={"pt-3"}>
                        And I'm working on&nbsp;
                        <TechStackItem
                            href="http://danger-radar.mauroner.eu/"
                            name="Danger Radar"
                        />
                        ,&nbsp;
                        <TechStackItem
                            href="https://github.com/MaximilianMauroner/kochbuchweb/"
                            name="Kochbuch"
                        />
                        ,&nbsp;
                        <TechStackItem
                            href="https://github.com/MaximilianMauroner/PersonalNotionManager/"
                            name="Personal Notion Manager"
                        />
                        ,&nbsp;
                        <TechStackItem
                            href="https://github.com/MaximilianMauroner/PersonalNotionManager/"
                            name="Audible Highlights Transcriber"
                        />
                        &nbsp;and&nbsp;
                        <TechStackItem
                            href="http://www.mauroner.eu/"
                            name="This Website"
                        />
                        . For more info check the projects on GitHub or send me
                        a message Twitter
                    </span>
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

    useVisibleTask$(() => {
        // copied from https://ottomated.net/
        const interval = setInterval(() => {
            age.value = dayjs()
                .diff(dayjs(birthday), "year", true)
                .toString()
                .substring(0, 12);
        }, 50);
        return () => clearInterval(interval);
    });

    return <>{age.value}</>;
});

const TechStackItem = component$(
    ({ name, href }: { name: string; href: string }) => {
        const linearGradient = getLinearGradient();

        return (
            <>
                <Link
                    href={href}
                    target="_blank"
                    class={"inline-block"}
                    title={name}
                >
                    <span
                        // style={{
                        //     background: `linear-gradient( to right,${linearGradient.start},  ${linearGradient.middle}, ${linearGradient.end},${linearGradient.start})`,
                        //     "background-size": "200%",
                        //     "-webkit-background-clip": "text",
                        //     "-webkit-text-fill-color": "transparent",
                        // }}
                        class="group animate-pan whitespace-nowrap bg-clip-text text-lg font-extrabold text-sky-500"
                    >
                        {name}
                        {/* animation also stolen and modified from https://ottomated.net/ */}
                        <span
                            style={{
                                background: `linear-gradient( to right,${linearGradient.start},  ${linearGradient.middle}, ${linearGradient.end},${linearGradient.start})`,
                                "background-size": "200%",
                            }}
                            class={
                                "mx-auto block h-0.5 w-0 animate-pan rounded-3xl group-hover:w-full group-hover:animate-pan-underline"
                            }
                        ></span>
                    </span>
                </Link>
            </>
        );
    }
);
export const head: DocumentHead = {
    title: "Maximilian Mauroner ",
    meta: [
        {
            name: "description",
            content:
                "Welcome to my Homepage, here is show of my blog(TBD) and projects",
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
