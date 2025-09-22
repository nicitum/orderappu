import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { useFontScale } from '../../App';

// Define theme constants
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
  accent: '#10B981',
};

const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
};

const BorderRadius = {
  lg: 12,
  xl: 16,
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

const FontSettings = () => {
  const navigation = useNavigation();
  const { fontSize, fontScales, updateFontSize, getScaledSize } = useFontScale();
  const [selectedFont, setSelectedFont] = useState(fontSize);

  const fontOptions = [
    {
      key: 'small',
      label: 'Small',
      description: 'Compact text for more content',
      scale: fontScales.small,
    },
    {
      key: 'medium',
      label: 'Medium',
      description: 'Default size, comfortable reading',
      scale: fontScales.medium,
    },
    {
      key: 'large',
      label: 'Large',
      description: 'Easier to read, more comfortable',
      scale: fontScales.large,
    },
    {
      key: 'extra-large',
      label: 'Extra Large',
      description: 'Maximum readability',
      scale: fontScales['extra-large'],
    },
  ];

  const handleFontSizeChange = async (fontSizeKey) => {
    try {
      setSelectedFont(fontSizeKey);
      await updateFontSize(fontSizeKey);
      
      Toast.show({
        type: 'success',
        text1: 'Font Size Updated',
        text2: `Font size changed to ${fontOptions.find(f => f.key === fontSizeKey)?.label}`,
        position: 'bottom',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update font size',
        position: 'bottom',
      });
    }
  };

  const resetToDefault = () => {
    Alert.alert(
      'Reset Font Size',
      'Reset font size to default (Medium)?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => handleFontSizeChange('medium'),
        },
      ]
    );
  };

  const renderFontOption = (option) => {
    const isSelected = selectedFont === option.key;
    
    return (
      <TouchableOpacity
        key={option.key}
        style={[
          styles.fontOption,
          isSelected && styles.fontOptionSelected,
        ]}
        onPress={() => handleFontSizeChange(option.key)}
      >
        <View style={styles.fontOptionContent}>
          <View style={styles.fontOptionHeader}>
            <Text
              style={[
                styles.fontOptionLabel,
                { fontSize: getScaledSize(16) },
                isSelected && styles.fontOptionLabelSelected,
              ]}
            >
              {option.label}
            </Text>
            {isSelected && (
              <Icon 
                name="check-circle" 
                size={24} 
                color={Colors.accent} 
              />
            )}
          </View>
          
          <Text
            style={[
              styles.fontOptionDescription,
              { fontSize: getScaledSize(14) },
              isSelected && styles.fontOptionDescriptionSelected,
            ]}
          >
            {option.description}
          </Text>
          
          {/* Preview text */}
          <View style={styles.previewContainer}>
            <Text
              style={[
                styles.previewText,
                { 
                  fontSize: Math.round(16 * option.scale),
                },
                isSelected && styles.previewTextSelected,
              ]}
            >
              Sample text preview
            </Text>
            <Text
              style={[
                styles.previewSubtext,
                { 
                  fontSize: Math.round(14 * option.scale),
                },
                isSelected && styles.previewSubtextSelected,
              ]}
            >
              Scale: {option.scale}x
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
          <Text style={[styles.headerTitle, { fontSize: getScaledSize(20) }]}>
            Font Settings
          </Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetToDefault}
          >
            <Icon name="refresh" size={24} color={Colors.text.light} />
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={[styles.instructionsTitle, { fontSize: getScaledSize(18) }]}>
            Choose Your Font Size
          </Text>
          <Text style={[styles.instructionsText, { fontSize: getScaledSize(14) }]}>
            Select a font size that's comfortable for you. Changes will be applied 
            throughout the entire app immediately.
          </Text>
        </View>

        {/* Font Options */}
        <View style={styles.optionsContainer}>
          {fontOptions.map(renderFontOption)}
        </View>

        {/* Current Selection Info */}
        <View style={styles.currentSelectionContainer}>
          <Text style={[styles.currentSelectionTitle, { fontSize: getScaledSize(16) }]}>
            Current Selection
          </Text>
          <View style={styles.currentSelectionContent}>
            <Text style={[styles.currentSelectionLabel, { fontSize: getScaledSize(18) }]}>
              {fontOptions.find(f => f.key === selectedFont)?.label}
            </Text>
            <Text style={[styles.currentSelectionScale, { fontSize: getScaledSize(14) }]}>
              Scale: {fontScales[selectedFont]}x
            </Text>
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsContainer}>
          <View style={styles.tipItem}>
            <Icon name="lightbulb-outline" size={20} color={Colors.accent} />
            <Text style={[styles.tipText, { fontSize: getScaledSize(14) }]}>
              Font changes apply instantly across all app screens
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Icon name="save-alt" size={20} color={Colors.accent} />
            <Text style={[styles.tipText, { fontSize: getScaledSize(14) }]}>
              Your font preference is automatically saved
            </Text>
          </View>
        </View>

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  resetButton: {
    padding: Spacing.sm,
  },
  instructionsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  instructionsTitle: {
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  instructionsText: {
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  optionsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  fontOption: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadows.sm,
  },
  fontOptionSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '08',
  },
  fontOptionContent: {
    padding: Spacing.lg,
  },
  fontOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  fontOptionLabel: {
    fontWeight: '600',
    color: Colors.text.primary,
  },
  fontOptionLabelSelected: {
    color: Colors.accent,
  },
  fontOptionDescription: {
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  fontOptionDescriptionSelected: {
    color: Colors.text.primary,
  },
  previewContainer: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.text.tertiary,
  },
  previewText: {
    color: Colors.text.primary,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  previewTextSelected: {
    color: Colors.accent,
  },
  previewSubtext: {
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  previewSubtextSelected: {
    color: Colors.text.primary,
  },
  currentSelectionContainer: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  currentSelectionTitle: {
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  currentSelectionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentSelectionLabel: {
    fontWeight: '600',
    color: Colors.accent,
  },
  currentSelectionScale: {
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  tipsContainer: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  tipText: {
    flex: 1,
    marginLeft: Spacing.md,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
});

export default FontSettings;