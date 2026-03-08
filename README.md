# 📱 Device Manager — Multi-Device Control System

A complete system to remotely manage photos and messages across multiple mobile devices from a single web-based admin panel.

## Architecture

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Mobile App  │────▶│  Backend Server  │◀────│   Admin Panel    │
│  (React      │     │  (Node.js +     │     │   (React +       │
│   Native)    │     │   Socket.IO)    │     │    Vite)         │
└──────────────┘     └─────────────────┘     └──────────────────┘
       📱                   🖥️                       🌐
  Camera + SMS          MongoDB DB              Dark Theme UI
  Photo Upload          REST API                Device Control
  Auto-Sync             Real-time               Photo Gallery
                                                Message Viewer
```

## Quick Start

### Prerequisites
- **Node.js** v18+
- **MongoDB** running locally on `mongodb://localhost:27017`
- **Expo CLI** (for mobile app): `npm install -g expo-cli`

### 1. Start Backend Server
```bash
cd backend
npm install
npm run seed    # Creates admin account + sample devices
npm run dev     # Starts server on localhost:5000
```

**Default admin login:**
- Email: `admin@devicemanager.com`
- Password: `admin123`

### 2. Start Admin Panel
```bash
cd admin-panel
npm install
npm run dev     # Opens on localhost:5173
```

### 3. Start Mobile App
```bash
cd mobile-app
npm install
npx expo start  # Scan QR with Expo Go app
```

> **Important:** In `mobile-app/App.js`, change `SERVER_URL` to your computer's local IP:
> ```js
> const SERVER_URL = 'http://YOUR_LOCAL_IP:5000';
> ```
> Find your IP with: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

## Features

### Admin Panel
- 📊 **Dashboard** — Device count, online status, photos, messages stats
- 📱 **Device Management** — View all devices, online/offline status, battery
- 📸 **Photo Gallery** — Browse all photos with device filter, lightbox, delete
- 💬 **Message Viewer** — Search messages, conversation threads, device filter
- 🎮 **Remote Commands** — Send "Capture Photo" or "Sync Messages" to any online device
- ⚡ **Real-time Updates** — Live device status and activity feed via Socket.IO

### Mobile App
- 📷 **Camera Capture** — Takes photos on command from admin panel
- 💬 **SMS Sync** — Reads and syncs SMS messages (Android only)
- 🔄 **Auto-reconnect** — Maintains persistent connection to server
- 📋 **Activity Log** — Shows all commands received and actions taken

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| POST | `/api/devices/register` | Register new device |
| GET | `/api/devices` | List all devices |
| POST | `/api/photos/upload` | Upload photo from device |
| GET | `/api/photos` | List photos (paginated) |
| POST | `/api/messages/sync` | Sync messages from device |
| GET | `/api/messages` | List messages (paginated) |
| POST | `/api/commands/:deviceId` | Send command to device |
| GET | `/api/dashboard` | Dashboard statistics |

## Tech Stack
- **Backend:** Node.js, Express, MongoDB, Socket.IO, JWT
- **Admin Panel:** React, Vite, Socket.IO Client, Axios
- **Mobile App:** React Native, Expo, expo-camera

## Security Notes
- JWT tokens for admin and device authentication
- SMS reading is **Android only** (iOS restriction)
- Designed for **personal/enterprise use** (sideloading)
- Change `JWT_SECRET` in `.env` for production
