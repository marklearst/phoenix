PNPM ?= pnpm

.PHONY: help install run demo-error typecheck test check

help:
	@echo "install     Install this standalone package"
	@echo "run         Run a successful traced calculation (84 / 7)"
	@echo "demo-error  Trace a division-by-zero error and its explanation"
	@echo "check       Typecheck and test the local calculator without an API key"

install:
	$(PNPM) install --frozen-lockfile

run:
	$(PNPM) start

demo-error:
	$(PNPM) start --demo-error

typecheck:
	$(PNPM) typecheck

test:
	$(PNPM) test

check: typecheck test
