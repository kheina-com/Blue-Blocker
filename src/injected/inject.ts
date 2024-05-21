//@ts-ignore

(function (xhr) {
	// TODO: find a way to make this cleaner
	const RequestRegex =
		/^https?:\/\/(?:\w+\.)?(?:twitter|x)\.com\/[\w\/\.\-\_\=]+\/(HomeLatestTimeline|HomeTimeline|Followers|Following|SearchTimeline|UserTweets|UserCreatorSubscriptions|FollowersYouKnow|BlueVerifiedFollowers|SearchTimeline|timeline\/home\.json|TweetDetail|search\/typeahead\.json|search\/adaptive\.json|blocks\/destroy\.json|mutes\/users\/destroy\.json)(?:$|\?)/;

	let XHR = <BlueBlockerXLMRequest>XMLHttpRequest.prototype;
	let open = XHR.open;
	let send = XHR.send;
	let setRequestHeader = XHR.setRequestHeader;
	XHR.open = function (method, url) {
		this._method = method;
		this._url = url.toString();
		this._requestHeaders = {};
		this._startTime = new Date().toISOString();
		// TODO: remove this ignore
		//@ts-ignore
		return open.apply(this, arguments);
	};
	XHR.setRequestHeader = function (header, value) {
		this._requestHeaders[header] = value;
		// TODO: remove this ignore
		//@ts-ignore
		return setRequestHeader.apply(this, arguments);
	};
	XHR.send = function (postData) {
		this.addEventListener('load', () => {
			// determine if request is a timeline/tweet-returning request
			const parsedUrl = RequestRegex.exec(this._url);
			if (this._url && parsedUrl && parsedUrl.length > 0) {
				document.dispatchEvent(
					new CustomEvent('blue-blocker-event', {
						detail: {
							parsedUrl,
							url: this._url,
							body: this.response,
							request: {
								headers: this._requestHeaders,
							},
							status: this.status,
						},
					}),
				);
			}
		});
		// TODO: remove this ignore
		//@ts-ignore
		return send.apply(this, arguments);
	};
})(XMLHttpRequest);
