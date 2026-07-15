// Shared placeholder for the scaffold's dashboard sections.
export function SectionPlaceholder({
  title,
  story,
}: {
  title: string;
  story?: string;
}) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-gray-500">
        Placeholder — not implemented yet (scaffold).
        {story ? ` See backlog ${story}.` : ""}
      </p>
    </section>
  );
}
