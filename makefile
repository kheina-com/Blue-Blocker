NULL := $(shell rm -rf build && npm run build)
VERSION := $(shell cat build/manifest.json | jq .version)

.PHONY: firefox
firefox:
	# ifneq (,$(wildcard blue-blocker-firefox-$(VERSION).zip))
	# 	rm "blue-blocker-firefox-${VERSION}.zip"
	# endif

	# create temp copy of chrome manifest
	cp build/manifest.json firefox-manifest.json
	# change version to 2
	jq '.manifest_version = 2' firefox-manifest.json >tmp.json && mv tmp.json firefox-manifest.json
	# change background object to use script instead of service worker
	jq '.background = {"scripts": ["service-worker-loader.js"],"type": "module"}' firefox-manifest.json >tmp.json && mv tmp.json firefox-manifest.json
	# make web_accessible_resources an array of strings
	jq '.web_accessible_resources = .web_accessible_resources[0].resources' firefox-manifest.json >tmp.json && mv tmp.json firefox-manifest.json
	# move action to browser_action
	jq '.["browser_action"] = .action | del(.action)' firefox-manifest.json >tmp.json && mv tmp.json firefox-manifest.json
	# replace chrome manifest with firefox manifest
	mv firefox-manifest.json build/manifest.json


	zip "blue-blocker-firefox-${VERSION}.zip" \
		build/* \
		LICENSE \
		README.md

.PHONY: chrome
chrome:
	# ifneq (,$(wildcard blue-blocker-chrome-$(VERSION).zip))
	# 	rm "blue-blocker-chrome-${VERSION}.zip"
	# endif
	zip "blue-blocker-chrome-${VERSION}.zip" \
		build/* \
		LICENSE \
		README.md

