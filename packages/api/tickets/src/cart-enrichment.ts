import { Competition, type ICartItem } from "@oc/api-db/models";

export interface EnrichedCartItem {
  competitionId: string;
  competitionTitle: string;
  slug: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  answerIndex: number;
  imageUrl?: string;
  maxTicketsPerUser: number;
}

export async function enrichCartItems(
  items: ICartItem[],
  competitionCache?: Map<
    string,
    {
      _id: { toString(): string };
      title: string;
      slug: string;
      ticketPrice: number;
      originalPrice?: number;
      imageUrl?: string;
      prizeImageUrl?: string;
      maxTicketsPerUser?: number;
    }
  >
): Promise<EnrichedCartItem[]> {
  if (items.length === 0) return [];

  const competitionIds = items.map((item) => item.competitionId);
  const compById =
    competitionCache ??
    new Map(
      (
        await Competition.find({ _id: { $in: competitionIds } })
          .select(
            "_id title slug ticketPrice imageUrl prizeImageUrl maxTicketsPerUser originalPrice"
          )
          .lean()
      ).map((comp) => [comp._id.toString(), comp])
    );

  const enriched: EnrichedCartItem[] = [];

  for (const item of items) {
    const comp = compById.get(item.competitionId.toString());
    if (!comp) continue;

    enriched.push({
      competitionId: item.competitionId.toString(),
      competitionTitle: comp.title,
      slug: comp.slug,
      price: comp.ticketPrice,
      originalPrice: comp.originalPrice,
      quantity: item.quantity,
      answerIndex: item.answerIndex,
      imageUrl: comp.imageUrl ?? comp.prizeImageUrl,
      maxTicketsPerUser: comp.maxTicketsPerUser ?? item.maxTicketsPerUser,
    });
  }

  return enriched;
}
