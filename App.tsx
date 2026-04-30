import React, { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/context/ThemeContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { migrateGroups } from './src/utils/migrateGroups';
import { cleanupExpiredEvents } from './src/utils/cleanupExpiredEvents';
import { AsyncStorageFriendRepository } from './src/repository/AsyncStorageFriendRepository';

const friendRepo = new AsyncStorageFriendRepository();

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([migrateGroups(), cleanupExpiredEvents(friendRepo)]).finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <HomeScreen />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
