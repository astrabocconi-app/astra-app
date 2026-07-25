import { PageHeader } from "@/app/_ui/page-header";
import { NewsForm } from "../news-form";

export default function NewNewsPage() {
  return (
    <>
      <PageHeader title="New post" subtitle="Write an announcement for the app feed." />
      <NewsForm />
    </>
  );
}
