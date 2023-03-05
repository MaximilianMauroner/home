import { component$ } from "@builder.io/qwik";

type LinkType = {
    name: string;
    url: string;
};

const projects: LinkType[] = [
    {
        name: "Who am I",
        url: "/whoami",
    },
    {
        name: "Projects",
        url: "/projects",
    },
    { name: "Goals", url: "/goals" },
    { name: "Contact", url: "/contact" },
];
const Header = component$(() => {
    return (
        <header>
            <ul>
                {projects.map((project: LinkType) => (
                    <HeaderLinkItem project={project} />
                ))}
            </ul>
        </header>
    );
});

const HeaderLinkItem = component$(({ project }: { project: LinkType }) => {
    return (
        <>
            <li>
                <a href={project.url} target="_blank">
                    {project.name}
                </a>
            </li>
        </>
    );
});

export default Header;
