import { component$, Slot } from "@builder.io/qwik";
import Footer from "~/components/footer";

import Header from "../components/header";

export default component$(() => {
    return (
        <body
            class={
                "flex h-full min-h-screen flex-col justify-between dark:bg-indigo-500"
            }
        >
            <main>
                <Header />
                <section
                    class={"mx-auto max-w-7xl px-2 text-white sm:px-6 lg:px-8"}
                >
                    <Slot />
                </section>
            </main>
            <Footer />
        </body>
    );
});
