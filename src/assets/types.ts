/** Asset manifest entry types shared by the build script output and the loader (ENG-0205). */
export type AssetType = 'image' | 'sheet' | 'font' | 'json' | 'audio' | 'lut' | 'shader' | 'text';

export interface AssetEntry {
  type: AssetType;
  /** URL relative to the site base (content-hashed file name). */
  url: string;
  bytes: number;
  bundle: string;
  hash: string;
  /** Sprite sheets: hashed page image URLs, in page order. */
  pages?: string[];
  /** Fonts: CSS face descriptors. */
  font?: { family: string; style: string; weight: string };
  /** Images: pixel size. */
  w?: number;
  h?: number;
}
