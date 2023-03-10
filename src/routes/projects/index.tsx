import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import ProjectCard from "~/components/projects/project-card";
import { default as projects } from "~/data/projects.json";

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

const Projects = component$(() => {
    return (
        <div class={"mt-4"}>
            <div class={"my-4 flex flex-col space-y-4"}>
                {projects.map((project) => (
                    <ProjectCard project={project} />
                ))}
            </div>
        </div>
    );
});
export default Projects;
