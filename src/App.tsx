import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Download,
  Filter,
  Home,
  Lock,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Truck,
  WifiOff,
  X,
} from 'lucide-react';
import { VehicleFilters, VehicleRecord } from './types/vehicle';
import {
  addEquipmentType,
  deleteVehicleRecord,
  getEquipmentTypes,
  getSecurityPin,
  initAndGetAllVehicles,
  removeCustomEquipmentType,
  saveVehicleRecord,
  setSecurityPin,
} from './db/localDb';
import {
  normalizePatenteKey,
  normalizeSearchText,
} from './utils/imageUtils';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePWAInstall } from './hooks/usePWAInstall';
import { RutaTrackLogo } from './components/RutaTrackLogo';
import { VehicleCard } from './components/VehicleCard';
import { VehicleFormModal } from './components/VehicleFormModal';
import { DocumentScannerModal } from './components/DocumentScannerModal';
import { VehicleDetailModal } from './components/VehicleDetailModal';
import { SettingsView } from './components/SettingsView';

type ActiveTab = 'home' | 'vehicles' | 'settings';

export default function App() {
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>([
    'Batea',
    'Cisterna',
    'Rampla',
  ]);
  const [isLoading, setIsLoading] = useState(true);

  // Security PIN Lock State
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [unlockAttempt, setUnlockAttempt] = useState('');
  const [unlockError, setUnlockError] = useState(false);

  // Search & Combinable Filters (Req 7 & 8)
  const [filters, setFilters] = useState<VehicleFilters>({
    searchQuery: '',
    tipoEquipo: 'Todos',
    empresa: 'Todas',
    marca: 'Todas',
    color: 'Todos',
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Modals State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleRecord | null>(
    null
  );
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null
  );

  const loadDatabase = async () => {
    setIsLoading(true);
    try {
      const [loadedVehicles, loadedTypes, pin] = await Promise.all([
        initAndGetAllVehicles(),
        getEquipmentTypes(),
        getSecurityPin(),
      ]);
      setVehicles(loadedVehicles);
      setEquipmentTypes(loadedTypes);
      setStoredPin(pin);
      if (pin) {
        setIsUnlocked(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, []);

  // Unique values for dynamic filter dropdowns (Req 8: Empresa, Marca, Color)
  const uniqueCompanies = useMemo(
    () =>
      Array.from(
        new Set(vehicles.map((v) => v.empresa.trim()).filter(Boolean))
      ).sort(),
    [vehicles]
  );

  const uniqueBrands = useMemo(
    () =>
      Array.from(
        new Set(vehicles.map((v) => v.marca.trim()).filter(Boolean))
      ).sort(),
    [vehicles]
  );

  const uniqueColors = useMemo(
    () =>
      Array.from(
        new Set(vehicles.map((v) => v.color.trim()).filter(Boolean))
      ).sort(),
    [vehicles]
  );

  // Fast, tolerant search and combinable filter engine (Req 1, 7, 8)
  const filteredVehicles = useMemo(() => {
    const rawQuery = filters.searchQuery.trim();
    const normQuery = normalizeSearchText(rawQuery);
    const normPlateQuery = normalizePatenteKey(rawQuery);

    return vehicles.filter((v) => {
      // 1. Combinable Filters
      if (
        filters.tipoEquipo !== 'Todos' &&
        v.tipoEquipo.toLowerCase() !== filters.tipoEquipo.toLowerCase()
      ) {
        return false;
      }
      if (
        filters.empresa !== 'Todas' &&
        v.empresa.toLowerCase() !== filters.empresa.toLowerCase()
      ) {
        return false;
      }
      if (
        filters.marca !== 'Todas' &&
        v.marca.toLowerCase() !== filters.marca.toLowerCase()
      ) {
        return false;
      }
      if (
        filters.color !== 'Todos' &&
        v.color.toLowerCase() !== filters.color.toLowerCase()
      ) {
        return false;
      }

      // 2. Search Query Tolerance (Patente camión, Patente remolque, Nombre, Apellido, Empresa, Marca, Tipo, Color)
      if (!normQuery) return true;

      const fullSearchableBlob = normalizeSearchText(
        [
          v.patenteCamion,
          v.patenteRemolque,
          v.choferNombre,
          v.choferApellido,
          `${v.choferNombre} ${v.choferApellido}`,
          v.empresa,
          v.marca,
          v.tipoEquipo,
          v.color,
        ].join(' ')
      );

      if (fullSearchableBlob.includes(normQuery)) {
        return true;
      }

      // Also check stripped license plate match (e.g., user types "ABCD" for "AB-CD-12")
      if (normPlateQuery.length >= 2) {
        const camKey = normalizePatenteKey(v.patenteCamion);
        const remKey = normalizePatenteKey(v.patenteRemolque);
        if (
          camKey.includes(normPlateQuery) ||
          remKey.includes(normPlateQuery)
        ) {
          return true;
        }
      }

      return false;
    });
  }, [vehicles, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.tipoEquipo !== 'Todos') count++;
    if (filters.empresa !== 'Todas') count++;
    if (filters.marca !== 'Todas') count++;
    if (filters.color !== 'Todos') count++;
    return count;
  }, [filters]);

  const clearAllFilters = () => {
    setFilters({
      searchQuery: '',
      tipoEquipo: 'Todos',
      empresa: 'Todas',
      marca: 'Todas',
      color: 'Todos',
    });
  };

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) || null,
    [vehicles, selectedVehicleId]
  );

  // Handlers for CRUD
  const handleSaveVehicle = async (record: VehicleRecord) => {
    const saved = await saveVehicleRecord(record);
    const [updatedVehicles, updatedTypes] = await Promise.all([
      initAndGetAllVehicles(),
      getEquipmentTypes(),
    ]);
    setVehicles(updatedVehicles);
    setEquipmentTypes(updatedTypes);
    setSelectedVehicleId(saved.id);
  };

  const handleDeleteVehicle = async (id: string) => {
    await deleteVehicleRecord(id);
    const updated = await initAndGetAllVehicles();
    setVehicles(updated);
    if (selectedVehicleId === id) {
      setSelectedVehicleId(null);
    }
  };

  const handleAddEquipmentType = async (newType: string) => {
    const updated = await addEquipmentType(newType);
    setEquipmentTypes(updated);
    return updated;
  };

  const handleRemoveEquipmentType = async (typeToRemove: string) => {
    const updated = await removeCustomEquipmentType(typeToRemove);
    setEquipmentTypes(updated);
    return updated;
  };

  const handleSetPin = async (pin: string | null) => {
    await setSecurityPin(pin);
    setStoredPin(pin);
    setIsUnlocked(true);
  };

  // Optional PIN Lock Screen
  if (storedPin && !isUnlocked) {
    return (
      <div className="min-h-screen bg-[#041B3E] text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-slate-900/90 border border-sky-400/25 rounded-3xl p-6 shadow-2xl text-center space-y-5">
          <img
            src="/icon.svg"
            alt="RutaTrack"
            className="w-20 h-20 rounded-2xl mx-auto shadow-lg"
          />
          <div>
            <h1 className="text-xl font-extrabold">Ruta Track</h1>
            <p className="text-xs text-sky-200/80 mt-1">
              Ingresa tu PIN de seguridad para acceder al Control de Vehículos
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (unlockAttempt === storedPin) {
                setIsUnlocked(true);
                setUnlockError(false);
              } else {
                setUnlockError(true);
              }
            }}
            className="space-y-3"
          >
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={unlockAttempt}
              onChange={(e) => {
                setUnlockAttempt(e.target.value);
                setUnlockError(false);
              }}
              placeholder="••••"
              className="w-full h-14 text-center text-2xl font-mono-plate tracking-[0.4em] rounded-2xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-[#00A8FF]"
            />
            {unlockError && (
              <p className="text-xs font-bold text-red-400">
                PIN incorrecto. Inténtalo de nuevo.
              </p>
            )}
            <button
              type="submit"
              className="w-full min-h-[50px] rounded-2xl bg-[#00A8FF] hover:bg-sky-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Desbloquear
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isSearchingOrFiltering =
    Boolean(filters.searchQuery.trim()) || activeFilterCount > 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* TOP BAR CONTRACT: 3 Zones (Brand, Nav Links on Desktop, Primary Action) */}
      <header className="sticky top-0 z-30 bg-[#041B3E] text-white border-b border-[#082A5E] shadow-xs">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Zone 1: Brand */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 text-left focus:outline-none"
          >
            <RutaTrackLogo variant="compact" />
          </button>

          {/* Zone 2: Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className={`hover:text-white transition py-1 ${
                activeTab === 'home'
                  ? 'text-[#00A8FF] underline underline-offset-4'
                  : ''
              }`}
            >
              Inicio
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vehicles')}
              className={`hover:text-white transition py-1 ${
                activeTab === 'vehicles'
                  ? 'text-[#00A8FF] underline underline-offset-4'
                  : ''
              }`}
            >
              Vehículos ({vehicles.length})
            </button>
            <button
              type="button"
              onClick={() => setIsScannerModalOpen(true)}
              className="hover:text-white transition py-1"
            >
              Digitalizar OCR
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`hover:text-white transition py-1 ${
                activeTab === 'settings'
                  ? 'text-[#00A8FF] underline underline-offset-4'
                  : ''
              }`}
            >
              Configuración
            </button>
          </nav>

          {/* Zone 3: Primary Action (Install or Digitalizar) */}
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 px-2 py-1 rounded-lg bg-amber-500/15">
                <WifiOff className="w-3.5 h-3.5" />
                Offline
              </span>
            )}

            {isInstallable && !isInstalled ? (
              <button
                type="button"
                onClick={install}
                className="min-h-[38px] px-3 rounded-xl bg-[#00A8FF] hover:bg-sky-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-xs whitespace-nowrap transition"
              >
                <Download className="w-3.5 h-3.5" />
                Instalar App
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsScannerModalOpen(true)}
                className="min-h-[38px] px-3 rounded-xl bg-[#00A8FF] hover:bg-sky-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-xs whitespace-nowrap transition"
              >
                <Camera className="w-3.5 h-3.5" />
                Digitalizar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT CONTENT */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-4 pb-24 space-y-5">
        {/* Shared Fast Search & Filter Block on Home and Vehicles screens */}
        {(activeTab === 'home' || activeTab === 'vehicles') && (
          <section className="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-xs space-y-3.5">
            {/* Large Search Bar (Req 1 & 7) */}
            <div className="relative">
              <Search className="w-5 h-5 text-sky-600 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={filters.searchQuery}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    searchQuery: e.target.value,
                  }))
                }
                placeholder="Buscar patente, remolque, chofer, empresa, marca..."
                className="w-full h-14 pl-12 pr-11 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:border-[#00A8FF] focus:bg-white text-base font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium focus:outline-none transition"
              />
              {filters.searchQuery && (
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, searchQuery: '' }))
                  }
                  className="min-h-[44px] min-w-[44px] absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400 hover:text-slate-700"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Quick Equipment Type Segmented Filter + Toggle More Filters (Req 8) */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {['Todos', ...equipmentTypes].map((type) => {
                  const active = filters.tipoEquipo === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({ ...prev, tipoEquipo: type }))
                      }
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition ${
                        active
                          ? 'bg-[#041B3E] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                className={`min-h-[40px] px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 transition ${
                  showAdvancedFilters || activeFilterCount > 0
                    ? 'bg-sky-50 border-sky-300 text-sky-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filtros</span>
                {activeFilterCount > 0 && (
                  <span className="font-mono-plate font-extrabold text-sky-700">
                    ({activeFilterCount})
                  </span>
                )}
              </button>
            </div>

            {/* Combinable Dropdown Filters: Empresa, Marca, Color */}
            {showAdvancedFilters && (
              <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Empresa
                  </label>
                  <select
                    value={filters.empresa}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        empresa: e.target.value,
                      }))
                    }
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800"
                  >
                    <option value="Todas">Todas las empresas</option>
                    {uniqueCompanies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Marca
                  </label>
                  <select
                    value={filters.marca}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, marca: e.target.value }))
                    }
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800"
                  >
                    <option value="Todas">Todas las marcas</option>
                    {uniqueBrands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Color
                  </label>
                  <select
                    value={filters.color}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, color: e.target.value }))
                    }
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800"
                  >
                    <option value="Todos">Todos los colores</option>
                    {uniqueColors.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                {activeFilterCount > 0 && (
                  <div className="sm:col-span-3 flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restablecer todos los filtros
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* TAB 1: PANTALLA PRINCIPAL (HOME) */}
        {activeTab === 'home' && (
          <div className="space-y-5">
            {/* Primary Ergonomic Action Buttons (Req 1: ➕ Nuevo registro, 📷 Digitalizar documento, 🚛 Vehículos registrados) */}
            {!isSearchingOrFiltering && (
              <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* ➕ Nuevo registro */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingVehicle(null);
                    setIsFormModalOpen(true);
                  }}
                  className="min-h-[82px] p-4 rounded-3xl bg-[#041B3E] hover:bg-[#082A5E] text-white flex items-center gap-3.5 shadow-sm active:scale-[0.99] transition text-left"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 text-[#00A8FF]">
                    <Plus className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="block text-sm font-extrabold">
                      Nuevo registro
                    </span>
                    <span className="block text-xs text-sky-200/80 mt-0.5">
                      Crear ficha manual
                    </span>
                  </div>
                </button>

                {/* 📷 Digitalizar documento */}
                <button
                  type="button"
                  onClick={() => setIsScannerModalOpen(true)}
                  className="min-h-[82px] p-4 rounded-3xl bg-[#00A8FF] hover:bg-sky-400 text-slate-950 flex items-center gap-3.5 shadow-sm active:scale-[0.99] transition text-left"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-950/10 flex items-center justify-center shrink-0 text-slate-950">
                    <Camera className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <div>
                    <span className="block text-sm font-extrabold">
                      Digitalizar documento
                    </span>
                    <span className="block text-xs text-slate-900/80 font-medium mt-0.5">
                      Cámara, Galería o PDF con IA
                    </span>
                  </div>
                </button>

                {/* 🚛 Vehículos registrados */}
                <button
                  type="button"
                  onClick={() => setActiveTab('vehicles')}
                  className="min-h-[82px] p-4 rounded-3xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 flex items-center gap-3.5 shadow-xs active:scale-[0.99] transition text-left"
                >
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0 text-sky-700">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="block text-sm font-extrabold">
                      Vehículos registrados
                    </span>
                    <span className="block text-xs text-slate-500 font-semibold mt-0.5 tabular-nums">
                      Ver las {vehicles.length} fichas guardadas
                    </span>
                  </div>
                </button>
              </section>
            )}

            {/* Instant Search Results or Recent Vehicles List */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-extrabold text-slate-900">
                  {isSearchingOrFiltering
                    ? `Resultados encontrados (${filteredVehicles.length})`
                    : `Vehículos Registrados (${vehicles.length})`}
                </h2>
                {isSearchingOrFiltering && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700"
                  >
                    Ver todos
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-xs font-semibold text-slate-500">
                  Cargando base de datos local...
                </div>
              ) : filteredVehicles.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-extrabold text-slate-900">
                      No se encontraron vehículos coincidentes
                    </p>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Prueba con otra parte de la patente, nombre del chofer o
                      limpia los filtros activos.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                    {isSearchingOrFiltering && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800"
                      >
                        Limpiar búsqueda
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingVehicle(null);
                        setIsFormModalOpen(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[#041B3E] text-white text-xs font-bold"
                    >
                      + Registrar nuevo vehículo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredVehicles.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      onSelect={(v) => setSelectedVehicleId(v.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: LISTA COMPLETA DE VEHÍCULOS (Req 9) */}
        {activeTab === 'vehicles' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h1 className="text-base font-extrabold text-slate-900">
                  Flota de Vehículos Registrados
                </h1>
                <p className="text-xs text-slate-500 tabular-nums">
                  Mostrando {filteredVehicles.length} de {vehicles.length}{' '}
                  unidades almacenadas en el teléfono
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingVehicle(null);
                  setIsFormModalOpen(true);
                }}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#041B3E] text-white text-xs font-extrabold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-[#00A8FF]" />
                Nuevo
              </button>
            </div>

            {filteredVehicles.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
                <p className="text-sm font-extrabold text-slate-900">
                  Sin coincidencias para el filtro actual
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-800"
                >
                  Mostrar todos los vehículos
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredVehicles.map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    onSelect={(v) => setSelectedVehicleId(v.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: CONFIGURACIÓN Y COPIA DE SEGURIDAD (Req 12, 13, 15) */}
        {activeTab === 'settings' && (
          <SettingsView
            vehicles={vehicles}
            equipmentTypes={equipmentTypes}
            securityPin={storedPin}
            onAddEquipmentType={handleAddEquipmentType}
            onRemoveEquipmentType={handleRemoveEquipmentType}
            onSetSecurityPin={handleSetPin}
            onDataRestored={loadDatabase}
          />
        )}
      </main>

      {/* MOBILE BOTTOM TAB BAR (Thumb-Zone Navigation Pattern) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe">
        <div className="max-w-3xl mx-auto grid grid-cols-4 items-center h-16">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`h-full flex flex-col items-center justify-center transition ${
              activeTab === 'home'
                ? 'text-[#041B3E] font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Home
              className={`w-5 h-5 ${
                activeTab === 'home' ? 'text-[#00A8FF]' : ''
              }`}
            />
            <span className="text-[11px] mt-1 tracking-tight">Inicio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vehicles')}
            className={`h-full flex flex-col items-center justify-center transition ${
              activeTab === 'vehicles'
                ? 'text-[#041B3E] font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck
              className={`w-5 h-5 ${
                activeTab === 'vehicles' ? 'text-[#00A8FF]' : ''
              }`}
            />
            <span className="text-[11px] mt-1 tracking-tight tabular-nums">
              Vehículos ({vehicles.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsScannerModalOpen(true)}
            className="h-full flex flex-col items-center justify-center text-slate-600 hover:text-slate-900 transition"
          >
            <Camera className="w-5 h-5 text-sky-600" />
            <span className="text-[11px] font-bold mt-1 tracking-tight">
              Digitalizar
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`h-full flex flex-col items-center justify-center transition ${
              activeTab === 'settings'
                ? 'text-[#041B3E] font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings
              className={`w-5 h-5 ${
                activeTab === 'settings' ? 'text-[#00A8FF]' : ''
              }`}
            />
            <span className="text-[11px] mt-1 tracking-tight">
              Configuración
            </span>
          </button>
        </div>
      </nav>

      {/* MODAL 1: REGISTRO / EDICIÓN MANUAL DE VEHÍCULO */}
      <VehicleFormModal
        isOpen={isFormModalOpen}
        editingVehicle={editingVehicle}
        allVehicles={vehicles}
        equipmentTypes={equipmentTypes}
        existingCompanies={uniqueCompanies}
        existingBrands={uniqueBrands}
        existingColors={uniqueColors}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingVehicle(null);
        }}
        onSave={handleSaveVehicle}
        onAddEquipmentType={handleAddEquipmentType}
        onOpenExistingVehicle={(veh) => setSelectedVehicleId(veh.id)}
      />

      {/* MODAL 2: DIGITALIZACIÓN AUTOMÁTICA CON OCR/IA Y REVISIÓN ANTES DE GUARDAR */}
      <DocumentScannerModal
        isOpen={isScannerModalOpen}
        isOnline={isOnline}
        allVehicles={vehicles}
        equipmentTypes={equipmentTypes}
        onClose={() => setIsScannerModalOpen(false)}
        onSaveVehicle={handleSaveVehicle}
        onAddEquipmentType={handleAddEquipmentType}
        onOpenExistingVehicle={(veh) => setSelectedVehicleId(veh.id)}
      />

      {/* MODAL 3: FICHA COMPLETA DEL VEHÍCULO */}
      <VehicleDetailModal
        vehicle={selectedVehicle}
        onClose={() => setSelectedVehicleId(null)}
        onEdit={(veh) => {
          setSelectedVehicleId(null);
          setEditingVehicle(veh);
          setIsFormModalOpen(true);
        }}
        onUpdateVehicle={handleSaveVehicle}
        onDeleteVehicle={handleDeleteVehicle}
      />
    </div>
  );
}
