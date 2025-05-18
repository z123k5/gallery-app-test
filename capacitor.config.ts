import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vod.gallery',
  appName: 'photo-gallery',
  webDir: 'dist',
  
  plugins: {
    Media: {
      androidGalleryMode: true
    },
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: true,
      iosKeychainPrefix: 'vue-sqlite-app-starter',
      iosBiometric: {
        biometricAuth: false,
        biometricTitle: "Biometric login for capacitor sqlite"
      },
      androidIsEncryption: true,
      androidBiometric: {
        biometricAuth: false,
        biometricTitle: "Biometric login for capacitor sqlite",
        biometricSubTitle: "Log in using your biometric"
      },
      electronIsEncryption: true,
      electronWindowsLocation: "C:\\ProgramData\\CapacitorDatabases",
      electronMacLocation: "/Volumes/Development_Lacie/Development/Databases",
      electronLinuxLocation: "Databases"
    },
    CapacitorHttp: {
      enabled: true,
    },
    CapacitorCookies: {
      enabled: true
    },
    capacitorGalleryEngine: {
      enabled: true
    },
  },
  server: {
    cleartext: true, // 如果需要使用 HTTP 请求
    allowNavigation: ['localhost', 'frp-dad.com', '172.20.10.5'] // 允许导航的域名
  }
};

export default config;
