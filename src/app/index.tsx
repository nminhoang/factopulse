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
import { Button, Field, Icon } from '../ui/kit';
import { colors } from '../ui/theme';

export default function LoginScreen() {
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

    router.replace('/dashboard');
  }

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
          <Text
            style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 }}
          >
            Sign in
          </Text>

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
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            onSubmitEditing={signIn}
            returnKeyType="go"
          />

          <Button
            title="Log in"
            variant="accent"
            loading={loading}
            disabled={!email.trim() || !password}
            onPress={signIn}
            style={{ marginTop: 6 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
