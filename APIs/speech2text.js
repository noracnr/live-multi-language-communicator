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
      .on('error', console.error);

    // send the audio content to the Speech API.
    audioStream.on('error', console.error).pipe(recognizeStream)

    return recognizeStream;
}
