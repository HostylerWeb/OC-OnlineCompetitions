import { Competition } from "@oc/api-db/models";
import type { PersonalisationCatalogueItem } from "@oc/types";

export async function buildPersonalisationCatalogueSnapshot(): Promise<PersonalisationCatalogueItem[]> {
  const now = new Date();
  const competitions = await Competition.find({
    status: "active",
    drawDate: { $gte: now },
    deletedAt: null,
  })
    .select("_id title category ticketPrice maxTickets ticketsSold endDate drawDate")
    .sort({ displayOrder: 1, drawDate: 1 })
    .limit(80)
    .lean();

  return competitions.map((c) => {
    const max = c.maxTickets ?? 0;
    const sold = c.ticketsSold ?? 0;
    const remainingPct =
      max > 0 ? Math.max(0, Math.min(100, Math.round(((max - sold) / max) * 100))) : 0;
    const endsAt = c.endDate ?? c.drawDate;
    return {
      id: String(c._id),
      title: c.title,
      category: c.category ?? undefined,
      ticketPrice: c.ticketPrice ?? 0,
      ticketsRemainingPct: remainingPct,
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
    };
  });
}
