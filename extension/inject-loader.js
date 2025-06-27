const script = document.createElement("script");
script.src = chrome.runtime.getURL("injected/fetch-intercept.js");
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);
