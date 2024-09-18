import {
  $,
  component$,
  type Signal,
  useSignal,
  useVisibleTask$,
} from "@builder.io/qwik";
import { type DocumentHead, Link } from "@builder.io/qwik-city";
import dayjs from "dayjs";

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const ogFirst = "maximilian";
const ogLast = "mauroner";

export default component$(() => {
  const firstname = useSignal(ogFirst);
  const lastname = useSignal(ogLast);

  const loadByName = $((name: Signal<string>, ogValue: string) => {
    let iteration = 0;
    name.value = name.value
      .split("")
      .map((_, index) => {
        if (index < iteration) {
          return ogValue[index];
        }
        return letters[Math.floor(Math.random() * 26)];
      })
      .join("");

    const unmask = () => {
      const interval = setInterval(() => {
        name.value = name.value
          .split("")
          .map((_, index) => {
            if (index < iteration) {
              return ogValue[index];
            }
            return letters[Math.floor(Math.random() * 26)];
          })
          .join("");

        if (iteration >= ogValue.length) {
          clearInterval(interval);
        }

        iteration += 1 / 3;
      }, 45);
    };
    setTimeout(unmask, 500);
  });
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    // effect inspired by https://kprverse.com/
    loadByName(firstname, ogFirst);
    loadByName(lastname, ogLast);
  });

  const downArrow = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="size-6"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15.75 17.25 12 21m0 0-3.75-3.75M12 21V3"
      />
    </svg>
  );
  const rightUpArrow = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="size-6"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
      />
    </svg>
  );
  return (
    <>
      <h1 class="invisible">
        {firstname.value} <br /> {lastname.value}
      </h1>
      <div class="my-10 grid w-full grid-flow-col grid-cols-5 grid-rows-2 items-center justify-center text-center font-mono text-5xl font-extrabold sm:text-7xl md:text-9xl">
        {firstname.value.split("").map((letter, index) => (
          <span key={index} class="relative text-center">
            <span>{letter}</span>
            {index % 2 === 0 ? (
              <div class="absolute -bottom-4 right-[47%]">{downArrow}</div>
            ) : index !== firstname.value.length - 1 ? (
              <div class="absolute right-0 top-0">{rightUpArrow}</div>
            ) : null}
          </span>
        ))}
      </div>
      <div class="my-10 grid w-full grid-flow-col grid-cols-4 grid-rows-2 items-center justify-center text-center font-mono text-5xl font-extrabold sm:text-7xl md:text-9xl">
        {lastname.value.split("").map((letter, index) => (
          <span key={index} class="relative text-center">
            <span>{letter}</span>
            {index % 2 === 0 ? (
              <div class="absolute -bottom-4 right-[47%]">{downArrow}</div>
            ) : index !== lastname.value.length - 1 ? (
              <div class="absolute right-0 top-0">{rightUpArrow}</div>
            ) : null}
          </span>
        ))}
      </div>
      <div class={"flex flex-col items-center justify-center py-4"}>
        <span class="sr-only">
          this page is intentionally ugly until it is done
        </span>
        <div class={"max-w-prose px-4 font-mono text-primary"}>
          <span>
            hi, i'm a <AgeCalculator /> year-old developer. currently studying
            software engineering at the&nbsp;
            <TechStackItem href="https://tuwien.at/" name="TU Wien" />
            .
            <br />
          </span>
          <span class={"pt-3"}>
            i'm usually working on multiple&nbsp;
            <TechStackItem href="/projects" name="Projects" />. for more info
            check them out on&nbsp;
            <TechStackItem
              href="https://github.com/MaximilianMauroner"
              name="GitHub"
            />
            &nbsp;or send me a message via&nbsp;
            <TechStackItem href="mailto:home@relay.mauroner.net" name="Email" />
          </span>
        </div>
      </div>
    </>
  );
});

const AgeCalculator = component$(() => {
  const birthday = new Date("2000-03-13 04:00:00");
  const age = useSignal(
    dayjs().diff(dayjs(birthday), "year", true).toString().substring(0, 12),
  );

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
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

const TechStackItem = component$(
  ({ name, href }: { name: string; href: string }) => {
    return (
      <>
        <Link
          href={href}
          target="_blank"
          rel="nofollow"
          class={"inline-block"}
          title={name}
        >
          <span class="animate-pan group whitespace-nowrap bg-clip-text text-lg font-extrabold text-primary">
            {name}
            {/* animation also stolen and modified from https://ottomated.net/ */}
            <span
              style={{
                "background-size": "200%",
              }}
              class={
                "animate-pan mx-auto block h-0.5 w-0 rounded-3xl bg-slate-500 group-hover:w-full group-hover:animate-pan-underline"
              }
            ></span>
          </span>
        </Link>
      </>
    );
  },
);
export const head: DocumentHead = {
  title: "Maximilian Mauroner",
  meta: [
    {
      name: "description",
      content: "Welcome to my Homepage",
    },
  ],
};
