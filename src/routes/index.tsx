import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { Link } from "@builder.io/qwik-city";

export default component$(() => {
    return <></>;
});

export const head: DocumentHead = {
    title: "Maximilian Mauroner ",
    meta: [
        {
            name: "description",
            content: "Welcome to my Homepage - Maximilian Mauroner",
        },
    ],
};
