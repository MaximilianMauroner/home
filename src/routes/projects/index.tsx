import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import ProjectList from "~/components/projects/project-llist";

const Projects = component$(() => {
    return (
        <div class={"mt-4"}>
            <ProjectList />
        </div>
    );
});
export default Projects;
export const head: DocumentHead = {
    title: "My Projects ",
    meta: [
        {
            name: "description",
            content:
                "These are the Projects that I'm currently working on, and the onese which are already done",
        },
    ],
};
