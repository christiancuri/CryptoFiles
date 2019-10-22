//webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var gumStream; //stream from getUserMedia()
var recorder; //WebAudioRecorder object
var input; //MediaStreamAudioSourceNode  we'll be recording
var encodingType; //holds selected encoding for resulting audio (file)
var encodeAfterRecord = true; // when to encode

// shim for AudioContext when it's not avb.
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext; //new audio context to help us record

var encodingTypeSelect = document.getElementById("encodingTypeSelect");
var recordButton = document.getElementById("recordButton");
var stopButton = document.getElementById("stopButton");

//add events to those 2 buttons
recordButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);

function startRecording() {
  console.log("startRecording() called");

  /*
		Simple constraints object, for more advanced features see
		https://addpipe.com/blog/audio-constraints-getusermedia/
	*/

  var constraints = { audio: true, video: false };

  /*
    	We're using the standard promise based getUserMedia() 
    	https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
	*/

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(function(stream) {
      __log(
        "getUserMedia() success, stream created, initializing WebAudioRecorder..."
      );

      /*
			create an audio context after getUserMedia is called
			sampleRate might change after getUserMedia is called, like it does on macOS when recording through AirPods
			the sampleRate defaults to the one set in your OS for your playback device

		*/
      audioContext = new AudioContext();

      //update the format
      document.getElementById("formats").innerHTML =
        "Format: 2 channel " +
        encodingTypeSelect.options[encodingTypeSelect.selectedIndex].value +
        " @ " +
        audioContext.sampleRate / 1000 +
        "kHz";

      //assign to gumStream for later use
      gumStream = stream;

      /* use the stream */
      input = audioContext.createMediaStreamSource(stream);

      //stop the input from playing back through the speakers
      //input.connect(audioContext.destination)

      //get the encoding
      encodingType =
        encodingTypeSelect.options[encodingTypeSelect.selectedIndex].value;

      //disable the encoding selector
      encodingTypeSelect.disabled = true;

      recorder = new WebAudioRecorder(input, {
        workerDir: "js/", // must end with slash
        encoding: encodingType,
        numChannels: 2, //2 is the default, mp3 encoding supports only 2
        onEncoderLoading: function(recorder, encoding) {
          // show "loading encoder..." display
          __log("Loading " + encoding + " encoder...");
        },
        onEncoderLoaded: function(recorder, encoding) {
          // hide "loading encoder..." display
          __log(encoding + " encoder loaded");
        }
      });

      recorder.onComplete = async function(recorder, blob) {
        __log("Encoding complete");

        await try02(recorder, blob);

        encodingTypeSelect.disabled = false;
      };

      recorder.setOptions({
        timeLimit: 120,
        encodeAfterRecord: encodeAfterRecord,
        ogg: { quality: 0.5 },
        mp3: { bitRate: 160 }
      });

      //start the recording process
      recorder.startRecording();

      __log("Recording started");
    })
    .catch(function(err) {
      //enable the record button if getUSerMedia() fails
      recordButton.disabled = false;
      stopButton.disabled = true;
    });

  //disable the record button
  recordButton.disabled = true;
  stopButton.disabled = false;
}

const playButton = document.getElementById("start");
const audioId = document.getElementById("audioId");

playButton.addEventListener("click", forcePlayAudio);

async function forcePlayAudio() {
  const id = audioId.value;
  if (id == "") {
    return alert("Type audio id");
  }
  axios
    .get(`/audio/${id}`)
    .then(data => data.data)
    .then(data => data.data)
    .then(async data => {
      const decrypted = await decrypt(data);
      const audio = new Audio(URL.createObjectURL(decrypted));
      audio.play();
    });
}

// axios
//   .get("/audio/sample")
//   .then(data => data.data)
//   .then(data => data.data)
//   .then(async data => {
//     const decrypted = await decrypt(data);
//     const audio = new Audio(URL.createObjectURL(decrypted));
//     audio.play();
//   });

let lastAudio;
const resendbutton = document.getElementById("reSend");
resendbutton.addEventListener("click", resendFile);
async function resendFile() {
  const formData = new FormData();
  const encryptedBlob = lastAudio;

  const currentAudioId = new Date().getTime();

  formData.append("data", encryptedBlob);
  formData.append(`name`, currentAudioId);

  axios.post("/upload", formData).then(dat => {
    const data = dat.data;
    const url = data.url;
    axios
      .get(url)
      .then(data => data.data)
      .then(data => data.data)
      .then(async data => {
        const decrypted = await decrypt(data);
        const audio = new Audio(URL.createObjectURL(decrypted));
        audio.play();
      });
  });
}

async function try02(recorder, blob) {
  const formData = new FormData();
  const encryptedBlob = await encrypt(blob);

  const currentAudioId = new Date().getTime();
  const file = arrayBufferToFile(encryptedBlob, currentAudioId);

  formData.append("data", file);
  formData.append(`name`, currentAudioId);

  console.log(currentAudioId);
  lastAudio = encryptedBlob;

  axios.post("/upload", formData).then(dat => {
    const data = dat.data;
    const url = data.url;
    // console.log(data);
    fetch(url)
      .then(data => data.blob())
      .then(async data => {
        const decrypted = await decrypt(data);
        const audio = new Audio(URL.createObjectURL(decrypted));
        audio.play();
      });
    // axios
    //   .get(url)
    //   .then(res => res.blob())
    //   // .then(data => data.data)
    //   .then(async data => {
    //     const decrypted = await decrypt(data);
    //     const audio = new Audio(URL.createObjectURL(decrypted));
    //     audio.play();
    //   });
  });
}

function arrayBufferToFile(ab, fileName) {
  return new File([ab], fileName);
}

let keyless;
const iv = crypto.getRandomValues(new Uint8Array(16));
generateKey();
async function generateKey() {
  keyless = await crypto.subtle.generateKey(
    { name: "AES-CBC", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  console.log(keyless);
  console.log("key generated");
}

async function encrypt(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(blob);
    reader.onload = () => {
      const arrayBuffer = reader.result;

      crypto.subtle
        .encrypt({ name: "AES-CBC", iv }, keyless, arrayBuffer)
        .then(encrypted => {
          resolve(encrypted);
          // console.log(encrypted);
          // const b64 = Base64Binary.encode(encrypted);
          // resolve(b64);
        })
        .catch(console.error);
    };
  });
}

var Base64Binary = {
  key: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

  decodeArrayBuffer: function(input) {
    const bytes = (input.length / 4) * 3;
    const arrayBuffer = new ArrayBuffer(bytes);
    this.decode(input, arrayBuffer);
    return arrayBuffer;
  },

  sanitize: function(input) {
    const lkey = this.key.indexOf(input.charAt(input.length - 1));
    return lkey == 64 ? input.substring(0, input.length - 1) : input;
  },

  decode: function(input, arrayBuffer) {
    input = this.sanitize(this.sanitize(input));

    const bytes = parseInt((input.length / 4) * 3, 10);

    let i,
      j = 0;

    const byteArray = new Uint8Array(arrayBuffer ? arrayBuffer : bytes);

    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    for (i = 0; i < bytes; i += 3) {
      const enc1 = this.key.indexOf(input.charAt(j++));
      const enc2 = this.key.indexOf(input.charAt(j++));
      const enc3 = this.key.indexOf(input.charAt(j++));
      const enc4 = this.key.indexOf(input.charAt(j++));

      const char1 = (enc1 << 2) | (enc2 >> 4);
      const char2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const char3 = ((enc3 & 3) << 6) | enc4;

      byteArray[i] = char1;
      if (enc3 != 64) byteArray[i + 1] = char2;
      if (enc4 != 64) byteArray[i + 2] = char3;
    }

    return byteArray;
  },

  encode: function(arrayBuffer) {
    let base64 = "";

    const bytes = new Uint8Array(arrayBuffer);
    const byteLength = bytes.byteLength;
    const byteRemainder = byteLength % 3;
    const mainLength = byteLength - byteRemainder;

    let a, b, c, d;
    let chunk;

    for (var i = 0; i < mainLength; i = i + 3) {
      chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

      a = (chunk & 16515072) >> 18;
      b = (chunk & 258048) >> 12;
      c = (chunk & 4032) >> 6;
      d = chunk & 63;

      base64 += this.key[a] + this.key[b] + this.key[c] + this.key[d];
    }

    if (byteRemainder == 1) {
      chunk = bytes[mainLength];
      a = (chunk & 252) >> 2;
      b = (chunk & 3) << 4;
      base64 += this.key[a] + this.key[b] + "==";
    } else if (byteRemainder == 2) {
      chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];
      a = (chunk & 64512) >> 10;
      b = (chunk & 1008) >> 4;
      c = (chunk & 15) << 2;
      base64 += this.key[a] + this.key[b] + this.key[c] + "=";
    }
    return base64;
  }
};

async function decrypt(encryptedBlob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const r = e.target.result;
      crypto.subtle
        .decrypt({ name: "AES-CBC", iv }, keyless, r)
        .then(decrypted => {
          resolve(new Blob([decrypted], { type: "audio/ogg" }));
        })
        .catch(console.error);
    };
    reader.readAsArrayBuffer(encryptedBlob);
  });
}

function stopRecording() {
  console.log("stopRecording() called");

  //stop microphone access
  gumStream.getAudioTracks()[0].stop();

  //disable the stop button
  stopButton.disabled = true;
  recordButton.disabled = false;

  //tell the recorder to finish the recording (stop recording + encode the recorded audio)
  recorder.finishRecording();

  __log("Recording stopped");
}

function createDownloadLink(blob, encoding) {
  var url = URL.createObjectURL(blob);
  var au = document.createElement("audio");
  var li = document.createElement("li");
  var link = document.createElement("a");

  //add controls to the <audio> element
  au.controls = true;
  au.src = url;

  //link the a element to the blob
  link.href = url;
  link.download = new Date().toISOString() + "." + encoding;
  link.innerHTML = link.download;

  //add the new audio and a elements to the li element
  li.appendChild(au);
  li.appendChild(link);

  //add the li element to the ordered list
  recordingsList.appendChild(li);
}

//helper function
function __log(e, data) {
  log.innerHTML += "\n" + e + " " + (data || "");
}
