import dbConnect from '@/lib/mongodb';
import GenerationJob from '@/models/GenerationJob';
import Project from '@/models/Project';
import { generateImage, generateVideo } from '@/lib/xai';
import { persistRemoteAsset } from '@/lib/storage';

export async function processGenerationJob(jobId: string) {
  await dbConnect();
  const job = await GenerationJob.findById(jobId);
  if (!job || job.status === 'done' || job.status === 'failed') return;

  job.status = 'processing';
  await job.save();

  const project = await Project.findById(job.projectId);
  if (!project) {
    job.status = 'failed';
    job.error = 'Project not found';
    await job.save();
    return;
  }

  const shots = (project.shots || []) as Array<Record<string, unknown>>;
  let completed = 0;

  for (const item of job.items) {
    if (item.status === 'done') {
      completed += 1;
      continue;
    }

    item.status = 'processing';
    await job.save();

    const shot = shots.find((s) => s.id === item.shotId);
    if (!shot) {
      item.status = 'failed';
      item.error = 'Shot not found';
      await job.save();
      continue;
    }

    try {
      if (job.mode === 'image') {
        const prompt = item.prompt || String(shot.description || '');
        const result = await generateImage(prompt);
        const stored = await persistRemoteAsset(result.url, `frames/${job.projectId}/${item.shotId}.jpg`);
        item.imageUrl = stored.url;
        shot.imageUrl = stored.url;
      } else {
        const prompt = item.prompt || String(shot.description || '');
        const referenceImageUrls = [
          (project.style as { referenceImageUrl?: string })?.referenceImageUrl,
          ...((project.characters as Array<{ referenceImageUrl?: string; id?: string }>) || [])
            .filter((c) => (shot.characterIds as string[] | undefined)?.includes(c.id || ''))
            .map((c) => c.referenceImageUrl)
            .filter(Boolean),
        ].filter(Boolean) as string[];

        const prevShot = shots
          .filter((s) => Number(s.number) < Number(shot.number) && s.videoUrl)
          .sort((a, b) => Number(b.number) - Number(a.number))[0];

        const result = await generateVideo({
          prompt,
          mode: prevShot?.videoUrl && !shot.imageUrl ? 'extend-video' : shot.imageUrl ? 'image-to-video' : referenceImageUrls.length ? 'reference-to-video' : 'text-to-video',
          imageUrl: shot.imageUrl as string | undefined,
          videoUrl: prevShot?.videoUrl as string | undefined,
          referenceImageUrls,
          duration: Number(shot.duration) || 8,
        });

        const stored = await persistRemoteAsset(result.url, `clips/${job.projectId}/${item.shotId}.mp4`);
        item.videoUrl = stored.url;
        shot.videoUrl = stored.url;
      }

      item.status = 'done';
      completed += 1;
      job.progress = Math.round((completed / job.items.length) * 100);
      project.shots = shots;
      project.markModified('shots');
      await project.save();
      await job.save();
    } catch (err) {
      item.status = 'failed';
      item.error = err instanceof Error ? err.message : 'Generation failed';
      await job.save();
    }
  }

  const failed = job.items.filter((i) => i.status === 'failed').length;
  const done = job.items.filter((i) => i.status === 'done').length;
  job.status = failed === job.items.length ? 'failed' : done === job.items.length ? 'done' : 'processing';
  job.progress = Math.round((done / job.items.length) * 100);
  if (failed > 0 && done === 0) job.error = 'All generations failed';
  await job.save();
}