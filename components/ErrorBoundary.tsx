import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS, RADIUS, SPACING } from '@/constants/theme';
import { logger } from '@/lib/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('ErrorBoundary caught unhandled render error', {
      error: error.message,
      stack: error.stack?.slice(0, 500),
      componentStack: info.componentStack?.slice(0, 500),
    });
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <View style={styles.container}>
        <View style={styles.icon} />
        <View style={styles.textBlock}>
          <Text style={styles.title}>Une erreur est survenue</Text>
          <Text style={styles.subtitle}>
            {this.state.error?.message ?? 'Erreur inattendue. Veuillez réessayer.'}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
          onPress={this.reset}
          accessibilityRole="button"
          accessibilityLabel="Réessayer"
        >
          <Text style={styles.btnLabel}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }
}

// Hardcoded colors — intentional: the boundary must render even when the theme
// system or font loader is itself part of what crashed.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e0c0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#C82828',
  },
  textBlock: { alignItems: 'center', gap: SPACING.sm },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: '#f0ece8',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: SPACING.sm,
    backgroundColor: '#C82828',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  btnLabel: {
    fontFamily: FONTS.heading,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.5,
  },
});
