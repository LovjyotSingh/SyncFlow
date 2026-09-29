export type FilePreviewKind = 'pdf' | 'text' | 'image' | 'download';

const TEXT_EXTENSION = /\.(txt|md|markdown|csv|json|log|xml|html|css|js|ts|tsx|jsx|yml|yaml)$/i;
const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp)$/i;

export function filePreviewKind(file: { name: string; mime: string }): FilePreviewKind {
  const mime = file.mime.split(';')[0].trim().toLowerCase();
  const name = file.name.toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if ((mime.startsWith('image/') && mime !== 'image/svg+xml') || IMAGE_EXTENSION.test(name)) return 'image';
  if (
    mime.startsWith('text/')
    || mime === 'application/json'
    || mime === 'application/xml'
    || TEXT_EXTENSION.test(name)
  ) return 'text';
  return 'download';
}
