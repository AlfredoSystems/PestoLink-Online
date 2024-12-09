let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

let bleAgent = createBleAgent();
let keyboardAgent = createKeyboardAgent();
let axisAgent = createMobileAxisAgent();
let buttonAgent = createMobileButtonAgent();
let gamepadAgent = createGamepadAgent();

let axisCallback = null
let buttonCallback = null

let mobileElements = document.getElementsByClassName("mobile-only");
let desktopElements = document.getElementsByClassName("desktop-only");

let helpRow = document.getElementsByClassName("help-row");

let infoElement = document.getElementById("info-container");
let hackSpacerElement = document.getElementById("hack-spacer");

let toggleMobile = document.getElementById('toggle-mobile-layout');
let toggleKeyboardWASD = document.getElementById('toggle-keyboard-style');
let toggleInfo = document.getElementById('toggle-info');

// --------------------------- state management ------------------------------------ //

if (localStorage.getItem(toggleMobile.id) == null) {
    if (isMobile) {
        localStorage.setItem(toggleMobile.id, 'true');
    } else {
        localStorage.setItem(toggleMobile.id, 'false');
    }
    updateMobileSlider(toggleMobile, false);
 }

 if(isMobile) for (let element of helpRow) element.style.display = "none";

document.addEventListener('DOMContentLoaded', function () {
    updateMobileSlider(toggleMobile, toggleState=false);
    updateSlider(toggleKeyboardWASD, toggleState=false);
    updateInfoSlider(toggleInfo, toggleState=false);

    toggleMobile.onmousedown = updateMobileSlider.bind(null, toggleMobile, toggleState=true)
    toggleKeyboardWASD.onmousedown = updateSlider.bind(null, toggleKeyboardWASD, toggleState=true)
    toggleInfo.onmousedown =     updateInfoSlider.bind(null, toggleInfo, toggleState=true)
    
    toggleMobile.ontouchstart = updateMobileSlider.bind(null, toggleMobile, toggleState=true)
    toggleKeyboardWASD.ontouchstart = updateSlider.bind(null, toggleKeyboardWASD, toggleState=true)
    toggleInfo.ontouchstart =     updateInfoSlider.bind(null, toggleInfo, toggleState=true)
    
    window.setInterval(renderLoop, 100); // call renderLoop every num milliseconds
});

function updateMobileSlider(sliderElement, toggleState){
    updateSlider(sliderElement, toggleState);

    if (localStorage.getItem(toggleMobile.id) === 'true') {
        for (let element of desktopElements) element.style.display = "none";
        for (let element of mobileElements) element.style.display = "grid";
        axisCallback = axisAgent.getAxes
        buttonCallback = buttonAgent.getButtons
    } else {
        for (let element of mobileElements) element.style.display = "none";
        for (let element of desktopElements) element.style.display = "grid";
        axisCallback = gamepadAgent.getAxes
        buttonCallback = gamepadAgent.getButtons
    }
}

function updateInfoSlider(sliderElement, toggleState){
    updateSlider(sliderElement, toggleState);

    if (localStorage.getItem(toggleInfo.id) === 'true') {
        infoElement.style.display = "grid";
        hackSpacerElement.style.display = "none";
    } else {
        infoElement.style.display = "none";
        hackSpacerElement.style.display = "grid";
    }
}

function updateSlider(sliderElement, toggleState){
    if(toggleState){
        if ( localStorage.getItem(sliderElement.id) === 'true') {
            localStorage.setItem(sliderElement.id, 'false');
        } else {
            localStorage.setItem(sliderElement.id, 'true');
        }        
    }

    if ( localStorage.getItem(sliderElement.id) === 'true') {
        sliderElement.style.backgroundColor = 'var(--alf-green)';
        sliderElement.firstElementChild.style.transform = 'translateX(2vw)';
        sliderElement.firstElementChild.style.webkitTransform  = 'translateX(2vw)';
        sliderElement.firstElementChild.style.msTransform = 'translateX(2vw)';

    } else {
        sliderElement.style.backgroundColor = 'rgb(189, 188, 188)';
        sliderElement.firstElementChild.style.transform = 'none';
        sliderElement.firstElementChild.style.webkitTransform  = 'none';
        sliderElement.firstElementChild.style.msTransform = 'none';
    }
}

// ----------------------------------------- main --------------------------------------- //

function renderLoop() {
    //bytes 0: packet version
    //bytes 1-4: axes
    //bytes 5-6: button states
    //bytes 7-17: pressed keyboard keys
    let rawPacket = new Uint8Array(1 + 4 + 2 + 11)

    rawPacket[0] = 0x01; //packet version

    rawPacket[1] = axisCallback().axis0
    rawPacket[2] = axisCallback().axis1
    rawPacket[3] = axisCallback().axis2
    rawPacket[4] = axisCallback().axis3

    rawPacket[5] = buttonCallback().byte0
    rawPacket[6] = buttonCallback().byte1

    keyboardArray = keyboardAgent.getKeyboardArray()

    for (let i = 0; i < 12; i++) {
        if (keyboardArray.length > i) {
            rawPacket[7 + i] = keyboardArray[i];
        } else {
            rawPacket[7 + i] = 0;
        }
    }

    function clampUint8(value) { return Math.max(0, Math.min(value, 255)) }

    if (localStorage.getItem(toggleKeyboardWASD.id) === 'true') {
        for (let key of keyboardArray) {
            // WASD for axis 0 and 1
            if (key === keyToNum["KeyA"]) rawPacket[1] = clampUint8(rawPacket[1] - 128);
            if (key === keyToNum["KeyD"]) rawPacket[1] = clampUint8(rawPacket[1] + 128);
            if (key === keyToNum["KeyW"]) rawPacket[2] = clampUint8(rawPacket[2] - 128);
            if (key === keyToNum["KeyS"]) rawPacket[2] = clampUint8(rawPacket[2] + 128);

            // IJKL for axis 2 and 3
            if (key === keyToNum["KeyJ"]) rawPacket[3] = clampUint8(rawPacket[3] - 128);
            if (key === keyToNum["KeyL"]) rawPacket[3] = clampUint8(rawPacket[3] + 128);
            if (key === keyToNum["KeyI"]) rawPacket[4] = clampUint8(rawPacket[4] - 128);
            if (key === keyToNum["KeyK"]) rawPacket[4] = clampUint8(rawPacket[4] + 128);
            
            // override buttons
            if (key === keyToNum["KeyZ"])  rawPacket[5] |= (1 << 0);
            if (key === keyToNum["KeyX"])  rawPacket[5] |= (1 << 1);
            if (key === keyToNum["KeyC"])  rawPacket[5] |= (1 << 2);
            if (key === keyToNum["KeyV"])  rawPacket[5] |= (1 << 3);
            if (key === keyToNum["KeyB"])  rawPacket[5] |= (1 << 4);
            if (key === keyToNum["KeyN"])  rawPacket[5] |= (1 << 5);
            if (key === keyToNum["KeyM"])  rawPacket[5] |= (1 << 6);
            if (key === keyToNum["Comma"]) rawPacket[5] |= (1 << 7);
        }
    }

    if (!document.hasFocus()) { rawPacket.fill(0, 0, 20); }

    //console.log(rawPacket)
    bleAgent.attemptSend(rawPacket);
}

// -------------------------------------------- bluetooth --------------------------------------- //

function createBleAgent() {
    let buttonBLE = document.getElementById('ble-button')
    let statusBLE = document.getElementById('ble-status')
    let telemetryDisplay = document.getElementById('telemetry')

    const SERVICE_UUID_PESTOBLE = '27df26c5-83f4-4964-bae0-d7b7cb0a1f54';
    const CHARACTERISTIC_UUID_GAMEPAD = '452af57e-ad27-422c-88ae-76805ea641a9';
    const CHARACTERISTIC_UUID_TELEMETRY = '266d9d74-3e10-4fcd-88d2-cb63b5324d0c';

    if (isMobile){
        buttonBLE.ontouchend = updateBLE;
    } else {
        buttonBLE.onclick = updateBLE;
    }

    function displayBleStatus(status, color) {
        statusBLE.innerHTML = status;
        console.log(status)
        statusBLE.style.backgroundColor = color;
    }

    let device = null;
    let server;
    let service;
    let characteristic_gamepad;
    let characteristic_telemetry;
    let isConnectedBLE = false;
    let bleUpdateInProgress = false;

    async function updateBLE() {
        if (bleUpdateInProgress) return
        bleUpdateInProgress = true;
        if (!isConnectedBLE) connectBLE();
        else disconnectBLE();
        bleUpdateInProgress = false;
    }

    async function connectBLE() {

        try {
            if (device == null){
                displayBleStatus('Connecting', 'black');
                device = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID_PESTOBLE] }] });
            } else {
                displayBleStatus(`Reconnecting to <br> ${device.name}`, 'black');
            }

            server = await device.gatt.connect();
            service = await server.getPrimaryService(SERVICE_UUID_PESTOBLE);
            
            characteristic_gamepad = await service.getCharacteristic(CHARACTERISTIC_UUID_GAMEPAD);
            try{
                characteristic_telemetry = await service.getCharacteristic(CHARACTERISTIC_UUID_TELEMETRY);
                await characteristic_telemetry.startNotifications()
                await characteristic_telemetry.addEventListener('characteristicvaluechanged', handleTelemetryCharacteristic);
                await terminal_output.addEventListener('characteristicvaluechanged', handleTerminal);
            }catch{
                console.log("Pestolink version on robot is real old :(")
            }

            await device.addEventListener('gattserverdisconnected', robotDisconnect);

            isConnectedBLE = true;
            buttonBLE.innerHTML = '❌';
            displayBleStatus(`Connected to <br> ${device.name}`, '#4dae50'); //green

        } catch (error) {
            if (error.name === 'NotFoundError') {
                displayBleStatus('No Device Selected', '#eb5b5b');
            } else if (error.name === 'SecurityError') {
                displayBleStatus('Security error', '#eb5b5b');
            } else {
                console.log( error);
                displayBleStatus('Connection failed', '#eb5b5b');
                connectBLE();
            }
        }
    }

    function handleTelemetryCharacteristic(event){
        batteryWatchdogReset();

        const value = event.target.value; // DataView of the characteristic's value
    
        let asciiString = '';
        for (let i = 0; i < Math.min(8, value.byteLength); i++) {
            asciiString += String.fromCharCode(value.getUint8(i));
        }
        //console.log('Received ASCII string:', asciiString);
        telemetryDisplay.innerHTML = asciiString;
        
        // Parse the last three bytes as an RGB hex color code
        if (value.byteLength >= 9) {
            const r = value.getUint8(8).toString(16).padStart(2, '0');  // Red
            const g = value.getUint8(9).toString(16).padStart(2, '0');  // Green
            const b = value.getUint8(10).toString(16).padStart(2, '0');  // Blue
            const hexColor = `#${r}${g}${b}`;
        
            //console.log('Hex color:', hexColor);
        
            // Set the text shadow color
            telemetryDisplay.style.textShadow = `0 0 2px ${hexColor}, 0 0 2px ${hexColor}, 0 0 2px ${hexColor}, 0 0 2px ${hexColor}`;
        }


        //batteryDisplay.innerHTML = "&#x1F50B;&#xFE0E; " + voltage.toFixed(1) + "V";
    }
    function handleTerminal(event){

        const value = event.target.value; // DataView of the characteristic's value
    
        let asciiString = '';
        for (let i = 0; i < Math.min(8, value.byteLength); i++) {
            asciiString += String.fromCharCode(value.getUint8(i));
        }
        //console.log('Received ASCII string:', asciiString);
        terminal.innerHTML = terminal.innerHTML + "\n" + asciiString;

    }

    async function disconnectBLE() {
        displayBleStatus('Disconnecting');
        try {
            batteryWatchdogStop();
            await device.removeEventListener('gattserverdisconnected', robotDisconnect);
            await device.gatt.disconnect();

            displayBleStatus('Not Connected', 'black');
            isConnectedBLE = false;
            buttonBLE.innerHTML = '🔗';


        } catch (error) {
            displayBleStatus("Error", '#eb5b5b');
            console.error('Error:', error);
        }
    }

    function robotDisconnect(event) {
        batteryWatchdogStop();
        displayBleStatus('Not Connected', 'black');
        isConnectedBLE = false;
        connectBLE();
    }

    async function sendPacketBLE(byteArray) {
        if (!isConnectedBLE) return;

        try {
            await characteristic_gamepad.writeValueWithoutResponse(new Uint8Array(byteArray));
        } catch (error) {
            console.error('Error:', error);
        }
    }

    let timer;
    const timeout = 1000; // 400ms
    // Function to start or reset the watchdog timer
    function batteryWatchdogReset() {
        displayBleStatus('Connected', '#4dae50'); //green
        if (timer) {clearTimeout(timer);}
        timer = setTimeout(() => {
            displayBleStatus('timeout?', 'black');
        }, timeout);
    }
    // Function to stop the watchdog timer
    function batteryWatchdogStop() {
        batteryWatchdogReset()
        if (timer) {clearTimeout(timer);timer = null;}
    }

    return {
        attemptSend: sendPacketBLE
    };
}

// -------------------------------------------- mobile --------------------------------------- //

function createMobileAxisAgent() {
    let parent = document.getElementById('joystick-container');
    const maxDiffScale = 0.5;
    const stick = document.createElement('div');
    stick.classList.add('joystick');

    stick.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    stick.addEventListener('touchstart', handleTouchDown, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchUp, { passive: false });

    stick.style.transition = '0s';

    let dragStart = null;
    let currentTouch = null;
    let currentPos = { x: 0, y: 0 };

    function handleMouseDown(event) {
        dragStart = {
            x: event.clientX,
            y: event.clientY,
        };
    }

    function handleTouchDown(event) {
        event.preventDefault();

        dragStart = {
            x: event.changedTouches[0].clientX,
            y: event.changedTouches[0].clientY,
        };

        currentTouch = event.changedTouches[0];
        return;
    }

    function handleMouseMove(event) {
        if (dragStart === null) return;

        moveStick(event.clientX, event.clientY);
    }

    function handleTouchMove(event) {
        event.preventDefault();

        if (dragStart === null) return;

        var touches = event.changedTouches;
        for (var i = 0; i < touches.length; i++) {
            if (touches[i].identifier === currentTouch.identifier) {
                moveStick(touches[i].clientX, touches[i].clientY);
            }
        }
    }

    function moveStick(deltaX, deltaY) {
        const xDiff = deltaX - dragStart.x;
        const yDiff = deltaY - dragStart.y;
        //square math
        const xNew = Math.sign(xDiff) * Math.min(parent.offsetWidth * maxDiffScale, Math.sign(xDiff) * xDiff);
        const yNew = Math.sign(yDiff) * Math.min(parent.offsetWidth * maxDiffScale, Math.sign(yDiff) * yDiff);

        stick.style.transform = `translate3d(${xNew}px, ${yNew}px, 0px)`;
        currentPos = { x: xNew, y: yNew };
    }

    function handleMouseUp(event) {
        if (dragStart === null) return;
        stick.style.transform = `translate3d(0px, 0px, 0px)`;
        dragStart = null;
        currentPos = { x: 0, y: 0 };
    }

    function handleTouchUp(event) {
        event.preventDefault();

        if (dragStart === null) return;

        var touches = event.changedTouches;
        for (var i = 0; i < touches.length; i++) {
            if (touches[i].identifier == currentTouch.identifier) {
                stick.style.transform = `translate3d(0px, 0px, 0px)`;
                dragStart = null;
                currentTouch = null;
                currentPos = { x: 0, y: 0 };
            }
        }
    }

    parent.appendChild(stick);

    function getScaledPos() {
        let yScaled = 127
        if (currentPos.y != 0) yScaled = Math.round((currentPos.y / (parent.offsetWidth * maxDiffScale) + 1) * (255 / 2));

        let xScaled = 127
        if (currentPos.x != 0) xScaled = Math.round((currentPos.x / (parent.offsetWidth * maxDiffScale) + 1) * (255 / 2));

        return { axis0: xScaled, axis1: yScaled, axis2: 127, axis3: 127 };
    }

    return {
        getAxes: getScaledPos
    };
}

function createMobileButtonAgent() {
    var buttonStates = [0, 0, 0, 0];

    const buttons = [
        document.getElementById('button-0'),
        document.getElementById('button-1'),
        document.getElementById('button-2'),
        document.getElementById('button-3')
    ];

    for (let i = 0; i < buttons.length; i++) {
        buttons[i].onmousedown = handleButton.bind(null, i, true);
        buttons[i].ontouchstart = handleButton.bind(null, i, true);
        buttons[i].onclick = handleButton.bind(null, i, false);
        buttons[i].ontouchend = handleButton.bind(null, i, false);
    }

    function handleButton(buttonNumber, buttonState) {
        if (buttonState) {
            buttonStates[buttonNumber] = 1;
            buttons[buttonNumber].style.backgroundColor = '#4dae50';
        }
        else {
            buttonStates[buttonNumber] = 0;
            buttons[buttonNumber].style.backgroundColor = 'grey';
        }
    }

    function getButtonBytes() {
        var buttonValMobile = 0;
        for (let i = 0; i < buttonStates.length; i++) {
            if (buttonStates[i]) buttonValMobile |= (1 << i)
        }

        return { byte0: buttonValMobile, byte1: 0 }
    }

    return {
        getButtons: getButtonBytes
    }
}

// -------------------------------------------- desktop --------------------------------------- //

function createGamepadAgent() {

    function getGamepads() {
        return Array.from(navigator.getGamepads()).filter(gamepad => gamepad);
    }

    function getSelectedGamepad() {
        return getGamepads().find(gamepad => gamepad.index == 0);
    }

    var axisValueElements = document.querySelectorAll('[id^="axisValue"]');
    var barElements = document.querySelectorAll('[id^="bar"]');
    var buttonElements = document.querySelectorAll('[id^="buttonDesktop"]');

    function convertUnitFloatToByte(unitFloat) {
        let byte = 127
        if (unitFloat != 0) byte = Math.round((unitFloat + 1) * (255 / 2));
        return byte
    }

    let axisArray = []
    function getGamepadAxes() {
        let gamepad = getSelectedGamepad();
        if (gamepad) {
            for (let i = 0; i < 4; i++) {
                let axisValGamepad = convertUnitFloatToByte(gamepad.axes[i])
                axisValueElements[i].textContent = axisValGamepad
                let percentage = Math.round((gamepad.axes[i] + 1) * (100 / 2))
                barElements[i].style.background = `linear-gradient(to right, var(--alf-green) ${percentage}%, grey 0%)`;
                axisArray[i] = axisValGamepad
            }
        } else {
            axisArray = [127, 127, 127, 127]
        }

        return { axis0: axisArray[0], axis1: axisArray[1], axis2: axisArray[2], axis3: axisArray[3] };
    }

    function getButtonBytes() {
        let gamepad = getSelectedGamepad();
        if (gamepad) {
            var firstByte = 0;
            var secondByte = 0;
            for (let i = 0; i < 8; i++) {
                if (gamepad.buttons[i].pressed) {
                    firstByte |= (gamepad.buttons[i].pressed << i);
                    buttonElements[i].style.background = 'var(--alf-green)';
                } else {
                    buttonElements[i].style.background = 'grey';
                }
            }

            for (let i = 8; i < 16; i++) {
                if (gamepad.buttons[i].pressed) {
                    secondByte |= (gamepad.buttons[i].pressed << i - 8);
                    buttonElements[i].style.background = 'var(--alf-green)';
                } else {
                    buttonElements[i].style.background = 'grey';
                }
            }
        }

        return { byte0: firstByte, byte1: secondByte }
    }

    return {
        getAxes: getGamepadAxes,
        getButtons: getButtonBytes
    }
}

// -------------------------------------------- keyboard --------------------------------------- //

function createKeyboardAgent() {

    document.addEventListener('keydown', handleKeyboardInput);
    document.addEventListener('keyup', handleKeyboardInput);

    function handleKeyboardInput(event) {
        if (event.repeat != true) {
            keyEventQueue.push(event);
        }
    }

    var keyEventQueue = [];
    var keyboardState = [];

    function getNumKeyboardState() {
        let keyEventsForThisFrame = [];

        for (let keyEvent of keyEventQueue) {
            var keyAlreadyUsed = false
            for (let usedEvent of keyEventsForThisFrame) {
                if (keyEvent.key == usedEvent.key) {
                    keyAlreadyUsed = true
                }
            }

            if (!keyAlreadyUsed) keyEventsForThisFrame.push(keyEvent);
        }

        for (let event of keyEventsForThisFrame) {
            if (event.type === 'keydown') {
                keyboardState.push(event.code);
            }

            if (event.type === 'keyup') {
                //do it twice just for good luck ;)
                let indexOfKeyToRemove = keyboardState.indexOf(event.code);
                if (indexOfKeyToRemove !== -1) keyboardState.splice(indexOfKeyToRemove, 1)
                indexOfKeyToRemove = keyboardState.indexOf(event.code);
                if (indexOfKeyToRemove !== -1) keyboardState.splice(indexOfKeyToRemove, 1)
            }

            let indexOfKeyEventToRemove = keyEventQueue.indexOf(event);
            if (indexOfKeyEventToRemove !== -1) {
                keyEventQueue.splice(indexOfKeyEventToRemove, 1);
            }
        }

        //for (let keyEvent of keyEventsForThisFrame) console.log(keyEvent.key + " " + keyEvent.type );
        //console.log(keyboardState)

        let numState = []
        for (let key of keyboardState) {
            numState.push(keyToNum[key]);
        }

        return numState
        //console.log(numState)
    }

    return {
        getKeyboardArray: getNumKeyboardState
    }
}

const keyToNum = {
    // Alphanumeric
    Backquote: 0,
    Backslash: 1,
    BracketLeft: 2,
    BracketRight: 3,
    Comma: 4,
    Digit0: 5,
    Digit1: 6,
    Digit2: 7,
    Digit3: 8,
    Digit4: 9,
    Digit5: 10,
    Digit6: 11,
    Digit7: 12,
    Digit8: 13,
    Digit9: 14,
    Equal: 15,
    IntlBackslash: 16,
    IntlRo: 17,
    IntlYen: 18,
    KeyA: 19,
    KeyB: 20,
    KeyC: 21,
    KeyD: 22,
    KeyE: 23,
    KeyF: 24,
    KeyG: 25,
    KeyH: 26,
    KeyI: 27,
    KeyJ: 28,
    KeyK: 29,
    KeyL: 30,
    KeyM: 31,
    KeyN: 32,
    KeyO: 33,
    KeyP: 34,
    KeyQ: 35,
    KeyR: 36,
    KeyS: 37,
    KeyT: 38,
    KeyU: 39,
    KeyV: 40,
    KeyW: 41,
    KeyX: 42,
    KeyY: 43,
    KeyZ: 44,
    Minus: 45,
    Period: 46,
    Quote: 47,
    Semicolon: 48,
    Slash: 49,

    // Functional
    AltLeft: 50,
    AltRight: 51,
    Backspace: 52,
    CapsLock: 53,
    ContextMenu: 54,
    ControlLeft: 55,
    ControlRight: 56,
    Enter: 57,
    MetaLeft: 58,
    MetaRight: 59,
    ShiftLeft: 60,
    ShiftRight: 61,
    Space: 62,
    Tab: 63,

    // Control Pad
    Delete: 64,
    End: 65,
    Help: 66,
    Home: 67,
    Insert: 68,
    PageDown: 69,
    PageUp: 70,
    ArrowDown: 71,
    ArrowLeft: 72,
    ArrowRight: 73,
    ArrowUp: 74,

    // Numpad
    NumLock: 75,
    Numpad0: 76,
    Numpad1: 77,
    Numpad2: 78,
    Numpad3: 79,
    Numpad4: 80,
    Numpad5: 81,
    Numpad6: 82,
    Numpad7: 83,
    Numpad8: 84,
    Numpad9: 85,
    NumpadAdd: 86,
    NumpadBackspace: 87,
    NumpadClear: 88,
    NumpadClearEntry: 89,
    NumpadComma: 90,
    NumpadDecimal: 91,
    NumpadDivide: 92,
    NumpadEnter: 93,
    NumpadEqual: 94,
    NumpadHash: 95,
    NumpadMemoryAdd: 96,
    NumpadMemoryClear: 97,
    NumpadMemoryRecall: 98,
    NumpadMemoryStore: 99,
    NumpadMemorySubtract: 100,
    NumpadMultiply: 101,
    NumpadParenLeft: 102,
    NumpadParenRight: 103,
    NumpadStar: 104,
    NumpadSubtract: 105,
};