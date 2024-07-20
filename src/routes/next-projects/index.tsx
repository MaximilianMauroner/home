import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";

export const head: DocumentHead = {
    title: "My Next Projects",
    meta: [
        {
            name: "description",
            content:
                "These are the Projects that I've either put on hold or are in the planning stage",
        },
    ],
};

const NextProjects = component$(() => {
    return <> Next Projects</>;
});
export default NextProjects;
