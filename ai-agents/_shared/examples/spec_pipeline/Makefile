# Spec pipeline · one-command run
PY := /media/praveen/praveenlinux21/praveen/aman/cuda/venv/bin/python

.PHONY: all goal spec validate tests scaffolding drill clean

all: goal spec validate tests scaffolding drill

goal:
	@echo "── 1. Goal ─────────────────"
	@cat 1-goal.md

spec:
	@echo "── 2. GSD spec ─────────────"
	@head -20 2-spec.yaml
	@echo "  ... (truncated)"

validate:
	@echo "── 3. openspec validate ────"
	@$(PY) -c "import yaml; yaml.safe_load(open('3-spec.openspec.yaml')); print('  ✓ valid YAML')"

tests:
	@echo "── 4. spec-kit tests ───────"
	@$(PY) -c "import yaml; d=yaml.safe_load(open('4-tests.yaml')); print(f'  ✓ {len(d[\"tests\"])} test contracts')"

scaffolding:
	@echo "── 5. impl scaffolding ─────"
	@$(PY) -c "import ast; ast.parse(open('5-impl-scaffolding.py').read()); print('  ✓ syntax ok')"

drill:
	@echo "── 6. drill ────────────────"
	@$(PY) 6-drill.py

clean:
	@echo "(no artifacts to clean)"
