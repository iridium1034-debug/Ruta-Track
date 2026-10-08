import React, { useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Truck,
  WifiOff,
  X,
} from 'lucide-react';
import {
  OCRDetectionResult,
  VehicleDocument,
  VehicleRecord,
} from '../types/vehicle';
import {
  compressImageFile,
  fileToDataUrl,
  formatPatenteDisplay,
  renderSampleDocumentDataUrl,
  SAMPLE_OCR_PRESETS,
  SampleDocumentPreset,
} from '../utils/imageUtils';
import { findDuplicatePatente } from '../db/localDb';
import { CameraCaptureModal } from './CameraCaptureModal';
import { DuplicatePatenteModal } from './DuplicatePatenteModal';

interface DocumentScannerModalProps {
  isOpen: boolean;
  isOnline: boolean;
  allVehicles: VehicleRecord[];
  equipmentTypes: string[];
  onClose: () => void;
  onSaveVehicle: (vehicle: VehicleRecord) => Promise<void>;
  onAddEquipmentType: (newType: string) => Promise<string[]>;
  onOpenExistingVehicle: (vehicle: VehicleRecord) => void;
}

export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({
  isOpen,
  isOnline,
  allVehicles,
  equipmentTypes,
  onClose,
  onSaveVehicle,
  onAddEquipmentType,
  onOpenExistingVehicle,
}) => {
  const [step, setStep] = useState<'select' | 'analyzing' | 'review'>('select');
  const [docDataUrl, setDocDataUrl] = useState('');
  const [docFileName, setDocFileName] = useState('');
  const [docMimeType, setDocMimeType] = useState('image/jpeg');
  const [keepOriginalDoc, setKeepOriginalDoc] = useState(true);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Extracted & editable fields in "Revisa los datos antes de guardar"
  const [patenteCamion, setPatenteCamion] = useState('');
  const [patenteRemolque, setPatenteRemolque] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [choferNombre, setChoferNombre] = useState('');
  const [choferApellido, setChoferApellido] = useState('');
  const [tipoEquipo, setTipoEquipo] = useState('Cisterna');
  const [marca, setMarca] = useState('');
  const [color, setColor] = useState('');
  const [textoDetectado, setTextoDetectado] = useState('');
  const [fotoCamion, setFotoCamion] = useState('');

  // Custom equipment type inline addition
  const [isAddingType, setIsAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  // Modals & refs
  const [isDocCameraOpen, setIsDocCameraOpen] = useState(false);
  const [isTruckCameraOpen, setIsTruckCameraOpen] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<VehicleRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const truckGalleryRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const resetScanner = () => {
    setStep('select');
    setDocDataUrl('');
    setDocFileName('');
    setOcrError(null);
    setPatenteCamion('');
    setPatenteRemolque('');
    setEmpresa('');
    setChoferNombre('');
    setChoferApellido('');
    setTipoEquipo(equipmentTypes[0] || 'Cisterna');
    setMarca('');
    setColor('');
    setTextoDetectado('');
    setFotoCamion('');
    setDuplicateMatch(null);
  };

  const applyDetectedFields = (fields: OCRDetectionResult) => {
    setPatenteCamion(fields.patenteCamion || '');
    setPatenteRemolque(fields.patenteRemolque || '');
    setEmpresa(fields.empresa || '');
    setChoferNombre(fields.choferNombre || '');
    setChoferApellido(fields.choferApellido || '');
    setTipoEquipo(fields.tipoEquipo || equipmentTypes[0] || 'Cisterna');
    setMarca(fields.marca || '');
    setColor(fields.color || '');
    setTextoDetectado(fields.textoDetectado || '');
  };

  const runGeminiOCR = async (
    dataUrl: string,
    mimeType: string,
    fileName: string,
    fallbackPreset?: OCRDetectionResult
  ) => {
    setDocDataUrl(dataUrl);
    setDocMimeType(mimeType);
    setDocFileName(fileName);
    setOcrError(null);
    setStep('analyzing');

    // If offline, gracefully inform and allow manual review or preset fallback
    if (!isOnline) {
      if (fallbackPreset) {
        applyDetectedFields(fallbackPreset);
      }
      setOcrError(
        'Modo sin conexión (Offline) activo: El análisis automático por IA en la nube requiere Internet. El documento original se ha adjuntado y puedes verificar o completar los campos abajo.'
      );
      setStep('review');
      return;
    }

    try {
      const response = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: dataUrl,
          mimeType,
          fileName,
          availableEquipmentTypes: equipmentTypes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudo analizar el documento.');
      }

      applyDetectedFields(result.data);
      setStep('review');
    } catch (err: unknown) {
      console.warn('Error en llamada OCR, usando respaldo:', err);
      if (fallbackPreset) {
        applyDetectedFields(fallbackPreset);
      } else {
        setOcrError(
          'No se pudo conectar con el motor OCR en este momento. Puedes revisar y completar los datos manualmente conservando el documento.'
        );
      }
      setStep('review');
    }
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1400, 0.86);
      await runGeminiOCR(compressed, 'image/jpeg', file.name);
    } finally {
      e.target.value = '';
    }
  };

  const handlePdfFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      await runGeminiOCR(dataUrl, 'application/pdf', file.name);
    } finally {
      e.target.value = '';
    }
  };

  const handleRunPresetSample = async (preset: SampleDocumentPreset) => {
    const renderedDataUrl = renderSampleDocumentDataUrl(preset);
    await runGeminiOCR(
      renderedDataUrl,
      'image/jpeg',
      preset.fileName,
      preset.fields
    );
  };

  const handleTruckGalleryPhoto = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1280, 0.84);
      setFotoCamion(compressed);
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmAddType = async () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    const updated = await onAddEquipmentType(trimmed);
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    const matched =
      updated.find((t) => t.toLowerCase() === formatted.toLowerCase()) ||
      formatted;
    setTipoEquipo(matched);
    setNewTypeName('');
    setIsAddingType(false);
  };

  const executeSaveRecord = async () => {
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const docs: VehicleDocument[] = [];
      if (keepOriginalDoc && docDataUrl) {
        docs.push({
          id: `doc-ocr-${Date.now()}`,
          name: docFileName || `Documento_OCR_${Date.now()}.jpg`,
          mimeType: docMimeType,
          dataUrl: docDataUrl,
          createdAt: now,
          source: 'ocr',
          extractedNotes: textoDetectado,
        });
      }

      const newVehicle: VehicleRecord = {
        id: `veh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        patenteCamion: formatPatenteDisplay(patenteCamion),
        patenteRemolque: patenteRemolque.trim()
          ? formatPatenteDisplay(patenteRemolque)
          : '',
        tipoEquipo: tipoEquipo.trim() || 'Cisterna',
        marca: marca.trim(),
        color: color.trim(),
        fotoPrincipal: fotoCamion,
        fotosAdicionales: [],
        choferNombre: choferNombre.trim(),
        choferApellido: choferApellido.trim(),
        empresa: empresa.trim(),
        documentos: docs,
        creadoEn: now,
        actualizadoEn: now,
        origenRegistro: 'ocr',
      };

      await onSaveVehicle(newVehicle);
      setDuplicateMatch(null);
      resetScanner();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcrError(null);

    if (!patenteCamion.trim()) {
      setOcrError('Por favor ingresa o confirma la Patente del camión antes de guardar.');
      return;
    }

    const dup = findDuplicatePatente(allVehicles, patenteCamion);
    if (dup) {
      setDuplicateMatch(dup);
      return;
    }

    await executeSaveRecord();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 overflow-hidden">
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-[#041B3E] text-white px-4 h-14 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              resetScanner();
              onClose();
            }}
            className="min-h-[44px] min-w-[44px] -ml-2 rounded-xl flex items-center justify-center text-slate-200 hover:bg-white/10 transition"
            aria-label="Cerrar digitalizador"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-base font-extrabold tracking-tight truncate">
            {step === 'review'
              ? 'Revisa los datos antes de guardar'
              : 'Digitalizar Documento (OCR/IA)'}
          </h2>
        </div>

        {step === 'review' && (
          <button
            type="button"
            onClick={resetScanner}
            className="text-xs font-bold text-sky-300 hover:text-white px-2.5 py-1.5 rounded-lg"
          >
            Escanear otro
          </button>
        )}
      </header>

      {/* STEP 1: SELECT SOURCE */}
      {step === 'select' && (
        <div className="flex-1 overflow-y-auto p-4 pb-16 max-w-xl w-full mx-auto space-y-5">
          {!isOnline && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-3">
              <WifiOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <p className="font-bold">Teléfono sin conexión a Internet</p>
                <p className="mt-0.5">
                  La extracción automática con IA requiere conexión. Aun así puedes
                  fotografiar o adjuntar el documento ahora y revisar los datos.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#041B3E] text-[#00A8FF] flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Extracción Automática de Datos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detecta Empresa, Chofer, Patente del camión, Remolque, Equipo,
                  Marca y Color desde cualquier documento.
                </p>
              </div>
            </div>

            {/* 3 Primary Capture Methods */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDocCameraOpen(true)}
                className="w-full min-h-[58px] px-4 rounded-2xl bg-[#041B3E] hover:bg-[#082A5E] text-white font-extrabold text-sm flex items-center justify-between shadow-md active:scale-[0.99] transition"
              >
                <span className="flex items-center gap-3">
                  <Camera className="w-5 h-5 text-[#00A8FF]" />
                  Tomar fotografía con la cámara
                </span>
                <span className="text-xs font-semibold text-sky-300">Cámara</span>
              </button>

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-full min-h-[56px] px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 font-bold text-sm flex items-center justify-between active:scale-[0.99] transition"
              >
                <span className="flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-sky-600" />
                  Seleccionar imagen de la galería
                </span>
                <span className="text-xs font-medium text-slate-500">JPG / PNG</span>
              </button>

              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="w-full min-h-[56px] px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 font-bold text-sm flex items-center justify-between active:scale-[0.99] transition"
              >
                <span className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-sky-600" />
                  Seleccionar un archivo PDF
                </span>
                <span className="text-xs font-medium text-slate-500">PDF</span>
              </button>
            </div>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileSelect}
              className="hidden"
            />
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              onChange={handlePdfFileSelect}
              className="hidden"
            />
          </div>

          {/* Interactive Sample Documents for Instant OCR Testing */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Probar Digitalización con Documentos de Ejemplo
            </h4>
            <p className="text-xs text-slate-600">
              Selecciona una guía de transporte de prueba para verificar cómo el OCR
              extrae los campos y muestra la pantalla de revisión:
            </p>
            <div className="space-y-2">
              {SAMPLE_OCR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleRunPresetSample(preset)}
                  className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 transition flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {preset.label}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {preset.fields.textoDetectado}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-[11px] font-bold shrink-0">
                    Probar OCR
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: ANALYZING DOCUMENT */}
      {step === 'analyzing' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-5">
          <div className="relative">
            {docDataUrl && !docDataUrl.startsWith('data:application/pdf') ? (
              <img
                src={docDataUrl}
                alt="Documento en análisis"
                className="w-44 h-56 object-cover rounded-2xl border-2 border-sky-400 shadow-xl opacity-80"
              />
            ) : (
              <div className="w-40 h-48 rounded-2xl bg-white border-2 border-sky-400 shadow-xl flex flex-col items-center justify-center p-4">
                <FileText className="w-14 h-14 text-sky-600 mb-2" />
                <span className="text-xs font-bold text-slate-700 truncate max-w-full">
                  {docFileName}
                </span>
              </div>
            )}
            <div className="absolute -bottom-3 -right-3 w-12 h-12 rounded-2xl bg-[#041B3E] text-[#00A8FF] flex items-center justify-center shadow-lg">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-extrabold text-slate-900">
              Digitalizando documento con IA...
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Extrayendo patente del camión, remolque, empresa, nombre y apellido
              del chofer, tipo de equipo, marca y color.
            </p>
          </div>
        </div>
      )}

      {/* STEP 3: "Revisa los datos antes de guardar" */}
      {step === 'review' && (
        <>
          <form
            onSubmit={handleReviewSubmit}
            className="flex-1 overflow-y-auto p-4 pb-28 max-w-2xl w-full mx-auto space-y-4"
          >
            {/* Banner: Revisa los datos antes de guardar */}
            <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3.5 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-800">
                <p className="font-extrabold text-slate-950 text-sm">
                  Revisa los datos antes de guardar
                </p>
                <p className="mt-0.5 text-slate-600">
                  Verifica y corrige cualquier campo detectado antes de confirmar
                  el registro del vehículo.
                </p>
              </div>
            </div>

            {ocrError && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs font-semibold text-amber-900">
                {ocrError}
              </div>
            )}

            {/* Original Document Preview + Keep Original Checkbox */}
            {docDataUrl && (
              <section className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-3">
                <div className="flex items-center gap-3">
                  {docMimeType === 'application/pdf' ? (
                    <div className="w-16 h-20 rounded-xl bg-sky-50 border border-sky-200 flex flex-col items-center justify-center shrink-0">
                      <FileText className="w-7 h-7 text-sky-600" />
                      <span className="text-[10px] font-bold text-sky-800 mt-0.5">
                        PDF
                      </span>
                    </div>
                  ) : (
                    <img
                      src={docDataUrl}
                      alt="Documento digitalizado"
                      className="w-16 h-20 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-slate-900 truncate">
                      {docFileName || 'Documento digitalizado'}
                    </p>
                    {textoDetectado && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                        {textoDetectado}
                      </p>
                    )}
                    <label className="mt-2 inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={keepOriginalDoc}
                        onChange={(e) => setKeepOriginalDoc(e.target.checked)}
                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Conservar documento original en 📄 Documentos
                      </span>
                    </label>
                  </div>
                </div>
              </section>
            )}

            {/* Detected Fields Form matching exact user specification */}
            <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Patente camión <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={patenteCamion}
                    onChange={(e) =>
                      setPatenteCamion(e.target.value.toUpperCase())
                    }
                    placeholder="AB-CD-12"
                    className="w-full h-12 px-3.5 rounded-xl bg-amber-50 border-2 border-slate-900 font-mono-plate text-base font-extrabold uppercase tracking-wider text-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Patente remolque
                  </label>
                  <input
                    type="text"
                    value={patenteRemolque}
                    onChange={(e) =>
                      setPatenteRemolque(e.target.value.toUpperCase())
                    }
                    placeholder="XY-45-67"
                    className="w-full h-12 px-3.5 rounded-xl bg-slate-50 border border-slate-300 font-mono-plate text-base font-bold uppercase tracking-wider text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Empresa
                </label>
                <input
                  type="text"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Transportes ABC"
                  className="w-full h-12 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={choferNombre}
                    onChange={(e) => setChoferNombre(e.target.value)}
                    placeholder="Juan"
                    className="w-full h-12 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={choferApellido}
                    onChange={(e) => setChoferApellido(e.target.value)}
                    placeholder="Pérez"
                    className="w-full h-12 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Tipo de equipo dropdown + add custom type */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Tipo <span className="text-red-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingType((prev) => !prev)}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Otro tipo
                  </button>
                </div>
                <select
                  value={tipoEquipo}
                  onChange={(e) => setTipoEquipo(e.target.value)}
                  className="w-full h-12 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {Array.from(
                    new Set([...equipmentTypes, tipoEquipo].filter(Boolean))
                  ).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                {isAddingType && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      placeholder="Nuevo tipo de equipo..."
                      className="flex-1 h-10 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmAddType}
                      className="h-10 px-3.5 rounded-xl bg-sky-600 text-white text-xs font-bold"
                    >
                      Agregar
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    placeholder="Volvo"
                    className="w-full h-12 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="Blanco"
                    className="w-full h-12 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </section>

            {/* Optional Truck Photo Capture right in the OCR Review Screen */}
            <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-sky-600" />
                  <h4 className="text-xs font-extrabold text-slate-900">
                    Fotografía del Camión (opcional)
                  </h4>
                </div>
                {fotoCamion && (
                  <button
                    type="button"
                    onClick={() => setFotoCamion('')}
                    className="text-xs font-semibold text-red-600"
                  >
                    Quitar
                  </button>
                )}
              </div>

              {fotoCamion && (
                <img
                  src={fotoCamion}
                  alt="Camión"
                  className="w-full h-40 object-cover rounded-xl border border-slate-200"
                />
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsTruckCameraOpen(true)}
                  className="min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-4 h-4 text-sky-600" />
                  Tomar foto camión
                </button>
                <button
                  type="button"
                  onClick={() => truckGalleryRef.current?.click()}
                  className="min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <ImageIcon className="w-4 h-4 text-sky-600" />
                  Galería
                </button>
              </div>
              <input
                ref={truckGalleryRef}
                type="file"
                accept="image/*"
                onChange={handleTruckGalleryPhoto}
                className="hidden"
              />
            </section>
          </form>

          {/* Bottom Sticky Button: ✅ GUARDAR REGISTRO */}
          <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe bg-white/95 backdrop-blur-md border-t border-slate-200 z-20">
            <div className="max-w-2xl mx-auto">
              <button
                type="button"
                onClick={handleReviewSubmit}
                disabled={isSaving}
                className="w-full min-h-[54px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.99] transition"
              >
                <CheckCircle2 className="w-5 h-5" />
                {isSaving ? 'GUARDANDO REGISTRO...' : '✅ GUARDAR REGISTRO'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Camera for Document */}
      <CameraCaptureModal
        isOpen={isDocCameraOpen}
        title="Fotografiar Documento para OCR"
        onClose={() => setIsDocCameraOpen(false)}
        onCapture={(dataUrl, fileName) =>
          runGeminiOCR(dataUrl, 'image/jpeg', fileName)
        }
      />

      {/* Camera for Truck Photo */}
      <CameraCaptureModal
        isOpen={isTruckCameraOpen}
        title="Fotografía del Camión"
        onClose={() => setIsTruckCameraOpen(false)}
        onCapture={(dataUrl) => setFotoCamion(dataUrl)}
      />

      {/* Duplicate Patente Warning Modal */}
      <DuplicatePatenteModal
        existingVehicle={duplicateMatch}
        onCancel={() => setDuplicateMatch(null)}
        onViewExisting={(veh) => {
          setDuplicateMatch(null);
          resetScanner();
          onClose();
          onOpenExistingVehicle(veh);
        }}
        onCreateAnyway={executeSaveRecord}
      />
    </div>
  );
};
