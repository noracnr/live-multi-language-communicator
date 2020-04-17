# Realtime communication with WebRTC
WebRTC p2p communication with fixed room name. 
Now, audio and video stream of two peers are available.

### How to run
```bash
npm install
node index.js
```

### What I have done yet
* Get a mediastream(video,audio) from your webcam.
* Manipulate stream playback.
* Use the RTCPeerConnection API to stream video.
* Exchange data between WebRTC endpoints (peers). [Not Implemented in this example]
* STUN, TURN servers: https://www.html5rocks.com/en/tutorials/webrtc/infrastructure/
* Run a WebRTC signaling service using Socket.IO running on Node.js
* Use that service to exchange WebRTC metadata between peers.

### constraints
* Only test on my computer (mac, chrome).
* Buttons and text translator are not implemented yet.( Wait for speech to text ) 

### Reference
[Realtime communication with WebRTC](https://codelabs.developers.google.com/codelabs/webrtc-web/#0).
