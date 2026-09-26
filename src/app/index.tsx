import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Button, Field, Icon, Segmented } from '../ui/kit';
import { colors } from '../ui/theme';

export default function LoginScreen() {
  const [mode, setMode] = useState<'Sign in' | 'Create account'>('Sign in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Login failed', error.message);
      return;
    }

    // The root layout checks whether this account belongs to a company
    // yet and sends it to the right place (dashboard, or set up a company).
    router.replace('/dashboard');
  }

  async function signUp() {
    if (password.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Could not create account', error.message);
      return;
    }

    if (data.session) {
      // No email confirmation required: continue straight to setting up
      // a company.
      router.replace('/setup-company');
      return;
    }

    Alert.alert(
      'Check your email',
      "We sent a confirmation link to " + email.trim() + ". Confirm it, then come back and sign in."
    );
    setMode('Sign in');
  }

  const busy = loading;
  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Icon name="wrench" size={40} color="#FFFFFF" />
          </View>
          <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '800' }}>
            InnoCon Maintenance
          </Text>
          <Text style={{ color: colors.headerSub, fontSize: 15, marginTop: 6 }}>
            Track machines. Cut downtime. Decide with data.
          </Text>
        </View>

        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            padding: 20,
          }}
        >
          <Segmented
            label=" "
            value={mode}
            onChange={(v) => setMode(v as 'Sign in' | 'Create account')}
            options={[
              { value: 'Sign in', tone: 'info' },
              { value: 'Create account', tone: 'good' },
            ]}
          />

          <Field
            label="Email"
            icon="mail"
            placeholder="you@company.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />

          <Field
            label="Password"
            icon="lock"
            placeholder={mode === 'Create account' ? 'At least 6 characters' : 'Your password'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType={mode === 'Create account' ? 'newPassword' : 'password'}
            onSubmitEditing={mode === 'Sign in' ? signIn : signUp}
            returnKeyType="go"
          />

          <Button
            title={mode === 'Sign in' ? 'Log in' : 'Create account'}
            variant="accent"
            loading={busy}
            disabled={!canSubmit}
            onPress={mode === 'Sign in' ? signIn : signUp}
            style={{ marginTop: 6 }}
          />

          {mode === 'Create account' ? (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10, textAlign: 'center' }}>
              Next you'll create a new company, or join one with an invite code from a teammate.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
