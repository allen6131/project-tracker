# AmpTrack Mobile App

A React Native mobile application built with Expo for AmpTrack - a project management system for electrical contractors.

## 🚀 Features

- **Authentication**: Secure login with JWT tokens
- **Project Management**: View and manage electrical projects
- **Customer Management**: Access customer information and contacts
- **Estimates**: Create and track project estimates
- **Invoices**: Manage billing and payment status
- **File Management**: Upload and download project files
- **Real-time Updates**: Pull-to-refresh functionality
- **iPad Optimized**: Responsive design for iPad use

## 📱 Screenshots

The app includes the following main screens:
- Dashboard with project statistics
- Projects list and detail views
- Customer management
- Estimates with status filtering
- Invoices with payment tracking
- File management with project organization

## 🛠️ Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npx expo start
   ```

4. Run on your device:
   - **iOS**: Press `i` to open in iOS Simulator
   - **Android**: Press `a` to open in Android Emulator
   - **Device**: Scan the QR code with Expo Go app

## 🔧 Configuration

### Backend Connection

The app connects to your AmpTrack backend server. Update the API base URL in `src/services/api.ts`:

```typescript
const API_BASE_URL = 'http://your-backend-url.com/api';
```

For local development, use:
- iOS Simulator: `http://localhost:3000/api`
- Android Emulator: `http://10.0.2.2:3000/api`
- Physical Device: `http://YOUR_COMPUTER_IP:3000/api`

## 📂 Project Structure

```
mobile/
├── src/
│   ├── contexts/          # React contexts (Auth)
│   ├── navigation/        # Navigation configuration
│   ├── screens/           # App screens
│   ├── services/          # API services
│   └── types/             # TypeScript types
├── App.tsx               # Main app component
├── package.json          # Dependencies
└── app.json             # Expo configuration
```

## 🎨 UI/UX

The app features:
- **Modern Design**: Clean, professional interface
- **Responsive Layout**: Optimized for both phone and tablet
- **iPad Support**: Enhanced for iPad usage
- **Consistent Branding**: Matches the web application
- **Intuitive Navigation**: Bottom tab navigation with icons

## 🔐 Authentication

The app uses JWT token authentication:
- Tokens are stored securely in AsyncStorage
- Automatic token refresh on API calls
- Secure logout functionality
- Protected routes for authenticated users

## 📡 API Integration

The app integrates with the AmpTrack backend API:
- **Projects**: CRUD operations for projects
- **Customers**: Customer management
- **Estimates**: Estimate creation and tracking
- **Invoices**: Invoice management and payments
- **Files**: File upload and download
- **Users**: User authentication and management

## 🚦 Development

### Running in Development

```bash
# Start development server
npx expo start

# Run on iOS
npx expo run:ios

# Run on Android
npx expo run:android
```

### Building for Production

```bash
# Build for iOS
npx expo build:ios

# Build for Android
npx expo build:android
```

## 📱 Supported Platforms

- iOS 12.0+
- Android 6.0+ (API level 23+)
- iPad (optimized)

## 🔄 State Management

The app uses React Context for state management:
- **AuthContext**: User authentication state
- **Local State**: Component-level state with hooks
- **AsyncStorage**: Persistent storage for tokens

## 🎯 Future Enhancements

- Push notifications for project updates
- Offline data synchronization
- Advanced filtering and search
- Photo capture for project documentation
- GPS location tracking for projects
- Digital signature for estimates

## 📝 License

This project is part of the AmpTrack system. All rights reserved.

---

For more information about the AmpTrack system, see the main project README. 