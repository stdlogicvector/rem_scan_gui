var img_canvas = document.getElementById("image-canvas");
//var img_ctx = img_canvas.getContext("2d", { alpha: true, willReadFrequently: true });

function initImage()
{

}

function onImageReceived(eventSender, image)
{
    var progress = document.getElementById("progress-bar");
    var percent = Math.round(image.count/ image.size * 100.0);
    
	progress.dataset.value = percent;
	progress.style.width = percent + '%'; 

    if (image.count >= image.size) {
        document.getElementById("capture-time").innerHTML = ("" + ((image.stoptime - image.starttime) / 1000.0).toFixed(2) + " s");

        document.getElementById("abort-button").disabled = true;
        document.getElementById("scan-button").disabled = false;
        document.getElementById("store-button").disabled = false;
        document.getElementById("equalize-button").disabled = false;
    }

    if ((image.count - image.lastcount > 2**13)
    || (image.count >= image.size))
    {
        image.lastcount = image.count;
        displayImage(image);
    }
}

function displayImage(image)
{
    // https://stackoverflow.com/questions/59537492/whats-the-fastest-way-to-draw-an-image-to-the-screen-in-javascript-from-array-o
    // https://stackoverflow.com/questions/73191734/efficiently-update-a-canvas-with-rgb-or-grayscale-data-but-not-rgba

    /*
    ctx.putImageData(
        new ImageData(new Uint8ClampedArray(image.data), ww, hh),
        0, 0,
        0, 0,
        image.width, image.height
    );
    */

    const png = new IJS.Image(
        image.width,
        image.height,
        (image.depth == 8 ? image.data8 : image.data16),
        {kind: 'GREY', bitDepth: image.depth});
    
    img_canvas.src = png.toDataURL();
}

function calcHistogram(image)
{
    let counts = Array(2**image.depth).fill(0);
    let cdf = Array(2**image.depth).fill(0);
    
    let min = 2**image.depth;
    let max = 0;

    let data = (image.depth == 8 ? image.data8 : image.data16);

    for (var i = 0; i < image.count; ++i)
    {
        counts[data[i]]++;

        if (data[i] > max)
            max = data[i];
        
        if (data[i] < min)
            min = data[i];
    }

    cdf[0] = counts[0];
    for (var i = 1; i < cdf.length; ++i)
        cdf[i] = cdf[i-1] + counts[i] ;

    return {min: min, max: max, counts: counts, cdf: cdf};
}

function equalizeHistogram(image)
{
    let histogram = calcHistogram(image);

    let high = 2**image.depth - 1;
    let max = image.count;
    let min = histogram.cdf[0];

    let data = (image.depth == 8 ? image.data8 : image.data16);

    for (let i = 0; i < max; ++i)
    {
        let v = histogram.cdf[data[i]];
        data[i] = Math.floor(high * (v - min) / (max - min));
    }

    displayImage(image);
}