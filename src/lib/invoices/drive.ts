import "server-only";
import { readDriveMedia } from "./drive-media";

const tokenUrl = "https://oauth2.googleapis.com/token";
let token: { value: string; expires: number } | undefined;

async function accessToken() {
  if (token && token.expires > Date.now()) return token.value;
  const refresh = process.env.DRIVE_READER_REFRESH_TOKEN;
  const client = process.env.DRIVE_READER_CLIENT_ID;
  const secret = process.env.DRIVE_READER_CLIENT_SECRET;
  if (!refresh || !client || !secret) throw new Error("Drive reader unavailable");
  const response = await fetch(tokenUrl, {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh,
      client_id: client, client_secret: secret }),
  });
  if (!response.ok) throw new Error("Drive reader unavailable");
  const data = await response.json();
  if (typeof data.access_token !== "string" || !data.access_token) throw new Error("Drive reader unavailable");
  token = { value: data.access_token, expires: Date.now() + (Number(data.expires_in) - 60) * 1000 };
  return token.value;
}

export async function readDriveFile(id: string, metadataOnly: boolean, signal: AbortSignal) {
  return readDriveMedia(id, metadataOnly, signal, await accessToken());
}
