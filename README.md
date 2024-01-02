# rem_scan_gui

## An open source scan controller for SEMs

- PCB: https://github.com/stdlogicvector/rem_scan_pcb
- GUI: https://github.com/stdlogicvector/rem_scan_gui

The PCB features two 16bit DACs to steer the electron beam of an SEM and two 16bit ADCs to acquire the image signal from up to two detectors.

It can be controlled via USB. The FTDI chip provides a virtual comport, a fast FIFO connection and a JTAG port for flashing the gateware.
Currently, only the serial port is supported in the gateware and the GUI.

Additionally, a VGA monitor can be connected for a live view of the image.
On PCBv1, only the internal blockram is used. This limits the resolution to 100x75 pixels. The image is upscaled to 800x600.

PCBv2 has external RAM and allows a native resolution of 800x600.

## GUI Usage

Open the index.html in a browser that supports WebSerial and click the "Connect" button in the lower left corner.

When you are connecting for the first time, a browser dialog pops up where you can select the device.
If you have problems finding the device under linux, your user is probably not a member of the group "dialout".

After connecting click "Init" to read the current value of all registers. All the settings are visible in the right slide-out.

Optionally fill out the textfields on the bottom and then click "Capture" to scan an image.

The capture can then be stored by clicking "Store". All stored caputures are visible in the left slide-out where they can be saved to your harddisk.
