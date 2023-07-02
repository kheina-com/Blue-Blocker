
(function (xhr) {
	function edit(regex: RegExp, replacements: { [k: string]: string }): RegExp {
		const regexp: string = regex.source;
		const repl = new RegExp(Object.keys(replacements).map(x => "{" + x + "}").join("|"), "g");
		return new RegExp(regexp.replaceAll(repl, m => replacements[m.substring(1, m.length - 1)]), regex.flags);
	}

	const RequestRegex = edit(
		/^https?:\/\/(?:\w+\.)?twitter.com\/[\w\/\.\-\_\=]+\/({queries})(?:$|\?)/, { queries: [
			/HomeLatestTimeline/,
			/HomeTimeline/,
			/SearchTimeline/,
			/UserTweets/,
			/timeline\/home\.json/,
			/TweetDetail/,
			/search\/typeahead\.json/,
			/search\/adaptive\.json/,
			/blocks\/destroy\.json/,
			/mutes\/users\/destroy\.json/,
		].map((r: RegExp) => r.source).join("|"),
	});

	const XHR = <BlueBlockerXLMRequest>XMLHttpRequest.prototype;
	const open = XHR.open;
	const send = XHR.send;
	const setRequestHeader = XHR.setRequestHeader;
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
				document.dispatchEvent(new CustomEvent("blue-blocker-event", {
					detail: {
						request: {
							url : this._url,
							headers: this._requestHeaders,
							method: this._method,
						},
						ok: true,
						parsedUrl,
						url : this._url,
						text: this.response,
						status: this.status,
					},
				}));
			}
		});
		// TODO: remove this ignore
		//@ts-ignore
		return send.apply(this, arguments);
	};
})(XMLHttpRequest);

document.dispatchEvent(new CustomEvent("blue-blocker-bound", {
	detail: {
		success: true,
	},
}));
