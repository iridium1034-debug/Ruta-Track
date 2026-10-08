import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Upload, X } from 'lucide-react';
import { compressImageFile } from '../utils/imageUtils';

interface CameraCaptureModalProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  onCapture: (dataUrl: string, fileName: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  title = 'Tomar Fotografía',
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let currentStream: MediaStream | null = null;
    setCameraError(null);
    setIsStreaming(false);

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'El visor directo no está disponible en este entorno. Usa el botón de Cámara Nativa Android abajo.'
        );
        return;
      }

      try {
        currentStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = currentStream;
          await videoRef.current.play();
          setIsStreaming(true);
        }
      } catch (err) {
        console.warn('No se pudo abrir getUserMedia:', err);
        setCameraError(
          'Permiso de cámara web no concedido o cámara ocupada. Pulsa "Abrir Cámara del Teléfono" para tomar la foto directamente.'
        );
      }
    }

    startCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  const handleTakeSnapshot = async () => {
    if (!videoRef.current || !isStreaming) return;
    setIsProcessing(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 960;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const rawDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        const compressed = await compressImageFile(rawDataUrl, 1280, 0.84);
        onCapture(compressed, `Foto_${Date.now()}.jpg`);
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNativeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const compressed = await compressImageFile(file, 1280, 0.84);
      onCapture(compressed, file.name || `Camara_${Date.now()}.jpg`);
      onClose();
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800">
        <h3 className="text-base font-bold tracking-tight truncate">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
            }
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95 transition"
            title="Cambiar cámara frontal/trasera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95 transition"
            aria-label="Cerrar cámara"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Camera Viewfinder */}
      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
        {!cameraError ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />
            {/* Framing Reticle */}
            <div className="pointer-events-none absolute inset-6 border-2 border-sky-400/50 rounded-2xl flex items-end justify-center pb-4">
              <span className="bg-slate-950/75 text-sky-200 text-xs font-medium px-3 py-1 rounded-lg">
                Encuadra el camión o documento con buena iluminación
              </span>
            </div>
          </>
        ) : (
          <div className="p-6 max-w-sm text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center mx-auto text-sky-400">
              <Camera className="w-8 h-8" />
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{cameraError}</p>
            <button
              type="button"
              onClick={() => nativeCameraInputRef.current?.click()}
              className="w-full min-h-[52px] rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition"
            >
              <Camera className="w-5 h-5" />
              Abrir Cámara del Teléfono
            </button>
          </div>
        )}
      </div>

      {/* Hidden native camera input for Android */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleNativeFileChange}
        className="hidden"
      />

      {/* Bottom Shutter Controls */}
      <div className="p-4 pb-safe bg-slate-900 border-t border-slate-800 flex items-center justify-around gap-3">
        <button
          type="button"
          onClick={() => nativeCameraInputRef.current?.click()}
          disabled={isProcessing}
          className="min-h-[48px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap"
        >
          <Upload className="w-4 h-4 text-sky-400" />
          Cámara Nativa /Archivo
        </button>

        {!cameraError && (
          <button
            type="button"
            onClick={handleTakeSnapshot}
            disabled={!isStreaming || isProcessing}
            className="min-h-[56px] px-7 rounded-2xl bg-[#00A8FF] hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-extrabold text-sm flex items-center gap-2.5 shadow-lg shadow-sky-500/20 active:scale-95 transition whitespace-nowrap"
          >
            <Camera className="w-5 h-5" />
            {isProcessing ? 'Procesando...' : 'CAPTURAR FOTO'}
          </button>
        )}
      </div>
    </div>
  );
};
