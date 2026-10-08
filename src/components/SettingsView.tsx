import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderDown,
  FolderUp,
  Lock,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  Unlock,
} from 'lucide-react';
import { BackupBundle, VehicleRecord } from '../types/vehicle';
import {
  createBackupBundle,
  DEFAULT_EQUIPMENT_TYPES,
  generateVehiclesCSV,
  restoreBackupBundle,
} from '../db/localDb';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface SettingsViewProps {
  vehicles: VehicleRecord[];
  equipmentTypes: string[];
  securityPin: string | null;
  onAddEquipmentType: (newType: string) => Promise<string[]>;
  onRemoveEquipmentType: (type: string) => Promise<string[]>;
  onSetSecurityPin: (pin: string | null) => Promise<void>;
  onDataRestored: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  vehicles,
  equipmentTypes,
  securityPin,
  onAddEquipmentType,
  onRemoveEquipmentType,
  onSetSecurityPin,
  onDataRestored,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Custom equipment type state
  const [newEquipmentInput, setNewEquipmentInput] = useState('');

  // Security PIN state
  const [pinInput, setPinInput] = useState('');
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 5000);
  };

  // 1. Exportar / Crear copia de seguridad JSON completa (con fotos y documentos)
  const handleExportJSONBackup = async () => {
    try {
      const bundle = await createBackupBundle();
      const jsonStr = JSON.stringify(bundle, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `rutatrack-copia-seguridad-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(
        'success',
        `Copia de seguridad creada con éxito (${bundle.vehicles.length} vehículos, fotografías y documentos incluidos).`
      );
    } catch (err) {
      console.error(err);
      showToast('error', 'No se pudo generar la copia de seguridad.');
    }
  };

  // 2. Importar / Restaurar copia de seguridad JSON
  const handleImportJSONBackup = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupBundle;
      const { importedCount } = await restoreBackupBundle(parsed, restoreMode);
      await onDataRestored();
      showToast(
        'success',
        `Se restauraron ${importedCount} registros correctamente (${
          restoreMode === 'merge' ? 'combinados' : 'reemplazados'
        }).`
      );
    } catch (err: unknown) {
      console.error(err);
      const msg =
        err instanceof Error
          ? err.message
          : 'El archivo seleccionado no es una copia válida.';
      showToast('error', msg);
    } finally {
      e.target.value = '';
    }
  };

  // 3. Exportar a CSV / Excel
  const handleExportCSVExcel = () => {
    try {
      const csvContent = generateVehiclesCSV(vehicles);
      const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `rutatrack-vehiculos-${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(
        'success',
        `Archivo CSV/Excel exportado (${vehicles.length} vehículos).`
      );
    } catch (err) {
      console.error(err);
      showToast('error', 'Error al exportar archivo CSV/Excel.');
    }
  };

  // 4. Descargar configuración Android APK / AAB
  const handleDownloadAndroidKit = () => {
    const kitContent = {
      appId: 'com.rutatrack.controldevehiculos',
      appName: 'Ruta Track - Control de Vehículos',
      versionName: '1.0.0',
      versionCode: 1,
      permissions: [
        'android.permission.CAMERA',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_EXTERNAL_STORAGE',
      ],
      commands: {
        installCapacitorAndroid:
          'npm install @capacitor/core @capacitor/cli @capacitor/android && npx cap add android',
        buildDebugAPK:
          'npm run build && npx cap sync android && cd android && ./gradlew assembleDebug',
        buildSignedAABForPlayStore:
          'npm run build && npx cap sync android && cd android && ./gradlew bundleRelease',
        buildBubblewrapTWA:
          'npx @bubblewrap/cli init --manifest https://ais-pre-trdhzqlsdooy2u6wram7ti-337261311210.us-west2.run.app/manifest.webmanifest && npx @bubblewrap/cli build',
      },
    };
    const blob = new Blob([JSON.stringify(kitContent, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rutatrack-android-apk-aab-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(
      'success',
      'Configuración Android APK y Google Play AAB descargada.'
    );
  };

  const handleAddTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEquipmentInput.trim()) return;
    await onAddEquipmentType(newEquipmentInput.trim());
    setNewEquipmentInput('');
    showToast('success', 'Nuevo tipo de equipo agregado.');
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim().length < 4) {
      showToast('error', 'El PIN debe tener al menos 4 dígitos.');
      return;
    }
    await onSetSecurityPin(pinInput.trim());
    setPinInput('');
    showToast('success', 'PIN de bloqueo local activado.');
  };

  const totalPhotos = vehicles.reduce(
    (acc, v) =>
      acc + (v.fotoPrincipal ? 1 : 0) + (v.fotosAdicionales?.length || 0),
    0
  );
  const totalDocs = vehicles.reduce(
    (acc, v) => acc + (v.documentos?.length || 0),
    0
  );

  return (
    <div className="space-y-5 pb-10">
      {statusMessage && (
        <div
          className={`rounded-2xl p-4 text-xs font-bold flex items-center gap-2.5 shadow-sm border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 1. Instalación Android (APK / AAB / PWA Standalone) */}
      <section className="bg-[#041B3E] text-white rounded-3xl p-5 shadow-md space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#00A8FF]/20 border border-[#00A8FF]/40 flex items-center justify-center shrink-0 text-[#00A8FF]">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                Aplicación Móvil Android (APK / AAB)
              </h3>
              <p className="text-xs text-sky-200/80 mt-0.5">
                {isInstalled
                  ? 'Instalada en modo nativo independiente en este dispositivo'
                  : 'Lista para instalar en tu teléfono Android y empaquetar en APK / Google Play AAB'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {!isInstalled && (
            <button
              type="button"
              onClick={async () => {
                if (isInstallable) {
                  await install();
                } else {
                  setShowAndroidGuide((prev) => !prev);
                }
              }}
              className="min-h-[48px] px-4 rounded-2xl bg-[#00A8FF] hover:bg-sky-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition"
            >
              <Download className="w-4 h-4" />
              Instalar App en Teléfono Android
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadAndroidKit}
            className="min-h-[48px] px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/15 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <FolderDown className="w-4 h-4 text-[#00A8FF]" />
            Descargar Kit APK / AAB (Google Play)
          </button>
        </div>

        {showAndroidGuide && (
          <div className="rounded-2xl bg-slate-900/90 border border-sky-400/30 p-4 text-xs text-slate-200 space-y-2">
            <p className="font-extrabold text-sky-300">
              Cómo instalar Ruta Track en Android o generar APK/AAB:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>
                <strong>Instalación directa en Android:</strong> En Chrome para
                Android, toca el menú <strong>⋮</strong> (esquina superior
                derecha) y selecciona{' '}
                <strong>"Instalar aplicación"</strong>. Se generará e instalará
                el WebAPK con el ícono oficial de Ruta Track y acceso completo
                offline.
              </li>
              <li>
                <strong>Generar archivo .APK instalable y .AAB firmado:</strong>{' '}
                El proyecto incluye <code>capacitor.config.json</code>,{' '}
                <code>android-packaging/twa-manifest.json</code> y el script{' '}
                <code>android-packaging/build-apk-aab.sh</code> listos para
                compilar <code>RutaTrack-instalable.apk</code> y{' '}
                <code>app-release.aab</code> para Google Play.
              </li>
            </ol>
          </div>
        )}
      </section>

      {/* 2. Copia de Seguridad y Exportación (Req 12) */}
      <section className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">
            Copia de Seguridad y Exportación
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Almacenamiento local actual: <strong>{vehicles.length}</strong>{' '}
            vehículos · <strong>{totalPhotos}</strong> fotografías ·{' '}
            <strong>{totalDocs}</strong> documentos
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleExportJSONBackup}
            className="min-h-[52px] px-4 rounded-2xl bg-[#041B3E] hover:bg-[#082A5E] text-white font-extrabold text-xs flex items-center justify-center gap-2.5 shadow-xs active:scale-[0.99] transition"
          >
            <FolderDown className="w-4 h-4 text-[#00A8FF]" />
            Crear Copia de Seguridad (.JSON)
          </button>

          <button
            type="button"
            onClick={handleExportCSVExcel}
            className="min-h-[52px] px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2.5 shadow-xs active:scale-[0.99] transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar a CSV / Excel (.CSV)
          </button>
        </div>

        {/* Restore / Import Section */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-extrabold text-slate-900">
                Restaurar / Importar Copia de Seguridad
              </h4>
              <p className="text-[11px] text-slate-500">
                Importa un archivo .JSON con vehículos, choferes, empresas, fotos
                y documentos
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start">
              <button
                type="button"
                onClick={() => setRestoreMode('merge')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  restoreMode === 'merge'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Combinar
              </button>
              <button
                type="button"
                onClick={() => setRestoreMode('replace')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  restoreMode === 'replace'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Reemplazar todo
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => backupInputRef.current?.click()}
            className="w-full min-h-[48px] px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.99] transition"
          >
            <FolderUp className="w-4 h-4 text-sky-600" />
            Seleccionar archivo de respaldo (.JSON) para restaurar
          </button>

          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportJSONBackup}
            className="hidden"
          />
        </div>
      </section>

      {/* 3. Administración de Tipos de Equipo (Req 2: Batea, Cisterna, Rampla + agregar otros) */}
      <section className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">
            Tipos de Equipo
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tipos predeterminados: Batea, Cisterna y Rampla. Puedes añadir otros
            tipos según tu operación.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {equipmentTypes.map((type) => {
            const isDefault = DEFAULT_EQUIPMENT_TYPES.includes(type);
            return (
              <div
                key={type}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800"
              >
                <span>{type}</span>
                {!isDefault && (
                  <button
                    type="button"
                    onClick={() => onRemoveEquipmentType(type)}
                    className="text-slate-400 hover:text-red-600"
                    title="Eliminar tipo personalizado"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddTypeSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={newEquipmentInput}
            onChange={(e) => setNewEquipmentInput(e.target.value)}
            placeholder="Agregar nuevo tipo (ej. Tolva, Cama Baja, Frigorífico)"
            className="flex-1 h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="submit"
            className="h-11 px-4 rounded-xl bg-[#041B3E] hover:bg-[#082A5E] text-white text-xs font-extrabold flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4 text-[#00A8FF]" />
            Agregar
          </button>
        </form>
      </section>

      {/* 4. Seguridad y Privacidad (Req 13) */}
      <section className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Privacidad y Seguridad Local
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Todos los datos de camiones, choferes, fotografías y documentos se
              almacenan de forma privada en la base de datos interna de tu
              teléfono (IndexedDB) y funcionan sin Internet.
            </p>
          </div>
        </div>

        {securityPin ? (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">
                Bloqueo por PIN activo en este teléfono
              </span>
            </div>
            <button
              type="button"
              onClick={async () => {
                await onSetSecurityPin(null);
                showToast('success', 'Bloqueo por PIN desactivado.');
              }}
              className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 text-xs font-bold flex items-center gap-1"
            >
              <Unlock className="w-3.5 h-3.5" />
              Desactivar PIN
            </button>
          </div>
        ) : (
          <form onSubmit={handleSavePin} className="flex items-center gap-2">
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Configurar PIN de acceso opcional (mín. 4 dígitos)"
              className="flex-1 h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="submit"
              className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0"
            >
              Activar PIN
            </button>
          </form>
        )}
      </section>
    </div>
  );
};
