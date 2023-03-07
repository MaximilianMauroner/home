import { component$, Slot } from "@builder.io/qwik";

import Header from "../components/header/header";

export default component$(() => {
    return (
        <body
            class={
                "flex h-full min-h-screen flex-col justify-between dark:bg-indigo-500"
            }
        >
            <main>
                <Header />
                <section class={"mx-auto max-w-7xl px-2 sm:px-6 lg:px-8"}>
                    <Slot />
                </section>
            </main>
            <footer class={"bg-indigo-900 p-4 text-white"}>
                {/* contact me via email */}
                <a href="mailto:homepage@relay.mauroner.eu">
                    <span class="">Email</span>
                </a>
            </footer>
        </body>
    );
});
