import Project from '@/models/Project';
import { isValidObjectId } from '@/lib/ids';

export { isValidObjectId };

export async function verifyProjectAccess(userId: string, projectId: string) {
  if (!projectId) {
    return { ok: false as const, status: 400, error: 'projectId required' };
  }
  if (!isValidObjectId(projectId)) {
    return { ok: false as const, status: 400, error: 'Invalid projectId' };
  }
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) {
    return { ok: false as const, status: 404, error: 'Project not found' };
  }
  return { ok: true as const, project };
}