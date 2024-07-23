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
  if (process.env.NODE_ENV !== "development") {
    projects.sort((a, b) => {
      if (a.images?.primary && b.images?.primary) {
        return a.progress > b.progress ? -1 : 1;
      } else if (a.images?.primary) {
        return -1;
      } else if (b.images?.primary) {
        return 1;
      }
      return a.progress > b.progress ? -1.5 : 0.5;
    });
  }

  return (
    <div class={"mt-4"}>
      <div class={"my-4 flex flex-col space-y-4"}>
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </div>
  );
});
export default Projects;
