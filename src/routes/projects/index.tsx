import { component$ } from "@builder.io/qwik";
import {
  type RequestHandler,
  routeLoader$,
  type DocumentHead,
} from "@builder.io/qwik-city";
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

const val = "https://api.github.com/repos/maximilianmauroner/home";

export const useGetProjectUpdate = routeLoader$(async () => {
  // This code runs only on the server, after every navigation
  const res = await fetch(val);
  const repo = await res.json();
  return repo.pushed_at as string | undefined;
});

const Projects = component$(() => {
  const signal = useGetProjectUpdate(); // Readonly<Signal<Product>>
  console.log(signal.value);

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
      {signal.value && <h2>{signal.value}</h2>}
      <div class={"my-4 flex flex-col space-y-4"}>
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </div>
  );
});
export default Projects;
