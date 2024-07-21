import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";

export const head: DocumentHead = {
    title: "My Next Projects",
    meta: [
        {
            name: "description",
            content:
                "Next proejcts are determined randomly so this page is not useful",
        },
    ],
};

const NextProjects = component$(() => {
    return (
        <>Next proejcts are determined randomly so this page is not useful</>
    );
});
export default NextProjects;
