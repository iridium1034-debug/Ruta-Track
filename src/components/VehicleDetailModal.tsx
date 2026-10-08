import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Camera,
  Download,
  Edit3,
  Eye,
  FileText,
  Image as ImageIcon,
  Maximize2,
  Plus,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react';
import { VehicleDocument, VehicleRecord } from '../types/vehicle';
import { compressImageFile, fileToDataUrl } from '../utils/imageUtils';
import { CameraCaptureModal } from './CameraCaptureModal';

interface VehicleDetailModalProps {
  vehicle: VehicleRecord | null;
  onClose: () => void;
  onEdit: (vehicle: VehicleRecord) => void;
  onUpdateVehicle: (updated: VehicleRecord) => Promise<void>;
  onDeleteVehicle: (id: string) => Promise<void>;
}

export const VehicleDetailModal: React.FC<VehicleDetailModalProps> = ({
  vehicle,
  onClose,
  onEdit,
  onUpdateVehicle,
  onDeleteVehicle,
}) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [viewingDocument, setViewingDocument] = useState<VehicleDocument | null>(
    null
  );
  const [confirmDeleteVehicle, setConfirmDeleteVehicle] = useState(false);

  // Camera & file inputs for direct photo/document actions on the Ficha
  const [cameraMode, setCameraMode] = useState<
    'replaceMain' | 'addExtra' | 'addDoc' | null
  >(null);
  const replacePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const addPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const addDocInputRef = useRef<HTMLInputElement | null>(null);

  if (!vehicle) return null;

  const allPhotos = [
    ...(vehicle.fotoPrincipal ? [vehicle.fotoPrincipal] : []),
    ...(vehicle.fotosAdicionales || []),
  ];
  const currentPhoto = allPhotos[activePhotoIndex] || allPhotos[0] || '';
  const fullDriverName =
    `${vehicle.choferNombre} ${vehicle.choferApellido}`.trim();
  const docs = vehicle.documentos || [];

  const handleReplaceMainPhoto = async (dataUrl: string) => {
    await onUpdateVehicle({
      ...vehicle,
      fotoPrincipal: dataUrl,
    });
    setActivePhotoIndex(0);
  };

  const handleAddExtraPhoto = async (dataUrl: string) => {
    if (!vehicle.fotoPrincipal) {
      await handleReplaceMainPhoto(dataUrl);
      return;
    }
    const updatedExtras = [...(vehicle.fotosAdicionales || []), dataUrl];
    await onUpdateVehicle({
      ...vehicle,
      fotosAdicionales: updatedExtras,
    });
    setActivePhotoIndex(updatedExtras.length);
  };

  const handleDeleteCurrentPhoto = async () => {
    if (!currentPhoto) return;
    if (activePhotoIndex === 0 && vehicle.fotoPrincipal) {
      const remaining = [...(vehicle.fotosAdicionales || [])];
      const nextMain = remaining.shift() || '';
      await onUpdateVehicle({
        ...vehicle,
        fotoPrincipal: nextMain,
        fotosAdicionales: remaining,
      });
      setActivePhotoIndex(0);
    } else {
      const extraIdx = vehicle.fotoPrincipal
        ? activePhotoIndex - 1
        : activePhotoIndex;
      const updatedExtras = (vehicle.fotosAdicionales || []).filter(
        (_, i) => i !== extraIdx
      );
      await onUpdateVehicle({
        ...vehicle,
        fotosAdicionales: updatedExtras,
      });
      setActivePhotoIndex(0);
    }
  };

  const handleGalleryFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'replace' | 'add'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1280, 0.84);
      if (mode === 'replace') {
        await handleReplaceMainPhoto(compressed);
      } else {
        await handleAddExtraPhoto(compressed);
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleAddDocumentFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const isImage = file.type.startsWith('image/');
      const dataUrl = isImage
        ? await compressImageFile(file, 1400, 0.86)
        : await fileToDataUrl(file);
      const newDoc: VehicleDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl,
        createdAt: new Date().toISOString(),
        source: 'manual',
      };
      await onUpdateVehicle({
        ...vehicle,
        documentos: [...docs, newDoc],
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleAddDocumentFromCamera = async (
    dataUrl: string,
    fileName: string
  ) => {
    const newDoc: VehicleDocument = {
      id: `doc-${Date.now()}`,
      name: fileName || `Documento_${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      dataUrl,
      createdAt: new Date().toISOString(),
      source: 'manual',
    };
    await onUpdateVehicle({
      ...vehicle,
      documentos: [...docs, newDoc],
    });
  };

  const handleDeleteDocument = async (docId: string) => {
    await onUpdateVehicle({
      ...vehicle,
      documentos: docs.filter((d) => d.id !== docId),
    });
    if (viewingDocument?.id === docId) {
      setViewingDocument(null);
    }
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
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight truncate font-mono-plate">
              {vehicle.patenteCamion}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(vehicle)}
            className="min-h-[40px] px-3.5 rounded-xl bg-[#00A8FF] hover:bg-sky-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition whitespace-nowrap"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Editar
          </button>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-28 max-w-2xl w-full mx-auto">
        {/* 1. Large Hero Photograph of the Truck */}
        <div className="relative bg-slate-900 aspect-[16/10] w-full overflow-hidden">
          {currentPhoto ? (
            <>
              <img
                src={currentPhoto}
                alt={`Camión ${vehicle.patenteCamion}`}
                referrerPolicy="no-referrer"
                onClick={() => setFullScreenImage(currentPhoto)}
                className="w-full h-full object-cover cursor-zoom-in"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />
              <button
                type="button"
                onClick={() => setFullScreenImage(currentPhoto)}
                className="absolute top-3 right-3 min-h-[40px] px-3 rounded-xl bg-slate-950/70 backdrop-blur-xs text-white text-xs font-bold flex items-center gap-1.5 hover:bg-slate-900 transition"
              >
                <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                Ampliar
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <Truck className="w-14 h-14 text-slate-600 mb-2" />
              <p className="text-sm font-bold text-slate-300">
                Sin fotografía del camión
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Usa los botones inferiores para tomar o seleccionar una foto
              </p>
            </div>
          )}

          {/* License Plate Overlay on Hero */}
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
            <div>
              <span className="inline-block font-mono-plate text-2xl font-extrabold tracking-wider text-slate-950 bg-amber-50 border-2 border-slate-950 rounded-xl px-3.5 py-1 shadow-md">
                {vehicle.patenteCamion}
              </span>
            </div>
            {allPhotos.length > 1 && (
              <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl">
                {allPhotos.map((photo, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePhotoIndex(idx)}
                    className={`w-8 h-8 rounded-lg overflow-hidden border-2 transition ${
                      idx === activePhotoIndex
                        ? 'border-[#00A8FF] scale-105'
                        : 'border-transparent opacity-60'
                    }`}
                  >
                    <img
                      src={photo}
                      alt={`Miniatura ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Photo Quick Actions Bar (Cambiar / Agregar / Eliminar fotografía) */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCameraMode('replaceMain')}
            className="min-h-[40px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Camera className="w-3.5 h-3.5 text-sky-600" />
            {currentPhoto ? 'Cambiar foto (Cámara)' : 'Tomar foto'}
          </button>

          <button
            type="button"
            onClick={() => replacePhotoInputRef.current?.click()}
            className="min-h-[40px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <ImageIcon className="w-3.5 h-3.5 text-sky-600" />
            {currentPhoto ? 'Cambiar (Galería)' : 'Desde galería'}
          </button>

          <button
            type="button"
            onClick={() => addPhotoInputRef.current?.click()}
            className="min-h-[40px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5 text-sky-600" />
            Agregar foto extra
          </button>

          {currentPhoto && (
            <button
              type="button"
              onClick={handleDeleteCurrentPhoto}
              className="min-h-[40px] px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1.5 transition ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar foto
            </button>
          )}

          <input
            ref={replacePhotoInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleGalleryFile(e, 'replace')}
            className="hidden"
          />
          <input
            ref={addPhotoInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleGalleryFile(e, 'add')}
            className="hidden"
          />
        </div>

        {/* Main Ficha Information Sections */}
        <div className="p-4 space-y-4">
          {/* Información del Vehículo */}
          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  Datos del Vehículo y Equipo
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {vehicle.origenRegistro === 'ocr'
                  ? 'Registrado con OCR/IA'
                  : 'Registro manual'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3.5 text-sm">
              <div>
                <p className="text-xs text-slate-500 font-medium">
                  Patente del camión
                </p>
                <p className="font-mono-plate font-extrabold text-slate-950 text-base mt-0.5">
                  {vehicle.patenteCamion}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-medium">
                  Patente del remolque
                </p>
                <p className="font-mono-plate font-bold text-slate-900 text-base mt-0.5">
                  {vehicle.patenteRemolque || 'No especificado'}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-medium">
                  Tipo de equipo
                </p>
                <p className="font-extrabold text-sky-700 mt-0.5">
                  {vehicle.tipoEquipo}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-medium">
                  Marca del camión
                </p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {vehicle.marca || 'No especificada'}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-medium">
                  Color del camión
                </p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {vehicle.color || 'No especificado'}
                </p>
              </div>
            </div>
          </section>

          {/* Conductor y Empresa */}
          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <User className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-extrabold text-slate-900">
                Conductor y Empresa
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
              <div>
                <p className="text-xs text-slate-500 font-medium">
                  Nombre completo del chofer
                </p>
                <p className="font-extrabold text-slate-900 text-base mt-0.5">
                  {fullDriverName || 'Sin chofer registrado'}
                </p>
                {(vehicle.choferNombre || vehicle.choferApellido) && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Nombre: {vehicle.choferNombre || '—'} · Apellido:{' '}
                    {vehicle.choferApellido || '—'}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  Empresa transportista
                </p>
                <p className="font-extrabold text-slate-900 text-base mt-0.5">
                  {vehicle.empresa || 'Empresa no registrada'}
                </p>
              </div>
            </div>
          </section>

          {/* 6. 📄 Documentos Section (Conservar y visualizar el documento original) */}
          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-600" />
                  📄 Documentos ({docs.length})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Documentos originales utilizados en OCR o respaldos asociados
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCameraMode('addDoc')}
                  className="min-h-[38px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1 transition"
                  title="Fotografiar documento"
                >
                  <Camera className="w-3.5 h-3.5 text-sky-600" />
                  Foto
                </button>
                <button
                  type="button"
                  onClick={() => addDocInputRef.current?.click()}
                  className="min-h-[38px] px-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-sky-600" />
                  Archivo / PDF
                </button>
              </div>
            </div>

            <input
              ref={addDocInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleAddDocumentFile}
              className="hidden"
            />

            {docs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No hay documentos adjuntos a esta ficha. Puedes fotografiar una
                guía o subir un archivo PDF.
              </div>
            ) : (
              <div className="space-y-2.5">
                {docs.map((doc) => {
                  const isPdf = doc.mimeType === 'application/pdf';
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-sky-300 transition"
                    >
                      <button
                        type="button"
                        onClick={() => setViewingDocument(doc)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      >
                        {!isPdf && doc.dataUrl ? (
                          <img
                            src={doc.dataUrl}
                            alt={doc.name}
                            className="w-12 h-14 rounded-lg object-cover border border-slate-300 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-14 rounded-lg bg-sky-100 border border-sky-200 flex flex-col items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-sky-700" />
                            <span className="text-[9px] font-extrabold text-sky-800">
                              PDF
                            </span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-extrabold text-slate-900 truncate">
                            {doc.name}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {doc.source === 'ocr'
                              ? 'Documento original de digitalización OCR'
                              : 'Documento adjunto'}
                            {' · '}
                            {new Date(doc.createdAt).toLocaleDateString('es-CL')}
                          </p>
                          {doc.extractedNotes && (
                            <p className="text-[11px] text-slate-600 truncate mt-0.5">
                              {doc.extractedNotes}
                            </p>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setViewingDocument(doc)}
                          className="min-h-[38px] px-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 hover:bg-sky-50 flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-sky-600" />
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="min-h-[38px] min-w-[38px] rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center"
                          title="Eliminar documento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Edit & Delete Actions */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onEdit(vehicle)}
              className="min-h-[50px] rounded-2xl bg-[#041B3E] hover:bg-[#082A5E] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition"
            >
              <Edit3 className="w-4 h-4 text-[#00A8FF]" />
              Editar toda la ficha
            </button>

            <button
              type="button"
              onClick={() => setConfirmDeleteVehicle(true)}
              className="min-h-[50px] rounded-2xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-extrabold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar registro
            </button>
          </div>
        </div>
      </div>

      {/* Full-Screen Truck Photo Viewer */}
      {fullScreenImage && (
        <div
          className="fixed inset-0 z-[70] bg-black/95 flex flex-col"
          onClick={() => setFullScreenImage(null)}
        >
          <div className="flex items-center justify-between p-4 text-white">
            <span className="font-mono-plate font-bold text-base">
              {vehicle.patenteCamion} — {vehicle.marca} {vehicle.tipoEquipo}
            </span>
            <button
              type="button"
              onClick={() => setFullScreenImage(null)}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-white/10 flex items-center justify-center"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-2 overflow-auto">
            <img
              src={fullScreenImage}
              alt={vehicle.patenteCamion}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Full-Screen Document Viewer (Image or PDF) */}
      {viewingDocument && (
        <div className="fixed inset-0 z-[70] bg-slate-950/95 flex flex-col text-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="min-w-0">
              <h4 className="text-sm font-extrabold truncate">
                {viewingDocument.name}
              </h4>
              <p className="text-[11px] text-slate-400">
                {viewingDocument.source === 'ocr'
                  ? 'Documento original de digitalización OCR'
                  : 'Documento adjunto'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={viewingDocument.dataUrl}
                download={viewingDocument.name}
                className="min-h-[40px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-4 h-4 text-sky-400" />
                Descargar
              </a>
              <button
                type="button"
                onClick={() => setViewingDocument(null)}
                className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            {viewingDocument.mimeType === 'application/pdf' ? (
              <iframe
                src={viewingDocument.dataUrl}
                title={viewingDocument.name}
                className="w-full h-full bg-white rounded-xl border border-slate-700"
              />
            ) : (
              <img
                src={viewingDocument.dataUrl}
                alt={viewingDocument.name}
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              />
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Req 10: Antes de eliminar un registro, solicitar confirmación) */}
      {confirmDeleteVehicle && (
        <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900">
                  ¿Eliminar este vehículo?
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Patente:{' '}
                  <span className="font-mono-plate font-bold text-slate-800">
                    {vehicle.patenteCamion}
                  </span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Se eliminarán la ficha del vehículo, sus fotografías y los
              documentos asociados de este dispositivo. Esta acción no se puede
              deshacer.
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteVehicle(false)}
                className="min-h-[46px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteVehicle(vehicle.id);
                  setConfirmDeleteVehicle(false);
                  onClose();
                }}
                className="min-h-[46px] rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Camera Modal for replacing/adding photo or document */}
      <CameraCaptureModal
        isOpen={cameraMode !== null}
        title={
          cameraMode === 'addDoc'
            ? 'Fotografiar Documento'
            : 'Fotografía del Camión'
        }
        onClose={() => setCameraMode(null)}
        onCapture={async (dataUrl, fileName) => {
          if (cameraMode === 'replaceMain') {
            await handleReplaceMainPhoto(dataUrl);
          } else if (cameraMode === 'addExtra') {
            await handleAddExtraPhoto(dataUrl);
          } else if (cameraMode === 'addDoc') {
            await handleAddDocumentFromCamera(dataUrl, fileName);
          }
          setCameraMode(null);
        }}
      />
    </div>
  );
};
