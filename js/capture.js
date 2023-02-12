function initCapture()
{
    document.getElementById("store-button").onclick = onStoreButtonClick;
}

function onStoreButtonClick(e)
{
    var storebutton = document.getElementById("store-button");
    
    if (storebutton.disabled == true)
        return;

    var captures_list = document.getElementById("captures-list");

    var img = document.createElement("img");
    img.src = img_canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    
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
    <tr><td>Size</td><td>:</td><td>${capture_metadata.height}x${capture_metadata.width}@${capture_metadata.depth}bpp</td></tr>
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
}

function onSelectImage(e)
{
    e.currentTarget.classList.toggle("selected");
}

async function onDownloadImage(e)
{
    // https://github.com/hometlt/png-metadata

    var a = document.createElement('a');
    a.href = e.target.src;
    a.download = formatDateFilename(e.target.dataset.time) + "_" + e.target.dataset.subject + "_" + e.target.dataset.magnifi + "x" + ".png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function formatDate(timestamp)
{
    var t = new Date(Number(timestamp));

    return `${t.getDay()}.${t.getMonth()}.${t.getFullYear()} ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
}

function formatDateFilename(timestamp)
{
    var t = new Date(Number(timestamp));

    return `${pad(t.getYear())}${pad(t.getMonth())}${pad(t.getDay())}_${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
}

function pad(v)
{
    return (v < 10 ? '0' + v : v);
}