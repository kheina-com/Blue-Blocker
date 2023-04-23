const RequestRegex = /^https:\/\/(?:\w+\.)?twitter.com\/[\w\/]+\/(HomeLatestTimeline|HomeTimeline|UserTweets|timeline\/home\.json|TweetDetail)(?:$|\?)/;

(function(xhr) {
	let XHR = XMLHttpRequest.prototype;
	let open = XHR.open;
	let send = XHR.send;
	let setRequestHeader = XHR.setRequestHeader;
	XHR.open = function(method, url) {
		this._method = method;
		this._url = url;
		this._requestHeaders = {};
		this._startTime = (new Date()).toISOString();
		return open.apply(this, arguments);
	};
	XHR.setRequestHeader = function(header, value) {
		this._requestHeaders[header] = value;
		return setRequestHeader.apply(this, arguments);
	};
	XHR.send = function(postData) {
		this.addEventListener("load", function() {
			// determine if request is a timeline/tweet-returning request
			const parsedUrl = RequestRegex.exec(this._url);
			if(this._url && parsedUrl) {
				document.dispatchEvent(new CustomEvent("blue-blocker-event", { detail: { url : this._url, parsedUrl, body: this.response, request: { headers: this._requestHeaders } } }));
			}
		});
		return send.apply(this, arguments);
	};
})(XMLHttpRequest);
