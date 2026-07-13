import { getBleMode, BLE_WARNINGS, getNativeBleClient } from './ble.js';
import { ScreenOrientation } from '@capacitor/screen-orientation';

ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});

let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

let bleAgent;
let keyboardAgent;
let cardPanels;
let gamepadAgent;

let keyboardWASDEnabled = false;
let focusZeroEnabled = false;


let toggleMobile = document.getElementById('toggle-mobile-layout');
let toggleKeyboardWASD = document.getElementById('toggle-keyboard-style');
let toggleTerminal = document.getElementById('toggle-terminal');
let toggleFocusZero = document.getElementById('toggle-focus-zero');



// --------------------------- state management ------------------------------------ //

if (localStorage.getItem(toggleMobile.id) === null) {
    if (isMobile) {
        localStorage.setItem(toggleMobile.id, 'true');
    } else {
        localStorage.setItem(toggleMobile.id, 'false');
    }
    updateMobileSlider(toggleMobile, false);
 }

 if (localStorage.getItem(toggleFocusZero.id) === null) {
    localStorage.setItem(toggleFocusZero.id, 'true');
    updateSlider(toggleFocusZero, false);
 }


document.addEventListener('DOMContentLoaded', function () {
    gamepadAgent = createGamepadAgent();
    bleAgent = createBleAgent(() => gamepadAgent.getSelectedGamepad());
    keyboardAgent = createKeyboardAgent();
    cardPanels = createCardPanels();

    document.getElementById('refresh-button').addEventListener('pointerdown', async () => {
        await bleAgent.cleanup();
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

    document.getElementById('app-version').textContent = 'build ' + (import.meta.env.VITE_BUILD_NUMBER ?? 'dev');
    setupSettings();
    setupCardSelectors();
    window.setInterval(renderLoop, 100);

    // Repaint cards every animation frame so state changes on one card show
    // up on the others without waiting for the 10 Hz packet loop.
    (function displayLoop() {
        cardPanels.getFrame();
        requestAnimationFrame(displayLoop);
    })();
});

function updateMobileSlider(sliderElement, toggleState) {
    updateSlider(sliderElement, toggleState);
    document.body.classList.toggle('mobile-mode', localStorage.getItem(toggleMobile.id) === 'true');
    cardPanels?.rebuild();
}

function updateTerminalSlider(sliderElement, toggleState) {
    updateSlider(sliderElement, toggleState);
    document.body.classList.toggle('terminal-visible', localStorage.getItem(toggleTerminal.id) === 'true');
}

function updateSlider(sliderElement, toggleState) {
    if (toggleState) {
        localStorage.setItem(sliderElement.id, localStorage.getItem(sliderElement.id) !== 'true');
    }
    const isActive = localStorage.getItem(sliderElement.id) === 'true';
    sliderElement.classList.toggle('active', isActive);
    if (sliderElement === toggleKeyboardWASD) keyboardWASDEnabled = isActive;
    if (sliderElement === toggleFocusZero) focusZeroEnabled = isActive;
}

function setupSettings() {
    const modal = document.getElementById('settings-modal');
    const btn = document.getElementById('settings-button');
    const closeBtn = document.getElementById('settings-close');

    btn.addEventListener('pointerdown', () => { modal.classList.add('open'); });
    closeBtn.addEventListener('pointerdown', () => { modal.classList.remove('open'); });
    modal.addEventListener('pointerdown', (e) => {
        if (e.target === modal) modal.classList.remove('open');
    });

    const options = modal.querySelectorAll('.theme-option');
    const saved = localStorage.getItem('color-theme') || 'system';
    applyTheme(saved);
    options.forEach(opt => {
        opt.classList.toggle('active', opt.dataset.value === saved);
        opt.addEventListener('pointerdown', () => {
            const val = opt.dataset.value;
            localStorage.setItem('color-theme', val);
            applyTheme(val);
            options.forEach(o => o.classList.toggle('active', o.dataset.value === val));
        });
    });
}

function applyTheme(value) {
    const resolved = value === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : value;
    document.documentElement.setAttribute('data-theme', resolved);
}

function setupGamepadSelection() {
    if (isMobile) return;

    const modal = document.getElementById('gamepad-modal');
    const btn = document.getElementById('gamepad-select-button');
    const span = document.getElementsByClassName('close-button')[0];
    const gamepadList = document.getElementById('gamepad-list');

    window.addEventListener('gamepadconnected', () => {
        if (modal.classList.contains('open')) populateGamepadList();
    });

    window.addEventListener('gamepaddisconnected', (event) => {
        gamepadAgent.handleDisconnect(event.gamepad.index);
        if (modal.classList.contains('open')) populateGamepadList();
    });

    btn.addEventListener('pointerdown', () => {
        populateGamepadList();
        modal.classList.add('open');
    });

    span.addEventListener('pointerdown', () => {
        modal.classList.remove('open');
    });

    window.addEventListener('pointerdown', (event) => {
        if (event.target === modal) {
            modal.classList.remove('open');
        }
    });

    function populateGamepadList() {
        gamepadList.innerHTML = '';
        const gamepads = navigator.getGamepads().filter(g => g);
        if (gamepads.length === 0) {
            gamepadList.innerHTML = '<li>No gamepads connected.</li>';
        } else {
            gamepads.forEach(gamepad => {
                const li = document.createElement('li');
                li.textContent = `${gamepad.index}: ${gamepad.id}`;
                li.addEventListener('pointerdown', () => { gamepadAgent.setIndex(gamepad.index); modal.classList.remove('open'); });
                gamepadList.appendChild(li);
            });
        }
    }
}
// ----------------------------------------- main --------------------------------------- //

function clampUint8(value) { return Math.max(0, Math.min(value, 255)) }

function convertUnitFloatToByte(unitFloat) {
    let byte = 127
    if (unitFloat !== 0) byte = Math.round((unitFloat + 1) * (255 / 2));
    return byte
}

function renderLoop() {
    //bytes 0: packet version
    //bytes 1-4: axes
    //bytes 5-6: button states
    //bytes 7-17: pressed keyboard keys
    let rawPacket = new Uint8Array(1 + 4 + 2 + 11)

    rawPacket[0] = 0x01;

    const frame = cardPanels.getFrame();
    rawPacket[1] = convertUnitFloatToByte(frame.axes[0]);
    rawPacket[2] = convertUnitFloatToByte(frame.axes[1]);
    rawPacket[3] = convertUnitFloatToByte(frame.axes[2]);
    rawPacket[4] = convertUnitFloatToByte(frame.axes[3]);
    rawPacket[5] = frame.buttons & 0xFF;
    rawPacket[6] = (frame.buttons >> 8) & 0xFF;

    const keyboardArray = keyboardAgent.getKeyboardArray()

    rawPacket.set(keyboardArray.slice(0, 12), 7);

    if (keyboardWASDEnabled) {
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

    if (focusZeroEnabled) {
        if (!document.hasFocus()) {
            rawPacket.fill(0);
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

function createBleAgent(getGamepad) {
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
        banner.classList.add('open');
        document.getElementById('ble-warning-close').addEventListener('pointerdown', () => banner.classList.remove('open'));
        buttonBLE.disabled = true;
        statusBLE.innerHTML = 'BLE not supported';
        return { attemptSend: () => {} };
    }

    const SERVICE_UUID_PESTOBLE = '27df26c5-83f4-4964-bae0-d7b7cb0a1f54';
    const CHARACTERISTIC_UUID_GAMEPAD = '452af57e-ad27-422c-88ae-76805ea641a9';
    const CHARACTERISTIC_UUID_TELEMETRY = '266d9d74-3e10-4fcd-88d2-cb63b5324d0c';
    const CHARACTERISTIC_UUID_TERMINAL = '433ec275-a494-40ab-98c2-4785a19bf830';

    const BLE_GREEN = '#4dae50';
    const BLE_RED = '#eb5b5b';
    const BLE_STATUS = {
        CONNECTING:    ['Connecting', 'black'],
        NOT_CONNECTED: ['Not Connected', 'black'],
        DISCONNECTING: ['Disconnecting', 'gray'],
        CONNECTED:     ['Connected', BLE_GREEN],
        TIMEOUT:       ['timeout?', 'black'],
        NO_DEVICE:     ['No Device Selected', BLE_RED],
        FAILED:        ['Connection failed', BLE_RED],
        SECURITY_ERR:  ['Security error', BLE_RED],
        PERM_DENIED:   ['Bluetooth permission denied', BLE_RED],
        BT_OFF:        ['Bluetooth is off', BLE_RED],
        ERROR:         ['Error', BLE_RED],
    };

    buttonBLE.addEventListener('pointerdown', updateBLE);
    terminalClearButton.addEventListener('pointerdown', clearTerminal);
    terminalLockButton.addEventListener('pointerdown', toggleTerminalLock);

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
    let userDisconnecting = false;

    // ---- BLE picker modal ----

    const pickerModal = document.getElementById('ble-picker-modal');
    const pickerList = document.getElementById('ble-picker-list');
    const pickerStatus = document.getElementById('ble-picker-status');
    const pickerCloseBtn = document.getElementById('ble-picker-close');
    let pickerCancelFn = null;

    function closePicker() {
        if (pickerCancelFn) pickerCancelFn();
        else closePickerModal();
    }

    // Wire X and backdrop once with pointerdown — reliable on Android WebView.
    pickerCloseBtn.addEventListener('pointerdown', closePicker);
    pickerModal.addEventListener('pointerdown', (e) => {
        if (e.target === pickerModal) closePicker();
    });

    function openPickerModal(statusText) {
        pickerList.innerHTML = '';
        pickerStatus.textContent = statusText;
        pickerModal.classList.add('open');
    }

    function closePickerModal() {
        pickerModal.classList.remove('open');
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
        li.addEventListener('pointerdown', onSelect);
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

    // Native (Capacitor iOS / Android): scan with requestLEScan and show results
    // in the custom picker. No OS-level device dialog is shown.
    async function connectNative() {
        try {
            if (nativeDeviceId === null) {
                displayBleStatus(...BLE_STATUS.CONNECTING);
                if (!nativeBleClient) nativeBleClient = await getNativeBleClient();

                const picked = await new Promise((resolve, reject) => {
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

                    nativeBleClient.requestLEScan(
                        { services: [SERVICE_UUID_PESTOBLE] },
                        (result) => {
                            const { deviceId, name } = result.device;
                            hint.remove();
                            addPickerDevice(deviceId, name || deviceId, () => {
                                nativeBleClient.stopLEScan().catch(() => {});
                                closePickerModal();
                                resolve({ deviceId, name: name || deviceId });
                            });
                        }
                    ).catch(err => {
                        // Show error inside the modal so user can read it then tap X.
                        const msg = err?.message ?? 'unknown error';
                        hint.remove();
                        pickerStatus.textContent = msg.toLowerCase().includes('permission')
                            ? 'Permission denied — enable Bluetooth & Location in Settings.'
                            : 'Scan failed: ' + msg;
                        // X button now just closes without stopping scan (already stopped).
                        pickerCancelFn = () => { closePickerModal(); resolve(null); };
                    });
                });

                if (!picked) {
                    displayBleStatus(...BLE_STATUS.NO_DEVICE);
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
            displayBleStatus(`Connected to <br>${nativeDeviceName}`, BLE_GREEN);

        } catch (error) {
            const msg = error?.message ?? '';
            if (msg.includes('cancelled') || msg.includes('User cancelled')) {
                displayBleStatus(...BLE_STATUS.NO_DEVICE);
            } else if (msg.includes('permission') || msg.includes('Permission')) {
                displayBleStatus(...BLE_STATUS.PERM_DENIED);
            } else if (msg.includes('disabled') || msg.includes('Bluetooth is not enabled')) {
                displayBleStatus(...BLE_STATUS.BT_OFF);
            } else {
                console.log(error);
                displayBleStatus('Scan failed: ' + msg, BLE_RED);
            }
        }
    }

    // Electron: show picker immediately, populate it via IPC as Chromium
    // discovers devices, then resolve requestDevice() with the user's choice.
    async function connectElectron() {
        try {
            if (device === null) {
                displayBleStatus(...BLE_STATUS.CONNECTING);
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
                displayBleStatus(...BLE_STATUS.NO_DEVICE);
            } else {
                console.log(error);
                displayBleStatus(...BLE_STATUS.FAILED);
            }
        }
    }

    // Web Bluetooth (Chrome on desktop / Android Chrome / Android PWA):
    // The browser security model requires its own device picker UI — we cannot
    // replace it. Show a brief modal so the user knows what's coming, then
    // open the browser picker when they confirm.
    async function connectWebBluetooth() {
        try {
            if (device === null) {
                displayBleStatus(...BLE_STATUS.CONNECTING);
                device = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID_PESTOBLE] }] });
            } else {
                displayBleStatus(`Reconnecting to <br>${device.name}`, 'black');
            }

            await connectGATT();
        } catch (error) {
            if (error.name === 'NotFoundError') {
                displayBleStatus(...BLE_STATUS.NO_DEVICE);
            } else if (error.name === 'SecurityError') {
                displayBleStatus(...BLE_STATUS.SECURITY_ERR);
            } else {
                console.log(error);
                displayBleStatus(...BLE_STATUS.FAILED);
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
        displayBleStatus(`Connected to <br>${device.name}`, BLE_GREEN);
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
            const gamepad = getGamepad();
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

        if (controlCharacter === 1) {
            const lines = terminalLog.innerHTML.split('<br>').filter(line => line !== '');
            lines.push(asciiString);
            while (lines.length > 7) lines.shift();
            terminalLog.innerHTML = lines.join('<br>');
        }

        if (controlCharacter === 2) {
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
        displayBleStatus(...BLE_STATUS.DISCONNECTING);
        userDisconnecting = true;
        try {
            batteryWatchdogStop();
            if (bleMode === 'native') {
                await nativeBleClient.disconnect(nativeDeviceId);
            } else {
                device.removeEventListener('gattserverdisconnected', robotDisconnect);
                await device.gatt.disconnect();
            }
            displayBleStatus(...BLE_STATUS.NOT_CONNECTED);
            isConnectedBLE = false;
            buttonBLE.innerHTML = '🔗';
        } catch (error) {
            displayBleStatus(...BLE_STATUS.ERROR);
            console.error('Error:', error);
        } finally {
            userDisconnecting = false;
        }
    }

    function robotDisconnect() {
        if (userDisconnecting) return;
        batteryWatchdogStop();
        displayBleStatus(...BLE_STATUS.NOT_CONNECTED);
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
        displayBleStatus(...BLE_STATUS.CONNECTED);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => displayBleStatus(...BLE_STATUS.TIMEOUT), timeout);
    }
    function batteryWatchdogStop() {
        if (timer) { clearTimeout(timer); timer = null; }
    }

    async function cleanup() {
        if (isConnectedBLE && bleMode === 'native' && nativeDeviceId) {
            userDisconnecting = true;
            try { await nativeBleClient.disconnect(nativeDeviceId); } catch {}
        }
    }

    return {
        attemptSend: sendPacketBLE,
        cleanup,
    };
}

// -------------------------------------------- input state --------------------------------------- //

// Axis values written by pointer interactions. Sliders hold their value;
// joysticks spring back by writing 0 on release. Whichever card wrote last
// wins. The gamepad is read fresh each frame; while a gamepad axis is
// active (outside the deadzone) it takes over that axis and clears the
// held pointer value, so everything reads 0 when the gamepad recenters.
const GAMEPAD_DEADZONE = 0.05;
const pointerAxes = [0, 0, 0, 0];

function setPointerAxis(axis, value) {
    pointerAxes[axis] = value;
}

// -------------------------------------------- cards --------------------------------------- //

// Cards are views of the shared input state. Pointer interactions write to
// pointerAxes or a per-card held-button mask; each frame getFrame() merges
// pointer and gamepad state, and every card repaints from the merged result
// via update(axes, buttons) — so cards sharing an axis or button stay in sync.
// The user's card selection applies to the mobile layout; with the mobile
// layout toggle off, both panels are overridden with the gamepad cards.

const CARD_TYPES = {
    'joystick-01':     { label: 'Joystick (axes 0, 1)',    create: (host) => createJoystickCard(host, 0, 1) },
    'joystick-23':     { label: 'Joystick (axes 2, 3)',    create: (host) => createJoystickCard(host, 2, 3) },
    'buttons-03':      { label: 'Buttons (0-3)',          create: (host) => createButtonsCard(host, 0) },
    'buttons-47':      { label: 'Buttons (4-7)',          create: (host) => createButtonsCard(host, 4) },
    'dpad':            { label: 'D-pad (buttons 12-15)',  create: createDpadCard },
    'sliders':         { label: 'Sliders (axes 0-3)',     create: createSlidersCard },
    'gamepad-axes':    { label: 'Axes display',    create: createGamepadAxesCard },
    'gamepad-buttons': { label: 'Buttons (0-15)',  create: createGamepadButtonsCard },
};

const PANEL_DEFAULTS = { 'card-left': 'joystick-01', 'card-right': 'buttons-03' };
const DESKTOP_CARDS = { 'card-left': 'gamepad-axes', 'card-right': 'gamepad-buttons' };

function getPanelCardType(panelKey) {
    const saved = localStorage.getItem(panelKey);
    return Object.hasOwn(CARD_TYPES, saved) ? saved : PANEL_DEFAULTS[panelKey];
}

function createCardPanels() {
    const hosts = {
        'card-left': document.getElementById('left-panel'),
        'card-right': document.getElementById('right-panel'),
    };
    let cards = [];

    function rebuild() {
        const mobile = document.body.classList.contains('mobile-mode');
        cards = Object.entries(hosts).map(([panelKey, host]) => {
            host.innerHTML = '';
            const cardType = mobile ? getPanelCardType(panelKey) : DESKTOP_CARDS[panelKey];
            return CARD_TYPES[cardType].create(host);
        });
        getFrame(); // paint fresh cards from the current input state
    }
    rebuild();

    function getFrame() {
        const gamepad = gamepadAgent.getSelectedGamepad();

        const axes = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) {
            const gamepadAxis = gamepad?.axes[i] ?? 0;
            if (Math.abs(gamepadAxis) > GAMEPAD_DEADZONE) {
                pointerAxes[i] = 0; // gamepad takeover discards the held pointer value
                axes[i] = gamepadAxis;
            } else {
                axes[i] = pointerAxes[i];
            }
        }

        let buttons = 0;
        for (const card of cards) buttons |= card.heldButtons?.() ?? 0;
        if (gamepad) {
            const buttonCount = Math.min(gamepad.buttons.length, 16);
            for (let i = 0; i < buttonCount; i++) {
                if (gamepad.buttons[i]?.pressed) buttons |= (1 << i);
            }
        }

        for (const card of cards) card.update?.(axes, buttons);
        return { axes, buttons };
    }

    return { rebuild, getFrame };
}

function setupCardSelectors() {
    for (const panelKey of Object.keys(PANEL_DEFAULTS)) {
        const select = document.getElementById('select-' + panelKey);
        for (const [value, { label }] of Object.entries(CARD_TYPES)) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            select.appendChild(option);
        }
        select.value = getPanelCardType(panelKey);
        select.addEventListener('change', () => {
            localStorage.setItem(panelKey, select.value);
            cardPanels.rebuild();
        });
    }
}

function createJoystickCard(host, axisX, axisY) {
    host.insertAdjacentHTML('beforeend', `
        <div class="card joystick-card">
            <div class="card-label joystick-label-x">&minus;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Axis ${axisX}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+</div>
            <div class="card-label joystick-label-y">&minus;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Axis ${axisY}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+</div>
            <div class="joystick-background">
                <div class="joystick-container"><div class="joystick"></div></div>
            </div>
        </div>`);
    const container = host.querySelector('.joystick-container');
    const stick = host.querySelector('.joystick');
    const maxDiffScale = 0.5;

    let activePointer = null;
    let dragStart = null;

    function moveStick(xUnit, yUnit) {
        const maxDiff = container.offsetWidth * maxDiffScale;
        stick.style.transform = `translate3d(${xUnit * maxDiff}px, ${yUnit * maxDiff}px, 0px)`;
    }

    function writeAxes(xUnit, yUnit) {
        setPointerAxis(axisX, xUnit);
        setPointerAxis(axisY, yUnit);
        moveStick(xUnit, yUnit);
    }

    stick.addEventListener('pointerdown', (e) => {
        if (activePointer !== null) return;
        activePointer = e.pointerId;
        stick.setPointerCapture(e.pointerId);
        dragStart = { x: e.clientX, y: e.clientY };
    });

    stick.addEventListener('pointermove', (e) => {
        if (e.pointerId !== activePointer) return;
        const maxDiff = container.offsetWidth * maxDiffScale;
        const clampUnit = (d) => Math.max(-1, Math.min(1, d / maxDiff));
        writeAxes(clampUnit(e.clientX - dragStart.x), clampUnit(e.clientY - dragStart.y));
    });

    function release(e) {
        if (e.pointerId !== activePointer) return;
        activePointer = null;
        dragStart = null;
        writeAxes(0, 0); // spring back
    }
    stick.addEventListener('pointerup', release);
    stick.addEventListener('pointercancel', release);

    function update(axes) {
        if (activePointer === null) moveStick(axes[axisX], axes[axisY]);
    }

    return { update };
}

// Wires pointer handlers so each button holds its data-bit while pressed.
// The pressed class is set immediately for instant feedback, then kept in
// sync with the merged button state (pointer and gamepad) via update().
function bindMomentaryButtons(buttonElements) {
    const buttons = [...buttonElements].map(el => ({ el, bit: 1 << Number(el.dataset.bit) }));
    let mask = 0;
    for (const { el, bit } of buttons) {
        el.addEventListener('pointerdown', (e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            mask |= bit;
            el.classList.add('pressed');
        });
        const release = () => {
            mask &= ~bit;
            el.classList.remove('pressed');
        };
        el.addEventListener('pointerup', release);
        el.addEventListener('pointercancel', release);
    }

    function update(axes, buttonMask) {
        for (const { el, bit } of buttons) {
            el.classList.toggle('pressed', !!(buttonMask & bit));
        }
    }

    return { heldButtons: () => mask, update };
}

function createButtonsCard(host, firstBit) {
    host.insertAdjacentHTML('beforeend', `
        <div class="card buttons-card">
            <button data-bit="${firstBit + 3}" class="pos-top">${firstBit + 3}</button>
            <button data-bit="${firstBit + 2}" class="pos-left">${firstBit + 2}</button>
            <button data-bit="${firstBit + 1}" class="pos-right">${firstBit + 1}</button>
            <button data-bit="${firstBit}" class="pos-bottom">${firstBit}</button>
        </div>`);
    return bindMomentaryButtons(host.querySelectorAll('button'));
}

// Maps to the standard gamepad D-pad bits: 12 up, 13 down, 14 left, 15 right.
function createDpadCard(host) {
    host.insertAdjacentHTML('beforeend', `
        <div class="card dpad-card">
            <button data-bit="12" class="pos-top">▲<span class="dpad-num">12</span></button>
            <button data-bit="14" class="pos-left">◀<span class="dpad-num">14</span></button>
            <button data-bit="15" class="pos-right"><span class="dpad-num">15</span>▶</button>
            <button data-bit="13" class="pos-bottom"><span class="dpad-num">13</span>▼</button>
        </div>`);
    return bindMomentaryButtons(host.querySelectorAll('button'));
}

// Four vertical sliders, one per axis. They hold their position when
// released (no spring back). Top of the track is +1, bottom is -1.
function createSlidersCard(host) {
    host.insertAdjacentHTML('beforeend', `
        <div class="card sliders-card">
            ${[0, 1, 2, 3].map(i => `
            <div class="slider-column" data-axis="${i}">
                <div class="slider-track">
                    <div class="slider-center"></div>
                    <div class="slider-thumb">${i}</div>
                </div>
                <div class="slider-value">0.00</div>
            </div>`).join('')}
        </div>`);

    const sliders = [...host.querySelectorAll('.slider-column')].map(column => {
        const axis = Number(column.dataset.axis);
        const track = column.querySelector('.slider-track');
        const thumb = column.querySelector('.slider-thumb');
        const valueDisplay = column.querySelector('.slider-value');
        let activePointer = null;

        function display(value) {
            const frac = (1 - value) / 2;
            thumb.style.top = `${frac * 85}%`; // thumb is 15% tall, so travel spans 85%
            valueDisplay.textContent = value.toFixed(2);
        }

        function setFromPointer(e) {
            const rect = track.getBoundingClientRect();
            const frac = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
            const value = 1 - 2 * frac;
            setPointerAxis(axis, value);
            display(value);
        }

        track.addEventListener('pointerdown', (e) => {
            activePointer = e.pointerId;
            track.setPointerCapture(e.pointerId);
            setFromPointer(e);
        });
        track.addEventListener('pointermove', (e) => {
            if (e.pointerId === activePointer) setFromPointer(e);
        });
        const release = (e) => {
            if (e.pointerId === activePointer) activePointer = null;
        };
        track.addEventListener('pointerup', release);
        track.addEventListener('pointercancel', release);

        return { axis, display, isDragging: () => activePointer !== null };
    });

    function update(axes) {
        for (const slider of sliders) {
            if (!slider.isDragging()) slider.display(axes[slider.axis]);
        }
    }

    return { update };
}

// Read-only display of the four merged axis values (what gets sent).
function createGamepadAxesCard(host) {
    host.insertAdjacentHTML('beforeend', `
        <div class="card gamepad-axes-card">
            ${[0, 1, 2, 3].map(i => `
            <div class="slider-non">Axis ${i}</div>
            <div class="slider-non axis-value">0.00</div>
            <div class="slider-bar"></div>`).join('')}
        </div>`);
    const valueElements = host.querySelectorAll('.axis-value');
    const barElements = host.querySelectorAll('.slider-bar');

    function update(axes) {
        for (let i = 0; i < 4; i++) {
            valueElements[i].textContent = axes[i].toFixed(2);
            const percentage = Math.round((axes[i] + 1) * (100 / 2));
            barElements[i].style.background = `linear-gradient(to right, var(--alf-green) ${percentage}%, grey 0%)`;
        }
    }

    return { update };
}

// All 16 buttons in one grid; pressable, and lights up with the merged state.
function createGamepadButtonsCard(host) {
    host.insertAdjacentHTML('beforeend', `
        <div class="card gamepad-buttons-card">
            ${Array.from({ length: 16 }, (_, i) => `<button data-bit="${i}">${i}</button>`).join('')}
        </div>`);
    return bindMomentaryButtons(host.querySelectorAll('button'));
}

// -------------------------------------------- gamepad selection --------------------------------------- //

function createGamepadAgent() {
    let selectedGamepadIndex = 0;

    function getSelectedGamepad() {
        return navigator.getGamepads()[selectedGamepadIndex];
    }

    function setIndex(i) {
        selectedGamepadIndex = i;
    }

    function handleDisconnect(disconnectedIndex) {
        if (selectedGamepadIndex === disconnectedIndex) {
            const remaining = navigator.getGamepads().filter(g => g && g.index !== disconnectedIndex);
            selectedGamepadIndex = remaining.length > 0 ? remaining[0].index : 0;
        }
    }

    return { setIndex, handleDisconnect, getSelectedGamepad };
}

// -------------------------------------------- keyboard --------------------------------------- //

function createKeyboardAgent() {

    document.addEventListener('keydown', handleKeyboardInput);
    document.addEventListener('keyup', handleKeyboardInput);

    function handleKeyboardInput(event) {
        if (!event.repeat) keyEventQueue.push(event);
    }

    let keyEventQueue = [];
    let keyboardState = new Set();

    function getNumKeyboardState() {
        for (const event of keyEventQueue.splice(0)) {
            if (event.type === 'keydown') keyboardState.add(event.code);
            else keyboardState.delete(event.code);
        }
        return [...keyboardState].map(key => keyToNum[key]);
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
