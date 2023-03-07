// src/routes/user/[username]/index.tsx
import { component$ } from "@builder.io/qwik";
import {
    type StaticGenerateHandler,
    type DocumentHead,
    routeLoader$,
} from "@builder.io/qwik-city";
import ProjectCard, { type Project } from "~/components/projects/project-card";
import { default as projects } from "~/data/projects.json";

export const useGetProjectData = routeLoader$(({ params }) => {
    return projects.find((project) => project.slug === params.slug);
});

export default component$(() => {
    const project = useGetProjectData().value;
    return (
        <div class={"mt-4"}>
            <div class={"my-4 flex flex-col space-y-4"}>
                <ProjectCard project={project as Project} />
            </div>
        </div>
    );
});

export const onStaticGenerate: StaticGenerateHandler = () => {
    const ids = projects.map((project) => project.slug);

    return {
        params: ids.map((id) => {
            return { id };
        }),
    };
};

export const head: DocumentHead = ({ resolveValue }) => {
    const project = resolveValue(useGetProjectData);
    if (!project) return {};
    return {
        title: `Project "${project?.name}"`,
        meta: [
            {
                name: "description",
                content: project.description,
            },
            {
                name: "slug",
                content: project.slug,
            },
        ],
    };
};
