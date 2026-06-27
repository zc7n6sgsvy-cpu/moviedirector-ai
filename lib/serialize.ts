export function serializeDoc(doc: object) {
  const obj = (doc as { toObject?: () => Record<string, unknown> }).toObject?.() ?? (doc as Record<string, unknown>);
  const id = (obj as { _id?: { toString: () => string } })._id?.toString?.() ?? (obj as { id?: string }).id;
  const { _id, __v, ...rest } = obj as Record<string, unknown> & { _id?: unknown; __v?: unknown };
  return {
    ...rest,
    id,
    createdAt: formatDate((obj as { createdAt?: Date | string }).createdAt),
    updatedAt: formatDate((obj as { updatedAt?: Date | string }).updatedAt),
    publishedAt: formatDate((obj as { publishedAt?: Date | string }).publishedAt),
  };
}

function formatDate(value?: Date | string) {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function serializeFeedItem(item: object) {
  const record = item as Record<string, unknown>;
  const base = serializeDoc(record);
  return {
    ...base,
    creator: (record.creatorUsername as string) || (base as { creator?: string }).creator,
    creatorUsername: record.creatorUsername,
    creatorId: (record.creatorId as { toString?: () => string })?.toString?.() ?? record.creatorId,
    projectId: (record.projectId as { toString?: () => string })?.toString?.() ?? record.projectId,
    likeCount: (record.likeCount as number) ?? 0,
    commentCount: (record.commentCount as number) ?? 0,
    ratingAvg: (record.ratingAvg as number) ?? 0,
    ratingCount: (record.ratingCount as number) ?? 0,
  };
}