import { component$ } from "@builder.io/qwik";
import {
  type StaticGenerateHandler,
  type DocumentHead,
  routeLoader$,
  type RequestEvent,
} from "@builder.io/qwik-city";
import ProjectCard, { type Project } from "~/components/projects/project-card";
import { default as projects } from "~/data/projects.json";

export const useGetProjectData = routeLoader$(({ params }) => {
  return projects.find((project) => project.slug === params.slug);
});

export const onGet = async ({ redirect, params }: RequestEvent) => {
  const project = projects.find((project) => project.slug === params.slug);
  if (project === undefined) {
    throw redirect(302, "/404");
  }
};

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
    params: ids.map((slug) => {
      return { slug };
    }),
  };
};

export const head: DocumentHead = ({ resolveValue }) => {
  const project = resolveValue(useGetProjectData);
  if (!project) return {};
  return {
    title: `Project "${project.name}"`,
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
