'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;
var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition
var SpeechGrammarList = SpeechGrammarList || webkitSpeechGrammarList
var SpeechRecognitionEvent = SpeechRecognitionEvent || webkitSpeechRecognitionEvent

var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};

/////////////////////////////////////////////
// Socket Events:

var room = 'foo';
// Could prompt for room name:
// room = prompt('Enter room name:');

var socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);
}


socket.on('created', function(room) {
  console.log('Created room ' + room);
  recognition.start();
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

////////////////////////////////////////////////

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

// This client receives a message
socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////
// Get User Media:

var localVideo = document.getElementById('localVideo');
var remoteVideo = document.getElementById('remoteVideo');


navigator.mediaDevices.getUserMedia({
  video: {
    width: { min: 640, ideal: 1920 },
    height: { min: 400, ideal: 1080 },
    aspectRatio: { ideal: 1.7777777778 }
  },
  audio: {
    sampleRate: 16000,
    echoCancellation: true,
    noiseSuppression: true
  }
})
.then(gotStream)
.catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});

function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
  //  console.log("isStartToGetAudioTrack");
  if (isInitiator) {
    maybeStart();
  }
}

var constraints = {
  audio: true,
  video: true
};

console.log('Getting user media with constraints', constraints);

if (location.hostname !== 'localhost') {
  requestTurn(
    'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
  );
}

function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function() {
  sendMessage('bye');
};

/////////////////////////////////////////////////////////
// Peer Connection:

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function requestTurn(turnURL) {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    console.log('Getting TURN server from ', turnURL);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        console.log('Got TURN server: ', turnServer);
        pcConfig.iceServers.push({
          'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}

/////////////////////////////////////////////////////////
// Data Channel:

/////////////////////////////////////////////////////////
// Subtitles:


/////////////////////////////////////////////////////////
// Speech Recognition:

// VARIABLES:
var isSpeechRecognitionEnabled = false;
var isSpeechRecognitionInitiated = false;
var isSpeechRecognitionCrashed = false;
var speechRecognitionIndicator = document.getElementById('speechRecognitionIndicator');
var languageSelector = document.getElementById('languageSelector');
var speechRecognitionAbort = document.getElementById('startButton');
var languagesIndex = {
    'en': 0, 'en-AU': 0, 'en-CA': 0, 'en-IN': 0, 'en-NZ': 0, 'en-ZA': 0, 'en-GB': 0, 'en-US': 0,
    'cmn': 1,'cmn-Hans': 1, 'cmn-Hans-CN': 1, 'cmn-Hans-HK': 1,'cmn-Hant': 1, 'cmn-Hant-TW': 1,'yue': 1, 'yue-Hant': 1, 'yue-Hant-HK': 1,
    'es': 2, 'es-AR': 2, 'es-BO': 2, 'es-CL': 2, 'es-CO': 2, 'es-CR': 2, 'es-EC': 2, 'es-SV': 2, 'es-ES': 2, 'es-US': 2,
    'es-GT': 2, 'es-HN': 2, 'es-MX': 2, 'es-NI': 2, 'es-PA': 2, 'es-PY': 2, 'es-PE': 2, 'es-PR': 2, 'es-DO': 2, 'es-UY': 2,
    'es-VE': 2,
    'fr': 3, 'fr-FR': 3,
    'it': 4, 'it-IT': 4, 'it-CH': 4,
    'hu': 5, 'hu-HU': 5,
    'no': 6, 'no-NO': 6,
    'nb': 6, 'nb-NO': 6,
    'pl': 7, 'pl-PL': 7,
    'pt': 8, 'pt-BR': 8, 'pt-PT': 8,
    'sv': 9, 'sv-SE': 9,
    'ar': 10,
    'he': 11, 'he-IL': 11,
    'iw': 11, 'iw-IL': 11,
    'ja': 12, 'ja-JP': 12,
    'ko': 13, 'ko-KR': 13,
    'ru': 14, 'ru-RU': 14
};

console.log('User\'s browser language is ', navigator.language);
if (languagesIndex[navigator.language] === undefined) {
  languageSelector.options.seletedIndex = 1;
  console.log('Setting local language to English');
} else {
  languageSelector.options.seletedIndex = languagesIndex[navigator.language];
  console.log('Setting language to', languageSelector.selectedOptions[0].text);
}

if (('webkitSpeechRecognition' in window)) {
  var recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = languageSelector.selectedOptions[0].value;

  recognition.onstart = function() {
    speechRecognitionIndicator.classList.remove('speechRecognitionIndicatorOff');
    speechRecognitionIndicator.classList.add('speechRecognitionIndicatorOn');
    isSpeechRecognitionEnabled = true;
    // Speech recognition initiation so no later permissions are required
    if (isSpeechRecognitionInitiated === false) {
      recognition.stop();
      isSpeechRecognitionInitiated = true;
    }
  };

  recognition.onresult = function(event) {
        var transcription = '';
        for (var i = event.resultIndex; i < event.results.length; ++i) {
            transcription += event.results[i][0].transcript;
        }
        console.log('transcription', transcription);
  };

  recognition.onerror = function(error) {
    console.error('Speech recognition error:', error);
    if (error.error === 'aborted') {
      isSpeechRecognitionCrashed = true;
      alert('Speech recognition aborted. Only one instance per client is supported.');
      // TODO
      //window.location = '/error.html';
    }
  };

  recognition.onend = function() {
    recognition.stop();
    speechRecognitionIndicator.classList.add('speechRecognitionIndicatorOff');
    speechRecognitionIndicator.classList.remove('speechRecognitionIndicatorOn');
    isSpeechRecognitionEnabled = false;
    console.log('Speech recognition has stopped.');
    keepSpeechRecognitionAliveIfNeeded();
  }
}

// Keeps the speech recognition alive
function keepSpeechRecognitionAliveIfNeeded() {
  if (!isSpeechRecognitionCrashed) {
    if (isSpeechRecognitionEnabled === false) {
      recognition.start();
      console.log('Keeping speech recognition alive');
    }
  }
}

// Updates the local user's language
function updateLanguage() {
  recognition.lang = languageSelector.selectedOptions[0].value;
  recognition.end();
  console.log('Language changed to', languageSelector.selectedOptions[0].text);
}

