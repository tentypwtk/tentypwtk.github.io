const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();

// Debug Logger
const castDebugLogger = cast.debug.CastDebugLogger.getInstance();
const LOG_RECEIVER_TAG = 'QlCastReceiver.LOG';

const playbackConfig = new cast.framework.PlaybackConfig();

/*
 * WARNING: Make sure to turn off debug logger for production release as it
 * may expose details of your app.
 * Uncomment below line to enable debug logger, show a 'DEBUG MODE' tag at
 * top left corner and show debug overlay.
 */
context.addEventListener(cast.framework.system.EventType.READY, () => {
	if (!castDebugLogger.debugOverlayElement_) {
	    /**
	     *  Enable debug logger and show a 'DEBUG MODE' tag at
	     *  top left corner.
	     */
		castDebugLogger.setEnabled(true);

	    /**
	     * Show debug overlay only when errors happen.
	     */
		castDebugLogger.showDebugLogs(false);

     	// Clear log messages on debug overlay
		castDebugLogger.clearDebugLogs();
	}
	castDebugLogger.info(LOG_RECEIVER_TAG, `Casting is ready`);
    castDebugLogger.info(LOG_RECEIVER_TAG, 'Cast framework version: ' + cast.framework.VERSION);
    castDebugLogger.info(LOG_RECEIVER_TAG, 'Shaka player version: ' + shaka.Player.version);
    castDebugLogger.info(LOG_RECEIVER_TAG, 'MuxJS present: ' + (muxjs != null));
    castDebugLogger.info(LOG_RECEIVER_TAG, 'Hosted at: ' + document.URL);
});


/*
 * Set verbosity level for Core events.
 */
castDebugLogger.loggerLevelByEvents = {
  'cast.framework.events.category.CORE': cast.framework.LoggerLevel.INFO,
  'cast.framework.events.EventType.MEDIA_STATUS': cast.framework.LoggerLevel.DEBUG
};

if (!castDebugLogger.loggerLevelByTags) {
  castDebugLogger.loggerLevelByTags = {};
}

/*
 * Set verbosity level for custom tag.
 * Enables log messages for error, warn, info and debug.
 */
castDebugLogger.loggerLevelByTags[LOG_RECEIVER_TAG] = cast.framework.LoggerLevel.DEBUG;

/*
 * Example of how to listen for events on playerManager.
 */
playerManager.addEventListener(
  cast.framework.events.EventType.ERROR, (event) => {
    castDebugLogger.showDebugLogs(true);
    castDebugLogger.error(LOG_RECEIVER_TAG, '> Detailed Error Code: ' + event.detailedErrorCode);
    castDebugLogger.error(LOG_RECEIVER_TAG, '> Full event: ' + JSON.stringify(event));
    if (event && event.detailedErrorCode == 905) {
      castDebugLogger.error(LOG_RECEIVER_TAG,
        '> LOAD_FAILED: Verify the load request is set up properly and the media is able to play.');
    }
});

playerManager.addEventListener(
  cast.framework.events.EventType., (event) => {
    castDebugLogger.showDebugLogs(true);
    castDebugLogger.error(LOG_RECEIVER_TAG, '> Detailed Error Code: ' + event.detailedErrorCode);
    castDebugLogger.error(LOG_RECEIVER_TAG, '> Full event: ' + JSON.stringify(event));
    if (event && event.detailedErrorCode == 905) {
      castDebugLogger.error(LOG_RECEIVER_TAG,
        '> LOAD_FAILED: Verify the load request is set up properly and the media is able to play.');
    }
});


/*
 * Intercept the LOAD request to load and set the contentUrl.
 */
playerManager.setMessageInterceptor(
	cast.framework.messages.MessageType.LOAD, 
	loadRequestData => {
		castDebugLogger.info(LOG_RECEIVER_TAG, `loadRequestData: ${JSON.stringify(loadRequestData)}`);

    	// If the loadRequestData is incomplete, return an error message.
		if (!loadRequestData || !loadRequestData.media) {
    		castDebugLogger.showDebugLogs(true);
    		castDebugLogger.error(LOG_RECEIVER_TAG, `Media incomplete: ${JSON.stringify(loadRequestData.media)}`);
			const error = new cast.framework.messages.ErrorData(cast.framework.messages.ErrorType.LOAD_FAILED);
			error.reason = cast.framework.messages.ErrorReason.INVALID_REQUEST;
			return error;
		}

		let source = loadRequestData.media.contentUrl;

    	// If there is no source then return an error.
		if (!source || source == "") {
			let error = new cast.framework.messages.ErrorData(
				cast.framework.messages.ErrorType.LOAD_FAILED);
			error.reason = cast.framework.messages.ErrorReason.INVALID_REQUEST;
			return error;
		}

		return Promise.resolve()
		.then(() => {
			castDebugLogger.info(LOG_RECEIVER_TAG, "Interceptor received URL"+loadRequestData.media.customData.licenseUrl);
			loadRequestData.media.contentUrl = source;
			return loadRequestData;
		})
		.catch((errorMessage) => {
			let error = new cast.framework.messages.ErrorData(
				cast.framework.messages.ErrorType.LOAD_FAILED);
			error.reason = cast.framework.messages.ErrorReason.INVALID_REQUEST;
			castDebugLogger.showDebugLogs(true);
			castDebugLogger.error(LOG_RECEIVER_TAG, errorMessage);
			return error;
		});
	});

playbackConfig.licenseRequestHandler = requestInfo => {
  	castDebugLogger.warn(LOG_RECEIVER_TAG, `Setting licenseRequestHandler: ${JSON.stringify(requestInfo)}`);
    requestInfo.url = requestInfo.customData.licenseUrl;
};

let keepAliveIntervalId;

function handleKeepAlive(customData) {
	if (keepAliveIntervalId) {
		clearInterval(keepAliveIntervalId);
	}
	if (customData.keepAliveURL && customData.keepAliveIntervalMillis) {
		const keepAliveUrl = customData.keepAliveURL;
		const keepAliveInterval = customData.keepAliveIntervalMillis;
		const keepAliveDebug = customData.keepAliveDebug

		keepAliveIntervalId = setInterval(() => {
			 fetch(keepAliveUrl)
			 	.then(data => {
			 		console.log("KeepAlive result:", data);
			 		if (keepAliveDebug) {
			 		    castDebugLogger.warn(LOG_RECEIVER_TAG, `KeepAlive result: ${JSON.stringify(data)}`);
			 		}
			 	})
			 	.catch(error => {
			 		console.log("KeepAlive error:", error);
			 		castDebugLogger.error(LOG_RECEIVER_TAG, "KeepAlive error: " + error)
			 		if (keepAliveDebug) {
			 		    castDebugLogger.warn(LOG_RECEIVER_TAG, `KeepAlive result: ${JSON.stringify(error)}`);
                    }
			 	});
		}, keepAliveInterval);
	}
}

playerManager.setMediaPlaybackInfoHandler((loadRequest, playbackConfig) => {
  if (loadRequest.media.customData) {
    handleKeepAlive(loadRequest.media.customData);
  }
  if (loadRequest.media.contentUrl && loadRequest.media.contentUrl.endsWith("m3u8")) {
    castDebugLogger.info(LOG_RECEIVER_TAG, `Playing HLS (m3u8). No customData checking needed.`);
    return playbackConfig;
  }
  castDebugLogger.warn(LOG_RECEIVER_TAG, `Info Handler: ${JSON.stringify(loadRequest)}`);
  if (loadRequest.media.customData && loadRequest.media.customData.licenseUrl) {
  	castDebugLogger.info(LOG_RECEIVER_TAG, `customData: ${JSON.stringify(loadRequest.media.customData)}`);
    playbackConfig.licenseUrl = loadRequest.media.customData.licenseUrl;
    playbackConfig.protectionSystem = cast.framework.ContentProtection.WIDEVINE;
	playbackConfig.licenseRequestHandler = requestInfo => {
  		requestInfo.withCredentials = true;
	};
  } else {
    castDebugLogger.showDebugLogs(true);
  	castDebugLogger.error(LOG_RECEIVER_TAG, "customData is null");
  }
  return playbackConfig;
});


const options = new cast.framework.CastReceiverOptions();
options.playbackConfig = playbackConfig;
options.useShakaForHls = true;
options.shakaVersion = "4.3.4";
context.start(options);