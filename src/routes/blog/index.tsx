import { component$ } from "@builder.io/qwik";
import { DocumentHead } from "@builder.io/qwik-city";

export const head: DocumentHead = {
    title: "Blog",
    meta: [
        {
            name: "description",
            content:
                "This is my blog where I'll be posting my thoughts on various topics",
        },
    ],
};

const Blog = component$(() => {
    return <> Blog TBD</>;
});
export default Blog;
