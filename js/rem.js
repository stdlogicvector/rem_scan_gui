const REMregisterCount = 32;

// GND  : 1,9,12
// X    : 10
// Y    : 13
// C    : 20
// V    : 2

const REMregisterMap = [
    { use: true,  name: "Configuration", type: "hex", bits: [
        {id: 0, name: "Channel 1" },
        {id: 1, name: "8-Bit" },
        {id: 2, name: "Test Image" },
        {id: 3, name: "Averaging" },
        {id: 4, name: "Invert" },
        {id: 5, name: "Shift" },
        {id: 6, name: "Multiply" }
    ] },
    { use: true, name: "Test Img. Mode", type: "hex", options: [
        {id: 0, name: "RC Lo/Lo" },
        {id: 1, name: "RC Lo/Hi" },
        {id: 2, name: "RC Hi/Lo" },
        {id: 3, name: "RC Hi/Hi" },
        {id: 4, name: "XY Lo/Lo" },
        {id: 5, name: "XY Lo/Hi" },
        {id: 6, name: "XY Hi/Lo" },
        {id: 7, name: "XY Hi/Hi" },
        {id: 8, name: "X xor Y" },
		{id: 9, name: "ROW(0)" },
		{id: 10, name: "COL(0)" },
		{id: 11, name: "ROW/COL" }
    ] },
    { use: true, name: "Averaging Count", type: "unsigned", min: 0, max: 2**8-1 },
    { use: true, name: "Averaging Delay", type: "unsigned", min: 0, max: 2**16-1, unit: "ms", mult: 0.01 },
    { use: true, name: "Shifting Offset", type: "unsigned", min: 0, max: 2**16-1 },
    { use: true, name: "Multiply Factor", type: "unsigned", min: 0, max: 2**8-1 },
    { use: false },
    { use: false },
    
    { use: true,  name: "Steps X",  type: "unsigned", min: 1, max: 2**16-1 },
    { use: true,  name: "Steps Y",  type: "unsigned", min: 1, max: 2**16-1 },
    { use: true,  name: "Delta X",  type: "unsigned", min: 0, max: 2**16-1, unit: "stp" },
    { use: true,  name: "Delta Y",  type: "unsigned", min: 0, max: 2**16-1, unit: "stp" },
    
    { use: false },
    { use: false },
    { use: false },
    { use: false },

    { use: true,  name: "Ctrl. Delay", type: "unsigned", min: 0, max: 2**16-1, unit: "ms", mult: 0.01024 },
    { use: true,  name: "Init Delay",  type: "unsigned", min: 0, max: 2**16-1, unit: "us", mult: 0.01 },
    { use: true,  name: "Col. Delay",  type: "unsigned", min: 0, max: 2**16-1, unit: "us", mult: 0.01  },
    { use: true,  name: "Row Delay",   type: "unsigned", min: 0, max: 2**16-1, unit: "us", mult: 0.01  },

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
    REGISTER_CHANGE: Symbol("Register Value changed"),
    PATTERN_CHANGE: Symbol("Scan Pattern changed"),
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
            REMevents.REGISTER_CHANGE,
            REMevents.PATTERN_CHANGE,
            REMevents.ERROR_OCCURRED
        ]);
  
        this.silent = false;

        this.serial = new Serial();

        this.serial.on(SerialEvents.CONNECTION_OPENED, this.onSerialOpened.bind(this));
        this.serial.on(SerialEvents.CONNECTION_CLOSED, this.onSerialClosed.bind(this));
        this.serial.on(SerialEvents.DATA_RECEIVED, this.onSerialReceived.bind(this));
        this.serial.on(SerialEvents.ERROR_OCCURRED, this.onSerialError.bind(this));

        this.mode = "cmd";
        this.liveview = false;
        this.textDecoder = new TextDecoder();
        this.rx_buffer = "";
        this.response_buffer = [];

        // Fill passes reference not distinct instances -> use Map
        this.register = new Array(REMregisterCount).fill().map(() => {return new Object({val: 0, inited: false, listeners: [] });}); 

        this.chunk = null;
        this.image = {};
        this.image.data = null;
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
        if (event == REMevents.REGISTER_CHANGE && 0 <= data && data <= REMregisterCount)
        {
            if (!this.silent)
                for (let callback of this.register[data].listeners)
                    callback(this, data);
        }
        
        if (this.events.has(event))
        {
            for (let callback of this.events.get(event))
                callback(this, data);
        }
    }

    async connect(select) {
        const serialOptions = {
            baudRate: 921600,
            dataBits: 8,
            stopBits: 1,
            parity: "none",
            flowControl: "hardware",
            bufferSize: 16384
        };
        
        if (navigator.serial)
        {
            if (!this.serial.isOpen())
            {
                if (!select)
                    await this.serial.autoConnectAndOpenPreviouslyApprovedPort(serialOptions);
                else
                    await this.serial.connectAndOpen(
                        [{ usbVendorId: 0x0403, usbProductId: 0x6011 }],
                        serialOptions);
            }
        } else {
            alert('The Web Serial API is not supported on this browser.');
        }

        this.register.forEach((r) => {
            r.inited = false;
        });
    }
  
    connected()
    {
        return this.serial.isOpen();
    }

    async close() {
        await this.serial.close();
    }

    async command(cmd, wait=true) {
        console.log("Command  " + cmd);
        await this.serial.write(cmd);

        while (wait)
        {
            await sleep(2);
            if (this.response_buffer.length > 0)
            {
                const response = this.response_buffer.pop();

                console.log("Response", response);

                return response;
            }
        }
    }

    async readRegister(nr, silent=false)
    {
        if (!this.serial.isOpen()) 
            return false;

        const regex = /\{R([a-fA-F0-9]{4})\}/;

        var response = await this.command("{R" + dec2hex(nr, 2) + "}");
        
        var regval = regex.exec(response);

        if (regval && regval.length == 2)
        {
            var val = parseInt(regval[1], 16);

            if (REMregisterMap[nr].type == "signed" && (val & 0x8000))
                val -= 0x10000;                

            this.register[nr].val = val;

            if (this.register[nr].val != val || this.register[nr].inited == false)
            {
                this.register[nr].inited = true;
                if (!silent)
                    this.fireEvent(REMevents.REGISTER_CHANGE, nr);
            }

            return this.register[nr].val;
        } else
            return undefined;        
    }

    async writeRegister(nr, val, silent=false)
    {
        if (!this.serial.isOpen()) 
            return false;

        var response = await this.command("{W" + dec2hex(nr, 2) + dec2hex(val, 4) + "}");

        if (response.match("!"))
        {
            var old_val = this.register[nr].val;

            this.register[nr].val = val;

            if (!silent && old_val != val)
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

        await this.abort();

        await this.readRegister(0);
        await this.readRegister(8);
        await this.readRegister(9);

        this.image.count = 0;
        this.image.lastcount = 0;
        this.image.height = this.register[9].val; 
        this.image.width = this.register[8].val;

        if (this.register[0].val & (1 << 1))
            this.image.depth = 8;
        else
            this.image.depth = 16;

        this.image.size = this.image.width*this.image.height*this.image.depth/8;

        this.image.buffer = new ArrayBuffer(this.image.size);
        this.image.data8 = new Uint8Array(this.image.buffer);
        this.image.data16 = new Uint16Array(this.image.buffer);

        this.image.starttime = performance.now();

        this.mode = "data";
        console.log("DATA");
        this.command("{S}", false);
    }

    async live() {
        if (!this.serial.isOpen()) 
            return false;

        this.command("{X}", true);

        await this.readRegister(10);
        await this.readRegister(11);
/*
        if (100 * this.register[10] > 2**16)
            await this.writeRegister(10, Math.floor(2**16 / 100));

        if (75 * this.register[11] > 2**16)
            await this.writeRegister(11, Math.floor(2**16 / 75));
*/
        this.lastDeltaX = this.register[10].val;
        this.lastDeltaY = this.register[11].val;

        await this.writeRegister(10, Math.floor((2**16 - 1) /100.0));
        await this.writeRegister(11, Math.floor((2**16 - 1) / 75.0));

        await this.readRegister(10);
        await this.readRegister(11);

        await this.command("{L}", true);
        this.liveview = true;
    }

    async abort()
    {
        if (!this.serial.isOpen()) 
            return false;

        await this.command("{X}", true);
        this.mode = "cmd";

        if (this.liveview)
        {
            await this.writeRegister(10, this.lastDeltaX);
            await this.writeRegister(11, this.lastDeltaY);

            await this.readRegister(10);
            await this.readRegister(11);
            this.liveview = false;
        }
    }

    async init()
    {
        if (!this.serial.isOpen()) 
            return false;

        for (var nr = 0; nr < REMregisterCount; ++nr)
            await this.readRegister(nr);

        this.fireEvent(REMevents.PATTERN_CHANGE, 0);
    }
	
    async getImageWidth()
    {
        if (!this.register[8].inited)
            await this.readRegister(8);

        return this.register[8].val;
    }

    async getImageHeight()
    {
        if (!this.register[9].inited)
            await this.readRegister(9);

        return this.register[9].val;
    }

    async getImageDepth()
    {
        if (!this.register[0].inited)
            await this.readRegister(0);

        if (this.register[0].val & (1 << 1))
            return 8;
        else
            return 16;
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

    		await this.writeRegister(reg, v, false);
			reg++;
		}
        
        this.fireEvent(REMevents.PATTERN_CHANGE, 0);
	}
	
	makePatternTransform(ox, oy, fx, fy, sx, sy, r)
	{
		// a c e
		// b d f

        const f = [
            [ fx,  0,  0],
            [  0, fy,  0],
            [  0,  0,  1],
        ];

        const s = [
            [  1,  Math.tan(sx / 180.0 * Math.PI),  0],
            [  Math.tan(sy / 180.0 * Math.PI),  1,  0],
            [  0,  0,  1],
        ];

        const w = r / 180.0 * Math.PI;

        const a = [
            [  +Math.cos(w),  -Math.sin(w),  0],
            [  +Math.sin(w),  +Math.cos(w),  0],
            [  0,  0,   1],
        ];

        const o = [
            [  0,  0,  ox],
            [  0,  0,  oy],
            [  0,  0,   0],
        ];
		
        const fs = math.multiply(f, s);
        const fsa = math.multiply(fs, a);
        const fsao = math.add(fsa, o);

		return new DOMMatrix([
            fsao[0][0],
            fsao[1][0],
            fsao[0][1],
            fsao[1][1],
            fsao[0][2],
            fsao[1][2]
        ]);
	}

    breakPatternTransform(a, b, c, d, e, f)
    {
        /*
        11 21 31
        12 22 32

         a  c  e
         b  d  f
        */
        var result = { ox: 0.0, oy: 0.0, fx: 1.0, fy: 1.0, sx: 0.0, sy: 0.0, r: 0.0 };

        // Translation
        result.ox = e;
        result.oy = f;

        // Scaling
        result.fx = Math.sqrt(a*a + b*b).toFixed(2);
        result.fy = Math.sqrt(c*c + d*d).toFixed(2);

        result.r = Math.atan2(b, a);
        result.r = (result.r / Math.PI * 180.0).toFixed(2);

        // https://stackoverflow.com/questions/45159314/decompose-2d-transformation-matrix
        // https://theswissbay.ch/pdf/Gentoomen%20Library/Game%20Development/Programming/Graphics%20Gems%202.pdf


        return result;
    }

    onSerialError(eventSender, error) {
        this.fireEvent(REMevents.ERROR_OCCURRED, error)
    }

    onSerialOpened(eventSender) {
        this.fireEvent(REMevents.CONNECTION_OPENED, eventSender);
    }

    onSerialClosed(eventSender) {
        this.register.forEach((r) => {
            r.inited = false;
        });

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
            if (this.image.count + newData.length <= this.image.size)
                this.image.data8.set(newData, this.image.count);

            this.image.count += newData.length;
            
            if (this.image.count >= this.image.size)
            {
                console.log("CMD");
                this.mode = "cmd";
                this.image.stoptime = performance.now();
            }

            this.fireEvent(REMevents.IMAGE_RECEIVED, this.image);
        }
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
