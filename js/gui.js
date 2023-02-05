const rem = new REMinterface();

rem.on(REMevents.CONNECTION_OPENED, onConnectionOpened);
rem.on(REMevents.CONNECTION_CLOSED, onConnectionClosed);
rem.on(REMevents.REGISTER_CHANGE, onRegisterChange);
rem.on(REMevents.IMAGE_RECEIVED, onImageReceived);
rem.on(REMevents.CHUNK_RECEIVED, onChunkReceived);
rem.on(REMevents.ERROR_OCCURRED, onErrorOccurred);

var img_canvas = document.getElementById("image-canvas");
var img_ctx = img_canvas.getContext("2d", { alpha: true, willReadFrequently: true });

var pat_canvas = document.getElementById("pattern-canvas");
var pat_ctx = pat_canvas.getContext("2d", { alpha: true, willReadFrequently: false });

var inputs = [];

var startTime = 0;
var stopTime = 0;

makeDraggable(document.querySelector('#message'));
makeDraggable(document.querySelector('#image'));
makeDraggable(document.querySelector('#pattern'));
makeDraggable(document.querySelector('#digitize'));
makeDraggable(document.querySelector('#register'));
makeDraggable(document.querySelector('#control'));

window.addEventListener("load", (event) =>
{
	//test();
	
    var register = document.getElementById("register-list");
    
    for (var nr = 0; nr < REMregisterCount; ++nr)
    {
        if (REMregisterMap[nr].use == true)
        {
            var row = document.createElement("tr");                                
        
            var col = document.createElement("td");
            col.innerHTML = nr;
            row.appendChild(col);

            col = document.createElement("td");
            col.innerHTML = "<label for=register-" + nr + ">" + REMregisterMap[nr].name + "</label>";
            row.appendChild(col);

            col = document.createElement("td");
            var input = document.createElement("input");
            
            input.type = "number";
            input.id = "register-" + nr;
            input.readOnly = REMregisterMap[nr].readonly && REMregisterMap[nr].readonly == true;
            input.dataset.register = nr;

            col.appendChild(input);
            row.appendChild(col);

            col = document.createElement("td");
            if (REMregisterMap[nr].unit)
                col.innerHTML = "<label>" + REMregisterMap[nr].unit + "</label>";

            row.appendChild(col);
        
            register.appendChild(row);

            rem.onRegisterChange(nr, onRegisterChange);

            if ((8  <= nr && nr <= 13) ||
		        (20 <= nr && nr <= 25))
		    {
    			rem.onRegisterChange(nr, drawPattern);
		    }
        }
    }

    inputs = document.querySelectorAll("[data-register]");

    inputs.forEach((input) => {
        input.addEventListener("change", onRegisterChangeUser);
    });

    
/*	
    pat_params = document.querySelectorAll("input[id^='pattern-']");
    dig_params = document.querySelectorAll("select[id^='digitize-']");
	
    pat_params.forEach((pat_param) => {
        pat_param.addEventListener("change", onPatParamChangeUser);
    });

    dig_params.forEach((dig_param) => {
        dig_param.addEventListener("change", onDigParamChangeUser);
    });
*/		
	drawPattern();
	
});

function test()
{
	// For Testing
	
	rem.register[8].val = 1024;
	rem.register[9].val = 2048;
	
	rem.register[10].val = 256;
	rem.register[11].val = 256;
	
	rem.register[12].val = 127;
	rem.register[13].val = 127;
	
	rem.register[20].val = 0x4000;
	rem.register[23].val = 0x4000;
}

function drawPattern()
{
    const scale = 256;

	var h = pat_canvas.height;
	var w = pat_canvas.width;
	
	pat_ctx.clearRect(0, 0, w, h);
	pat_ctx.lineWidth = 1;
	
	// Draw Grid
	for (var x = 0; x < w; x += 16)
	{
	  pat_ctx.moveTo(x, 0);
	  pat_ctx.lineTo(x, h);
	}

	for (var y = 0; y < h; y += 16)
	{
	  pat_ctx.moveTo(0, y);
	  pat_ctx.lineTo(w, y);

	}
	pat_ctx.strokeStyle = '#666666';
    pat_ctx.stroke();
	
	// Draw Pattern
	pat_ctx.setTransform(rem.getPatternTransform());
	
	var rect = rem.getPatternRect();
	
	pat_ctx.globalAlpha = 0.4;
	pat_ctx.fillRect(rect.x/scale, rect.y/scale, rect.w/scale, rect.h/scale);
	pat_ctx.globalAlpha = 1.0;
	
	pat_ctx.beginPath();
	pat_ctx.lineWidth = 1;
	pat_ctx.strokeStyle = '#ffffff';
	pat_ctx.rect(rect.x/scale, rect.y/scale, rect.w/scale, rect.h/scale);
	pat_ctx.stroke();	
}

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

    img_canvas.width = rem.getImageWidth();
    img_canvas.height = rem.getImageHeight();

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

function onRegisterChange(eventSender, nr)
{
    var val = rem.register[nr].val;

    inputs.forEach((input) => 
    {
        if (input.dataset.register == nr)
        {
            if (input.dataset.bits)
            {
                var range = input.dataset.bits.split(":");
                range = range.map((s) => { return parseInt(s); });

                if (range.length == 1) {
                    var mask = 1 << range[0];
                    input.value = (val & mask) >> range[0];
                }
                else if (range.length == 2) {
                    var mask = (2**(range[0]-range[1]) - 1);
                    input.value = ((val >> range[1]) & mask) >> range[1];
                }
            }
            else
            {
                if (REMregisterMap[nr].mult)
                    input.value = (val * REMregisterMap[nr].mult).toFixed(2);
                else if (REMregisterMap[nr].div)
                    input.value = (val / REMregisterMap[nr].div).toFixed(2);
                else
                    input.value = val;
            }
        }
    });
}

async function onRegisterChangeUser(event)
{
    var nr = event.target.dataset.register;
    var bits = event.target.dataset.bits;
    var val = event.target.value;

    var new_val = rem.register[nr].val;

    if (bits)
    {
        var range = bits.split(":");
        range = range.map((s) => { return parseInt(s); });

        if (range.length == 1)
        {
            var mask = 1 << range[0];

            console.log(val, range, mask, new_val);

            new_val &=~mask;
            new_val |= (val & 1) << range[0];
        }
        else if (range.length == 2)
        {
            var mask = (2**(range[0]-range[1]) - 1);

            console.log(val, range, mask, new_val);

            new_val &=~mask;
            new_val |= (val & mask) << range[1];
        }
    }
    else {
        if (REMregisterMap[nr].mult)
            new_val = Math.round(val / REMregisterMap[nr].mult);
        else if (REMregisterMap[nr].div)
            new_val = Math.round(val * REMregisterMap[nr].div);
        else
            new_val = val;
    }

    await rem.writeRegister(nr, new_val);
}

function onImageReceived(eventSender, data)
{
    stopTime = performance.now();

    //document.getElementById("time").innerHTML = "" + ((stopTime - startTime) / 1000.0).toFixed(2) + " s";

    document.getElementById("abort-button").disabled = true;
    document.getElementById("scan-button").disabled = false;

    displayImage(data);
}

function onChunkReceived(eventSender, data)
{
	var progress = document.getElementById("progress-bar");
    var percent = Math.round(data.image.length / (data.w * data.h) * 100.0);
    
	progress.style.width = percent + '%'; 
    progress.innerHTML = percent * 1  + '%';
    
    displayImage(data);
}

function displayImage(data)
{
	let dataRGBA = new Uint8Array(data.w*data.h*4);
    convertRGBA(data.image, dataRGBA);
    
    var img = img_ctx.getImageData(0, 0, data.w, data.h);
    
    img.data.set(dataRGBA);
    img_ctx.putImageData(img, 0, 0);
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