#!/usr/bin/env bash
# ==============================================================================
# RUTA TRACK - CONTROL DE VEHÍCULOS
# Script automatizado de empaquetado Android con Capacitor 6+
# Genera:
#   - ./RutaTrack-instalable.apk (APK instalable directo en teléfonos Android)
#   - ./RutaTrack-release.aab    (Opcional con flag --aab para Google Play)
# ==============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "========================================================"
echo "  RUTA TRACK - Empaquetador Oficial Android (Capacitor) "
echo "========================================================"

# 1. Verificar dependencias instaladas
if [ ! -d "node_modules/@capacitor/core" ] || [ ! -d "node_modules/@capacitor/android" ]; then
  echo "[1/5] Instalando dependencias de Capacitor..."
  npm install
else
  echo "[1/5] Dependencias de Capacitor verificadas."
fi

# 2. Compilar el bundle de producción (Vite -> dist/)
echo "[2/5] Compilando aplicación web (npm run build -> dist/)..."
npm run build

# 3. Crear o sincronizar el proyecto nativo Android con Capacitor
if [ ! -d "android" ]; then
  echo "[3/5] Generando plataforma nativa Android (npx cap add android)..."
  npx cap add android
else
  echo "[3/5] Carpeta android/ detectada."
fi

echo "      Sincronizando activos web con Capacitor (npx cap sync android)..."
npx cap sync android

# 4. Inyectar permisos requeridos (Cámara, Fotos y Archivos) en AndroidManifest.xml
MANIFEST_FILE="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST_FILE" ]; then
  echo "[4/5] Verificando permisos de Cámara y Archivos en AndroidManifest.xml..."
  if ! grep -q "android.permission.CAMERA" "$MANIFEST_FILE"; then
    node -e '
      const fs = require("fs");
      const file = "android/app/src/main/AndroidManifest.xml";
      let xml = fs.readFileSync(file, "utf8");
      const permissions = `
    <!-- Permisos Ruta Track: Cámara, Galería y Documentos PDF -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
`;
      xml = xml.replace("</manifest>", permissions + "</manifest>");
      fs.writeFileSync(file, xml, "utf8");
    '
    echo "      Permisos de Cámara, Galería y Documentos agregados correctamente."
  else
    echo "      Permisos ya presentes en AndroidManifest.xml."
  fi
fi

# 5. Compilar el APK instalable usando Gradle Wrapper
echo "[5/5] Compilando APK instalable con Gradle..."
chmod +x android/gradlew
(cd android && ./gradlew assembleDebug)

APK_SOURCE="android/app/build/outputs/apk/debug/app-debug.apk"
APK_DEST="./RutaTrack-instalable.apk"

if [ -f "$APK_SOURCE" ]; then
  cp "$APK_SOURCE" "$APK_DEST"
  echo "========================================================"
  echo "✅ APK INSTALABLE GENERADO EXITOSAMENTE:"
  echo "   Archivo: $APK_DEST"
  echo "========================================================"
else
  echo "❌ Error: No se encontró el archivo APK esperado en $APK_SOURCE"
  exit 1
fi

# Compilación opcional de Android App Bundle (.aab) si se pasa el argumento --aab
if [[ "${1:-}" == "--aab" ]]; then
  echo "Generando Android App Bundle (.aab) para Google Play..."
  (cd android && ./gradlew bundleRelease)
  AAB_SOURCE="android/app/build/outputs/bundle/release/app-release.aab"
  if [ -f "$AAB_SOURCE" ]; then
    cp "$AAB_SOURCE" "./RutaTrack-release.aab"
    echo "✅ AAB generado exitosamente en: ./RutaTrack-release.aab"
  fi
fi
