// Imports the Google Cloud client library
const speech = require('@google-cloud/speech');

// Creates a client
const client = new speech.SpeechClient();

function SpeechToTextStream(audioStream, encoding='LINEAR16'
	, sampleRateHertz=16000, languageCode='en-US') {
	
	const request = {
	  config: {
	    encoding: encoding,
	    sampleRateHertz: sampleRateHertz,
	    languageCode: languageCode,
	  },
	  interimResults: false, // If you want interim results, set this to true
	};

	const recognizeStream = client
	  .streamingRecognize(request)
	  .on('error', console.error)
	  .on('data', data =>
	    process.stdout.write(
	      data.results[0] && data.results[0].alternatives[0]
	        ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
	        : `\n\nReached transcription time limit, press Ctrl+C\n`
	    )
	  );

	// send the microphone input to the Speech API.
	audioStream.on('error', console.error).pipe(recognizeStream)

	console.log('Listening, press Ctrl+C to stop.');
}