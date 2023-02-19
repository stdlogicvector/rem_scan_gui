function initCapture()
{
    document.getElementById("store-button").onclick = onStoreButtonClick;
}

function unsavedCaptures()
{
    return document.querySelectorAll("[data-unsaved='true']").length;
}

function onStoreButtonClick(e)
{
    var storebutton = document.getElementById("store-button");
    
    if (storebutton.disabled == true)
        return;

    var captures_list = document.getElementById("captures-list");

    var img = document.createElement("img");
    img.src = img_canvas.src.replace("image/png", "image/octet-stream");
    img.classList.add("capture-img");
    img.dataset.unsaved = "true";
    img.dataset.selected = "false";
    
    for (const [key, value] of Object.entries(capture_metadata))
        img.dataset[key] = value;
        
    img.ondblclick = onDownloadImage;

    var td_nr = document.createElement("td");
    
    td_nr.innerHTML = "<span class='capture_nr'>" + (captures_list.children.length + 1) + "</span>";

    var td_img = document.createElement("td");
    td_img.appendChild(img);

    var td_meta = document.createElement("td");
    td_meta.innerHTML = `
    <table>
    <tr><td>Time</td><td>:</td><td>${formatDate(capture_metadata.time)}</td></tr>
    <tr><td>Subject</td><td>:</td><td>${capture_metadata.subject}</td></tr>
    <tr><td>Voltage</td><td>:</td><td>${capture_metadata.voltage} kV</td></tr>
    <tr><td>Mag.</td><td>:</td><td>${capture_metadata.magnifi} x</td></tr>
    <tr><td>Size</td><td>:</td><td>${capture_metadata.height} x ${capture_metadata.width} @ ${capture_metadata.depth}bpp</td></tr>
    <tr><td>Comment</td><td>:</td><td>${capture_metadata.comment}</td></tr>
    </table>
    `;

    var tr = document.createElement("tr");
    tr.addEventListener("click", onSelectImage);
    tr.appendChild(td_nr);
    tr.appendChild(td_img);
    tr.appendChild(td_meta);

    captures_list.prepend(tr);

    e.target.disabled = true;
    img_canvas.dataset.stored = "true";

    document.getElementById("captures-save").disabled = false;
    document.getElementById("captures-save-unsaved").disabled = false;
    document.getElementById("captures-save-all").disabled = false;

    document.getElementById("captures-clear").disabled = false;
    document.getElementById("captures-clear-saved").disabled = false;
    document.getElementById("captures-clear-all").disabled = false;
}

function onCapturesSave(e, all=false, unsaved=false)
{
    if (all)
        var selected = document.querySelectorAll(".capture-img");
    else
    {
        if (unsaved)
            var selected = document.querySelectorAll("[data-unsaved='true']");
        else
            var selected = document.querySelectorAll("[data-selected='true']");
    }

    if (selected.length > 0)
    {
        var zip = new JSZip();
        var first = Number.MAX_SAFE_INTEGER;
        var last = 0;

        selected.forEach((s) => {
            var imagedata = s.src.substring(31);
            zip.file(formatFilename(s.dataset), imagedata, {base64: true});

            var ts = Number(s.dataset.time);

            if (ts < first)
                first = ts;
            
            if (ts > last)
                last = ts;

            s.dataset.unsaved = "false";
        });
        
        zip.generateAsync({type: "base64"}).then((content) => {
            var a = document.createElement('a'); 
            a.href = "data:application/zip;base64," + content;
            
            a.download = "REM " + formatDate(first) + " - " + formatDate(last) + ".zip";
            
            a.click();
        });
    }

    if (unsavedCaptures() == 0)
        document.getElementById("captures-save-unsaved").disabled = true;
}

function onCapturesClear(e, all=false, saved=false)
{
    var unsaved = 0;

    if (all)
    {
        var selected = document.querySelectorAll(".capture-img");
        unsaved = unsavedCaptures();
    } else
    {
        if (saved)
            var selected = document.querySelectorAll("[data-unsaved='false']");
        else
            var selected = document.querySelectorAll("[data-selected='true']");
    }
    
    if (selected.length > 0)
    {
        if (unsaved > 0)
            var discard = confirm("Do you really want to discard " + selected.length + " captures, " + unsaved + " of them unsaved?");
        else
            var discard = confirm("Do you really want to discard " + selected.length + " captures?");

        if (discard)
        {
            selected.forEach((s) => {
                s.parentElement.parentElement.remove();
            });

            document.getElementById("captures-clear").disabled = all;
            document.getElementById("captures-clear-saved").disabled = all | saved;
            document.getElementById("captures-clear-all").disabled = all;
        }
    }
}

function onSelectImage(e)
{
    e.currentTarget.classList.toggle("selected");
    
    e.currentTarget.querySelector(":scope img").dataset.selected = e.currentTarget.classList.contains("selected");
}

async function onDownloadImage(e)
{
    // https://github.com/hometlt/png-metadata

    console.log(e.currentTarget);

    e.target.dataset.unsaved = "false";

    var a = document.createElement('a');
    a.href = e.target.src;
    a.download = formatFilename(e.target.dataset);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function formatFilename(dataset)
{
    return formatDateFilename(dataset.time)
    + "_"
    + dataset.subject
    + (dataset.magnifi == "??" ? "" : "_" + dataset.magnifi + "x")
    + ".png";
}

function formatDate(timestamp)
{
    var t = new Date(Number(timestamp));

    return `${t.getDate()}.${t.getMonth()+1}.${t.getFullYear()} ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
}

function formatDateFilename(timestamp)
{
    var t = new Date(Number(timestamp));

    return `${pad(t.getYear()-100)}${pad(t.getMonth()+1)}${pad(t.getDate())}_${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
}

function pad(v)
{
    return (v < 10 ? '0' + v : v);
}