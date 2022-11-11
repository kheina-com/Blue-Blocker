![Blue Blocker Marquee](assets/marquee.png)
# Blue Blocker
Blocks all Verified Twitter Blue users on twitter.com

## Usage
Nothing! Just install and say goodbye to all the paid blue checkmarks!

By default, Blue Blocker does not block users you follow who have purchased Twitter Blue. You can enable this from the extension settings.

## Installation
### Chrome
1. Visit the [releases page](https://github.com/kheina-com/Blue-Blocker/releases) and download the latest release .zip file
2. Unzip the downloaded .zip file
3. Visit the [chrome extentions page](chrome://extensions/)
	(or enter `chrome://extensions/` in the Chrome url bar)
4. Enable `Developer mode` in the top right
5. Click `Load unpacked` in the top left and select the newly unzipped directory

### Firefox
1. Visit the [releases page](https://github.com/kheina-com/Blue-Blocker/releases) and download the latest release .zip file
2. Unzip the downloaded .zip file
3. Rename `firefox-manifest.json` to `manifest.json`
	(feel free to delete or rename the other `manifest.json`)
4. Visit the [firefox addon debugging page](about:debugging#/runtime/this-firefox)
	(or enter `about:debugging#/runtime/this-firefox` in the Firefox url bar)
5. Click `Load Temporary Add-on` in the top right and select `manifest.json` in the unzipped folder

NOTE: You may need to replace instances of `browser.storage.sync` with `browser.storage.local` for local firefox development.

```
extension has been added to the chrome webstore, but is pending review.
```

```
extension has been added to the firefox addons website, but is pending review.
```
