const rem = new REMinterface();

rem.on(REMevents.CONNECTION_OPENED, onConnectionOpened);
rem.on(REMevents.CONNECTION_CLOSED, onConnectionClosed);
rem.on(REMevents.REGISTER_CHANGE, onRegisterChange);
rem.on(REMevents.IMAGE_RECEIVED, onImageReceived);
rem.on(REMevents.CHUNK_RECEIVED, onChunkReceived);
rem.on(REMevents.ERROR_OCCURRED, onErrorOccurred);

var canvas = document.getElementById("image-canvas");
var ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: true });

var startTime = 0;
var stopTime = 0;

makeDraggable(document.querySelector('#message'));
makeDraggable(document.querySelector('#image'));
makeDraggable(document.querySelector('#pattern'));
makeDraggable(document.querySelector('#register'));
makeDraggable(document.querySelector('#control'));

window.addEventListener("load", (event) => {
    var register = document.getElementById("register-list");
    
    for (var i = 0; i < 32; ++i)
    {
        if (REMregister[i].use == true)
        {
            var row = document.createElement("tr");                                
        
            var col = document.createElement("td");
            col.innerHTML = i;
            row.appendChild(col);

            col = document.createElement("td");
            col.innerHTML = REMregister[i].name;
            row.appendChild(col);

            col = document.createElement("td");
            var input = document.createElement("input");
            
            input.type = "number";
            input.id = "register-" + i;
            input.readOnly = REMregister[i].readonly && REMregister[i].readonly == true;
            input.onchange = onRegisterChangeUser;

            col.appendChild(input);
            row.appendChild(col);

            col = document.createElement("td");
            if (REMregister[i].unit)
                col.innerHTML = REMregister[i].unit;

            row.appendChild(col);
        
            register.appendChild(row);
        }
    }
});

async function onConnectButtonClick() {
    await rem.connect();
}

async function onInitButtonClick() {
    await rem.init();
}

async function onScanButtonClick() {
    document.getElementById("scan-button").disabled = true;
    document.getElementById("abort-button").disabled = false;
    document.getElementById("progress-bar").value = 0;

    canvas.width = rem.register[10];
    canvas.height = rem.register[11];

    startTime = performance.now();

    await rem.scan();
}

async function onAbortButtonClick() {
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

async function onRegisterChangeUser(event)
{
    var nr = event.target.id.split("-")[1];
    var val = event.target.value;
    
    if (REMregister[nr].mult)
        val = Math.round(val / REMregister[nr].mult);
    else if (REMregister[nr].div)
        val = Math.round(val * REMregister[nr].div);

    await rem.writeRegister(nr, val);
}

function onRegisterChange(eventSender, data)
{
    var register = document.getElementById("register-" + data.nr);

    if (register)
    {
        if (REMregister[data.nr].mult)
            register.value = (data.val * REMregister[data.nr].mult).toFixed(2);
        else if (REMregister[data.nr].div)
            register.value = (data.val / REMregister[data.nr].div).toFixed(2);
        else
            register.value = data.val;
    }
}

function onImageReceived(eventSender, data)
{
    stopTime = performance.now();

    document.getElementById("time").innerHTML = "" + ((stopTime - startTime) / 1000.0).toFixed(2) + " s";

    document.getElementById("abort-button").disabled = true;
    document.getElementById("scan-button").disabled = false;

    let dataRGBA = new Uint8Array(data.w*data.h*4);
    convertRGBA(data.image, dataRGBA);
    
    var img = ctx.getImageData(0, 0, data.w, data.h);
    
    img.data.set(dataRGBA);
    ctx.putImageData(img, 0, 0);
}

function onChunkReceived(eventSender, data)
{
    var percent = Math.round(data.image.length / (data.w * data.h) * 100.0);
    var progress = document.getElementById("progress-bar");
    progress.style.width = percent + '%'; 
    progress.innerHTML = percent * 1  + '%';
    
    let dataRGBA = new Uint8Array(data.w*data.h*4);
    convertRGBA(data.image, dataRGBA, data.w, data.h, data.image.length);
    
    var img = ctx.getImageData(0, 0, data.w, data.h);
    
    img.data.set(dataRGBA);
    ctx.putImageData(img, 0, 0);
}

function convertRGBA(src, dest)
{
    const destW = new Uint32Array(dest.buffer);
    const alpha = 0xFF000000;

    for (var i = 0; i < src.length; i++)
    {
        const g = src[i];
        destW[i] = alpha + (g << 16) + (g << 8) + g;
    }    
}