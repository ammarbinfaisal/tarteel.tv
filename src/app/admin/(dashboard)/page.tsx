import Link from "next/link";
import { Film, Upload, BarChart3 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listClips } from "@/lib/server/clips";
import { getPageviewStats, getUniqueVisitors, parseDateRange } from "@/lib/server/analytics";

export const metadata = {
  title: "Dashboard",
};

export default async function AdminDashboardPage() {
  const todayRange = parseDateRange("today");

  const [clips, todayViews, todayUniques] = await Promise.all([
    listClips({ includeArchived: true }),
    getPageviewStats(todayRange).catch(() => 0),
    getUniqueVisitors(todayRange).catch(() => 0),
  ]);

  const activeClips = clips.filter((c) => !c.archivedAt);
  const archivedClips = clips.filter((c) => c.archivedAt);
  const telegramLinked = activeClips.filter((c) => c.telegram);
  const recentClips = [...clips]
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 5);

  const stats = [
    { label: "Total Clips", value: clips.length },
    { label: "Active", value: activeClips.length },
    { label: "Today's Views", value: todayViews },
    { label: "Unique Visitors", value: todayUniques },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of clips and traffic.</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value }) => (
          <Card key={label} className="border-border/60 bg-card/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent clips */}
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">Recent Clips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentClips.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clips yet.</p>
            ) : (
              recentClips.map((clip) => (
                <Link
                  key={clip.id}
                  href={`/admin/clips/clip/${encodeURIComponent(clip.id)}` as any}
                  className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-sm transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">
                      S{clip.surah}:{clip.ayahStart}-{clip.ayahEnd}
                    </span>
                    <span className="ml-2 text-muted-foreground">{clip.reciterName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {clip.telegram && (
                      <Badge variant="secondary" className="text-xs">TG</Badge>
                    )}
                    {clip.archivedAt && (
                      <Badge variant="destructive" className="text-xs">Archived</Badge>
                    )}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quick actions + stats */}
        <div className="space-y-4">
          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={"/admin/ingest" as any}>
                  <Upload className="mr-2 size-4" />
                  Ingest New Clip
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={"/admin/clips" as any}>
                  <Film className="mr-2 size-4" />
                  View All Clips
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={"/admin/analytics" as any}>
                  <BarChart3 className="mr-2 size-4" />
                  View Analytics
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="text-base">Clip Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Telegram linked</span>
                <span className="font-medium">{telegramLinked.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Needs review (no Telegram)</span>
                <span className="font-medium">{activeClips.length - telegramLinked.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Archived</span>
                <span className="font-medium">{archivedClips.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
