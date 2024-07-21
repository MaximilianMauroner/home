import { component$, Slot } from "@builder.io/qwik";
import Footer from "~/components/footer";

import Header from "../components/header";

export default component$(() => {
    return (
        <body class={"min-h-dvh flex flex-col"}>
            <Header />
            <main class="flex-1">
                <Slot />
            </main>
            <Footer />
        </body>
    );
});
