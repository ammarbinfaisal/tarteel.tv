import { listClips } from "@/lib/server/clips";

import ClipManager from "./ClipManager.client";

export const metadata = {
  title: "Clips",
};

export default async function ClipManagerPage() {
  const clips = await listClips({ includeArchived: true });

  return <ClipManager clips={clips} />;
}
