export async function readDriveMedia(id: string, metadataOnly: boolean, signal: AbortSignal, access: string, request = fetch) {
  if (!/^[A-Za-z0-9_-]{1,255}$/.test(id)) return null;
  const options: RequestInit = {
    headers: { Authorization: `Bearer ${access}` }, cache: "no-store",
    redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
  };
  async function get(query: string) {
    const response = await request(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&${query}`, options);
    if (response.status === 404 || response.status === 403) return null;
    if (!response.ok) throw new Error("Drive unavailable");
    return response;
  }
  const info = await get("fields=mimeType,trashed,capabilities(canDownload)");
  if (!info) return null;
  const metadata = await info.json();
  if (metadata.trashed || metadata.capabilities?.canDownload !== true) return null;
  if (metadataOnly) return new Response(null, { headers: { "Content-Type": metadata.mimeType } });
  return get("alt=media");
}
