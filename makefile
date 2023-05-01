VERSION := $(shell cat manifest.json | jq .version)


.PHONY: firefox
firefox:
	# ifneq (,$(wildcard blue-blocker-firefox-$(VERSION).zip))
	# 	rm "blue-blocker-firefox-${VERSION}.zip"
	# endif

	mv manifest.json chrome-manifest.json
	mv firefox-manifest.json manifest.json
	zip "blue-blocker-firefox-${VERSION}.zip" \
		manifest.json \
		LICENSE \
		readme.md \
		popup.html \
		style.css \
		inject.js \
		main.js \
		options.js \
		script.js \
		service_worker.js \
		shared.js \
		assets/*
	mv manifest.json firefox-manifest.json
	mv chrome-manifest.json manifest.json

.PHONY: chrome
chrome:
	# ifneq (,$(wildcard blue-blocker-chrome-$(VERSION).zip))
	# 	rm "blue-blocker-chrome-${VERSION}.zip"
	# endif
	zip "blue-blocker-chrome-${VERSION}.zip" \
		manifest.json \
		LICENSE \
		readme.md \
		popup.html \
		style.css \
		inject.js \
		main.js \
		options.js \
		script.js \
		service_worker.js \
		shared.js \
		assets/*
