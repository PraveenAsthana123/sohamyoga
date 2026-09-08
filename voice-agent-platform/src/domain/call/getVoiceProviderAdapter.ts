import { VoiceProviderAdapter } from './VoiceProviderAdapter';
import { VapiCallAdapter } from './VapiCallAdapter';
import { NotConfiguredVoiceProvider } from './NotConfiguredVoiceProvider';

/** Resolves the active adapter -- VapiCallAdapter if configured, else the
 * fail-closed default. Update this the day another provider is added. */
export function getVoiceProviderAdapter(): VoiceProviderAdapter {
  const vapi = new VapiCallAdapter();
  return vapi.isConfigured() ? vapi : new NotConfiguredVoiceProvider();
}
