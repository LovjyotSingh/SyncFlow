export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Only accept URLs that point at a Vercel Blob store, inside this page's folder. */
export function isPageBlob(url: string, pathname: string, docId: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".public.blob.vercel-storage.com") &&
      pathname.startsWith(`docs/${docId}/`) &&
      decodeURIComponent(parsed.pathname).slice(1) === pathname
    );
  } catch {
    return false;
  }
}

export type FileKind = "image" | "pdf" | "text" | "other";

export function fileKind(contentType: string, name: string): FileKind {
  if (contentType.startsWith("image/")) return "image";
  if (contentType === "application/pdf") return "pdf";
  if (
    contentType.startsWith("text/") ||
    /json|javascript|typescript|xml|yaml|toml|sql/.test(contentType) ||
    /\.(md|txt|csv|json|js|jsx|ts|tsx|py|java|c|cpp|h|go|rs|rb|php|css|html|sql|yml|yaml|toml|sh)$/i.test(name)
  ) {
    return "text";
  }
  return "other";
}
