import { component$ } from "@builder.io/qwik";

const Footer = component$(() => {
    return (
        <footer class="flex items-center justify-between bg-primary px-6 py-4 text-primary-foreground">
            <p class="text-sm">
                <a
                    href="mailto:home@relay.mauroner.net"
                    rel="nofollow"
                    class="font-medium underline-offset-4 hover:underline"
                >
                    <span class="">Email</span>
                </a>
            </p>
        </footer>
    );
});
export default Footer;
