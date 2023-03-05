import {
    component$,
    useBrowserVisibleTask$,
    useSignal,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import dayjs from "dayjs";

export default component$(() => {
    return (
        <>
            <AgeCalculator />
        </>
    );
});

const AgeCalculator = component$(() => {
    const birthday = new Date("2000-03-13 04:00:00");
    const age = useSignal(
        dayjs().diff(dayjs(birthday), "year", true).toString().substring(0, 12)
    );

    useBrowserVisibleTask$(() => {
        // copied from https://ottomated.net/
        const interval = setInterval(() => {
            age.value = dayjs()
                .diff(dayjs(birthday), "year", true)
                .toString()
                .substring(0, 12);
        }, 50);
        return () => clearInterval(interval);
    });

    return <>{age.value}</>;
});

export const head: DocumentHead = {
    title: "Maximilian Mauroner ",
    meta: [
        {
            name: "description",
            content: "Welcome to my Homepage - Maximilian Mauroner",
        },
    ],
};
