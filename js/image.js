var img_canvas = document.getElementById("image-canvas");
var img_ctx = img_canvas.getContext("2d", { alpha: true, willReadFrequently: true });

function initImage()
{

}

function onImageReceived(eventSender, image)
{
    stopTime = performance.now();

    //document.getElementById("time").innerHTML = "" + ((stopTime - startTime) / 1000.0).toFixed(2) + " s";

    document.getElementById("abort-button").disabled = true;
    document.getElementById("scan-button").disabled = false;
    document.getElementById("store-button").disabled = false;

    displayImage(image);
}

function onChunkReceived(eventSender, image)
{
	var progress = document.getElementById("progress-bar");
    var percent = Math.round(image.data.length / (image.width * image.height) * 100.0);
    
	progress.dataset.value = percent;
	progress.style.width = percent + '%'; 
    
    displayImage(image);
}

function displayImage(image)
{
    /*
    let png = await pngtoy.fetch(image.data);
    let bmp = await png.decode(png);
    let data = await png.convertToRGBA(png);
    */
    
	let data = new Uint8Array(image.width*image.height*4);
    convertRGBA(image.data, data);

    var img = img_ctx.getImageData(0, 0, image.width, image.height);
    
    img.data.set(data);
    img_ctx.putImageData(img, 0, 0);

/*
    let png = await IJS.Image.load(image.data);
    img_canvas.src = png.toDataURL();
*/
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
