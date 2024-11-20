# Note: this makefile expects you to have run `npm install` and `npm run build`
# first before using it.

export PATH = $(shell echo "$${PATH}:./node_modules/node-jq/bin")

_ := $(shell rm -rf build && npm run build)
VERSION := $(shell cat build/manifest.json | jq .version)
PKG_VERSION := $(shell jq .version package.json)

ifneq ($(VERSION), $(PKG_VERSION))
$(error Extension version mismatch. manifest: $(VERSION), package.json: $(PKG_VERSION))
endif

.PHONY: version
version:
	@echo ${VERSION}

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
	jq '.web_accessible_resources = [.web_accessible_resources[].resources[]]' firefox-manifest.json >tmp.json && mv tmp.json firefox-manifest.json
# move action to browser_action
	jq '.["browser_action"] = .action | del(.action)' firefox-manifest.json >tmp.json && mv tmp.json firefox-manifest.json
# remove static content script
	jq '.content_scripts = []' firefox-manifest.json >tmp.json && mv tmp.json firefox-manifest.json
# add host permissions
	jq '.permissions += ["*://*.twitter.com/*", "*://twitter.com/*", "*://*.x.com/*", "*://x.com/*"]' firefox-manifest.json >tmp.json && mv tmp.json firefox-manifest.json
# replace chrome manifest with firefox manifest
	jq '.browser_specific_settings = {"gecko": {"id": "{119be3f3-597c-4f6a-9caf-627ee431d374}"}}'  firefox-manifest.json >tmp.json && mv tmp.json firefox-manifest.json
	mv firefox-manifest.json build/manifest.json

	cp LICENSE build/LICENSE
	cp readme.md build/readme.md
	cd build; zip "blue-blocker-firefox-${VERSION}.zip" -r *
	mv "build/blue-blocker-firefox-${VERSION}.zip" "blue-blocker-firefox-${VERSION}.zip"

.PHONY: chrome
chrome:
# ifneq (,$(wildcard blue-blocker-chrome-$(VERSION).zip))
# 	rm "blue-blocker-chrome-${VERSION}.zip"
# endif

	cp LICENSE build/LICENSE
	cp readme.md build/readme.md
	cd build; zip "blue-blocker-chrome-${VERSION}.zip" -r *
	mv "build/blue-blocker-chrome-${VERSION}.zip" "blue-blocker-chrome-${VERSION}.zip"
