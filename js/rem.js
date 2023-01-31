const REMregister = [
    { use: true,  name: "Configuration", display: "checkbox", bits: [
        {id: 0, name: "Channel 1" },
        {id: 1, name: "8-Bit" },
        {id: 2, name: "Test Image" }
    ] },
    { use: true, name: "Test Img. Mode", display: "dropdown", options: [
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
    
    { use: true,  name: "Offset X", display: "unsigned", min: 0, max:0xFFFF, unit: "stp" },
    { use: true,  name: "Offset Y", display: "unsigned", min: 0, max:0xFFFF, unit: "stp" },
    { use: true,  name: "Steps X",  display: "unsigned", min: 0, max:0xFFFF},
    { use: true,  name: "Steps Y",  display: "unsigned", min: 0, max:0xFFFF},
    { use: true,  name: "Delta X",  display: "unsigned", min: 0, max:0xFFFF, unit: "stp" },
    { use: true,  name: "Delta Y",  display: "unsigned", min: 0, max:0xFFFF, unit: "stp" },
    
    { use: false },
    { use: false },

    { use: true,  name: "Ctrl. Delay", display: "unsigned", min: 0, max:0xFFFF, unit: "ms", mult: 0.00256 },
    { use: true,  name: "Init Delay",  display: "unsigned", min: 0, max:0xFFFF, unit: "us", mult: 0.01 },
    { use: true,  name: "Col. Delay",  display: "unsigned", min: 0, max:0xFFFF, unit: "us", mult: 0.01  },
    { use: true,  name: "Row Delay",   display: "unsigned", min: 0, max:0xFFFF, unit: "us", mult: 0.01  },

    { use: true,  name: "Transform 00", display: "signed", min: -2^15, max: 2^15-1, div: 0x4000 },
    { use: true,  name: "Transform 01", display: "signed", min: -2^15, max: 2^15-1, div: 0x4000 },
    { use: true,  name: "Transform 02", display: "signed", min: -2^15, max: 2^15-1, div: 0x4000 },
    { use: true,  name: "Transform 10", display: "signed", min: -2^15, max: 2^15-1, div: 0x4000 },
    { use: true,  name: "Transform 11", display: "signed", min: -2^15, max: 2^15-1, div: 0x4000 },
    { use: true,  name: "Transform 12", display: "signed", min: -2^15, max: 2^15-1, div: 0x4000 },

    { use: false },
    { use: false },

    { use: true,  name: "Clock Freq",  display: "unsigned", readonly: true, unit: "MHz" },
    { use: true,  name: "PCB Version", display: "hex", readonly: true },
    { use: true,  name: "FW Version",  display: "hex", readonly: true },
    { use: true,  name: "FW Build",    display: "hex", readonly: true }
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
  
        this.serial = new Serial();

        this.serial.on(SerialEvents.CONNECTION_OPENED, this.onSerialOpened.bind(this));
        this.serial.on(SerialEvents.CONNECTION_CLOSED, this.onSerialClosed.bind(this));
        this.serial.on(SerialEvents.DATA_RECEIVED, this.onSerialReceived.bind(this));
        this.serial.on(SerialEvents.ERROR_OCCURRED, this.onSerialError.bind(this));

        this.mode = "cmd";
        this.textDecoder = new TextDecoder();
        this.rx_buffer = "";
        this.response_buffer = [];

        this.register = [];

        this.chunk = null;
        this.image = null;
        this.count = 0;
    }

    on(label, callback) {
        if (this.knownEvents.has(label)) {
            if (!this.events.has(label)) {
                this.events.set(label, []);
            }
            this.events.get(label).push(callback);
        } else {
            console.log(`Could not create event subscription for ${label}. Event unknown.`);
        }
    }

    fireEvent(event, data = null) {
        if (this.events.has(event)) {
            for (let callback of this.events.get(event)) {
                callback(this, data);
            }
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
            await this.serial.autoConnectAndOpenPreviouslyApprovedPort(serialOptions);

/*            if (!this.serial.isOpen()) {
                await this.serial.connectAndOpen(
                    [{ usbVendorId: 0x0403, usbProductId: 0x6011 }],
                    serialOptions);
            }
*/           
            
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

            if (this.register[nr] != val)
                this.fireEvent(REMevents.REGISTER_CHANGE, {nr: nr, val: val});

            this.register[nr] = val;
            return this.register[nr];
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
            if (this.register[nr] != val)
                this.fireEvent(REMevents.REGISTER_CHANGE, {nr: nr, val: val});

            this.register[nr] = val;

            return true;
        }
        else
            return false;
    }

    async scan()
    {
        if (!this.serial.isOpen()) 
            return false;

        await this.readRegister(10);
        await this.readRegister(11);

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

        for (var r = 0; r < 32; ++r)
        {
            this.register[r] = await this.readRegister(r);
        }
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

            if (this.count >= this.register[10] * this.register[11])
            {
                this.mode = "cmd";
                this.onImageReceived();
            }
        }
    }

    onChunkReceived()
    {
        this.fireEvent(REMevents.CHUNK_RECEIVED, {
            h: this.register[11],
            w: this.register[10],
            image: this.image
        });
    }

    onImageReceived()
    {
        this.fireEvent(REMevents.IMAGE_RECEIVED, {
            h: this.register[11],
            w: this.register[10],
            image: this.image
        });
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function dec2hex(d, padding) {
    var hex = Number(d).toString(16);
    padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

    while (hex.length < padding) {
        hex = "0" + hex;
    }

    return hex;
}
