.PHONY: assets clean help

help:
	@echo "Bunker Asset Pipeline"
	@echo "---------------------"
	@echo "make assets - Process original images from assets_orig/ to assets/ using config.json dimensions"
	@echo "make clean  - Clear the assets/ directory"

assets:
	@echo "Processing vault assets..."
	@python3 process_assets.py
	@echo "Assets synchronized."

clean:
	@echo "Clearing production assets..."
	rm -rf assets/*
	@echo "Done."
