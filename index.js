let bleAgent = createBleAgent();
let keyboardAgent = createKeyboardAgent();
let axisAgent = createMobileAxisAgent();
let buttonAgent = createMobileButtonAgent();
let gamepadAgent = createGamepadAgent();

let axisCallback = null
let buttonCallback = null

let mobileElements = document.getElementsByClassName("mobile-only");
let desktopElements = document.getElementsByClassName("desktop-only");
let infoElement = document.getElementById("info-container");
let hackSpacerElement = document.getElementById("hack-spacer");

let toggleMobile = document.getElementById('toggle-mobile-layout');
let toggleKeyboardWASD = document.getElementById('toggle-keyboard-style');
let toggleInfo = document.getElementById('toggle-info');
let lastKeyPressed = 1;

// --------------------------- state management ------------------------------------ //

if (localStorage.getItem(toggleMobile.id) == null) {
    let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    if (isMobile) {
        localStorage.setItem(toggleMobile.id, 'true');
    } else {
        localStorage.setItem(toggleMobile.id, 'false');
    }
    updateMobileSlider(toggleMobile, false);
 }

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
    var axisValueElements = document.querySelectorAll('[id^="axisValue"]');
    var barElements = document.querySelectorAll('[id^="bar"]');
    var buttonElements = document.querySelectorAll('[id^="buttonDesktop"]');
    // console.log(document.lastKeyPressed);
    //bytes 0: packet version
    //bytes 1-4: axes
    //bytes 5-6: button states
    //bytes 7-19: pressed keyboard keys
    let rawPacket = new Uint8Array(1 + 4 + 2 + 11)

    rawPacket[0] = 0x01; //packet version

    rawPacket[1] = axisCallback().axis0
    rawPacket[2] = axisCallback().axis1
    rawPacket[3] = axisCallback().axis2
    rawPacket[4] = axisCallback().axis3

    rawPacket[5] = buttonCallback().byte0
    rawPacket[6] = buttonCallback().byte1

    keyboardArray = keyboardAgent.getKeyboardArray()
    var keys = {
        //Change these to change which keys are bound to which button.
        'axis0+':22,
        'axis0-':19,
        'axis1+':37,
        'axis1-':41,
        'axis2+':30,
        'axis2-':28,
        'axis3+':29,
        'axis3-':27,
        'button0':35,
        'button1':23,
        'button2':36,
        'button3':38,
        'button4':43,
        'button5':39,
        'button6':33,
        'button7':34,
        'button8':44,
        'button9':42,
        'button10':21,
        'button11':40,
        'button12':20,
        'button13':32,
        'button14':31,
        'button15':4
    }

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
            // console.log(this);
            if (key === keys['axis0-']) rawPacket[1] = clampUint8(rawPacket[1] - 128); //A
            if (key === keys['axis0+']) rawPacket[1] = clampUint8(rawPacket[1] + 128); //D
            if (key === keys['axis1-']) rawPacket[2] = clampUint8(rawPacket[2] - 128); //W
            if (key === keys['axis1+']) rawPacket[2] = clampUint8(rawPacket[2] + 128); //S
            if(key===keys['axis2-']) rawPacket[3] = clampUint8(rawPacket[3] - 128); //J
            if(key===keys['axis2+']) rawPacket[3] = clampUint8(rawPacket[3] + 128); //L
            if(key===keys['axis3-']) rawPacket[4] = clampUint8(rawPacket[4] - 128); //I
            if(key===keys['axis3+']) rawPacket[4] = clampUint8(rawPacket[4] + 128); //K
            for(let i=0; i<8; i++){
                if(key===keys['button'+i]) rawPacket[5] |= (1 << i)
            }
            for(let i=8; i<16; i++){
                if(key===keys['button'+i]) rawPacket[6] |= (1 << i-8)
            }
        }
    }

    if (!document.hasFocus()) { rawPacket.fill(0, 7, 20); }

    if(localStorage.getItem(toggleKeyboardWASD.id) === 'true'){
        for(let i=0; i<4; i++){
            let axisValGamepad = rawPacket[i+1];
            axisValueElements[i].textContent = axisValGamepad
            let percentage = Math.round(axisValGamepad*100/255);
            barElements[i].style.background = `linear-gradient(to right, var(--alf-green) ${percentage}%, grey 0%)`;
        }
        buttonElements.forEach((button) => button.style.background='grey')
        if(rawPacket[5]!=0 || rawPacket[6]!=0){
            for(let i=7; rawPacket[i]!=0; i++){
                if(Object.values(keys).slice(8).includes(rawPacket[i])){
                    buttonElements[Object.values(keys).slice(8).indexOf(rawPacket[i])].style.background='var(--alf-green)';
                }
                // if(rawPacket[i]<=14){
                //     buttonElements[rawPacket[i]-5].style.background = 'var(--alf-green)';
                // }
                // else if(rawPacket[i]===35){
                //     buttonElements[10].style.background = 'var(--alf-green)';
                // }
                // else if(rawPacket[i]===23){
                //     buttonElements[11].style.background = 'var(--alf-green)';
                // }
                // else if(rawPacket[i]===36){
                //     buttonElements[12].style.background = 'var(--alf-green)';
                // }
                // else if(rawPacket[i]===38){
                //     buttonElements[13].style.background = 'var(--alf-green)';
                // }
                // else if(rawPacket[i]===43){
                //     buttonElements[14].style.background = 'var(--alf-green)';
                // }
                // else if(rawPacket[i]===39){
                //     buttonElements[15].style.background = 'var(--alf-green)';
                // }
            }
        }
    }

    // console.log(rawPacket)
    bleAgent.attemptSend(rawPacket);
}

// -------------------------------------------- bluetooth --------------------------------------- //

function createBleAgent() {
    let parent = document.getElementById('ButtonBLE')

    const SERVICE_UUID_PESTOBLE = '27df26c5-83f4-4964-bae0-d7b7cb0a1f54';
    const CHARACTERISTIC_UUID_GAMEPAD = '452af57e-ad27-422c-88ae-76805ea641a9';

    parent.onclick = changeBleState;
    parent.ontouchend = changeBleState;

    function displayBleStatus(status) {
        parent.innerHTML = status;
        switch (status) {
            case 'Connecting':
                parent.style.backgroundColor = 'grey';
                break;
            case 'Connected':
                parent.style.backgroundColor = '#4dae50';
                break;
            case 'Disconnecting':
                parent.style.backgroundColor = 'grey';
                break;
            case 'Not Connected':
                parent.style.backgroundColor = 'grey';
                break;
            default:
                parent.style.backgroundColor = '#eb5b5b';
        }
    }

    let device;
    let server;
    let service;
    let characteristic_gamepad;
    let bleUpdateInProgress = false;
    let isConnectedBLE = false;

    async function changeBleState() {
        if (bleUpdateInProgress) return
        bleUpdateInProgress = true;
        if (!isConnectedBLE) connectBLE();
        else disconnectBLE();
        bleUpdateInProgress = false;
    }

    async function connectBLE() {
        displayBleStatus('Connecting');

        try {
            device = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID_PESTOBLE] }] });
            server = await device.gatt.connect();
            service = await server.getPrimaryService(SERVICE_UUID_PESTOBLE);
            characteristic_gamepad = await service.getCharacteristic(CHARACTERISTIC_UUID_GAMEPAD);
            await device.addEventListener('gattserverdisconnected', robotDisconnect);

            displayBleStatus('Connected');
            isConnectedBLE = true;

        } catch (error) {
            displayBleStatus("Error");
            console.error('Error:', error);
        }
    }

    async function disconnectBLE() {
        displayBleStatus('Disconnecting');
        try {
            await device.gatt.disconnect();

            displayBleStatus('Not Connected');
            isConnectedBLE = false;

        } catch (error) {
            displayBleStatus("Error");
            console.error('Error:', error);
        }
    }

    function robotDisconnect(event) {
        displayBleStatus('Not Connected');
        isConnectedBLE = false;
    }

    async function sendPacketBLE(byteArray) {
        if (!isConnectedBLE) return;
        if (bleUpdateInProgress) return;

        try {
            await characteristic_gamepad.writeValueWithoutResponse(new Uint8Array(byteArray));
        } catch (error) {
            console.error('Error:', error);
        }
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
            this.lastKeyPressed=event.code;
        }
    }
    // this.console.log(this);
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