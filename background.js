const filter = {
	urls:[
		// home timeline using "latest tweets"
		// "*://*.twitter.com/*/HomeLatestTimeline*",
		// "*://twitter.com/*/HomeLatestTimeline*",
		// home timeline using "top tweets"
		// userpage timeline
		// search results
		// include everything
	],
}

function requestListener(details) {
	console.log("details:", details)

	// parse details for the message body
	// parse message body for "is_blue_verified"
	// if they are a twitter blue user and we don't alredy follow them, send a request to the twitter api to block the user
	// console.log(`blocked {user}`)
}

chrome.webRequest.onCompleted.addListener(requestListener, filter, ["responseHeaders"]);
