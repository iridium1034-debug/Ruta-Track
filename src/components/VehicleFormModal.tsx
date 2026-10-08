import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { VehicleDocument, VehicleRecord } from '../types/vehicle';
import {
  compressImageFile,
  fileToDataUrl,
  formatPatenteDisplay,
} from '../utils/imageUtils';
import { findDuplicatePatente } from '../db/localDb';
import { CameraCaptureModal } from './CameraCaptureModal';
import { DuplicatePatenteModal } from './DuplicatePatenteModal';

interface VehicleFormModalProps {
  isOpen: boolean;
  editingVehicle?: VehicleRecord | null;
  allVehicles: VehicleRecord[];
  equipmentTypes: string[];
  existingCompanies: string[];
  existingBrands: string[];
  existingColors: string[];
  onClose: () => void;
  onSave: (vehicle: VehicleRecord) => Promise<void>;
  onAddEquipmentType: (newType: string) => Promise<string[]>;
  onOpenExistingVehicle: (vehicle: VehicleRecord) => void;
}

const COMMON_BRANDS = [
  'Volvo',
  'Scania',
  'Mercedes-Benz',
  'Freightliner',
  'International',
  'Mack',
  'MAN',
  'Iveco',
  'Kenworth',
  'DAF',
];

const COMMON_COLORS = [
  'Blanco',
  'Azul',
  'Rojo',
  'Plata',
  'Gris',
  'Negro',
  'Amarillo',
  'Verde',
  'Naranja',
];

export const VehicleFormModal: React.FC<VehicleFormModalProps> = ({
  isOpen,
  editingVehicle,
  allVehicles,
  equipmentTypes,
  existingCompanies,
  existingBrands,
  existingColors,
  onClose,
  onSave,
  onAddEquipmentType,
  onOpenExistingVehicle,
}) => {
  const [patenteCamion, setPatenteCamion] = useState(
    editingVehicle?.patenteCamion || ''
  );
  const [patenteRemolque, setPatenteRemolque] = useState(
    editingVehicle?.patenteRemolque || ''
  );
  const [tipoEquipo, setTipoEquipo] = useState(
    editingVehicle?.tipoEquipo || equipmentTypes[0] || 'Cisterna'
  );
  const [marca, setMarca] = useState(editingVehicle?.marca || '');
  const [color, setColor] = useState(editingVehicle?.color || '');
  const [choferNombre, setChoferNombre] = useState(
    editingVehicle?.choferNombre || ''
  );
  const [choferApellido, setChoferApellido] = useState(
    editingVehicle?.choferApellido || ''
  );
  const [empresa, setEmpresa] = useState(editingVehicle?.empresa || '');
  const [fotoPrincipal, setFotoPrincipal] = useState(
    editingVehicle?.fotoPrincipal || ''
  );
  const [fotosAdicionales, setFotosAdicionales] = useState<string[]>(
    editingVehicle?.fotosAdicionales || []
  );
  const [documentos, setDocumentos] = useState<VehicleDocument[]>(
    editingVehicle?.documentos || []
  );

  // Adding a new equipment type inline
  const [isAddingType, setIsAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  // Camera & file refs
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  // Validation & Duplicate state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<VehicleRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPatenteCamion(editingVehicle?.patenteCamion || '');
    setPatenteRemolque(editingVehicle?.patenteRemolque || '');
    setTipoEquipo(
      editingVehicle?.tipoEquipo || equipmentTypes[0] || 'Cisterna'
    );
    setMarca(editingVehicle?.marca || '');
    setColor(editingVehicle?.color || '');
    setChoferNombre(editingVehicle?.choferNombre || '');
    setChoferApellido(editingVehicle?.choferApellido || '');
    setEmpresa(editingVehicle?.empresa || '');
    setFotoPrincipal(editingVehicle?.fotoPrincipal || '');
    setFotosAdicionales(editingVehicle?.fotosAdicionales || []);
    setDocumentos(editingVehicle?.documentos || []);
    setErrorMsg(null);
    setDuplicateMatch(null);
    setIsAddingType(false);
    setNewTypeName('');
  }, [isOpen, editingVehicle, equipmentTypes]);

  if (!isOpen) return null;

  const brandSuggestions = Array.from(
    new Set([...existingBrands, ...COMMON_BRANDS])
  ).filter(Boolean);
  const colorSuggestions = Array.from(
    new Set([...existingColors, ...COMMON_COLORS])
  ).filter(Boolean);

  const handleGalleryPhotoSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1280, 0.84);
      setFotoPrincipal(compressed);
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = '';
    }
  };

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const isImage = file.type.startsWith('image/');
      const dataUrl = isImage
        ? await compressImageFile(file, 1400, 0.85)
        : await fileToDataUrl(file);
      const newDoc: VehicleDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl,
        createdAt: new Date().toISOString(),
        source: 'manual',
      };
      setDocumentos((prev) => [...prev, newDoc]);
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmAddType = async () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    const updatedList = await onAddEquipmentType(trimmed);
    const formatted =
      trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    const matched =
      updatedList.find((t) => t.toLowerCase() === formatted.toLowerCase()) ||
      formatted;
    setTipoEquipo(matched);
    setNewTypeName('');
    setIsAddingType(false);
  };

  const buildRecord = (): VehicleRecord => {
    const now = new Date().toISOString();
    return {
      id:
        editingVehicle?.id ||
        `veh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      patenteCamion: formatPatenteDisplay(patenteCamion),
      patenteRemolque: patenteRemolque.trim()
        ? formatPatenteDisplay(patenteRemolque)
        : '',
      tipoEquipo: tipoEquipo.trim() || 'Cisterna',
      marca: marca.trim(),
      color: color.trim(),
      fotoPrincipal,
      fotosAdicionales,
      choferNombre: choferNombre.trim(),
      choferApellido: choferApellido.trim(),
      empresa: empresa.trim(),
      documentos,
      creadoEn: editingVehicle?.creadoEn || now,
      actualizadoEn: now,
      origenRegistro: editingVehicle?.origenRegistro || 'manual',
    };
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      const record = buildRecord();
      await onSave(record);
      setDuplicateMatch(null);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!patenteCamion.trim()) {
      setErrorMsg('La patente del camión es obligatoria.');
      return;
    }

    if (!tipoEquipo.trim()) {
      setErrorMsg('El tipo de equipo es obligatorio.');
      return;
    }

    // Check duplicate license plate
    const dup = findDuplicatePatente(
      allVehicles,
      patenteCamion,
      editingVehicle?.id
    );

    if (dup) {
      setDuplicateMatch(dup);
      return;
    }

    await executeSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 overflow-hidden">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 bg-[#041B3E] text-white px-4 h-14 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -ml-2 rounded-xl flex items-center justify-center text-slate-200 hover:bg-white/10 active:scale-95 transition"
            aria-label="Cerrar formulario"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-base font-extrabold tracking-tight truncate">
            {editingVehicle ? 'Editar Vehículo' : 'Nuevo Registro de Vehículo'}
          </h2>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="px-4 py-2 rounded-xl bg-[#00A8FF] hover:bg-sky-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition whitespace-nowrap"
        >
          <Check className="w-4 h-4 stroke-[2.5]" />
          {isSaving ? 'Guardando...' : 'Guardar'}
        </button>
      </header>

      {/* Scrollable Form Body */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto p-4 pb-28 max-w-2xl w-full mx-auto space-y-6"
      >
        {errorMsg && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs font-bold text-red-700">
            {errorMsg}
          </div>
        )}

        {/* 1. Fotografía del Camión */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">
              Fotografía del Camión
            </h3>
            {fotoPrincipal && (
              <button
                type="button"
                onClick={() => setFotoPrincipal('')}
                className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Quitar foto
              </button>
            )}
          </div>

          {fotoPrincipal ? (
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-[16/10] border border-slate-200">
              <img
                src={fotoPrincipal}
                alt="Vista previa del camión"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-7 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center mb-2">
                <Truck className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-700">
                Identificación visual del camión
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Toma una fotografía directa o selecciónala desde tu galería
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="min-h-[48px] rounded-xl bg-[#041B3E] hover:bg-[#082A5E] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-95 transition"
            >
              <Camera className="w-4 h-4 text-[#00A8FF]" />
              Tomar fotografía
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <ImageIcon className="w-4 h-4 text-sky-600" />
              Desde galería
            </button>
          </div>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleGalleryPhotoSelect}
            className="hidden"
          />
        </section>

        {/* 2. Información del Vehículo */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900">
            Información del Vehículo
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Patente del camión (Obligatorio) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Patente del camión <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={patenteCamion}
                onChange={(e) => setPatenteCamion(e.target.value.toUpperCase())}
                placeholder="Ej: AB-CD-12"
                className="w-full h-12 px-3.5 rounded-xl bg-amber-50/70 border-2 border-slate-800 font-mono-plate text-base font-extrabold uppercase tracking-wider text-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Patente del remolque (Opcional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Patente del remolque{' '}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={patenteRemolque}
                onChange={(e) =>
                  setPatenteRemolque(e.target.value.toUpperCase())
                }
                placeholder="Ej: XY-45-67"
                className="w-full h-12 px-3.5 rounded-xl bg-slate-50 border border-slate-300 font-mono-plate text-base font-bold uppercase tracking-wider text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Tipo de Equipo (Obligatorio + extensible) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Tipo de equipo <span className="text-red-600">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsAddingType((prev) => !prev)}
                className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar otro tipo
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {equipmentTypes.map((type) => {
                const active =
                  tipoEquipo.toLowerCase() === type.toLowerCase();
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTipoEquipo(type)}
                    className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition truncate ${
                      active
                        ? 'bg-[#041B3E] text-white border-[#041B3E] shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>

            {isAddingType && (
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Nuevo tipo (ej. Tolva, Cama Baja)"
                  className="flex-1 h-11 px-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={handleConfirmAddType}
                  className="h-11 px-4 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 transition whitespace-nowrap"
                >
                  Añadir
                </button>
              </div>
            )}
          </div>

          {/* Marca & Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Marca del camión
              </label>
              <input
                type="text"
                list="brand-suggestions"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Ej: Volvo, Scania, Mercedes-Benz"
                className="w-full h-12 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <datalist id="brand-suggestions">
                {brandSuggestions.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Color del camión
              </label>
              <input
                type="text"
                list="color-suggestions"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Ej: Blanco, Azul, Rojo"
                className="w-full h-12 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <datalist id="color-suggestions">
                {colorSuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
        </section>

        {/* 3. Información del Conductor y Empresa */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900">
            Conductor y Empresa
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nombre del chofer
              </label>
              <input
                type="text"
                value={choferNombre}
                onChange={(e) => setChoferNombre(e.target.value)}
                placeholder="Ej: Juan"
                className="w-full h-12 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Apellido del chofer
              </label>
              <input
                type="text"
                value={choferApellido}
                onChange={(e) => setChoferApellido(e.target.value)}
                placeholder="Ej: Pérez"
                className="w-full h-12 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Empresa para la que trabaja el chofer
            </label>
            <input
              type="text"
              list="company-suggestions"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Ej: Transportes ABC"
              className="w-full h-12 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <datalist id="company-suggestions">
              {existingCompanies.map((comp) => (
                <option key={comp} value={comp} />
              ))}
            </datalist>
          </div>
        </section>

        {/* 4. Documentos Adjuntos (opcional) */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Documentos Asociados ({documentos.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Guías, padrón, licencias o respaldos en foto/PDF
              </p>
            </div>
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              className="min-h-[40px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4 text-sky-600" />
              Adjuntar
            </button>
          </div>

          <input
            ref={docInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleDocumentSelect}
            className="hidden"
          />

          {documentos.length > 0 && (
            <div className="space-y-2 pt-1">
              {documentos.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {doc.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {doc.source === 'ocr' ? 'Documento original OCR' : 'Adjunto manual'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDocumentos((prev) => prev.filter((d) => d.id !== doc.id))
                    }
                    className="p-2 text-slate-400 hover:text-red-600"
                    title="Eliminar documento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </form>

      {/* Bottom Sticky Save CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe bg-white/95 backdrop-blur-md border-t border-slate-200 z-20">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="w-full min-h-[52px] rounded-2xl bg-[#041B3E] hover:bg-[#082A5E] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition"
          >
            <Check className="w-5 h-5 text-[#00A8FF]" />
            {isSaving
              ? 'GUARDANDO...'
              : editingVehicle
              ? 'GUARDAR CAMBIOS'
              : 'GUARDAR REGISTRO'}
          </button>
        </div>
      </div>

      {/* Live Camera Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        title="Fotografía del Camión"
        onClose={() => setIsCameraOpen(false)}
        onCapture={(dataUrl) => setFotoPrincipal(dataUrl)}
      />

      {/* Duplicate Patente Warning Modal */}
      <DuplicatePatenteModal
        existingVehicle={duplicateMatch}
        onCancel={() => setDuplicateMatch(null)}
        onViewExisting={(veh) => {
          setDuplicateMatch(null);
          onClose();
          onOpenExistingVehicle(veh);
        }}
        onCreateAnyway={executeSave}
      />
    </div>
  );
};
