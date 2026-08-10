#!/usr/bin/env bash
# download_kaggle_datasets.sh — mass-download every dataset referenced in
# docs/AI_USE_CASES_TOP_1_PERCENT.md (Blocks A · B · C · D · E · F).
#
# Per global §36: Kaggle credentials already installed at ~/.kaggle/kaggle.json.
# Per operator instruction 2026-06-08: "data must be downloaded".

set -uo pipefail
cd "$(dirname "$0")/.."

ROOT="data/raw"
mkdir -p "$ROOT"

declare -A DATASETS=(
  # Block A · Zero-coverage
  ["car-damage"]="hamzamanssor/car-damage-assessment"
  ["xview-property"]="rhammell/planesnet"
  ["creditcard-fraud"]="mlg-ulb/creditcardfraud"
  ["ieee-fraud"]="ieee-fraud-detection"   # competition · use kaggle competitions
  ["unsw-nb15"]="mrwellsdavid/unsw-nb15"
  ["cross-sell"]="anmolkumar/health-insurance-cross-sell-prediction"

  # Block B · Low-coverage
  ["roof-damage"]="ckay16/roof-damage-detection"
  ["customer-service-tickets"]="nikhilreddy123/customer-service-ticket-data"
  ["aml-transactions"]="ealtman2019/ibm-transactions-for-anti-money-laundering-aml"
  ["total-loss-vehicle"]="goyaladi/total-loss-vehicle-claims"
  ["insurance-classic"]="mirichoi0218/insurance"

  # Block C · Architecture
  ["ravdess-audio"]="uwrfkaggler/ravdess-emotional-speech-audio"
  ["policy-corpus"]="hsankesara/policy-language-corpus"
  ["telco-churn"]="blastchar/telco-customer-churn"
  ["hurricane-noaa"]="noaa/atlantic-hurricane-database"

  # Block D · Missing scenarios
  ["sample-insurance-claim"]="sjayachandran1/sample-insurance-claim-prediction-dataset"
  ["handwriting"]="landlord/handwriting-recognition"

  # Block E · Stacked operator additions
  # (Anthropic hh-rlhf · common-voice · etc. live on HuggingFace not Kaggle · download via huggingface_hub)
)

# COUNT TRACKING
TOTAL=${#DATASETS[@]}
SUCCESS=0
SKIPPED=0
FAILED=0

echo "=== Kaggle mass-download · $TOTAL datasets ==="
echo ""

for KEY in "${!DATASETS[@]}"; do
  REF="${DATASETS[$KEY]}"
  DEST="$ROOT/$KEY"

  if [[ -d "$DEST" ]] && [[ -n "$(ls -A "$DEST" 2>/dev/null)" ]]; then
    echo "  [SKIP] $KEY · already populated"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  mkdir -p "$DEST"
  echo "  [DL]   $KEY ($REF)"

  if [[ "$KEY" == "ieee-fraud" ]]; then
    # Competition data needs `kaggle competitions download`
    if kaggle competitions download -c "$REF" -p "$DEST" 2>&1 | tail -3; then
      unzip -q "$DEST/$REF.zip" -d "$DEST" 2>/dev/null || true
      SUCCESS=$((SUCCESS + 1))
    else
      FAILED=$((FAILED + 1))
    fi
  else
    if kaggle datasets download -d "$REF" -p "$DEST" --unzip 2>&1 | tail -3; then
      SUCCESS=$((SUCCESS + 1))
    else
      FAILED=$((FAILED + 1))
    fi
  fi
done

echo ""
echo "=== HuggingFace mass-download (no Kaggle equivalent) ==="
HF_DATASETS=(
  "Anthropic/hh-rlhf"
  "mozilla-foundation/common_voice_15_0"
  "clinc/clinc150"
)
for HF in "${HF_DATASETS[@]}"; do
  HF_KEY=$(echo "$HF" | tr '/' '_')
  DEST="$ROOT/$HF_KEY"
  if [[ -d "$DEST" ]] && [[ -n "$(ls -A "$DEST" 2>/dev/null)" ]]; then
    echo "  [SKIP] $HF_KEY"
    continue
  fi
  mkdir -p "$DEST"
  echo "  [DL]   $HF_KEY"
  python3 -c "
from huggingface_hub import snapshot_download
try:
    snapshot_download(repo_id='$HF', repo_type='dataset', local_dir='$DEST')
    print('    OK')
except Exception as e:
    print(f'    FAIL: {e}')
" 2>&1 | tail -2 || true
done

echo ""
echo "=== External (non-Kaggle non-HF · manual notes) ==="
cat > "$ROOT/MANUAL_DOWNLOADS.md" <<'EOM'
# Manual download required for these datasets

The following datasets require accounts / registration / large bandwidth:

| Dataset | URL | Block reference |
|---|---|---|
| xView2 (post-disaster) | https://xview2.org/dataset | A2 property |
| CICIDS2017 (network) | http://205.174.165.80/CICDataset/CIC-IDS-2017/ | A4 cyber |
| Stanford LegalBench | https://hazyresearch.stanford.edu/legalbench/ | C2 long-doc transformer |
| ALLDATA OEM manuals | commercial | F2 hybrid |
| RSMeans cost data | commercial | F3 hybrid |
| US regulations.gov scrape | needs API key | D8 knowledge graph |
EOM

echo ""
echo "=== Summary ==="
echo "  total Kaggle datasets:  $TOTAL"
echo "  successfully downloaded: $SUCCESS"
echo "  skipped (already exist): $SKIPPED"
echo "  failed:                  $FAILED"
echo ""
echo "  Storage root: $ROOT"
echo "  Total size:   $(du -sh "$ROOT" 2>/dev/null | cut -f1)"
echo ""
echo "Next steps:"
echo "  1. Review $ROOT/MANUAL_DOWNLOADS.md for non-Kaggle/HF datasets"
echo "  2. Per §87.4 + operator instruction: run vector ingest cron to move embeddings:"
echo "     bash scripts/cron_install.sh  # installs <USE_CASE>-VECTOR-INGEST per use case"
echo "  3. Verify per-use-case G1-G12 mandatory subsections (per §90)"
