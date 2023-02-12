var pat_fill_canvas = document.createElement("canvas");
pat_fill_canvas.width = 10;
pat_fill_canvas.height = 10;
var pat_fill_ctx = pat_fill_canvas.getContext("2d");

let pat_fill_gradient = pat_fill_ctx.createLinearGradient(0, 0, 0, pat_fill_canvas.height);

const colorStops = [
        [0, 'white'],
        [0.5, 'white'],
        [0.5, 'red'],
        [1.0, 'red']
];

colorStops.forEach(element => {
    pat_fill_gradient.addColorStop(element[0], element[1]);
});

pat_fill_ctx.fillStyle = pat_fill_gradient;
pat_fill_ctx.fillRect(0, 0, pat_fill_canvas.width, pat_fill_canvas.height);

let pat_fill = pat_fill_ctx.createPattern(pat_fill_canvas, 'repeat');

var pat_canvas = document.getElementById("pattern-canvas");
var pat_ctx = pat_canvas.getContext("2d", { alpha: true, willReadFrequently: false });

var registers = [];
var transforms = [];
var transformation = {};

function initSettings()
{
    initRegister();

    registers = document.querySelectorAll("[data-register]");

    registers.forEach((register) => {
        register.addEventListener("change", onRegisterChangeUser);
    });

    transforms = document.querySelectorAll("[data-transform]");

    transforms.forEach((transform) => {
        transformation[transform.dataset.transform] = transform;
        transform.addEventListener("change", onTransformChangeUser);
    });

    drawGrid();
}

function onPatternChange(eventSender, data)
{
    drawPattern();
}

async function onTransformChangeUser(event)
{
    var t = rem.makePatternTransform(
        (transformation.ox ? transformation.ox.value : 0.0),
        (transformation.oy ? transformation.oy.value : 0.0),
        (transformation.fx ? transformation.fx.value : 1.0),
        (transformation.fy ? transformation.fy.value : 1.0),
        (transformation.sx ? transformation.sx.value : 0.0),
        (transformation.sy ? transformation.sy.value : 0.0),
        (transformation.r  ? transformation.r.value  : 0.0),
    );

    await rem.setPatternTransform(t.a, t.b, t.c, t.d, t.e, t.f);
}

function drawGrid()
{
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
}

function drawPattern()
{
    const scale = 256;

    drawGrid();

    var m = rem.getPatternTransform();
    var t = rem.breakPatternTransform(m.a, m.b, m.c, m.d, m.e, m.f);

    // Update Scale/Skew/Rotation
    transformation.ox.value = t.ox;
    transformation.oy.value = t.oy;
    transformation.fx.value = t.fx;
    transformation.fy.value = t.fy;
    transformation.sx.value = t.sx;
    transformation.sy.value = t.sy;
    transformation.r.value  = t.r;

    pat_ctx.save();

    m.e /= scale;
    m.f /= scale;

	pat_ctx.setTransform(m);

	var rect = rem.getPatternRect();

	pat_ctx.globalAlpha = 0.5;
    pat_ctx.fillStyle = pat_fill;    
	pat_ctx.fillRect(rect.x/scale, rect.y/scale, rect.w/scale, rect.h/scale);
	pat_ctx.globalAlpha = 1.0;
	
	pat_ctx.beginPath();
	pat_ctx.lineWidth = 1;
	pat_ctx.strokeStyle = '#ffffff';
	pat_ctx.rect(rect.x/scale, rect.y/scale, rect.w/scale, rect.h/scale);
	pat_ctx.stroke();

    pat_ctx.restore();
}

function onRegisterChange(eventSender, nr)
{
    var val = rem.register[nr].val;

    registers.forEach((input) => 
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
            new_val &=~mask;
            new_val |= (val & 1) << range[0];
        }
        else if (range.length == 2)
        {
            var mask = (2**(range[0]-range[1]) - 1);
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

function initRegister()
{
    var inputs = document.getElementById("register-list");
    
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
        
            inputs.appendChild(row);

            rem.onRegisterChange(nr, onRegisterChange);
            
            if ((8  <= nr && nr <= 11) ||
		        (20 <= nr && nr <= 25))
		    {
    			rem.onRegisterChange(nr, drawPattern);
		    }
            
        }
    }
}