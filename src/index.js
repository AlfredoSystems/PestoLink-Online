import { getBleMode, BLE_WARNINGS, getNativeBleClient } from './ble.js';

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

let terminalElement = document.getElementById("terminal-container");
let hackSpacerElement = document.getElementById("hack-spacer");

let toggleMobile = document.getElementById('toggle-mobile-layout');
let toggleKeyboardWASD = document.getElementById('toggle-keyboard-style');
let toggleTerminal = document.getElementById('toggle-terminal');
let toggleFocusZero = document.getElementById('toggle-focus-zero');

let selectedGamepadIndex = 0;


// --------------------------- state management ------------------------------------ //

if (localStorage.getItem(toggleMobile.id) == null) {
    if (isMobile) {
        localStorage.setItem(toggleMobile.id, 'true');
    } else {
        localStorage.setItem(toggleMobile.id, 'false');
    }
    updateMobileSlider(toggleMobile, false);
 }

 if (localStorage.getItem(toggleFocusZero.id) == null) {
    localStorage.setItem(toggleFocusZero.id, 'true');
    updateSlider(toggleFocusZero, false);
 }

 if(isMobile) for (let element of helpRow) element.style.display = "none";

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('refresh-button').addEventListener('click', () => {
        window.location.reload();
    });

    if (isMobile) {
        document.getElementById('gamepad-select-button').style.display = 'none';
    }

    setupGamepadSelection();

    updateMobileSlider(toggleMobile, false);
    updateSlider(toggleKeyboardWASD, false);
    updateTerminalSlider(toggleTerminal, false);
    updateSlider(toggleFocusZero, false);
    // pointerdown fires exactly once for both mouse and touch (no double-fire),
    // and works correctly in Electron, Chrome, and Capacitor.
    toggleMobile.addEventListener('pointerdown', updateMobileSlider.bind(null, toggleMobile, true));
    toggleKeyboardWASD.addEventListener('pointerdown', updateSlider.bind(null, toggleKeyboardWASD, true));
    toggleTerminal.addEventListener('pointerdown', updateTerminalSlider.bind(null, toggleTerminal, true));
    toggleFocusZero.addEventListener('pointerdown', updateSlider.bind(null, toggleFocusZero, true));

    window.setInterval(renderLoop, 100);
});

function updateMobileSlider(sliderElement, toggleState){
    updateSlider(sliderElement, toggleState);

    if (localStorage.getItem(toggleMobile.id) === 'true') {
        for (let element of desktopElements) { element.style.display = "none"; }
        for (let element of mobileElements) { element.style.display = "grid"; }
        axisCallback = axisAgent.getAxes
        buttonCallback = buttonAgent.getButtons
    } else {
        for (let element of mobileElements) { element.style.display = "none"; }
        for (let element of desktopElements) { element.style.display = "grid"; }

        axisCallback = gamepadAgent.getAxes
        buttonCallback = gamepadAgent.getButtons
    }
}

function updateTerminalSlider(sliderElement, toggleState){
    updateSlider(sliderElement, toggleState);

    if (localStorage.getItem(toggleTerminal.id) === 'true') {
        terminalElement.style.display = "grid";
        hackSpacerElement.style.display = "none";
    } else {
        terminalElement.style.display = "none";
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

function setupGamepadSelection() {
    if (isMobile) return;

    const modal = document.getElementById('gamepad-modal');
    const btn = document.getElementById('gamepad-select-button');
    const span = document.getElementsByClassName('close-button')[0];
    const gamepadList = document.getElementById('gamepad-list');

    const focusToggle = document.getElementById('toggle-focus-zero');
    // pointerdown already registered in DOMContentLoaded — no duplicate needed here.

    window.addEventListener('gamepadconnected', () => {
        if (modal.style.display === 'flex') populateGamepadList();
    });

    window.addEventListener('gamepaddisconnected', (event) => {
        if (selectedGamepadIndex === event.gamepad.index) {
            const gamepads = navigator.getGamepads().filter(g => g && g.index !== event.gamepad.index);
            selectedGamepadIndex = gamepads.length > 0 ? gamepads[0].index : 0;
        }
        if (modal.style.display === 'flex') populateGamepadList();
    });

    btn.onclick = function() {
        populateGamepadList();
        modal.style.display = 'flex';
    }

    span.onclick = function() {
        modal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }

    function populateGamepadList() {
        gamepadList.innerHTML = '';
        const gamepads = navigator.getGamepads().filter(g => g);
        if (gamepads.length === 0) {
            gamepadList.innerHTML = '<li>No gamepads connected.</li>';
        } else {
            gamepads.forEach(gamepad => {
                const li = document.createElement('li');
                li.textContent = `${gamepad.index}: ${gamepad.id}`;
                li.onclick = () => { selectedGamepadIndex = gamepad.index; modal.style.display = 'none'; };
                gamepadList.appendChild(li);
            });
        }
    }
}
// ----------------------------------------- main --------------------------------------- //

function renderLoop() {
    //bytes 0: packet version
    //bytes 1-4: axes
    //bytes 5-6: button states
    //bytes 7-17: pressed keyboard keys
    let rawPacket = new Uint8Array(1 + 4 + 2 + 11)

    rawPacket[0] = 0x01;

    rawPacket[1] = axisCallback().axis0
    rawPacket[2] = axisCallback().axis1
    rawPacket[3] = axisCallback().axis2
    rawPacket[4] = axisCallback().axis3

    rawPacket[5] = buttonCallback().byte0
    rawPacket[6] = buttonCallback().byte1

    const keyboardArray = keyboardAgent.getKeyboardArray()

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
            if (key === keyToNum["KeyA"]) rawPacket[1] = clampUint8(rawPacket[1] - 128);
            if (key === keyToNum["KeyD"]) rawPacket[1] = clampUint8(rawPacket[1] + 128);
            if (key === keyToNum["KeyW"]) rawPacket[2] = clampUint8(rawPacket[2] - 128);
            if (key === keyToNum["KeyS"]) rawPacket[2] = clampUint8(rawPacket[2] + 128);

            if (key === keyToNum["KeyJ"]) rawPacket[3] = clampUint8(rawPacket[3] - 128);
            if (key === keyToNum["KeyL"]) rawPacket[3] = clampUint8(rawPacket[3] + 128);
            if (key === keyToNum["KeyI"]) rawPacket[4] = clampUint8(rawPacket[4] - 128);
            if (key === keyToNum["KeyK"]) rawPacket[4] = clampUint8(rawPacket[4] + 128);

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

    if (localStorage.getItem(toggleFocusZero.id) === 'true') {
        if (!document.hasFocus()) {
            rawPacket.fill(0, 0, 20);
            rawPacket[0] = 1;
            rawPacket[1] = 127;
            rawPacket[2] = 127;
            rawPacket[3] = 127;
            rawPacket[4] = 127;
        }
    }

    bleAgent.attemptSend(rawPacket);
}

// -------------------------------------------- bluetooth --------------------------------------- //

function createBleAgent() {
    const bleMode = getBleMode();

    let buttonBLE = document.getElementById('ble-button')
    let statusBLE = document.getElementById('ble-status')
    let telemetryDisplay = document.getElementById('telemetry')
    let terminalLog = document.getElementById("terminal-log");
    let terminalClearButton = document.getElementById("terminal-clear-button");
    let terminalLockButton = document.getElementById("terminal-lock-button");

    // Show warning banner on unsupported platforms and disable the BLE button.
    const warning = BLE_WARNINGS[bleMode];
    if (warning) {
        const banner = document.getElementById('ble-warning-banner');
        document.getElementById('ble-warning-message').textContent = warning.message + ' ';
        document.getElementById('ble-warning-detail').textContent = warning.detail;
        banner.style.display = 'flex';
        document.getElementById('ble-warning-close').onclick = () => banner.style.display = 'none';
        buttonBLE.disabled = true;
        statusBLE.innerHTML = 'BLE not supported';
        return { attemptSend: () => {} };
    }

    const SERVICE_UUID_PESTOBLE = '27df26c5-83f4-4964-bae0-d7b7cb0a1f54';
    const CHARACTERISTIC_UUID_GAMEPAD = '452af57e-ad27-422c-88ae-76805ea641a9';
    const CHARACTERISTIC_UUID_TELEMETRY = '266d9d74-3e10-4fcd-88d2-cb63b5324d0c';
    const CHARACTERISTIC_UUID_TERMINAL = '433ec275-a494-40ab-98c2-4785a19bf830';

    if (isMobile){
        buttonBLE.ontouchend = updateBLE;
        terminalClearButton.ontouchend = clearTerminal;
        terminalLockButton.ontouchend = toggleTerminalLock;
    } else {
        buttonBLE.onclick = updateBLE;
        terminalClearButton.onclick = clearTerminal;
        terminalLockButton.onclick = toggleTerminalLock;
    }

    function displayBleStatus(status, color) {
        statusBLE.innerHTML = status;
        console.log(status)
        statusBLE.style.backgroundColor = color;
    }

    // Web Bluetooth / Electron state
    let device = null;
    let characteristic_gamepad;

    // Capacitor native BLE state
    let nativeDeviceId = null;
    let nativeDeviceName = null;
    let nativeBleClient = null;

    let isConnectedBLE = false;
    let bleUpdateInProgress = false;

    // ---- BLE picker modal ----

    const pickerModal = document.getElementById('ble-picker-modal');
    const pickerList = document.getElementById('ble-picker-list');
    const pickerStatus = document.getElementById('ble-picker-status');
    const pickerCloseBtn = document.getElementById('ble-picker-close');
    let pickerCancelFn = null;

    // Backdrop click closes the picker.
    pickerModal.addEventListener('click', (e) => {
        if (e.target === pickerModal && pickerCancelFn) pickerCancelFn();
    });

    function openPickerModal(statusText) {
        pickerList.innerHTML = '';
        pickerStatus.textContent = statusText;
        pickerModal.style.display = 'flex';
        pickerCloseBtn.onclick = () => { if (pickerCancelFn) pickerCancelFn(); };
    }

    function closePickerModal() {
        pickerModal.style.display = 'none';
        pickerCancelFn = null;
    }

    function deviceLabel(id, name) {
        // Chromium reports unresolved BLE names as "Unknown or Unsupported Device (MAC)".
        // Trim that down to just the MAC so the list stays readable.
        if (!name || name.startsWith('Unknown or Unsupported Device')) return id;
        return name;
    }

    function addPickerDevice(id, name, onSelect) {
        const label = deviceLabel(id, name);
        for (const li of pickerList.querySelectorAll('li[data-device-id]')) {
            if (li.dataset.deviceId === id) {
                // Update if we now have a real name where we had a MAC fallback before.
                if (label !== id && li.textContent === id) li.textContent = label;
                return;
            }
        }
        const li = document.createElement('li');
        li.dataset.deviceId = id;
        li.textContent = label;
        li.onclick = onSelect;
        pickerList.appendChild(li);
    }

    // ---- end BLE picker modal ----

    async function updateBLE() {
        if (bleUpdateInProgress) return
        bleUpdateInProgress = true;
        try {
            if (!isConnectedBLE) await connectBLE();
            else await disconnectBLE();
        } finally {
            bleUpdateInProgress = false;
        }
    }

    async function connectBLE() {
        if (bleMode === 'native') await connectNative();
        else if (bleMode === 'electron') await connectElectron();
        else await connectWebBluetooth();
    }

    // Native (Capacitor iOS / Android): scan with startLEScan and show results
    // in the custom picker. No OS-level device dialog is shown.
    async function connectNative() {
        try {
            if (nativeDeviceId == null) {
                displayBleStatus('Connecting', 'black');
                if (!nativeBleClient) nativeBleClient = await getNativeBleClient();

                const picked = await new Promise(async (resolve) => {
                    openPickerModal('Searching for robots...');

                    const hint = document.createElement('li');
                    hint.classList.add('picker-hint');
                    hint.textContent = 'Make sure your robot is powered on.';
                    pickerList.appendChild(hint);

                    pickerCancelFn = () => {
                        nativeBleClient.stopLEScan().catch(() => {});
                        closePickerModal();
                        resolve(null);
                    };

                    await nativeBleClient.startLEScan(
                        {},
                        (result) => {
                            const { deviceId, name } = result.device;
                            hint.remove();
                            addPickerDevice(deviceId, name || deviceId, async () => {
                                await nativeBleClient.stopLEScan().catch(() => {});
                                closePickerModal();
                                resolve({ deviceId, name: name || deviceId });
                            });
                        }
                    );
                });

                if (!picked) {
                    displayBleStatus('No Device Selected', '#eb5b5b');
                    return;
                }
                nativeDeviceId = picked.deviceId;
                nativeDeviceName = picked.name;
            } else {
                displayBleStatus(`Reconnecting to <br>${nativeDeviceName}`, 'black');
            }

            await nativeBleClient.connect(nativeDeviceId, robotDisconnect);

            try {
                await nativeBleClient.startNotifications(nativeDeviceId, SERVICE_UUID_PESTOBLE, CHARACTERISTIC_UUID_TELEMETRY, handleTelemetryData);
            } catch { console.log("Telemetry characteristic not available."); }

            try {
                await nativeBleClient.startNotifications(nativeDeviceId, SERVICE_UUID_PESTOBLE, CHARACTERISTIC_UUID_TERMINAL, handleTerminalData);
            } catch { console.log("Terminal characteristic not available."); }

            isConnectedBLE = true;
            buttonBLE.innerHTML = '❌';
            displayBleStatus(`Connected to <br>${nativeDeviceName}`, '#4dae50');

        } catch (error) {
            const msg = error?.message ?? '';
            if (msg.includes('cancelled') || msg.includes('User cancelled')) {
                displayBleStatus('No Device Selected', '#eb5b5b');
            } else {
                console.log(error);
                displayBleStatus('Connection failed', '#eb5b5b');
                connectNative();
            }
        }
    }

    // Electron: show picker immediately, populate it via IPC as Chromium
    // discovers devices, then resolve requestDevice() with the user's choice.
    async function connectElectron() {
        try {
            if (device == null) {
                displayBleStatus('Connecting', 'black');
                openPickerModal('Searching for robots...');

                window.electronBLE.onDeviceList((devices) => {
                    if (devices.length > 0) pickerStatus.textContent = 'Select a device:';
                    devices.forEach(({ deviceId, deviceName }) => {
                        addPickerDevice(deviceId, deviceName || deviceId, () => {
                            // Close the picker immediately for snappy feel; requestDevice()
                            // will resolve once the main process receives the selection.
                            closePickerModal();
                            window.electronBLE.removeListeners();
                            window.electronBLE.selectDevice(deviceId);
                        });
                    });
                });

                pickerCancelFn = () => {
                    window.electronBLE.removeListeners();
                    window.electronBLE.cancel(); // tells main to call callback('') → requestDevice throws
                    closePickerModal();
                };

                device = await navigator.bluetooth.requestDevice({
                    filters: [{ services: [SERVICE_UUID_PESTOBLE] }]
                });

                // Clean up in case the modal was not already closed (e.g. device
                // resolved before the user interacted with the list).
                window.electronBLE.removeListeners();
                closePickerModal();
            } else {
                displayBleStatus(`Reconnecting to <br>${device.name}`, 'black');
            }

            await connectGATT();
        } catch (error) {
            window.electronBLE?.removeListeners();
            closePickerModal();
            if (error.name === 'NotFoundError') {
                displayBleStatus('No Device Selected', '#eb5b5b');
            } else {
                console.log(error);
                displayBleStatus('Connection failed', '#eb5b5b');
                connectElectron();
            }
        }
    }

    // Web Bluetooth (Chrome on desktop / Android Chrome / Android PWA):
    // The browser security model requires its own device picker UI — we cannot
    // replace it. Show a brief modal so the user knows what's coming, then
    // open the browser picker when they confirm.
    async function connectWebBluetooth() {
        try {
            if (device == null){
                displayBleStatus('Connecting', 'black');
                device = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID_PESTOBLE] }] });
            } else {
                displayBleStatus(`Reconnecting to <br>${device.name}`, 'black');
            }

            await connectGATT();
        } catch (error) {
            if (error.name === 'NotFoundError') {
                displayBleStatus('No Device Selected', '#eb5b5b');
            } else if (error.name === 'SecurityError') {
                displayBleStatus('Security error', '#eb5b5b');
            } else {
                console.log(error);
                displayBleStatus('Connection failed', '#eb5b5b');
                connectWebBluetooth();
            }
        }
    }

    // Shared GATT setup used by both connectElectron and connectWebBluetooth.
    async function connectGATT() {
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID_PESTOBLE);

        characteristic_gamepad = await service.getCharacteristic(CHARACTERISTIC_UUID_GAMEPAD);

        try {
            const ct = await service.getCharacteristic(CHARACTERISTIC_UUID_TELEMETRY);
            await ct.startNotifications();
            ct.addEventListener('characteristicvaluechanged', (e) => handleTelemetryData(e.target.value));
        } catch { console.log("Telemetry characteristic not available."); }

        try {
            const cc = await service.getCharacteristic(CHARACTERISTIC_UUID_TERMINAL);
            await cc.startNotifications();
            cc.addEventListener('characteristicvaluechanged', (e) => handleTerminalData(e.target.value));
        } catch { console.log("Terminal characteristic not available."); }

        device.addEventListener('gattserverdisconnected', robotDisconnect);

        isConnectedBLE = true;
        buttonBLE.innerHTML = '❌';
        displayBleStatus(`Connected to <br>${device.name}`, '#4dae50');
    }

    // Unified data handlers — accept a DataView directly (works for both paths).

    function handleTelemetryData(value) {
        batteryWatchdogReset();

        let asciiString = '';
        for (let i = 0; i < Math.min(8, value.byteLength); i++) {
            asciiString += String.fromCharCode(value.getUint8(i));
        }
        telemetryDisplay.innerHTML = asciiString;

        if (value.byteLength >= 11) {
            const r = value.getUint8(8).toString(16).padStart(2, '0');
            const g = value.getUint8(9).toString(16).padStart(2, '0');
            const b = value.getUint8(10).toString(16).padStart(2, '0');
            telemetryDisplay.style.textShadow = `0 0 2px #${r}${g}${b}, 0 0 2px #${r}${g}${b}, 0 0 2px #${r}${g}${b}, 0 0 2px #${r}${g}${b}`;
        }

        if (value.byteLength >= 12 && value.getUint8(11) === 1) {
            const gamepad = navigator.getGamepads()[selectedGamepadIndex];
            if (gamepad?.vibrationActuator) {
                gamepad.vibrationActuator.playEffect("dual-rumble", {
                    startDelay: 0,
                    duration: 150,
                    weakMagnitude: 1.0,
                    strongMagnitude: 1.0
                });
            }
        }
    }

    let terminalLocked = false;

    function handleTerminalData(value) {
        if (terminalLocked) return;

        const controlCharacter = value.getUint8(0);
        let asciiString = '';
        for (let i = 0; i < Math.min(64, value.byteLength - 1); i++) {
            asciiString += String.fromCharCode(value.getUint8(i + 1));
        }

        if (controlCharacter == 1) {
            const lines = terminalLog.innerHTML.split('<br>').filter(line => line !== '');
            lines.push(asciiString);
            while (lines.length > 7) lines.shift();
            terminalLog.innerHTML = lines.join('<br>');
        }

        if (controlCharacter == 2) {
            terminalLog.innerHTML = '';
        }
    }

    function clearTerminal() {
        terminalLog.innerHTML = '';
    }

    function toggleTerminalLock() {
        terminalLocked = !terminalLocked;
        terminalLockButton.innerHTML = terminalLocked ? '🔒' : '🔓';
    }

    async function disconnectBLE() {
        displayBleStatus('Disconnecting', 'gray');
        try {
            batteryWatchdogStop();
            if (bleMode === 'native') {
                await nativeBleClient.disconnect(nativeDeviceId);
            } else {
                device.removeEventListener('gattserverdisconnected', robotDisconnect);
                await device.gatt.disconnect();
            }
            displayBleStatus('Not Connected', 'black');
            isConnectedBLE = false;
            buttonBLE.innerHTML = '🔗';
        } catch (error) {
            displayBleStatus('Error', '#eb5b5b');
            console.error('Error:', error);
        }
    }

    function robotDisconnect() {
        batteryWatchdogStop();
        displayBleStatus('Not Connected', 'black');
        isConnectedBLE = false;
        connectBLE();
    }

    async function sendPacketBLE(byteArray) {
        if (!isConnectedBLE) return;
        try {
            if (bleMode === 'native') {
                await nativeBleClient.writeWithoutResponse(
                    nativeDeviceId,
                    SERVICE_UUID_PESTOBLE,
                    CHARACTERISTIC_UUID_GAMEPAD,
                    new DataView(byteArray.buffer)
                );
            } else {
                await characteristic_gamepad.writeValueWithoutResponse(new Uint8Array(byteArray));
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    let timer;
    const timeout = 1000;
    function batteryWatchdogReset() {
        displayBleStatus('Connected', '#4dae50');
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => displayBleStatus('timeout?', 'black'), timeout);
    }
    function batteryWatchdogStop() {
        batteryWatchdogReset();
        if (timer) { clearTimeout(timer); timer = null; }
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
        dragStart = { x: event.clientX, y: event.clientY };
    }

    function handleTouchDown(event) {
        event.preventDefault();
        dragStart = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
        currentTouch = event.changedTouches[0];
    }

    function handleMouseMove(event) {
        if (dragStart === null) return;
        moveStick(event.clientX, event.clientY);
    }

    function handleTouchMove(event) {
        event.preventDefault();
        if (dragStart === null) return;
        for (let touch of event.changedTouches) {
            if (touch.identifier === currentTouch.identifier) {
                moveStick(touch.clientX, touch.clientY);
            }
        }
    }

    function moveStick(deltaX, deltaY) {
        const xDiff = deltaX - dragStart.x;
        const yDiff = deltaY - dragStart.y;
        const xNew = Math.sign(xDiff) * Math.min(parent.offsetWidth * maxDiffScale, Math.sign(xDiff) * xDiff);
        const yNew = Math.sign(yDiff) * Math.min(parent.offsetWidth * maxDiffScale, Math.sign(yDiff) * yDiff);
        stick.style.transform = `translate3d(${xNew}px, ${yNew}px, 0px)`;
        currentPos = { x: xNew, y: yNew };
    }

    function handleMouseUp() {
        if (dragStart === null) return;
        stick.style.transform = `translate3d(0px, 0px, 0px)`;
        dragStart = null;
        currentPos = { x: 0, y: 0 };
    }

    function handleTouchUp(event) {
        event.preventDefault();
        if (dragStart === null) return;
        for (let touch of event.changedTouches) {
            if (touch.identifier == currentTouch.identifier) {
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

    return { getAxes: getScaledPos };
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
        buttons[i].addEventListener('pointerdown', (e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handleButton(i, true);
        });
        buttons[i].addEventListener('pointerup', handleButton.bind(null, i, false));
        buttons[i].addEventListener('pointercancel', handleButton.bind(null, i, false));
    }

    function handleButton(buttonNumber, buttonState) {
        if (buttonState) {
            buttonStates[buttonNumber] = 1;
            buttons[buttonNumber].style.backgroundColor = '#4dae50';
        } else {
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

    return { getButtons: getButtonBytes }
}

// -------------------------------------------- desktop --------------------------------------- //

function createGamepadAgent() {

    function getFirstGamepad() {
        return navigator.getGamepads()[selectedGamepadIndex];
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
        let gamepad = getFirstGamepad();
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
        const gamepad = getFirstGamepad();
        let buttonStates = 0;

        if (gamepad) {
            const buttonCount = Math.min(gamepad.buttons.length, 16);
            for (let i = 0; i < buttonCount; i++) {
                const button = gamepad.buttons[i];
                if (button && button.pressed) buttonStates |= (1 << i);
                if (buttonElements[i]) {
                    const newColor = button && button.pressed ? 'var(--alf-green)' : 'grey';
                    if (buttonElements[i].style.background !== newColor) {
                        buttonElements[i].style.background = newColor;
                    }
                }
            }
        }

        return { byte0: buttonStates & 0xFF, byte1: (buttonStates >> 8) & 0xFF };
    }

    return { getAxes: getGamepadAxes, getButtons: getButtonBytes }
}

// -------------------------------------------- keyboard --------------------------------------- //

function createKeyboardAgent() {

    document.addEventListener('keydown', handleKeyboardInput);
    document.addEventListener('keyup', handleKeyboardInput);

    function handleKeyboardInput(event) {
        if (event.repeat != true) keyEventQueue.push(event);
    }

    var keyEventQueue = [];
    var keyboardState = [];

    function getNumKeyboardState() {
        let keyEventsForThisFrame = [];

        for (let keyEvent of keyEventQueue) {
            var keyAlreadyUsed = false
            for (let usedEvent of keyEventsForThisFrame) {
                if (keyEvent.key == usedEvent.key) keyAlreadyUsed = true
            }
            if (!keyAlreadyUsed) keyEventsForThisFrame.push(keyEvent);
        }

        for (let event of keyEventsForThisFrame) {
            if (event.type === 'keydown') keyboardState.push(event.code);

            if (event.type === 'keyup') {
                let idx = keyboardState.indexOf(event.code);
                if (idx !== -1) keyboardState.splice(idx, 1)
                idx = keyboardState.indexOf(event.code);
                if (idx !== -1) keyboardState.splice(idx, 1)
            }

            let idx = keyEventQueue.indexOf(event);
            if (idx !== -1) keyEventQueue.splice(idx, 1);
        }

        let numState = []
        for (let key of keyboardState) numState.push(keyToNum[key]);
        return numState
    }

    return { getKeyboardArray: getNumKeyboardState }
}

const keyToNum = {
    Backquote: 0, Backslash: 1, BracketLeft: 2, BracketRight: 3, Comma: 4,
    Digit0: 5, Digit1: 6, Digit2: 7, Digit3: 8, Digit4: 9,
    Digit5: 10, Digit6: 11, Digit7: 12, Digit8: 13, Digit9: 14,
    Equal: 15, IntlBackslash: 16, IntlRo: 17, IntlYen: 18,
    KeyA: 19, KeyB: 20, KeyC: 21, KeyD: 22, KeyE: 23, KeyF: 24, KeyG: 25,
    KeyH: 26, KeyI: 27, KeyJ: 28, KeyK: 29, KeyL: 30, KeyM: 31, KeyN: 32,
    KeyO: 33, KeyP: 34, KeyQ: 35, KeyR: 36, KeyS: 37, KeyT: 38, KeyU: 39,
    KeyV: 40, KeyW: 41, KeyX: 42, KeyY: 43, KeyZ: 44,
    Minus: 45, Period: 46, Quote: 47, Semicolon: 48, Slash: 49,
    AltLeft: 50, AltRight: 51, Backspace: 52, CapsLock: 53, ContextMenu: 54,
    ControlLeft: 55, ControlRight: 56, Enter: 57, MetaLeft: 58, MetaRight: 59,
    ShiftLeft: 60, ShiftRight: 61, Space: 62, Tab: 63,
    Delete: 64, End: 65, Help: 66, Home: 67, Insert: 68,
    PageDown: 69, PageUp: 70, ArrowDown: 71, ArrowLeft: 72, ArrowRight: 73, ArrowUp: 74,
    NumLock: 75, Numpad0: 76, Numpad1: 77, Numpad2: 78, Numpad3: 79, Numpad4: 80,
    Numpad5: 81, Numpad6: 82, Numpad7: 83, Numpad8: 84, Numpad9: 85,
    NumpadAdd: 86, NumpadBackspace: 87, NumpadClear: 88, NumpadClearEntry: 89,
    NumpadComma: 90, NumpadDecimal: 91, NumpadDivide: 92, NumpadEnter: 93,
    NumpadEqual: 94, NumpadHash: 95, NumpadMemoryAdd: 96, NumpadMemoryClear: 97,
    NumpadMemoryRecall: 98, NumpadMemoryStore: 99, NumpadMemorySubtract: 100,
    NumpadMultiply: 101, NumpadParenLeft: 102, NumpadParenRight: 103,
    NumpadStar: 104, NumpadSubtract: 105,
};
