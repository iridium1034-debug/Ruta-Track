import { BackupBundle, VehicleRecord } from '../types/vehicle';
import {
  normalizePatenteKey,
  renderSampleDocumentDataUrl,
  SAMPLE_OCR_PRESETS,
} from '../utils/imageUtils';
import truckVolvoCisterna from '../assets/images/truck_volvo_cisterna_1791477609848.jpg';
import truckScaniaBatea from '../assets/images/truck_scania_batea_1791477620060.jpg';
import truckMercedesRampla from '../assets/images/truck_mercedes_rampla_1791477632157.jpg';

const DB_NAME = 'RutaTrackLocalDB';
const DB_VERSION = 1;
const STORE_VEHICLES = 'vehicles';
const STORE_META = 'meta';

export const DEFAULT_EQUIPMENT_TYPES = ['Batea', 'Cisterna', 'Rampla'];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_VEHICLES)) {
        const store = db.createObjectStore(STORE_VEHICLES, { keyPath: 'id' });
        store.createIndex('patenteCamion', 'patenteCamion', { unique: false });
        store.createIndex('actualizadoEn', 'actualizadoEn', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createInitialSeedVehicles(): VehicleRecord[] {
  const now = new Date().toISOString();
  let sampleDocUrl = '';
  try {
    sampleDocUrl = renderSampleDocumentDataUrl(SAMPLE_OCR_PRESETS[0]);
  } catch {
    sampleDocUrl = '';
  }

  return [
    {
      id: 'veh-seed-1',
      patenteCamion: 'AB-CD-12',
      patenteRemolque: 'XY-45-67',
      tipoEquipo: 'Cisterna',
      marca: 'Volvo',
      color: 'Blanco',
      fotoPrincipal: truckVolvoCisterna,
      fotosAdicionales: [],
      choferNombre: 'Juan',
      choferApellido: 'Pérez',
      empresa: 'Transportes ABC',
      documentos: sampleDocUrl
        ? [
            {
              id: 'doc-seed-1',
              name: 'Guia_Despacho_AB-CD-12.jpg',
              mimeType: 'image/jpeg',
              dataUrl: sampleDocUrl,
              createdAt: now,
              source: 'ocr',
              extractedNotes:
                'Empresa: Transportes ABC | Chofer: Juan Pérez | Patente: AB-CD-12 | Remolque: XY-45-67 | Equipo: Cisterna | Marca: Volvo | Color: Blanco',
            },
          ]
        : [],
      creadoEn: now,
      actualizadoEn: now,
      origenRegistro: 'ocr',
    },
    {
      id: 'veh-seed-2',
      patenteCamion: 'BC-FG-89',
      patenteRemolque: 'TR-10-22',
      tipoEquipo: 'Batea',
      marca: 'Scania',
      color: 'Azul',
      fotoPrincipal: truckScaniaBatea,
      fotosAdicionales: [],
      choferNombre: 'Carlos',
      choferApellido: 'Gómez Rojas',
      empresa: 'Logística del Sur',
      documentos: [],
      creadoEn: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      actualizadoEn: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      origenRegistro: 'manual',
    },
    {
      id: 'veh-seed-3',
      patenteCamion: 'HJ-KL-34',
      patenteRemolque: 'RM-78-90',
      tipoEquipo: 'Rampla',
      marca: 'Mercedes-Benz',
      color: 'Plata',
      fotoPrincipal: truckMercedesRampla,
      fotosAdicionales: [],
      choferNombre: 'Andrés',
      choferApellido: 'Muñoz Silva',
      empresa: 'Transportes Cordillera',
      documentos: [],
      creadoEn: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
      actualizadoEn: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
      origenRegistro: 'manual',
    },
  ];
}

export async function initAndGetAllVehicles(): Promise<VehicleRecord[]> {
  const db = await openDatabase();

  // Check if seeded
  const isSeeded = await new Promise<boolean>((resolve) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get('seeded_v1');
    req.onsuccess = () => resolve(!!req.result?.value);
    req.onerror = () => resolve(false);
  });

  if (!isSeeded) {
    const seeds = createInitialSeedVehicles();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_VEHICLES, STORE_META], 'readwrite');
      const vStore = tx.objectStore(STORE_VEHICLES);
      for (const v of seeds) {
        vStore.put(v);
      }
      tx.objectStore(STORE_META).put({ key: 'seeded_v1', value: true });
      tx.objectStore(STORE_META).put({
        key: 'equipment_types',
        value: DEFAULT_EQUIPMENT_TYPES,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return getAllVehicles();
}

export async function getAllVehicles(): Promise<VehicleRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VEHICLES, 'readonly');
    const req = tx.objectStore(STORE_VEHICLES).getAll();
    req.onsuccess = () => {
      const list = (req.result as VehicleRecord[]) || [];
      list.sort(
        (a, b) =>
          new Date(b.actualizadoEn).getTime() - new Date(a.actualizadoEn).getTime()
      );
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveVehicleRecord(vehicle: VehicleRecord): Promise<VehicleRecord> {
  const db = await openDatabase();
  const updated: VehicleRecord = {
    ...vehicle,
    actualizadoEn: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_VEHICLES, 'readwrite');
    tx.objectStore(STORE_VEHICLES).put(updated);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Also ensure equipment type is registered in equipment_types
  if (updated.tipoEquipo) {
    await addEquipmentType(updated.tipoEquipo);
  }

  return updated;
}

export async function deleteVehicleRecord(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VEHICLES, 'readwrite');
    tx.objectStore(STORE_VEHICLES).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getEquipmentTypes(): Promise<string[]> {
  const db = await openDatabase();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get('equipment_types');
    req.onsuccess = () => {
      const stored: string[] = req.result?.value || DEFAULT_EQUIPMENT_TYPES;
      const merged = Array.from(new Set([...DEFAULT_EQUIPMENT_TYPES, ...stored]));
      resolve(merged);
    };
    req.onerror = () => resolve(DEFAULT_EQUIPMENT_TYPES);
  });
}

export async function addEquipmentType(newType: string): Promise<string[]> {
  const trimmed = newType.trim();
  if (!trimmed) return getEquipmentTypes();
  const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  const current = await getEquipmentTypes();
  const exists = current.some((t) => t.toLowerCase() === formatted.toLowerCase());
  if (exists) return current;

  const updated = [...current, formatted];
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key: 'equipment_types', value: updated });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return updated;
}

export async function removeCustomEquipmentType(typeToRemove: string): Promise<string[]> {
  if (DEFAULT_EQUIPMENT_TYPES.includes(typeToRemove)) {
    return getEquipmentTypes();
  }
  const current = await getEquipmentTypes();
  const updated = current.filter((t) => t !== typeToRemove);
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key: 'equipment_types', value: updated });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return updated;
}

export async function getSecurityPin(): Promise<string | null> {
  const db = await openDatabase();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get('security_pin');
    req.onsuccess = () => resolve(req.result?.value || null);
    req.onerror = () => resolve(null);
  });
}

export async function setSecurityPin(pin: string | null): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key: 'security_pin', value: pin });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Finds if any existing vehicle (excluding optional editingId) shares the same normalized patenteCamion
 */
export function findDuplicatePatente(
  vehicles: VehicleRecord[],
  patenteCamion: string,
  excludeVehicleId?: string
): VehicleRecord | undefined {
  const targetKey = normalizePatenteKey(patenteCamion);
  if (!targetKey) return undefined;
  return vehicles.find(
    (v) =>
      v.id !== excludeVehicleId &&
      normalizePatenteKey(v.patenteCamion) === targetKey
  );
}

/**
 * Creates a complete JSON backup including vehicles, drivers, companies, photos, and OCR documents
 */
export async function createBackupBundle(): Promise<BackupBundle> {
  const [vehicles, equipmentTypes] = await Promise.all([
    getAllVehicles(),
    getEquipmentTypes(),
  ]);

  return {
    app: 'Ruta Track - Control de Vehículos',
    version: 1,
    exportedAt: new Date().toISOString(),
    equipmentTypes,
    vehicles,
  };
}

/**
 * Restores or merges a BackupBundle into IndexedDB
 */
export async function restoreBackupBundle(
  bundle: BackupBundle,
  mode: 'merge' | 'replace'
): Promise<{ importedCount: number }> {
  if (!bundle || !Array.isArray(bundle.vehicles)) {
    throw new Error('El archivo no tiene un formato de copia de seguridad válido de Ruta Track.');
  }

  const db = await openDatabase();
  const existingTypes = await getEquipmentTypes();
  const mergedTypes = Array.from(
    new Set([
      ...DEFAULT_EQUIPMENT_TYPES,
      ...existingTypes,
      ...(Array.isArray(bundle.equipmentTypes) ? bundle.equipmentTypes : []),
    ])
  );

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_VEHICLES, STORE_META], 'readwrite');
    const vStore = tx.objectStore(STORE_VEHICLES);

    if (mode === 'replace') {
      vStore.clear();
    }

    for (const rawVeh of bundle.vehicles) {
      if (!rawVeh || !rawVeh.patenteCamion) continue;
      const cleanVeh: VehicleRecord = {
        id: rawVeh.id || `veh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        patenteCamion: String(rawVeh.patenteCamion).trim().toUpperCase(),
        patenteRemolque: String(rawVeh.patenteRemolque || '').trim().toUpperCase(),
        tipoEquipo: String(rawVeh.tipoEquipo || 'Cisterna').trim(),
        marca: String(rawVeh.marca || '').trim(),
        color: String(rawVeh.color || '').trim(),
        fotoPrincipal: String(rawVeh.fotoPrincipal || ''),
        fotosAdicionales: Array.isArray(rawVeh.fotosAdicionales) ? rawVeh.fotosAdicionales : [],
        choferNombre: String(rawVeh.choferNombre || '').trim(),
        choferApellido: String(rawVeh.choferApellido || '').trim(),
        empresa: String(rawVeh.empresa || '').trim(),
        documentos: Array.isArray(rawVeh.documentos) ? rawVeh.documentos : [],
        creadoEn: rawVeh.creadoEn || new Date().toISOString(),
        actualizadoEn: rawVeh.actualizadoEn || new Date().toISOString(),
        origenRegistro: rawVeh.origenRegistro === 'ocr' ? 'ocr' : 'manual',
      };
      vStore.put(cleanVeh);
    }

    tx.objectStore(STORE_META).put({
      key: 'equipment_types',
      value: mergedTypes,
    });
    tx.objectStore(STORE_META).put({
      key: 'last_backup_restored',
      value: new Date().toISOString(),
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return { importedCount: bundle.vehicles.length };
}

/**
 * Exports all vehicles to a UTF-8 BOM CSV file directly compatible with Microsoft Excel & Google Sheets
 */
export function generateVehiclesCSV(vehicles: VehicleRecord[]): string {
  const headers = [
    'Patente Camión',
    'Patente Remolque',
    'Tipo de Equipo',
    'Marca',
    'Color',
    'Nombre Chofer',
    'Apellido Chofer',
    'Chofer Completo',
    'Empresa',
    'Origen Registro',
    'Tiene Fotografía',
    'Documentos Adjuntos',
    'Fecha Actualización',
  ];

  const escapeCSV = (val: string | number) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = vehicles.map((v) => [
    escapeCSV(v.patenteCamion),
    escapeCSV(v.patenteRemolque || ''),
    escapeCSV(v.tipoEquipo),
    escapeCSV(v.marca),
    escapeCSV(v.color),
    escapeCSV(v.choferNombre),
    escapeCSV(v.choferApellido),
    escapeCSV(`${v.choferNombre} ${v.choferApellido}`.trim()),
    escapeCSV(v.empresa),
    escapeCSV(v.origenRegistro === 'ocr' ? 'OCR / IA' : 'Manual'),
    escapeCSV(v.fotoPrincipal ? 'Sí' : 'No'),
    escapeCSV((v.documentos || []).length),
    escapeCSV(new Date(v.actualizadoEn).toLocaleString('es-CL')),
  ]);

  // UTF-8 BOM (\uFEFF) ensures Excel opens Spanish accents cleanly
  return '\uFEFF' + [headers.map(escapeCSV).join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}
