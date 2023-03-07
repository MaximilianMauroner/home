import { component$ } from "@builder.io/qwik";

const Footer = component$(() => {
    return (
        <footer class={"bg-indigo-900 py-4 text-white"}>
            <div class={"mx-auto max-w-7xl px-2 sm:px-6 lg:px-8"}>
                <div class={"flex items-center justify-between"}>
                    <a href="mailto:homepage@relay.mauroner.eu">
                        <span class="">Email</span>
                    </a>
                </div>
            </div>
        </footer>
    );
});
export default Footer;
