#!/usr/bin/env bash
# Прогоняет бенчи на Node 20/22/24 через nvm и сохраняет результаты в results/.
# Использование: bash scripts/bench-all-nodes.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=/dev/null
source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"

mkdir -p results

for v in 20 22 24; do
  echo "▶ Node $v..."
  nvm use "$v" --silent
  {
    echo "Node: $(node -v) | V8: $(node -e 'process.stdout.write(process.versions.v8)') | Date: $(date +%Y-%m-%d)"
    echo ""
    node --expose-gc bench/shapes.mjs
    echo ""
    node --expose-gc bench/creation.mjs
  } > "results/node-$v.txt"
  echo "  ✓ results/node-$v.txt"
done

echo "Готово."
