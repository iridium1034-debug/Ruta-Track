import { OCRDetectionResult } from '../types/vehicle';

/**
 * Normalizes a license plate for display (e.g. "ab cd 12" -> "AB-CD-12")
 */
export function formatPatenteDisplay(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const alnumOnly = cleaned.replace(/-/g, '');
  if (alnumOnly.length === 6 && !cleaned.includes('-')) {
    return `${alnumOnly.slice(0, 2)}-${alnumOnly.slice(2, 4)}-${alnumOnly.slice(4, 6)}`;
  }
  return cleaned;
}

/**
 * Strips all spaces, hyphens, and dots for tolerant license plate comparison
 */
export function normalizePatenteKey(raw: string): string {
  return (raw || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Normalizes any text for accent-insensitive and case-insensitive search
 */
export function normalizeSearchText(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Reads any File (image or PDF) as a base64 Data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses and resizes a camera/gallery image so it stores quickly in IndexedDB
 * and uploads fast to Gemini OCR.
 */
export async function compressImageFile(
  fileOrDataUrl: File | string,
  maxWidth = 1280,
  quality = 0.82
): Promise<string> {
  const srcDataUrl =
    typeof fileOrDataUrl === 'string' ? fileOrDataUrl : await fileToDataUrl(fileOrDataUrl);

  // If it's a PDF or non-image, return as-is
  if (srcDataUrl.startsWith('data:application/pdf')) {
    return srcDataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(srcDataUrl);
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(srcDataUrl);
    img.src = srcDataUrl;
  });
}

export interface SampleDocumentPreset {
  id: string;
  label: string;
  fileName: string;
  fields: OCRDetectionResult;
}

export const SAMPLE_OCR_PRESETS: SampleDocumentPreset[] = [
  {
    id: 'preset-1',
    label: 'Guía Transportes ABC — Juan Pérez (AB-CD-12 / Cisterna Volvo)',
    fileName: 'Guia_Despacho_AB-CD-12.jpg',
    fields: {
      empresa: 'Transportes ABC',
      choferNombre: 'Juan',
      choferApellido: 'Pérez',
      patenteCamion: 'AB-CD-12',
      patenteRemolque: 'XY-45-67',
      tipoEquipo: 'Cisterna',
      marca: 'Volvo',
      color: 'Blanco',
      textoDetectado:
        'Empresa: Transportes ABC | Chofer: Juan Pérez | Patente: AB-CD-12 | Remolque: XY-45-67 | Equipo: Cisterna | Marca: Volvo | Color: Blanco',
    },
  },
  {
    id: 'preset-2',
    label: 'Hoja de Ruta Minera Norte — Roberto Soto (KL-MN-88 / Batea Scania)',
    fileName: 'Control_Acceso_KL-MN-88.jpg',
    fields: {
      empresa: 'Logística Minera del Norte',
      choferNombre: 'Roberto',
      choferApellido: 'Soto Morales',
      patenteCamion: 'KL-MN-88',
      patenteRemolque: 'RT-90-14',
      tipoEquipo: 'Batea',
      marca: 'Scania',
      color: 'Azul',
      textoDetectado:
        'Empresa: Logística Minera del Norte | Chofer: Roberto Soto Morales | Patente: KL-MN-88 | Remolque: RT-90-14 | Equipo: Batea | Marca: Scania | Color: Azul',
    },
  },
  {
    id: 'preset-3',
    label: 'Manifiesto Carga Austral — Miguel Ángel Díaz (PR-ST-45 / Rampla Mercedes-Benz)',
    fileName: 'Manifiesto_PR-ST-45.jpg',
    fields: {
      empresa: 'Transportes Austral S.A.',
      choferNombre: 'Miguel Ángel',
      choferApellido: 'Díaz Vega',
      patenteCamion: 'PR-ST-45',
      patenteRemolque: 'ZN-33-21',
      tipoEquipo: 'Rampla',
      marca: 'Mercedes-Benz',
      color: 'Plata',
      textoDetectado:
        'Empresa: Transportes Austral S.A. | Chofer: Miguel Ángel Díaz Vega | Patente: PR-ST-45 | Remolque: ZN-33-21 | Equipo: Rampla | Marca: Mercedes-Benz | Color: Plata',
    },
  },
];

/**
 * Generates a realistic printed transport control document image on an HTML5 canvas
 * so users can test OCR digitization immediately or view sample original documents.
 */
export function renderSampleDocumentDataUrl(preset: SampleDocumentPreset): string {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Paper background
  ctx.fillStyle = '#FCFBF7';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle border
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, 820, 1080);

  // Header bar
  ctx.fillStyle = '#041B3E';
  ctx.fillRect(40, 40, 820, 115);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('FICHA DE CONTROL Y DESPACHO DE TRANSPORTE', 75, 95);
  ctx.fillStyle = '#38BDF8';
  ctx.font = '600 18px monospace';
  ctx.fillText(`FOLIO N° 004892  |  FECHA: ${new Date().toLocaleDateString('es-CL')}`, 75, 130);

  // Section 1
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('1. DATOS DE LA EMPRESA Y CONDUCTOR', 75, 220);

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(75, 235);
  ctx.lineTo(825, 235);
  ctx.stroke();

  const drawRow = (label: string, value: string, y: number, highlight = false) => {
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(label, 85, y);

    if (highlight) {
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(345, y - 30, 450, 44);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(345, y - 30, 450, 44);
    }

    ctx.fillStyle = '#0F172A';
    ctx.font = highlight ? 'bold 26px monospace' : 'bold 24px sans-serif';
    ctx.fillText(value, 360, y);
  };

  drawRow('Empresa:', preset.fields.empresa, 290);
  drawRow('Chofer:', `${preset.fields.choferNombre} ${preset.fields.choferApellido}`, 350);
  drawRow('Nombre:', preset.fields.choferNombre, 410);
  drawRow('Apellido:', preset.fields.choferApellido, 470);

  // Section 2
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('2. IDENTIFICACIÓN DEL VEHÍCULO Y EQUIPO', 75, 560);

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(75, 575);
  ctx.lineTo(825, 575);
  ctx.stroke();

  drawRow('Patente:', preset.fields.patenteCamion, 640, true);
  drawRow('Remolque:', preset.fields.patenteRemolque || 'N/A', 710, true);
  drawRow('Equipo:', preset.fields.tipoEquipo, 780);
  drawRow('Marca:', preset.fields.marca, 845);
  drawRow('Color:', preset.fields.color, 910);

  // Stamp box at bottom
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 3;
  ctx.strokeRect(520, 965, 290, 110);
  ctx.fillStyle = '#0284C7';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('CONTROL PORTERÍA', 565, 1005);
  ctx.font = '16px monospace';
  ctx.fillText('DOCUMENTO VERIFICADO', 562, 1035);
  ctx.fillText('RUTA TRACK LOGÍSTICA', 565, 1060);

  return canvas.toDataURL('image/jpeg', 0.9);
}
