#!/usr/bin/env bash
# Download yoga-related datasets and seed data for SohamYoga
# Run: bash download-datasets.sh
# Requires: curl, unzip. Kaggle downloads require KAGGLE_USERNAME + KAGGLE_KEY in .env

set -euo pipefail

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/datasets"
mkdir -p "$BASE/yoga_poses" "$BASE/asana_library" "$BASE/audio_guides"

echo "=== SohamYoga: downloading datasets ==="

# --- 1. Yoga pose JSON seed (open, no auth) ---
POSES_JSON="$BASE/asana_library/yoga_poses_open.json"
if [ ! -f "$POSES_JSON" ]; then
  echo "[download] Open yoga pose dataset..."
  curl -fsSL "https://raw.githubusercontent.com/rebeccaansems/yoga-pose-dataset/main/yoga_poses.json" \
    -o "$POSES_JSON" 2>/dev/null || echo "  [skip] Could not reach; add manually"
else
  echo "[skip] $POSES_JSON already exists"
fi

# --- 2. Kaggle: yoga pose images (requires Kaggle API key) ---
if [ -n "${KAGGLE_USERNAME:-}" ] && [ -n "${KAGGLE_KEY:-}" ]; then
  POSES_DIR="$BASE/yoga_poses/images"
  if [ ! -d "$POSES_DIR" ]; then
    echo "[download] Kaggle yoga pose images..."
    pip install kaggle --quiet
    mkdir -p "$POSES_DIR"
    KAGGLE_CONFIG_DIR="$(mktemp -d)"
    echo "{\"username\":\"$KAGGLE_USERNAME\",\"key\":\"$KAGGLE_KEY\"}" > "$KAGGLE_CONFIG_DIR/kaggle.json"
    chmod 600 "$KAGGLE_CONFIG_DIR/kaggle.json"
    KAGGLE_CONFIG_DIR="$KAGGLE_CONFIG_DIR" kaggle datasets download -d niharika41298/yoga-poses-dataset -p "$POSES_DIR" --unzip
    echo "  Yoga pose images downloaded."
  else
    echo "[skip] yoga_poses/images already exists"
  fi
else
  echo "[skip] Set KAGGLE_USERNAME and KAGGLE_KEY in environment to download yoga pose images"
  cat > "$BASE/yoga_poses/DOWNLOAD_INSTRUCTIONS.txt" <<'EOF'
To download yoga pose images from Kaggle:
  1. Create a Kaggle account at kaggle.com
  2. Go to Account → API → Create New API Token → downloads kaggle.json
  3. Set: export KAGGLE_USERNAME=your_username  KAGGLE_KEY=your_key
  4. Re-run: bash download-datasets.sh

Dataset: https://www.kaggle.com/datasets/niharika41298/yoga-poses-dataset
Contains: 5 class yoga pose images (Downdog, Goddess, Plank, Tree, Warrior2)
EOF
fi

# --- 3. Pranayama guide text (public domain) ---
PRANAYAMA_FILE="$BASE/asana_library/pranayama_techniques.json"
if [ ! -f "$PRANAYAMA_FILE" ]; then
  cat > "$PRANAYAMA_FILE" <<'EOF'
[
  {"id":"nadi_shodhana","name":"Nadi Shodhana","englishName":"Alternate Nostril Breathing","duration":"5-10 min","dosha":["vata","pitta"],"benefits":["Balances left and right brain","Reduces anxiety","Improves concentration"],"steps":["Close right nostril with thumb, inhale left","Close left nostril, exhale right","Inhale right, close, exhale left — 1 cycle"]},
  {"id":"kapalabhati","name":"Kapalabhati","englishName":"Skull-Shining Breath","duration":"2-5 min","dosha":["kapha"],"benefits":["Energises the body","Strengthens core","Clears sinuses"],"steps":["Sit comfortably","Passive inhale, sharp exhale through nose contracting belly","1–2 pumps per second"],"contraindications":["Pregnancy","Hypertension","Hernia"]},
  {"id":"ujjayi","name":"Ujjayi","englishName":"Ocean Breath / Victorious Breath","duration":"Throughout practice","dosha":["tridosha"],"benefits":["Generates internal heat","Anchors attention","Regulates breath in flow"],"steps":["Slight constriction at back of throat","Breathe in and out through nose","Audible ocean sound"]},
  {"id":"bhramari","name":"Bhramari","englishName":"Bee Breath","duration":"3-5 min","dosha":["vata","pitta"],"benefits":["Immediate stress relief","Lowers blood pressure","Calms mind instantly"],"steps":["Close eyes, place thumbs on ears","Inhale deeply","Exhale with humming sound — feel vibration in skull"]}
]
EOF
  echo "Pranayama techniques JSON created."
fi

echo ""
echo "==================================="
echo "Datasets saved to: $BASE"
echo "  $BASE/asana_library/  — pose + pranayama JSON"
echo "  $BASE/yoga_poses/     — images (Kaggle, if keys set)"
