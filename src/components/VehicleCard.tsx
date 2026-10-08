import React, { useState } from 'react';
import { ChevronRight, FileText, Truck } from 'lucide-react';
import { VehicleRecord } from '../types/vehicle';

interface VehicleCardProps {
  vehicle: VehicleRecord;
  onSelect: (vehicle: VehicleRecord) => void;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, onSelect }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const fullDriverName = `${vehicle.choferNombre} ${vehicle.choferApellido}`.trim();
  const hasPhoto = Boolean(vehicle.fotoPrincipal) && !imgFailed;
  const docCount = (vehicle.documentos || []).length;

  return (
    <button
      type="button"
      onClick={() => onSelect(vehicle)}
      className="w-full text-left bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs hover:border-sky-500/50 hover:shadow-md active:scale-[0.99] transition flex items-start gap-3.5 group"
    >
      {/* Thumbnail Photo of the Truck */}
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
        {hasPhoto ? (
          <img
            src={vehicle.fotoPrincipal}
            alt={`Camión ${vehicle.patenteCamion}`}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center bg-gradient-to-br from-slate-100 to-slate-200/70 w-full h-full">
            <Truck className="w-8 h-8 text-slate-400 mb-1" />
            <span className="text-[10px] font-semibold text-slate-500 leading-tight">
              Sin foto
            </span>
          </div>
        )}
      </div>

      {/* Vehicle Details matching the required hierarchy */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          {/* Patente del Camión */}
          <span className="font-mono-plate text-lg font-extrabold tracking-wider text-slate-950 bg-amber-50 border-2 border-slate-900 rounded-lg px-2.5 py-0.5 leading-none">
            {vehicle.patenteCamion}
          </span>

          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-sky-600 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </div>

        {/* Marca — Color & Tipo de equipo */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold text-slate-700">
          <span>
            {[vehicle.marca || 'Marca no especificada', vehicle.color]
              .filter(Boolean)
              .join(' — ')}
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="text-sky-700 font-bold">{vehicle.tipoEquipo}</span>
        </div>

        {/* Empresa */}
        <p className="mt-1 text-xs font-bold text-slate-900 truncate">
          {vehicle.empresa || 'Empresa no registrada'}
        </p>

        {/* Chofer & Remolque */}
        <div className="mt-1 space-y-0.5 text-xs text-slate-600">
          <p className="truncate">
            <span className="text-slate-500 font-medium">Chofer:</span>{' '}
            <span className="font-semibold text-slate-800">
              {fullDriverName || 'No registrado'}
            </span>
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate">
              <span className="text-slate-500 font-medium">Remolque:</span>{' '}
              <span className="font-mono-plate font-semibold text-slate-800">
                {vehicle.patenteRemolque || 'Sin remolque'}
              </span>
            </p>
            {docCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 shrink-0">
                <FileText className="w-3.5 h-3.5 text-sky-600" />
                {docCount} {docCount === 1 ? 'doc' : 'docs'}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};
