export function getPartPrefix(partNo: string): string {
  const seg = partNo.split('-')[0];
  return (seg || partNo.substring(0, 3)).toUpperCase();
}