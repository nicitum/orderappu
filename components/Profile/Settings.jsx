import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { useFontScale } from '../../App';
import PasswordChangeModal from './PasswordChangeModal';
import { jwtDecode } from 'jwt-decode';
import { ipAddress } from '../../services/urls';


// Define theme constants since theme file is missing
const Colors = {
  primary: '#003366',
  background: '#F3F4F6',
  surface: '#FFFFFF',
  text: {
    primary: '#111827',
    secondary: '#4B5563',
    tertiary: '#9CA3AF',
    light: '#FFFFFF',
  },
};

const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  '4xl': 64,
};

const BorderRadius = {
  lg: 12,
};

const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
};
const Settings = () => {
  const navigation = useNavigation();
  const { getScaledSize, fontSize: currentFontSize } = useFontScale();
 
  const [currentFontSettings, setCurrentFontSettings] = useState({
    scale: 1.0,
    weight: '400',
    family: 'system',
  });
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load font settings from AsyncStorage
      const fontScale = await AsyncStorage.getItem('font_scale');
      const fontWeight = await AsyncStorage.getItem('font_weight');
      const fontFamily = await AsyncStorage.getItem('font_family');
      
      setCurrentFontSettings({
        scale: fontScale ? parseFloat(fontScale) : 1.0,
        weight: fontWeight || '400',
        family: fontFamily || 'system',
      });

      // Load other settings
      const notificationsSetting = await AsyncStorage.getItem('notifications_enabled');
      const autoSyncSetting = await AsyncStorage.getItem('auto_sync_enabled');
      
      setNotifications(notificationsSetting !== 'false');
      setAutoSync(autoSyncSetting !== 'false');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const toggleNotifications = async (value) => {
    try {
      setNotifications(value);
      await AsyncStorage.setItem('notifications_enabled', value.toString());
      Toast.show({
        type: 'success',
        text1: 'Notifications Updated',
        text2: `Notifications ${value ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update notification settings',
      });
    }
  };

  const toggleAutoSync = async (value) => {
    try {
      setAutoSync(value);
      await AsyncStorage.setItem('auto_sync_enabled', value.toString());
      Toast.show({
        type: 'success',
        text1: 'Auto Sync Updated',
        text2: `Auto sync ${value ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update auto sync settings',
      });
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear app cache and temporary files. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              // Simulate cache clearing
              await new Promise(resolve => setTimeout(resolve, 2000));
              Toast.show({
                type: 'success',
                text1: 'Cache Cleared',
                text2: 'App cache has been cleared successfully',
              });
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to clear cache',
              });
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'Choose how you would like to contact support:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email',
          onPress: () => Linking.openURL('mailto:support@yourapp.com'),
        },
        {
          text: 'Phone',
          onPress: () => Linking.openURL('tel:+1234567890'),
        },
      ]
    );
  };

  const handlePasswordChange = () => {
    setPasswordModalVisible(true);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get the token before removing it
              const token = await AsyncStorage.getItem("userAuthToken");
              
              if (token) {
                try {
                  // Decode token to get customer_id
                  const decodedToken = jwtDecode(token);
                  const customer_id = decodedToken.id;
                  
                  if (customer_id) {
                    // Call logout API to clear user_token from database
                    const response = await fetch(`http://${ipAddress}:8091/logout`, {
                      method: "POST",
                      headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        customer_id: customer_id,
                      }),
                    });
                    
                    if (!response.ok) {
                      console.warn("Logout API failed:", response.status);
                      // Continue with local logout even if API fails
                    } else {
                      const data = await response.json();
                      console.log("Logout API success:", data.message);
                    }
                  }
                } catch (apiError) {
                  console.warn("Error calling logout API:", apiError);
                  // Continue with local logout even if API fails
                }
              }
              
              // Remove the token from AsyncStorage
              await AsyncStorage.removeItem("userAuthToken");

              // Navigate to Login screen after logout
              navigation.replace("Login"); // This ensures that the user cannot go back to the previous screen
            } catch (error) {
              console.error("Error during logout:", error);
              // Even if there's an error, try to navigate to login
              navigation.replace("Login");
            }
          },
        },
      ]
    );
  };

  const renderSettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    rightComponent, 
    showArrow = true,
    disabled = false 
  }) => (
    <TouchableOpacity
      style={[styles.settingItem, disabled && styles.settingItemDisabled]}
      onPress={onPress}
      disabled={disabled || isLoading}
    >
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>
          <Icon name={icon} size={24} color={Colors.primary} />
        </View>
        <View style={styles.settingContent}>
          <Text style={[styles.settingTitle, { fontSize: getScaledSize(16) }]}>{title}</Text>
          {subtitle && <Text style={[styles.settingSubtitle, { fontSize: getScaledSize(14) }]}>{subtitle}</Text>}
        </View>
      </View>
      
      <View style={styles.settingRight}>
        {rightComponent}
        {showArrow && !rightComponent && (
          <Icon name="chevron-right" size={24} color={Colors.text.tertiary} />
        )}
      </View>
    </TouchableOpacity>
  );


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={Colors.text.light} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: getScaledSize(20) }]}>Settings</Text>
          <View style={styles.headerRight} />
        </View>

        {/* User Profile Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: getScaledSize(16) }]}>Account</Text>
          {renderSettingItem({
            icon: 'person',
            title: 'Profile',
            subtitle: 'Manage your account information',
            onPress: () => navigation.navigate('Profile'),
          })}
          {renderSettingItem({
            icon: 'lock',
            title: 'Change Password',
            subtitle: 'Update your account password',
            onPress: handlePasswordChange,
          })}
          {renderSettingItem({
            icon: 'logout',
            title: 'Logout',
            subtitle: 'Sign out of your account',
            onPress: handleLogout,
          })}
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: getScaledSize(16) }]}>Appearance</Text>
          {renderSettingItem({
            icon: 'font-download',
            title: 'Font Settings',
            subtitle: `Current: ${currentFontSize.charAt(0).toUpperCase() + currentFontSize.slice(1)}`,
            onPress: () => navigation.navigate('FontSettings'),
          })}
          {renderSettingItem({
            icon: 'palette',
            title: 'Theme',
            subtitle: 'Light theme (Coming soon)',
            onPress: () => {
              Toast.show({
                type: 'info',
                text1: 'Coming Soon',
                text2: 'Theme selection will be available in future updates',
              });
            },
            disabled: true,
          })}
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: getScaledSize(16) }]}>Preferences</Text>
          {renderSettingItem({
            icon: 'notifications',
            title: 'Notifications',
            subtitle: 'Receive order updates and alerts',
            rightComponent: (
              <Switch
                value={notifications}
                onValueChange={toggleNotifications}
                trackColor={{ false: '#D1D5DB', true: Colors.primary }}
                thumbColor={notifications ? '#FFFFFF' : '#9CA3AF'}
              />
            ),
            showArrow: false,
            onPress: () => toggleNotifications(!notifications),
          })}
          {renderSettingItem({
            icon: 'sync',
            title: 'Auto Sync',
            subtitle: 'Automatically sync data when connected',
            rightComponent: (
              <Switch
                value={autoSync}
                onValueChange={toggleAutoSync}
                trackColor={{ false: '#D1D5DB', true: Colors.primary }}
                thumbColor={autoSync ? '#FFFFFF' : '#9CA3AF'}
              />
            ),
            showArrow: false,
            onPress: () => toggleAutoSync(!autoSync),
          })}
        </View>

        {/* Data & Storage Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: getScaledSize(16) }]}>Data & Storage</Text>
          {renderSettingItem({
            icon: 'storage',
            title: 'Clear Cache',
            subtitle: 'Free up storage space',
            onPress: handleClearCache,
          })}
          {renderSettingItem({
            icon: 'backup',
            title: 'Backup & Restore',
            subtitle: 'Manage your data backup',
            onPress: () => {
              Toast.show({
                type: 'info',
                text1: 'Coming Soon',
                text2: 'Backup feature will be available soon',
              });
            },
          })}
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: getScaledSize(16) }]}>Support</Text>
          {renderSettingItem({
            icon: 'help',
            title: 'Help & FAQ',
            subtitle: 'Find answers to common questions',
            onPress: () => navigation.navigate('Help'),
          })}
          {renderSettingItem({
            icon: 'contact-support',
            title: 'Contact Support',
            subtitle: 'Get help from our support team',
            onPress: handleContactSupport,
          })}
          {renderSettingItem({
            icon: 'info',
            title: 'About',
            subtitle: 'App version and information',
            onPress: () => navigation.navigate('About'),
          })}
        </View>

        {/* App Information */}
        <View style={styles.appInfo}>
          <Text style={[styles.appVersion, { fontSize: getScaledSize(14) }]}>Version 1.0.0</Text>
          <Text style={[styles.appCopyright, { fontSize: getScaledSize(12) }]}>© 2025 OrderAppu. All rights reserved.</Text>
        </View>

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
      
      <PasswordChangeModal
        isVisible={isPasswordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    ...Shadows.md,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    fontWeight: '600',
    color: Colors.text.light,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40, // Balance the header
  },
  section: {
    paddingVertical: Spacing.md,
  },
  sectionTitle: {
    fontWeight: '600',
    color: Colors.text.secondary,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  settingItemDisabled: {
    opacity: 0.6,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Spacing.xs / 2,
  },
  settingSubtitle: {
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  appVersion: {
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  appCopyright: {
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
});

export default Settings;