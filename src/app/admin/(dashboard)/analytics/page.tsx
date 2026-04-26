import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  parseDateRange,
  getPageviewStats,
  getUniqueVisitors,
  getTopClips,
  getTopReferrers,
  getDeviceBreakdown,
  getCountryBreakdown,
  getPageviewsTimeSeries,
  getUtmCampaigns,
} from "@/lib/server/analytics";

import AnalyticsRangeSelector from "./AnalyticsRangeSelector.client";
import PageHeader from "../_components/PageHeader";

export const metadata = {
  title: "Analytics",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const rangeKey = typeof params.range === "string" ? params.range : "7d";
  const range = parseDateRange(rangeKey);

  const [
    totalViews,
    uniqueVisitors,
    topClips,
    topReferrers,
    devices,
    countries,
    timeSeries,
    utmCampaigns,
  ] = await Promise.all([
    getPageviewStats(range),
    getUniqueVisitors(range),
    getTopClips(range),
    getTopReferrers(range),
    getDeviceBreakdown(range),
    getCountryBreakdown(range),
    getPageviewsTimeSeries(range, rangeKey === "today" ? "hour" : "day"),
    getUtmCampaigns(range),
  ]);

  const avgPerVisitor = uniqueVisitors > 0 ? (totalViews / uniqueVisitors).toFixed(1) : "0";
  const topCountry = countries[0]?.country ?? "—";
  const totalDeviceViews = devices.reduce((s, d) => s + d.views, 0);
  const maxTimeSeriesViews = Math.max(...timeSeries.map((t) => t.views), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Server-side traffic tracking."
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Analytics" }]}
        actions={<AnalyticsRangeSelector current={rangeKey} />}
      />

      {/* Headline metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Pageviews", value: totalViews.toLocaleString() },
          { label: "Unique Visitors", value: uniqueVisitors.toLocaleString() },
          { label: "Avg Views / Visitor", value: avgPerVisitor },
          { label: "Top Country", value: topCountry },
        ].map(({ label, value }) => (
          <Card key={label} className="border-border/60 bg-card/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Time series + top clips */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">Views Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {timeSeries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-1.5">
                {timeSeries.map((row) => (
                  <div key={row.bucket} className="flex items-center gap-3 text-xs">
                    <span className="w-28 shrink-0 text-muted-foreground">{row.bucket}</span>
                    <div className="flex-1">
                      <div
                        className="h-4 rounded-sm bg-primary/70"
                        style={{ width: `${Math.max((row.views / maxTimeSeriesViews) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-medium">{row.views}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">Top Clips</CardTitle>
          </CardHeader>
          <CardContent>
            {topClips.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clip views yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clip ID</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Uniques</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topClips.map((row) => (
                    <TableRow key={row.clipId}>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs">
                        {row.clipId}
                      </TableCell>
                      <TableCell className="text-right">{row.views}</TableCell>
                      <TableCell className="text-right">{row.uniques}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Devices + Referrers */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">Device Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {devices.map((d) => {
                  const pct = totalDeviceViews > 0 ? ((d.views / totalDeviceViews) * 100).toFixed(1) : "0";
                  return (
                    <div key={d.deviceType} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{d.deviceType ?? "Unknown"}</span>
                        <span className="text-muted-foreground">{pct}% ({d.views})</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">Top Referrers</CardTitle>
          </CardHeader>
          <CardContent>
            {topReferrers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No referrer data yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Uniques</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topReferrers.map((row) => (
                    <TableRow key={row.referrerDomain ?? "direct"}>
                      <TableCell>{row.referrerDomain ?? "Direct"}</TableCell>
                      <TableCell className="text-right">{row.views}</TableCell>
                      <TableCell className="text-right">{row.uniques}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Countries */}
      <Card className="border-border/60 bg-card/70">
        <CardHeader>
          <CardTitle className="text-base">Top Countries</CardTitle>
        </CardHeader>
        <CardContent>
          {countries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No geo data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Uniques</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countries.map((row) => (
                  <TableRow key={row.country ?? "unknown"}>
                    <TableCell>{row.country ?? "Unknown"}</TableCell>
                    <TableCell className="text-right">{row.views}</TableCell>
                    <TableCell className="text-right">{row.uniques}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* UTM Campaigns (only if data exists) */}
      {utmCampaigns.length > 0 && (
        <Card className="border-border/60 bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">UTM Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Medium</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Uniques</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {utmCampaigns.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.utmSource ?? "—"}</TableCell>
                    <TableCell>{row.utmMedium ?? "—"}</TableCell>
                    <TableCell>{row.utmCampaign ?? "—"}</TableCell>
                    <TableCell className="text-right">{row.views}</TableCell>
                    <TableCell className="text-right">{row.uniques}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
