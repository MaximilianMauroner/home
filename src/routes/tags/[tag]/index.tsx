import { component$ } from "@builder.io/qwik"
import { TagView, getTagInformation } from ".."
import { DocumentHead, routeLoader$, useLocation } from "@builder.io/qwik-city";


export const useTagLoader = routeLoader$(async () => {
  return getTagInformation();
});

export default component$(() => {

  const selected = useLocation().params.tag
  const { tags, blogs, logs } = useTagLoader().value;
  return (
    <>
      <TagView tags={tags} blogs={blogs} logs={logs} preSelectedTag={selected} />
    </>
  );
})
export const head: DocumentHead = ({ resolveValue, params }) => {
  const tag = params.tag
  return {
    title: `<${tag}>`,
  };
};
