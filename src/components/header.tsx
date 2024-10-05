import { component$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import ImgAstronaut from "~/media/astronaut.avif?jsx";

function classs(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

const navigation = [
  {
    name: "who am i",
    href: "/",
    current: true,
  },
  { name: "blog", href: "/blog/", current: false },
  { name: "dev log", href: "/dev-log/", current: false },
  {
    name: "projects",
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
    <header class="sticky top-0 z-10 flex items-center justify-center bg-primary px-2 py-2 text-primary-foreground sm:px-6 md:justify-between">
      <nav class="flex w-full items-center justify-around gap-2 sm:justify-center sm:gap-6">
        <a href="/" class="flex items-center gap-2 font-medium">
          <div class={"my-auto flex h-20 w-20 items-center justify-center"}>
            <ImgAstronaut
              loading="eager"
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
              "my-auto hidden rounded-md border border-slate-500 px-3 py-2 text-center text-sm font-medium sm:block",
            )}
            aria-current={item.current ? "page" : undefined}
          >
            {item.name}
          </a>
        ))}
        <div class="grid grid-cols-2 gap-2">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              class={classs(
                item.current ? "border-2" : "",
                "my-auto block rounded-md border border-slate-500 px-3 py-2 text-center text-sm font-medium sm:hidden",
              )}
              aria-current={item.current ? "page" : undefined}
            >
              {item.name}
            </a>
          ))}
        </div>
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
