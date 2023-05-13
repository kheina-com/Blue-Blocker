(function (xhr) {
  const RequestRegex =
    /^https:\/\/(?:\w+\.)?twitter.com\/[\w\/\.\-\_\=]+\/(HomeLatestTimeline|HomeTimeline|UserTweets|timeline\/home\.json|TweetDetail|search\/typeahead\.json|search\/adaptive\.json)(?:$|\?)/;

  // let XHR = <BlueBlockerXLMRequest>XMLHttpRequest.prototype;
  let XHR = XMLHttpRequest.prototype;
  let open = XHR.open;
  let send = XHR.send;
  let setRequestHeader = XHR.setRequestHeader;
  XHR.open = function (method, url) {
    this._method = method;
    this._url = url.toString();
    this._requestHeaders = {};
    this._startTime = new Date().toISOString();
    return open.apply(this, arguments);
  };
  XHR.setRequestHeader = function (header, value) {
    this._requestHeaders[header] = value;
    return setRequestHeader.apply(this, [header, value]);
  };
  XHR.send = function (postData) {
    this.addEventListener('load', () => {
      // determine if request is a timeline/tweet-returning request
      const parsedUrl = RequestRegex.exec(this._url);
      if (this._url && parsedUrl?.length) {
        document.dispatchEvent(
          new CustomEvent('blue-blocker-event', {
            detail: {
              url: this._url,
              parsedUrl,
              body: this.response,
              request: { headers: this._requestHeaders },
            },
          }),
        );
      }
    });
    return send.apply(this, [postData]);
  };
})(XMLHttpRequest);
