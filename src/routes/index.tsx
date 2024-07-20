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
                <div class={"max-w-prose px-4 font-mono text-primary"}>
                    <span>
                        Hi, I'm Maximilian a <AgeCalculator /> year-old
                        developer. Currently studying software engineering at
                        the&nbsp;
                        <TechStackItem
                            href="https://tuwien.at/"
                            name="TU Wien"
                        />
                        .
                        <br />
                    </span>
                    <span class={"pt-3"}>
                        I'm working on multiple&nbsp;
                        <TechStackItem href="/projects" name="Projects" />. For
                        more info check the projects on&nbsp;
                        <TechStackItem
                            href="https://github.com/MaximilianMauroner"
                            name="GitHub"
                        />
                        &nbsp;or send me a message via&nbsp;
                        <TechStackItem
                            href="mailto:home@relay.mauroner.net"
                            name="Email"
                        />
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
        return (
            <>
                <Link
                    href={href}
                    target="_blank"
                    class={"inline-block"}
                    title={name}
                >
                    <span class="group animate-pan whitespace-nowrap bg-clip-text text-lg font-extrabold text-primary">
                        {name}
                        {/* animation also stolen and modified from https://ottomated.net/ */}
                        <span
                            style={{
                                "background-size": "200%",
                            }}
                            class={
                                "mx-auto  block h-0.5 w-0 animate-pan rounded-3xl bg-slate-500 group-hover:w-full group-hover:animate-pan-underline"
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
