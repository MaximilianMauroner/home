import { component$, useSignal } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
}

const navigation = [
    {
        name: "Who am I",
        href: "/",
        current: true,
    },
    {
        name: "Projects",
        href: "/projects/",
        current: false,
    },
    { name: "Next Projects", href: "/next-projects/", current: false },
];

const socials = [
    {
        name: "GitHub",
        href: "https://github.com/maximilianMauroner/",
        icon: "/github-mark-white.svg",
    },
    {
        name: "Twitter",
        href: "https://twitter.com/MaxiMauroner/",
        icon: "/twitter-blue.svg",
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

    const menuOpen = useSignal(false);
    return (
        <>
            <nav class="bg-indigo-900">
                <div class="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
                    <div class="relative flex h-16 items-center justify-between">
                        <div class="absolute inset-y-0 left-0 flex items-center sm:hidden">
                            {/* <!-- Mobile menu button--> */}
                            <button
                                type="button"
                                onClick$={() =>
                                    (menuOpen.value = !menuOpen.value)
                                }
                                class="inline-flex items-center justify-center rounded-md p-2 text-indigo-400 hover:bg-indigo-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                                aria-controls="mobile-menu"
                                aria-expanded="false"
                            >
                                <span class="sr-only">Open main menu</span>
                                {menuOpen.value ? (
                                    <svg
                                        class="h-6 w-6"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke-width="1.5"
                                        stroke="currentColor"
                                        aria-hidden="true"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                ) : (
                                    <svg
                                        class="block h-6 w-6"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke-width="1.5"
                                        stroke="currentColor"
                                        aria-hidden="true"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                                        />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <div class="hidden flex-1 items-center justify-center sm:flex sm:items-stretch sm:justify-start">
                            <div class="flex space-x-4">
                                {navigation.map((item) => (
                                    <a
                                        key={item.name}
                                        href={item.href}
                                        class={classNames(
                                            item.current
                                                ? "bg-indigo-900 text-white"
                                                : "text-indigo-300 hover:bg-indigo-700 hover:text-white",
                                            "rounded-md border border-slate-500 border-white px-3 py-2 text-sm font-medium"
                                        )}
                                        aria-current={
                                            item.current ? "page" : undefined
                                        }
                                    >
                                        {item.name}
                                    </a>
                                ))}
                            </div>
                        </div>
                        <div class="flex flex-1 items-center justify-center space-x-4 sm:items-stretch sm:justify-end">
                            {socials.map((item) => (
                                <Link
                                    href={item.href}
                                    title={item.name}
                                    target="_blank"
                                    key={item.name}
                                    class={"rounded-lg border border-white p-1"}
                                >
                                    <img
                                        class={"h-8 w-8"}
                                        src={item.icon}
                                        alt={item.name}
                                    />
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* <!-- Mobile menu, show/hide based on menu state. --> */}
                {menuOpen.value && (
                    <div class="sm:hidden" id="mobile-menu">
                        <div class="space-y-1 px-2 pt-2 pb-3">
                            {navigation.map((item) => (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    title={item.name}
                                    class={classNames(
                                        item.current
                                            ? "bg-indigo-900 text-white"
                                            : "text-indigo-300 hover:bg-indigo-700 hover:text-white",
                                        "block rounded-md px-3 py-2 text-base font-medium"
                                    )}
                                    aria-current={
                                        item.current ? "page" : undefined
                                    }
                                >
                                    {item.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </nav>
        </>
    );
});

export default Header;
