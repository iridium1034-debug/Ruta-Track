import React from 'react';
import { AlertTriangle, Eye, PlusCircle, X } from 'lucide-react';
import { VehicleRecord } from '../types/vehicle';

interface DuplicatePatenteModalProps {
  existingVehicle: VehicleRecord | null;
  onCancel: () => void;
  onViewExisting: (vehicle: VehicleRecord) => void;
  onCreateAnyway: () => void;
}

export const DuplicatePatenteModal: React.FC<DuplicatePatenteModalProps> = ({
  existingVehicle,
  onCancel,
  onViewExisting,
  onCreateAnyway,
}) => {
  if (!existingVehicle) return null;

  const fullDriver = `${existingVehicle.choferNombre} ${existingVehicle.choferApellido}`.trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-200/80 px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Esta patente ya está registrada.
              </h3>
              <p className="text-xs text-amber-900/80 font-medium mt-0.5">
                Se encontró un vehículo con la patente{' '}
                <span className="font-mono-plate font-bold">{existingVehicle.patenteCamion}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-amber-100/70"
            aria-label="Cerrar aviso"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Record Summary */}
        <div className="p-5 space-y-4">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 flex items-center gap-3.5">
            {existingVehicle.fotoPrincipal ? (
              <img
                src={existingVehicle.fotoPrincipal}
                alt={existingVehicle.patenteCamion}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                {existingVehicle.patenteCamion}
              </div>
            )}
            <div className="min-w-0 flex-1 text-xs space-y-0.5">
              <div className="font-mono-plate text-sm font-extrabold text-slate-950">
                {existingVehicle.patenteCamion}
                {existingVehicle.patenteRemolque
                  ? ` · Remolque: ${existingVehicle.patenteRemolque}`
                  : ''}
              </div>
              <p className="font-semibold text-slate-700">
                {[existingVehicle.marca, existingVehicle.color, existingVehicle.tipoEquipo]
                  .filter(Boolean)
                  .join(' — ')}
              </p>
              <p className="text-slate-600 truncate">
                <span className="font-medium">Chofer:</span> {fullDriver || 'Sin asignar'}
              </p>
              <p className="text-slate-600 truncate">
                <span className="font-medium">Empresa:</span>{' '}
                {existingVehicle.empresa || 'Sin empresa'}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            ¿Deseas abrir la ficha del vehículo existente o crear un nuevo registro de todas
            formas?
          </p>

          {/* Actions */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={() => onViewExisting(existingVehicle)}
              className="w-full min-h-[48px] rounded-xl bg-[#041B3E] hover:bg-[#082A5E] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition"
            >
              <Eye className="w-4 h-4 text-sky-400" />
              Ver registro existente
            </button>

            <button
              type="button"
              onClick={onCreateAnyway}
              className="w-full min-h-[48px] rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition"
            >
              <PlusCircle className="w-4 h-4 text-amber-700" />
              Crear de todas formas
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full min-h-[44px] rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition"
            >
              Volver y corregir patente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
