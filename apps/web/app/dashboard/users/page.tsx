import { SectionPlaceholder } from "../_components/placeholder";
import { UsersIcon } from "@/app/_ui/icons";

export default function UsersPage() {
  return (
    <SectionPlaceholder
      title="Users"
      subtitle="Members, staff roles, and access."
      icon={<UsersIcon size={30} />}
      description="Search members, review their points and activity, and manage staff roles from here."
    />
  );
}
