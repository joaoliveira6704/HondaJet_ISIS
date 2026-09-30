const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// 1. Correctly import 'open' and all required enums from node-simconnect
const { open, Protocol, SimConnectConstants, SimConnectPeriod, SimConnectDataType } = require('node-simconnect');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Client connected to ISIS dashboard');
});

// Start web server
server.listen(3000, () => {
    console.log('Instrument running on http://localhost:3000');
});

// 2. Initialize SimConnect
open('HondaJet ISIS', Protocol.FSX_SP2)
    .then(({ recvOpen, handle }) => {
        console.log('Connected to MSFS SimConnect:', recvOpen.applicationName);

        const DEFINITION_1 = 1;
        const REQUEST_1 = 1;

        // Define the variables we want from the simulator.
        handle.addToDataDefinition(DEFINITION_1, 'PLANE PITCH DEGREES', 'Degrees', SimConnectDataType.FLOAT64);
        handle.addToDataDefinition(DEFINITION_1, 'PLANE BANK DEGREES', 'Degrees', SimConnectDataType.FLOAT64);
        handle.addToDataDefinition(DEFINITION_1, 'PLANE HEADING DEGREES MAGNETIC', 'Degrees', SimConnectDataType.FLOAT64);
        handle.addToDataDefinition(DEFINITION_1, 'KOHLSMAN SETTING MB:3', 'Millibars', SimConnectDataType.FLOAT64);
        handle.addToDataDefinition(DEFINITION_1, 'AIRSPEED INDICATED', 'Knots', SimConnectDataType.FLOAT64);
        handle.addToDataDefinition(DEFINITION_1, 'INDICATED ALTITUDE:3', 'Feet', SimConnectDataType.FLOAT64);
        handle.addToDataDefinition(DEFINITION_1, "KOHLSMAN SETTING STD:3", 'Bool', SimConnectDataType.FLOAT64);
        handle.addToDataDefinition(DEFINITION_1, "AIRSPEED MACH", "mach", SimConnectDataType.FLOAT64);
        handle.addToDataDefinition(DEFINITION_1, "INCIDENCE BETA", "Degrees", SimConnectDataType.FLOAT64); // Added Slip Angle

        // Tell the simulator to send us this data structure on every visual frame.
        handle.requestDataOnSimObject(REQUEST_1, DEFINITION_1, SimConnectConstants.OBJECT_ID_USER, SimConnectPeriod.SIM_FRAME);

        // Listen for incoming data packets.
        handle.on('simObjectData', (recvSimObjectData) => {
            if (recvSimObjectData.requestID === REQUEST_1) {
                const buffer = recvSimObjectData.data;

                // Extract data from the buffer in the EXACT order defined above.
                const pitch = buffer.readFloat64();
                const roll = buffer.readFloat64();
                const heading = buffer.readFloat64();
                const qnh = buffer.readFloat64();
                const airspeed = buffer.readFloat64();
                const altitude = buffer.readFloat64();
                const isStdSet = buffer.readFloat64() === 1;
                const mach = buffer.readFloat64();
                const slip = buffer.readFloat64();

                // Broadcast the telemetry to our frontend socket
                io.emit('simData', {
                    pitch: -pitch,
                    roll: roll,
                    heading: heading,
                    qnh: qnh,
                    airspeed: airspeed,
                    altitude: altitude,
                    isStdSet: isStdSet,
                    mach: mach,
                    slip: slip // Broadcast slip
                });
            }
        });
    })
    .catch((err) => {
        console.error('Failed to connect to MSFS:', err);
        console.log('Make sure MSFS is running before starting the Node server.');
    });
