VERSION := $(shell cat manifest.json | jq .version)


.PHONY: firefox
firefox:
	# ifneq (,$(wildcard blue-blocker-firefox-$(VERSION).zip))
	# 	rm "blue-blocker-firefox-${VERSION}.zip"
	# endif

	mv manifest.json chrome-manifest.json
	mv firefox-manifest.json manifest.json
	zip "blue-blocker-firefox-${VERSION}.zip" \
		assets/icon-128.png \
		assets/icon.png \
		assets/error.png \
		injected/* \
		models/* \
		parsers/* \
		popup/* \
		pages/* \
		manifest.json \
		LICENSE \
		readme.md \
		*.js
	mv manifest.json firefox-manifest.json
	mv chrome-manifest.json manifest.json

.PHONY: chrome
chrome:
	# ifneq (,$(wildcard blue-blocker-chrome-$(VERSION).zip))
	# 	rm "blue-blocker-chrome-${VERSION}.zip"
	# endif
	zip "blue-blocker-chrome-${VERSION}.zip" \
		assets/icon-128.png \
		assets/icon.png \
		assets/error.png \
		injected/* \
		models/* \
		parsers/* \
		popup/* \
		pages/* \
		manifest.json \
		LICENSE \
		readme.md \
		*.js
