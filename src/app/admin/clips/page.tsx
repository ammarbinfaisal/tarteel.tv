import { listClips } from "@/lib/server/clips";
import { requireAdminPageAuth } from "@/lib/server/admin-auth";

import AdminLogoutButton from "../AdminLogoutButton.client";
import ClipManager from "./ClipManager.client";

export const metadata = {
  title: "Clip Manager | Admin",
};

export default async function ClipManagerPage() {
  await requireAdminPageAuth("/admin/clips");

  const clips = await listClips({});

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4 flex justify-end">
        <AdminLogoutButton />
      </div>
      <ClipManager clips={clips} />
    </div>
  );
}
