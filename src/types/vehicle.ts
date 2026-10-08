export interface VehicleDocument {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  createdAt: string;
  source: 'ocr' | 'manual';
  extractedNotes?: string;
}

export interface VehicleRecord {
  id: string;
  patenteCamion: string;
  patenteRemolque: string;
  tipoEquipo: string;
  marca: string;
  color: string;
  fotoPrincipal: string;
  fotosAdicionales: string[];
  choferNombre: string;
  choferApellido: string;
  empresa: string;
  documentos: VehicleDocument[];
  creadoEn: string;
  actualizadoEn: string;
  origenRegistro: 'manual' | 'ocr';
}

export interface OCRDetectionResult {
  patenteCamion: string;
  patenteRemolque: string;
  empresa: string;
  choferNombre: string;
  choferApellido: string;
  tipoEquipo: string;
  marca: string;
  color: string;
  textoDetectado?: string;
}

export interface VehicleFilters {
  searchQuery: string;
  tipoEquipo: string;
  empresa: string;
  marca: string;
  color: string;
}

export interface BackupBundle {
  app: string;
  version: number;
  exportedAt: string;
  equipmentTypes: string[];
  vehicles: VehicleRecord[];
}
