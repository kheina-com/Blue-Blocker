![Blue Blocker Marquee](assets/marquee.png)
# Blue Blocker
Blocks all Verified Twitter Blue users on twitter.com

## Usage
Nothing! Just install and say goodbye to all the paid blue checkmarks!

By default, Blue Blocker does not block users you follow who have purchased Twitter Blue. You can enable this from the extension settings.

## Install
[![Available from Chrome Webstore](assets/chrome.png)](https://chrome.google.com/webstore/detail/blue-blocker/jgpjphkbfjhlbajmmcoknjjppoamhpmm)
[![Available from Firefox Add-ons](assets/firefox.png)](https://addons.mozilla.org/en-US/firefox/addon/blue-blocker/)

## Development
### Chrome
1. Clone the repository
2. Visit the [chrome extentions page](chrome://extensions/)
	(or enter `chrome://extensions/` in the Chrome url bar)
3. Enable `Developer mode` in the top right
4. Click `Load unpacked` in the top left and select the cloned directory

### Firefox
1. Clone the repository
2. Rename `firefox-manifest.json` to `manifest.json`
	(feel free to delete or rename the other `manifest.json`)
3. Visit the [firefox addon debugging page](about:debugging#/runtime/this-firefox)
	(or enter `about:debugging#/runtime/this-firefox` in the Firefox url bar)
4. Click `Load Temporary Add-on` in the top right and select `manifest.json` in the cloned directory

## TODO
1. Missing support for these requests
	- search (all types)
	- "you might like" column
	- "who to follow" sections
2. Remove the blocked users from the dom
3. Look into an issue where users can be missed
