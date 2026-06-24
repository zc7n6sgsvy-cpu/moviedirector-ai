import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import FeedItem from '@/models/FeedItem';

export async function GET() {
  await dbConnect();
  const items = await FeedItem.find().sort({ publishedAt: -1 }).limit(50);
  return NextResponse.json(items);
}
