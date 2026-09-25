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
  /** Art status (ART-0041): the demo build refuses `placeholder` in demo bundles. */
  status?: 'placeholder' | 'wip' | 'final';
  /** 9-slice margins in px: left, top, right, bottom (ART-0048). */
  nine?: [number, number, number, number];
  /** Pivot in 0..1 of the image (ART-0047: the wound centre for ailment sprites). */
  pivot?: [number, number];
  /** Embed direction in radians the art is drawn at, so `Embedded` entities rotate by `angle - angle0` (ART-0047). */
  angle0?: number;
  /** Backdrop layers (ART-0045): which `Backdrop` a layer belongs to, and its parallax factor (0 fixed … 1 camera speed). */
  layer?: string;
  parallax?: number;
}
