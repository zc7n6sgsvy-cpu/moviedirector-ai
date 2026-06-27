export function isValidObjectId(id: string): boolean {
  if (!id || id.startsWith('demo-')) return false;
  return /^[a-f\d]{24}$/i.test(id);
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}