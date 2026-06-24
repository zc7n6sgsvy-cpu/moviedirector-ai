import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Project from '@/models/Project';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

function getUserFromToken(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  try {
    const token = auth.replace('Bearer ', '');
    return jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  await dbConnect();
  const user = getUserFromToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projects = await Project.find({ userId: user.userId }).sort({ updatedAt: -1 });
  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  await dbConnect();
  const user = getUserFromToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const project = await Project.create({
    userId: user.userId,
    ...body,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return NextResponse.json(project);
}
