import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";

const birthday = dayjs("2000-03-13T04:00:00Z");

export default function AgeCalculator({ initialAge }: { initialAge: string }) {
  const [age, setAge] = useState(initialAge);
  const ageRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let nearViewport = true;
    let interval: number | undefined;
    const updateAge = () =>
      setAge(dayjs().diff(birthday, "year", true).toFixed(9));
    const stopUpdates = () => {
      window.clearInterval(interval);
      interval = undefined;
    };
    const syncUpdates = () => {
      if (document.hidden || !nearViewport) {
        stopUpdates();
      } else if (interval === undefined) {
        updateAge();
        interval = window.setInterval(updateAge, 50);
      }
    };

    // Resume before the text enters view when scrolling back to the profile.
    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver(
            ([entry]) => {
              nearViewport = entry.isIntersecting;
              syncUpdates();
            },
            { rootMargin: "200px" },
          );
    if (ageRef.current) observer?.observe(ageRef.current);
    document.addEventListener("visibilitychange", syncUpdates);
    syncUpdates();

    return () => {
      stopUpdates();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", syncUpdates);
    };
  }, []);

  return <span ref={ageRef}>{age}</span>;
}
