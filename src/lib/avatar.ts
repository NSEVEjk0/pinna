"use client";

/**
 * Avatars. A picture is shrunk in the browser before it is kept, so an address
 * book of faces stays small — it lives in this browser with everything else
 * and is never uploaded anywhere.
 */

export const AVATAR_SIZE = 96;

export interface AvatarImage {
  /** A data URL, already resized. */
  dataUrl: string;
  size: number;
}

/** Read a picked file and return a small square data URL. */
export async function fileToAvatar(file: File): Promise<AvatarImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file is not an image.");
  }
  const raw = await readAsDataUrl(file);
  const squared = await drawSquare(raw, AVATAR_SIZE);
  return { dataUrl: squared, size: squared.length };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The picture could not be read."));
    reader.readAsDataURL(file);
  });
}

/** Draw the image centre-cropped into a square, then encode it small. */
export function drawSquare(dataUrl: string, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("This browser cannot resize images."));
          return;
        }
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Could not resize the picture."));
      }
    };
    img.onerror = () => reject(new Error("That picture could not be opened."));
    img.src = dataUrl;
  });
}

/** Two letters to stand in for a name when there is no picture. */
export function initialsOf(nameOrAddress: string): string {
  const value = String(nameOrAddress ?? "").trim();
  if (!value) return "?";
  if (value.startsWith("0x")) return value.slice(2, 4).toUpperCase();
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** A stable colour per name, so the fallback avatar is recognisable. */
export function avatarHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}
