import { component$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import ImgAstronaut from "~/media/astronaut.avif?jsx";

function classs(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

const navigation = [
  {
    name: "Who am I",
    href: "/",
    current: true,
  },
  { name: "Blog", href: "/blog/", current: false },
  {
    name: "Projects",
    href: "/projects/",
    current: false,
  },
];

const socials = [
  {
    name: "GitHub",
    href: "https://github.com/MaximilianMauroner",
    icon: "/github-mark-white.svg",
  },
];

const Header = component$(() => {
  const navigate = useLocation();
  for (const navItem of navigation) {
    if (navItem.href === navigate.url.pathname) {
      navItem.current = true;
    } else {
      navItem.current = false;
    }
  }
  return (
    <header class="flex items-center justify-center bg-primary px-2 py-4 text-primary-foreground sm:px-6 md:justify-between">
      <nav class="flex items-center gap-2 sm:gap-6">
        <a href="/" class="flex items-center gap-2 font-medium">
          <div class={"h-6 w-8"}>
            <ImgAstronaut
              decoding="sync"
              srcset="/astronaut.avif"
              alt="Astronaut with laptop"
            />
            <span class="sr-only">Astronaut</span>
          </div>
        </a>
        {navigation.map((item) => (
          <a
            key={item.name}
            href={item.href}
            class={classs(
              item.current ? "border-2" : "",
              "my-auto block rounded-md border border-slate-500 px-3 py-2 text-sm font-medium",
            )}
            aria-current={item.current ? "page" : undefined}
          >
            {item.name}
          </a>
        ))}
      </nav>
      <div class="flex gap-4">
        {socials.map((item) => (
          <a
            href={item.href}
            title={item.name}
            target="_blank"
            key={item.name}
            class={
              "hidden items-center gap-2 text-sm font-medium underline-offset-4 hover:underline md:flex"
            }
          >
            <div class={"h-6 w-6"}>
              <img src={item.icon} alt={item.name} width={1000} height={1000} />
            </div>
          </a>
        ))}
      </div>
    </header>
  );
});

export default Header;
