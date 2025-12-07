export default {
  expo: {
    name: "HailO",
    slug: "hailo",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/android-chrome-512x512.png",
    scheme: "hailo",
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier: "com.hailo.app"
    },
    android: {
      package: "com.hailo.app",
      adaptiveIcon: {
        foregroundImage: "./assets/images/android-chrome-512x512.png",
        backgroundColor: "#FFFFFF"
      }
    },
    plugins: [
      "expo-router"
    ],
    extra: {
      EXPO_PUBLIC_BACKEND_URL: "http://localhost:3001",
      eas: {
        projectId: "d9862b3a-8792-43f1-b86f-38538a3aaf9f"
      }
    }
  }
};
