const REMregisterCount = 32;

const REMregisterMap = [
    { use: true,  name: "Configuration", type: "bitfield", bits: [
        {id: 0, name: "Channel 1" },
        {id: 1, name: "8-Bit" },
        {id: 2, name: "Test Image" }
    ] },
    { use: true, name: "Test Img. Mode", type: "select", options: [
        {id: 0, name: "RC Lo/Lo" },
        {id: 1, name: "RC Lo/Hi" },
        {id: 2, name: "RC Hi/Lo" },
        {id: 3, name: "RC Hi/Hi" },
        {id: 4, name: "XY Lo/Lo" },
        {id: 5, name: "XY Lo/Hi" },
        {id: 6, name: "XY Hi/Lo" },
        {id: 7, name: "XY Hi/Hi" },
        {id: 8, name: "0x55AA" }
    ] },
    { use: false },
    { use: false },
    { use: false },
    { use: false },
    { use: false },
    { use: false },
    
    { use: true,  name: "Steps X",  type: "unsigned", min: 1, max: 2^16-1 },
    { use: true,  name: "Steps Y",  type: "unsigned", min: 1, max: 2^16-1 },
    { use: true,  name: "Delta X",  type: "unsigned", min: 0, max: 2^16-1, unit: "stp" },
    { use: true,  name: "Delta Y",  type: "unsigned", min: 0, max: 2^16-1, unit: "stp" },
    
    { use: false },
    { use: false },
    { use: false },
    { use: false },

    { use: true,  name: "Ctrl. Delay", type: "unsigned", min: 0, max: 2^16-1, unit: "ms", mult: 0.00256 },
    { use: true,  name: "Init Delay",  type: "unsigned", min: 0, max: 2^16-1, unit: "us", mult: 0.01 },
    { use: true,  name: "Col. Delay",  type: "unsigned", min: 0, max: 2^16-1, unit: "us", mult: 0.01  },
    { use: true,  name: "Row Delay",   type: "unsigned", min: 0, max: 2^16-1, unit: "us", mult: 0.01  },

    { use: true,  name: "Transform A", type: "signed", min: -(2**15), max: 2**15-1, div: 0x4000 },
    { use: true,  name: "Transform B", type: "signed", min: -(2**15), max: 2**15-1, div: 0x4000 },
    { use: true,  name: "Transform C", type: "signed", min: -(2**15), max: 2**15-1, div: 0x4000 },
    { use: true,  name: "Transform D", type: "signed", min: -(2**15), max: 2**15-1, div: 0x4000 },
    { use: true,  name: "Transform E", type: "signed", min: -(2**15), max: 2**15-1, div: 1 },
    { use: true,  name: "Transform F", type: "signed", min: -(2**15), max: 2**15-1, div: 1 },

    { use: false },
    { use: false },

    { use: true,  name: "Clock Freq",  type: "unsigned", readonly: true, unit: "MHz" },
    { use: true,  name: "PCB Version", type: "hex", readonly: true },
    { use: true,  name: "FW Version",  type: "hex", readonly: true },
    { use: true,  name: "FW Build",    type: "hex", readonly: true }
];

const REMevents = Object.freeze({
    CONNECTION_OPENED: Symbol("Connection opened"),
    CONNECTION_CLOSED: Symbol("Connection closed"),
    IMAGE_RECEIVED: Symbol("New Image received"),
    CHUNK_RECEIVED: Symbol("New Chunk received"),
    REGISTER_CHANGE: Symbol("Register Value changed"),
    ERROR_OCCURRED: Symbol("An Error occurred")
})

class REMinterface {
    constructor()
    {
        this.events = new Map();

        this.knownEvents = new Set([
            REMevents.CONNECTION_OPENED,
            REMevents.CONNECTION_CLOSED,
            REMevents.IMAGE_RECEIVED,
            REMevents.CHUNK_RECEIVED,
            REMevents.REGISTER_CHANGE,
            REMevents.ERROR_OCCURRED
        ]);
  
        this.silent = false;

        this.serial = new Serial();

        this.serial.on(SerialEvents.CONNECTION_OPENED, this.onSerialOpened.bind(this));
        this.serial.on(SerialEvents.CONNECTION_CLOSED, this.onSerialClosed.bind(this));
        this.serial.on(SerialEvents.DATA_RECEIVED, this.onSerialReceived.bind(this));
        this.serial.on(SerialEvents.ERROR_OCCURRED, this.onSerialError.bind(this));

        this.mode = "cmd";
        this.textDecoder = new TextDecoder();
        this.rx_buffer = "";
        this.response_buffer = [];

        // Fill passes reference not distinct instances -> use Map
        this.register = new Array(REMregisterCount).fill().map(() => {return new Object({val: 0, inited: false, listeners: [] });}); 

        this.chunk = null;
        this.image = null;
        this.count = 0;
    }

    on(label, callback) {
        if (this.knownEvents.has(label))
        {
            if (!this.events.has(label))
                this.events.set(label, []);
            
            this.events.get(label).push(callback);
        } else
        {
            console.log(`Could not create event subscription for ${label}. Event unknown.`);
        }
    }

    onRegisterChange(nr, callback) {
        if (0 <= nr && nr < REMregisterCount)
            this.register[nr].listeners.push(callback);
    }

    fireEvent(event, data = null) {
        reg: if (event == REMevents.REGISTER_CHANGE && 0 <= data && data <= REMregisterCount)
        {
            console.log(data, this.silent);

            //if (this.silent)
                //break reg;

            for (let callback of this.register[data].listeners)
                callback(this, data);
        }
        
        if (this.events.has(event))
        {
            for (let callback of this.events.get(event))
                callback(this, data);
        }
    }

    async connect() {
        const serialOptions = {
            baudRate: 921600,
            dataBits: 8,
            stopBits: 1,
            parity: "none",
            flowControl: "none",
            bufferSize: 4096
        };
        
        if (navigator.serial) {
//            await this.serial.autoConnectAndOpenPreviouslyApprovedPort(serialOptions);

            if (!this.serial.isOpen()) {
                await this.serial.connectAndOpen(
                    [{ usbVendorId: 0x0403, usbProductId: 0x6011 }],
                    serialOptions);
            }
         
            
        } else {
            alert('The Web Serial API is not supported on this browser.');
        }
    }

    async close() {
        await this.serial.close();
    }

    async command(cmd, wait=true) {
        console.log("Sending Command " + cmd);
        await this.serial.write(cmd);

        while (wait)
        {
            await sleep(2);
            if (this.response_buffer.length > 0)
            {
                const response = this.response_buffer.pop();
                return response;
            }
        }
    }

    async readRegister(nr)
    {
        if (!this.serial.isOpen()) 
            return false;

        const regex = /\{R([a-fA-F0-9]{4})\}/;

        var response = await this.command("{R" + dec2hex(nr, 2) + "}");
        
        var regval = regex.exec(response);

        if (regval && regval.length == 2)
        {
            var val = parseInt(regval[1], 16);

            this.register[nr].val = val;

            if (this.register[nr].val != val || this.register[nr].inited == false)
            {
                this.register[nr].inited = true;
                this.fireEvent(REMevents.REGISTER_CHANGE, nr);
            }

            return this.register[nr].val;
        } else
            return undefined;        
    }

    async writeRegister(nr, val)
    {
        if (!this.serial.isOpen()) 
            return false;

        var response = await this.command("{W" + dec2hex(nr, 2) + dec2hex(val, 4) + "}");

        if (response.match("!"))
        {
            var old_val = this.register[nr].val;

            this.register[nr].val = val;

            if (old_val != val)
                this.fireEvent(REMevents.REGISTER_CHANGE, nr);

            return true;
        }
        else
            return false;
    }

    async scan()
    {
        if (!this.serial.isOpen()) 
            return false;

        await this.readRegister(8);
        await this.readRegister(9);

        this.count = 0;
        this.image = [];

        this.mode = "data";
        this.command("{S}", false);
    }

    async abort()
    {
        if (!this.serial.isOpen()) 
            return false;

        await this.command("{X}");
        this.mode = "cmd";
    }

    async init()
    {
        if (!this.serial.isOpen()) 
            return false;

        for (var nr = 0; nr < REMregisterCount; ++nr)
        {
            await this.readRegister(nr);
        }
    }
	
    getImageWidth()
    {
        return this.register[8].val;
    }

    getImageHeight()
    {
        return this.register[9].val;
    }

	getPatternRect()
	{
		return {
			x: 0,
			y: 0,
			w: this.register[8].val * this.register[10].val,
			h: this.register[9].val * this.register[11].val
		};
	}

	async setPatternRect(w, h, dx, dy)
	{
		var reg = 8;
		for (const arg in arguments)
		{	
            this.silent = (arg < 3);
			await this.writeRegister(reg, clamp(arguments[arg],  REMregisterMap[reg].min, REMregisterMap[reg].max));
            reg++;
		}
	}

	getPatternTransform()
	{
		var t = [];
		
		for (var reg = 20; reg < 26; ++reg)
			t.push(this.register[reg].val / REMregisterMap[reg].div);
		
		return new DOMMatrix(t);
	}
	
	async setPatternTransform(a, b, c, d, e, f)
	{
		var reg = 20;

		for (const arg in arguments)
		{	
			var v = clamp(arguments[arg] * REMregisterMap[reg].div, REMregisterMap[reg].min, REMregisterMap[reg].max);

            this.silent = (arg < 5);
			await this.writeRegister(reg, v);
			reg++;
		}
	}
	
	makePatternTransform(ox, oy, fx, fy, sx, sy, r)
	{
		// a c e
		// b d f
		// 		  0  1  2  3  4  5
		//        a  b  c  d  e  f
		var t = [ 1, 0, 0, 1, 0, 0 ];
		
		// Scale
        t[0] *= fx;	
		t[3] *= fy;
		
		// Skew
		t[1] += Math.tan(sy / 180.0 * Math.PI);
		t[2] += Math.tan(sx / 180.0 * Math.PI);
		
		// Rotate
		t[0] *= Math.cos(r / 180.0 * Math.PI);
		t[3] *= Math.cos(r / 180.0 * Math.PI);
		
		t[1] += +Math.sin(r / 180.0 * Math.PI);
		t[2] += -Math.sin(r / 180.0 * Math.PI);
		
        t[4] = ox;
        t[5] = oy;

		return new DOMMatrix(t);
	}

    breakPatternTransform(a, b, c, d, e, f)
    {
        var result = { ox: 0.0, oy: 0.0, fx: 1.0, fy: 1.0, sx: 0.0, sy: 0.0, r: 0.0 };

        var tan_psi = 0;

        if (Math.abs(b) < Math.abs(c))  // Shear is in Y
        {
            tan_psi = b / (c != 0 ? -c : 1);    console.log(b, -c, tan_psi);
            b /= (tan_psi > 0 ? tan_psi : 1.0); console.log(b);
            result.sy = Math.atan(tan_psi);     console.log(result.sy);
        } else {
            tan_psi = -c / (b != 0 ? b : 1);    console.log(-c, b, tan_psi);
            c /= (tan_psi > 0 ? tan_psi : 1.0); console.log(c);
            result.sx = Math.atan(tan_psi);     console.log(result.sx);
        }

        var sin_phi = b;
        
        result.r = Math.asin(sin_phi);          console.log(sin_phi, result.r);

        var cos_phi = Math.cos(result.r);       console.log(cos_phi);

        result.fx = a / cos_phi;
        result.fy = d / cos_phi;

        result.ox = e;
        result.oy = f;

        return result;
    }

    onSerialError(eventSender, error) {
        this.fireEvent(REMevents.ERROR_OCCURRED, error)
    }

    onSerialOpened(eventSender) {
        this.fireEvent(REMevents.CONNECTION_OPENED, eventSender);
    }

    onSerialClosed(eventSender) {
        this.fireEvent(REMevents.CONNECTION_CLOSED, eventSender);
    }

    onSerialReceived(eventSender, newData) {
        if (this.mode == "cmd")
        {
            this.rx_buffer += this.textDecoder.decode(newData);
            const responses = this.rx_buffer.split("\n");
            this.rx_buffer = responses.pop();
            this.response_buffer = this.response_buffer.concat(responses);
        } else {
            var tmp = new Uint8Array(this.image.length + newData.length);
            
            tmp.set(this.image);
            tmp.set(newData, this.image.length);
            
            this.image = tmp;
            this.count += newData.length;
            
            this.onChunkReceived();

            if (this.count >= this.register[8].val * this.register[9].val)
            {
                this.mode = "cmd";
                this.onImageReceived();
            }
        }
    }

    onChunkReceived()
    {
        this.fireEvent(REMevents.CHUNK_RECEIVED, {
            h: this.register[9].val,
            w: this.register[8].val,
            image: this.image
        });
    }

    onImageReceived()
    {
        this.fireEvent(REMevents.IMAGE_RECEIVED, {
            h: this.register[9].val,
            w: this.register[8].val,
            image: this.image
        });
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function dec2hex(d, padding) {

    d = Number(d);

    if (d < 0)
        d += 16**padding;

    var hex = Number(d).toString(16);
    padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

    while (hex.length < padding) {
        hex = "0" + hex;
    }

    return hex;
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max).toFixed(0);
};
