import { component$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import ImgAstronaut from "~/media/astronaut.avif?jsx";

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
  { name: "tags", href: "/tags/", current: false, defaultHidden: true },
];
type NavItemType = (typeof navigation)[number];

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
            <ImgAstronaut loading="eager" alt="Astronaut with laptop" />
            <span class="sr-only">Astronaut</span>
          </div>
        </a>

        {navigation.map((item) => (
          <NavItem key={item.name} item={item} isMobile={false} />
        ))}
        <div class="grid grid-cols-2 gap-2">
          {navigation.map((item) => (
            <NavItem key={item.name} item={item} isMobile={true} />
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

const NavItem = component$(
  ({ item, isMobile = false }: { item: NavItemType; isMobile?: boolean }) => {
    let mobileClass = " sm:block hidden";
    if (isMobile) {
      mobileClass = " block sm:hidden";
    }

    if (item.current) {
      return (
        <div class={"relative" + mobileClass}>
          {/* <div class="absolute inset-0 -translate-x-0.5 translate-y-0.5 rounded-lg bg-gradient-to-br from-pink-500 via-cyan-500 to-violet-500 blur"></div> */}
          <div class="rotating-border-animation absolute inset-0 -translate-x-0.5 translate-y-0.5 rounded-lg blur"></div>
          <div class="rotating-border-animation rounded-md !border-2">
            <a
              key={item.name}
              href={item.href}
              class={
                "relative my-auto rounded-md bg-black p-4 px-3 py-2 text-center text-sm font-medium" +
                mobileClass
              }
              aria-current={"page"}
            >
              {item.name}
            </a>
          </div>
        </div>
      );
    }
    if (item.defaultHidden) return;
    return (
      <a
        key={item.name}
        href={item.href}
        class={
          "my-auto rounded-md border border-slate-500 px-3 py-2 text-center text-sm font-medium" +
          mobileClass
        }
      >
        {item.name}
      </a>
    );
  },
);

export default Header;
