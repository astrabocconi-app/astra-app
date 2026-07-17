import { SectionPlaceholder } from "../_components/placeholder";
import { BookIcon } from "@/app/_ui/icons";

export default function MaterialsPage() {
  return (
    <SectionPlaceholder
      title="Materials"
      subtitle="Shared resources for members."
      icon={<BookIcon size={30} />}
      description="Upload and organize study materials, guides, and documents shared with the community."
    />
  );
}
