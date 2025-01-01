import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import dayjs from "dayjs";

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ogFirst = "maximilian";
const ogLast = "mauroner";

const Homepage = () => {
  const [firstname, setFirstname] = useState(ogFirst);
  const [lastname, setLastname] = useState(ogLast);

  const loadByName = (
    setName: Dispatch<SetStateAction<string>>,
    ogValue: string,
  ) => {
    let iteration = 0;

    const stringRemap = (str: string, iteration: number) => {
      return str
        .split("")
        .map((_, index) => {
          if (index < iteration) {
            return ogValue[index];
          }
          return letters[Math.floor(Math.random() * 26)];
        })
        .join("");
    };

    const unmask = () => {
      const interval = setInterval(() => {
        setName((prev) => stringRemap(prev, Math.floor(iteration)));

        if (iteration >= ogValue.length) {
          clearInterval(interval);
          setName(ogValue); // Ensure final value is correct
        }

        iteration += 1 / 3;
      }, 45);
    };
    setTimeout(unmask, 50);
  };

  useEffect(() => {
    loadByName(setFirstname, ogFirst);
    loadByName(setLastname, ogLast);
  }, []);

  const downArrow = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="size-4 md:size-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25 12 21m0 0-3.75-3.75M12 21V3"
      />
    </svg>
  );

  const rightUpArrow = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="size-4 md:size-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
      />
    </svg>
  );

  return (
    <>
      <h1 className="invisible">
        {firstname} <br /> {lastname}
      </h1>
      <div className="mx-auto max-w-7xl">
        <div className="my-10 grid w-full grid-flow-col grid-cols-5 grid-rows-2 items-center justify-center gap-y-3 text-center font-mono text-5xl font-extrabold sm:text-7xl md:text-9xl">
          {firstname.split("").map((letter, index) => (
            <span key={index} className="relative text-center">
              <span>{letter}</span>
              {index % 2 === 0 ? (
                <div className="absolute -bottom-2 left-[50%] -translate-x-[50%] translate-y-[50%] md:-bottom-4">
                  {downArrow}
                </div>
              ) : index !== firstname.length - 1 ? (
                <div className="absolute right-0 top-0">{rightUpArrow}</div>
              ) : null}
            </span>
          ))}
        </div>
        <div className="my-10 grid w-full grid-flow-col grid-cols-4 grid-rows-2 items-center justify-center gap-y-3 text-center font-mono text-5xl font-extrabold sm:text-7xl md:text-9xl">
          {lastname.split("").map((letter, index) => (
            <span key={index} className="relative text-center">
              <span>{letter}</span>
              {index % 2 === 0 ? (
                <div className="absolute -bottom-2 left-[50%] -translate-x-[50%] translate-y-[50%] md:-bottom-4">
                  {downArrow}
                </div>
              ) : index !== lastname.length - 1 ? (
                <div className="absolute right-0 top-0">{rightUpArrow}</div>
              ) : null}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-4">
        <span className="sr-only">
          this page is intentionally ugly until it is done
        </span>
        <div className="max-w-prose px-4 font-mono text-primary">
          <span>
            hi, i'm a <AgeCalculator /> year-old developer. currently studying
            software engineering at the&nbsp;
            <TechStackItem href="https://tuwien.at/" name="TU Wien" />
            .
            <br />
          </span>
          <span className="pt-3">
            i'm usually working on multiple&nbsp;
            <TechStackItem href="/tools" name="Tools" />. for more info check
            them out on&nbsp;
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
};

const AgeCalculator = () => {
  const birthday = new Date("2000-03-13 04:00:00");

  const getDiff = (precision = 9) => {
    const now = dayjs();
    const birth = dayjs(birthday);
    const currentAge = now.diff(birth, "year", true).toFixed(precision);
    return currentAge;
  };
  const [age, setAge] = useState(getDiff(2) + "0000000");

  useEffect(() => {
    // Small delay for smoother transition
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setAge(getDiff());
      }, 50);

      return () => clearInterval(interval);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return <>{age}</>;
};

const TechStackItem = ({ name, href }: { name: string; href: string }) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow"
      className="inline-block"
      title={name}
    >
      <span className="animate-pan group whitespace-nowrap bg-clip-text text-lg font-extrabold text-primary">
        {name}
        <span
          style={{
            backgroundSize: "200%",
          }}
          className="animate-pan mx-auto block h-0.5 w-0 rounded-3xl bg-slate-500 group-hover:w-full group-hover:animate-pan-underline"
        ></span>
      </span>
    </a>
  );
};

export default Homepage;
