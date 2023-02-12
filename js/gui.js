const rem = new REMinterface();

rem.on(REMevents.CONNECTION_OPENED, onConnectionOpened);
rem.on(REMevents.CONNECTION_CLOSED, onConnectionClosed);
rem.on(REMevents.PATTERN_CHANGE, onPatternChange);
rem.on(REMevents.IMAGE_RECEIVED, onImageReceived);
rem.on(REMevents.CHUNK_RECEIVED, onChunkReceived);
rem.on(REMevents.ERROR_OCCURRED, onErrorOccurred);

var capture_metadata = {};

var startTime = 0;
var stopTime = 0;

window.addEventListener("load", (event) =>
{
    initWindows();
    initSlideouts();
    
    initCapture();
    initSettings();
    initImage();


});

document.addEventListener("keyup", (e) => {
    if (e.ctrlKey && e.altKey && e.key == 'c') {
        document.getElementById("captures").classList.toggle("show");
    } else
    if (e.ctrlKey && e.altKey && e.key == 's') {
        document.getElementById("settings").classList.toggle("show");
    } else
    if (e.altKey && e.key == 'o') {
        onConnectButtonClick();
    } else 
    if (e.altKey && e.key == 'i') {
        onInitButtonClick();
    } else 
    if (e.altKey && e.key == 'c') {
        onScanButtonClick();
    } else 
    if (e.altKey && e.key == 'a') {
        onAbortButtonClick();
    } else 
    if (e.altKey && e.key == 's') {
        onStoreButtonClick();
    } else 
    if (e.altKey && e.key == 't') {
        document.getElementById("capture-subject").focus();
    } 
});

async function onConnectButtonClick() {
    await rem.connect();
}

async function onInitButtonClick() {
    if (!rem.connected())
        return;

    await rem.init();
}

async function onScanButtonClick() {
    if (!rem.connected())
        return;

    var scanbutton = document.getElementById("scan-button");
 
    if (scanbutton.disabled == true)
        return;

    scanbutton.disabled = true;
    document.getElementById("abort-button").disabled = false;
    document.getElementById("progress-bar").dataset.value = 0;

    img_canvas.width = await rem.getImageWidth();
    img_canvas.height = await rem.getImageHeight();

    capture_metadata.time    = Date.now();
    capture_metadata.subject = document.getElementById("capture-subject").value;
    capture_metadata.voltage = document.getElementById("capture-voltage").value;
    capture_metadata.magnifi = document.getElementById("capture-magnifi").value;
    capture_metadata.comment = document.getElementById("capture-comment").value;
    capture_metadata.width   = img_canvas.width;
    capture_metadata.height  = img_canvas.height;
    capture_metadata.depth   = await rem.getImageDepth();

    if (capture_metadata.subject == "")
        capture_metadata.subject = "untitled";

    if (capture_metadata.voltage == "")
        capture_metadata.voltage = "??";

    if (capture_metadata.magnifi == "")
        capture_metadata.magnifi = "??";

    startTime = performance.now();

    await rem.scan();
}

async function onAbortButtonClick() {
    if (!rem.connected())
        return;

    await rem.abort();

    document.getElementById("abort-button").disabled = true;
    document.getElementById("scan-button").disabled = false;
}

function onConnectionOpened(eventSender)
{
    document.getElementById("connect-button").disabled = true;
    document.getElementById("scan-button").disabled = false;
    document.getElementById("init-button").disabled = false;
}

function onConnectionClosed(eventSender)
{
    document.getElementById("scan-button").disabled = true;
    document.getElementById("init-button").disabled = true;
    document.getElementById("connect-button").disabled = false;
}

function onErrorOccurred(eventSender, error)
{
    var msg = document.getElementById("message");
    msg.style.display = "block";
    
    msg.childNodes[3].innerHTML = error;

    console.log(error);
}