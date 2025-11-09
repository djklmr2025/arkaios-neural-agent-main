// macos-permissions.js
import { app, shell, systemPreferences, desktopCapturer } from 'electron';

class MacOSPermissions {
  constructor() {
    this.permissionChecks = {
      screenRecording: this.checkScreenRecording.bind(this),
      accessibility: this.checkAccessibility.bind(this),
      // App Management removed - we'll just inform users about it
    };
  }

  /**
   * Check Screen Recording permission
   */
  async checkScreenRecording() {
    if (process.platform !== 'darwin') return true;
    
    try {
      const status = systemPreferences.getMediaAccessStatus('screen');
      return status === 'granted';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check Accessibility permission
   */
  async checkAccessibility() {
    if (process.platform !== 'darwin') return true;
    
    return systemPreferences.isTrustedAccessibilityClient(false);
  }

  /**
   * Request Screen Recording permission
   */
  async requestScreenRecording() {
    if (process.platform !== 'darwin') return true;
    
    try {
      await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1280, height: 720 }
      });
      
      return await this.checkScreenRecording();
    } catch (error) {
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
      return false;
    }
  }

  /**
   * Request Accessibility permission
   */
  async requestAccessibility() {
    if (process.platform !== 'darwin') return true;
    
    systemPreferences.isTrustedAccessibilityClient(true);
    await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
    
    return false;
  }

  /**
   * Open App Management settings - no permission check, just direct user there
   */
  async openAppManagementSettings() {
    if (process.platform !== 'darwin') return;
    
    await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AppManagement');
  }

  /**
   * Check only the reliable permissions
   */
  async checkAllPermissions() {
    if (process.platform !== 'darwin') {
      return { allGranted: true, missing: [], results: {} };
    }
    
    const results = {
      screenRecording: await this.checkScreenRecording(),
      accessibility: await this.checkAccessibility(),
      // App Management is not checked - we'll handle it differently in UI
    };

    const missing = Object.keys(results).filter(key => !results[key]);
    
    return {
      allGranted: missing.length === 0,
      missing,
      results
    };
  }

  /**
   * Open System Preferences to specific permission section
   */
  async openSystemPreferences(permission) {
    const urls = {
      accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
      screenRecording: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
      appManagement: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AppManagement'
    };

    if (urls[permission]) {
      await shell.openExternal(urls[permission]);
    }
  }
}

export default MacOSPermissions;