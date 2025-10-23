#!/usr/bin/env bash
# upload_fs.sh — Build and upload SPIFFS/LittleFS data for ESP32
# Usage:
#   ./upload_fs.sh [--cleanup] [--usbport <num>] [--checkacm [<num>]]

set -euo pipefail

VENV_DIR="venv"
BIN_FILE="littlefs.bin"
MOUNT_ADDR="0x290000"
MKSRC_URL="https://github.com/earlephilhower/mklittlefs/releases/download/4.1.0/x86_64-linux-gnu-mklittlefs-42acb97.tar.gz"
MKTAR="mklittlefs.tar.gz"
MKDIR_TMP="mklittlefs_extracted"
MKEXEC="./mklittlefs_bin"   # renamed to avoid conflict

CLEANUP=false
PORT=""
UPLOAD_SUCCESS=false
MK_DOWNLOADED=false

USBPORT_ARG=""
CHECKACM_ARG=""

# --- Cleanup function ---
cleanup_on_exit() {
  if [ "$CLEANUP" = true ]; then
    echo "🧹 Performing cleanup..."
    rm -f "$MKTAR" 2>/dev/null || true
    rm -rf "$MKDIR_TMP" 2>/dev/null || true
    rm -rf "$VENV_DIR" 2>/dev/null || true
    if [ "$UPLOAD_SUCCESS" = true ]; then
      rm -f "$BIN_FILE" 2>/dev/null || true
    fi
    if [ "$MK_DOWNLOADED" = true ] && [ -f "$MKEXEC" ]; then
      echo "🗑️ Removing downloaded mklittlefs binary..."
      rm -f "$MKEXEC"
    fi
    echo "🧽 Cleanup complete."
  fi
}
trap cleanup_on_exit EXIT

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
  case $1 in
    --cleanup) CLEANUP=true; shift ;;
    --usbport)
      if [[ -n "${2:-}" && ! $2 =~ ^-- ]]; then
        USBPORT_ARG="$2"; shift 2
      else
        echo "❌ Missing value for --usbport"; exit 1
      fi
      ;;
    --checkacm)
      if [[ -n "${2:-}" && ! $2 =~ ^-- ]]; then
        CHECKACM_ARG="$2"; shift 2
      else
        CHECKACM_ARG="true"; shift
      fi
      ;;
    *)
      echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# --- Determine port ---
if [[ -n "$USBPORT_ARG" ]]; then
  PORT="/dev/ttyUSB${USBPORT_ARG}"
elif [[ -n "$CHECKACM_ARG" && "$CHECKACM_ARG" != "true" ]]; then
  PORT="/dev/ttyACM${CHECKACM_ARG}"
elif [[ "$CHECKACM_ARG" == "true" ]]; then
  PORT=$(ls /dev/ttyACM* 2>/dev/null | head -n1 || true)
else
  PORT=$(ls /dev/ttyUSB* 2>/dev/null | head -n1 || true)
fi

if [ -z "$PORT" ]; then
  echo "❌ No ESP32 device detected!"
  exit 1
fi
echo "🔌 Using port: $PORT"

# --- Ensure mklittlefs exists or download ---
if [ ! -x "$MKEXEC" ]; then
  echo "📥 mklittlefs not found — downloading..."
  curl -L "$MKSRC_URL" -o "$MKTAR"
  mkdir -p "$MKDIR_TMP"
  tar -xzf "$MKTAR" -C "$MKDIR_TMP"

  MKFOUND=$(find "$MKDIR_TMP" -type f -name "mklittlefs" | head -n1 || true)
  if [ -n "$MKFOUND" ]; then
    echo "✅ Found mklittlefs at: $MKFOUND"
    cp "$MKFOUND" "$MKEXEC"
    chmod +x "$MKEXEC"
    MK_DOWNLOADED=true
  else
    echo "❌ Could not locate mklittlefs binary!"
    exit 1
  fi
else
  echo "✅ Using existing mklittlefs binary: $MKEXEC"
fi

# --- Setup Python venv ---
if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"
pip install --upgrade pip >/dev/null
if python -m esptool version >/dev/null 2>&1; then
  pip install --upgrade esptool >/dev/null
else
  pip install esptool >/dev/null
fi

# --- Build and flash ---
"$MKEXEC" -c data -b 4096 -p 256 -s 0x150000 "$BIN_FILE"
echo "🗜️  Created: $BIN_FILE"

if esptool --chip esp32 --port "$PORT" write_flash "$MOUNT_ADDR" "$BIN_FILE"; then
  echo "⚡ Flash successful!"
  UPLOAD_SUCCESS=true
else
  echo "❌ Flash failed!"
  exit 1
fi

echo "🎯 Done!"
