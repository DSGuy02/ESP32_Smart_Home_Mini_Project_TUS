#!/usr/bin/env bash
# upload_fs.sh — Build and upload SPIFFS/LittleFS data for ESP32
# Usage:
#   ./upload_fs.sh
#   ./upload_fs.sh --cleanup
#   ./upload_fs.sh --usbport 0
#   ./upload_fs.sh --checkacm
#   ./upload_fs.sh --checkacm 1
#   (can combine, e.g. ./upload_fs.sh --checkacm --cleanup)

set -euo pipefail

VENV_DIR="venv"
BIN_FILE="littlefs.bin"
MOUNT_ADDR="0x290000"
MKSRC_URL="https://github.com/earlephilhower/mklittlefs/releases/download/4.1.0/x86_64-linux-gnu-mklittlefs-42acb97.tar.gz"
MKTAR="mklittlefs.tar.gz"
MKDIR_TMP="mklittlefs"
MKEXEC="./mklittlefs"

CLEANUP=false
PORT=""

# --- Parse arguments ---
USBPORT_ARG=""
CHECKACM_ARG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --cleanup)
      CLEANUP=true
      shift
      ;;
    --usbport)
      if [[ -n "${2:-}" && ! $2 =~ ^-- ]]; then
        USBPORT_ARG="$2"
        shift 2
      else
        echo "❌ Missing value for --usbport"
        exit 1
      fi
      ;;
    --checkacm)
      if [[ -n "${2:-}" && ! $2 =~ ^-- ]]; then
        CHECKACM_ARG="$2"
        shift 2
      else
        CHECKACM_ARG="true"  # flag only, no number
        shift
      fi
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--cleanup] [--usbport <num>] [--checkacm [<num>]]"
      exit 1
      ;;
  esac
done

# --- Determine port ---
if [[ -n "$USBPORT_ARG" ]]; then
  PORT="/dev/ttyUSB${USBPORT_ARG}"
elif [[ -n "$CHECKACM_ARG" && "$CHECKACM_ARG" != "true" ]]; then
  PORT="/dev/ttyACM${CHECKACM_ARG}"
elif [[ "$CHECKACM_ARG" == "true" ]]; then
  PORT=$(ls /dev/ttyACM* 2>/dev/null | head -n 1 || true)
else
  PORT=$(ls /dev/ttyUSB* 2>/dev/null | head -n 1 || true)
fi

if [ -z "$PORT" ]; then
  echo "❌ No ESP32 device detected!"
  echo "👉 Try connecting your device or specify manually with:"
  echo "   --usbport <num> or --checkacm [<num>]"
  exit 1
fi

echo "🔌 Using detected ESP32 port: $PORT"

# --- Ensure mklittlefs exists, or download it ---
if [ ! -x "$MKEXEC" ]; then
  echo "📥 mklittlefs not found — downloading from GitHub..."
  curl -L "$MKSRC_URL" -o "$MKTAR"
  echo "📦 Extracting..."
  mkdir -p "$MKDIR_TMP"
  tar -xzf "$MKTAR" -C "$MKDIR_TMP"
  if [ -f "$MKDIR_TMP/mklittlefs/mklittlefs" ]; then
    mv "$MKDIR_TMP/mklittlefs/mklittlefs" .
    chmod +x "$MKEXEC"
    echo "✅ mklittlefs ready."
  else
    echo "❌ Failed to extract mklittlefs binary!"
    exit 1
  fi
fi

# --- Create venv if missing ---
if [ ! -d "$VENV_DIR" ]; then
  echo "🧱 Creating Python virtual environment..."
  python3 -m venv "$VENV_DIR"
fi

# --- Activate venv ---
echo "🐍 Activating virtual environment..."
# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

# --- Upgrade pip ---
echo "⬆️  Upgrading pip..."
pip install --upgrade pip >/dev/null

# --- Install or update esptool ---
echo "🔧 Checking esptool installation..."
if python -m esptool version >/dev/null 2>&1; then
  echo "✅ esptool already installed — updating..."
  pip install --upgrade esptool >/dev/null
else
  echo "📦 Installing esptool..."
  pip install esptool >/dev/null
fi

# --- Build LittleFS image ---
echo "🗜️  Building LittleFS image..."
"$MKEXEC" -c data -b 4096 -p 256 -s 0x150000 "$BIN_FILE"
echo "✅ Created: $BIN_FILE"

# --- Flash to ESP32 ---
echo "⚡ Flashing LittleFS to ESP32 on $PORT..."
if esptool --chip esp32 --port "$PORT" write_flash "$MOUNT_ADDR" "$BIN_FILE"; then
  echo "✅ Flash successful!"

  # --- Cleanup ---
  if [ "$CLEANUP" = true ]; then
    echo "🧹 Performing cleanup..."
    rm -f "$BIN_FILE" "$MKTAR"
    rm -rf "$MKDIR_TMP"
    rm -rf "$VENV_DIR"
    echo "🧽 Deleted venv, binary, and downloaded files."
  else
    echo "🧹 Keeping venv and build artifacts (use --cleanup to remove)."
  fi
else
  echo "❌ Flash failed — keeping $BIN_FILE for inspection."
  exit 1
fi

echo "🎯 Done!"
