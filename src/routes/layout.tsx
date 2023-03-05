import { component$, Slot } from "@builder.io/qwik";

import Header from "../components/header/header";

export default component$(() => {
    return (
        <>
            <main class={"h-full min-h-screen dark:bg-indigo-500"}>
                <Header />
                <section class={"mx-auto max-w-7xl px-2 sm:px-6 lg:px-8"}>
                    <Slot />
                </section>
            </main>
            <footer>
                {/* <a href="https://www.builder.io/" target="_blank">
                    Made with ♡ by Builder.io
                    <div>{serverTime.value.date}</div>
                </a> */}
            </footer>
        </>
    );
});
