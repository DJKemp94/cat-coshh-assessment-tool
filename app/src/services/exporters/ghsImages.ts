import { GhsPictogram } from '@/types/assessment';
import explosive from '@/assets/ghs/GHS-pictogram-explos.svg';
import flammable from '@/assets/ghs/GHS-pictogram-flamme.svg';
import oxidising from '@/assets/ghs/GHS-pictogram-rondflam.svg';
import compressedGas from '@/assets/ghs/GHS-pictogram-bottle.svg';
import corrosive from '@/assets/ghs/GHS-pictogram-acid.svg';
import toxic from '@/assets/ghs/GHS-pictogram-skull.svg';
import harmful from '@/assets/ghs/GHS-pictogram-exclam.svg';
import healthHazard from '@/assets/ghs/GHS-pictogram-silhouette.svg';
import environmental from '@/assets/ghs/GHS-pictogram-pollu.svg';

const GHS_URLS: Record<GhsPictogram, string> = {
  explosive,
  flammable,
  oxidising,
  'compressed-gas': compressedGas,
  corrosive,
  toxic,
  harmful,
  'health-hazard': healthHazard,
  environmental,
};

export const GHS_LABELS: Record<GhsPictogram, string> = {
  explosive: 'Explosive',
  flammable: 'Flammable',
  oxidising: 'Oxidising',
  'compressed-gas': 'Gas under pressure',
  corrosive: 'Corrosive',
  toxic: 'Acute toxicity',
  harmful: 'Harmful / irritant',
  'health-hazard': 'Health hazard',
  environmental: 'Hazardous to environment',
};

export interface RasterisedPictogram {
  id: GhsPictogram;
  label: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

const PIX = 192; // rasterised pictogram size — plenty for print

const cache = new Map<GhsPictogram, Promise<RasterisedPictogram>>();

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function rasterise(url: string): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = PIX;
        canvas.height = PIX;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2D context');
        ctx.clearRect(0, 0, PIX, PIX);
        ctx.drawImage(img, 0, 0, PIX, PIX);
        const dataUrl = canvas.toDataURL('image/png');
        resolve({ bytes: dataUrlToBytes(dataUrl), width: PIX, height: PIX });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

function loadPictogram(id: GhsPictogram): Promise<RasterisedPictogram> {
  let p = cache.get(id);
  if (!p) {
    p = rasterise(GHS_URLS[id]).then(({ bytes, width, height }) => ({
      id, label: GHS_LABELS[id], bytes, width, height,
    }));
    cache.set(id, p);
  }
  return p;
}

export async function loadPictograms(ids: GhsPictogram[]): Promise<RasterisedPictogram[]> {
  return Promise.all(ids.map(loadPictogram));
}
