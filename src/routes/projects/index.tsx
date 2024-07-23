import { component$ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import ProjectCard, { type Project } from "~/components/projects/project-card";
import { default as localProjects } from "~/data/projects.json";

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

export const useGetProjectUpdate = routeLoader$(async (requestEvent) => {
  const apiKey = requestEvent.env.get("GITHUB_TOKEN");

  const projects: Project[] = [];
  const promises = [];
  for (const project of localProjects) {
    promises.push(getLastPush(project.github, apiKey));
    projects.push({ ...project, lastUpdate: null });
  }

  const updates = await Promise.all(promises);

  for (let i = 0; i < projects.length; i++) {
    projects[i].lastUpdate = updates[i];
  }
  return projects;
});

const getLastPush = async (url: string, apiKey: string | undefined) => {
  // https://api.github.com/repos/MaximilianMauroner/tt-friend-dl
  // https://github.com/MaximilianMauroner/tt-friend-dl
  if (!apiKey) return null;

  const apiUrl = url.replace("github.com/", "api.github.com/repos/");

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: "Bearer " + apiKey,
      },
    });
    const repo = await res.json();

    if (repo?.pushed_at) {
      return repo.pushed_at;
    }
  } catch (e) {
    console.error(e);
  }

  return null;
};

const Projects = component$(() => {
  const projects = useGetProjectUpdate();

  if (import.meta.env.PROD) {
    projects.value.sort((a, b) => {
      if (a.lastUpdate && b.lastUpdate) {
        return b.lastUpdate.localeCompare(a.lastUpdate);
      } else if (a.images?.primary) {
        return -1.25;
      } else if (b.images?.primary) {
        return -0.75;
      }
      return a.progress > b.progress ? -1.5 : -0.5;
    });
  }

  return (
    <div class={"mt-4"}>
      <div class={"my-4 flex flex-col space-y-4"}>
        {projects.value.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </div>
  );
});
export default Projects;
