import fs from 'fs';
import os from 'os';
import path from 'path'; 
import isDev from 'electron-is-dev';

/**
 * Gets optimal agent binary path for maximum performance
 * On macOS: extracts binary from app bundle to avoid Gatekeeper overhead
 * On Windows: uses bundled binary directly (no performance issues)
 */
function getOptimalAgentBinary() {
  const isWindows = process.platform === 'win32';

  if (isDev) {
    return isWindows ? './aiagent/build/Release/agent.exe' : './aiagent/build/agent';
  }

  const isMac = process.platform === 'darwin';
  const binaryName = isWindows ? 'agent.exe' : 'agent';
  const bundledBinaryPath = path.join(process.resourcesPath, binaryName);
  
  // Windows works fine with bundled binary - no extraction needed
  if (isWindows) {
    return path.join(process.resourcesPath, binaryName);
  } else if (isMac) {
    return path.join(process.resourcesPath, 'agent', binaryName);
  } else {
    return path.join(process.resourcesPath, 'agent', binaryName);
  }
  
  // // macOS needs extraction to avoid Gatekeeper verification overhead
  // if (isMac) {
  //   const tempDir = path.join(os.tmpdir(), 'neuralagent');
  //   const extractedBinaryPath = path.join(tempDir, binaryName);
  //   try {
  //     // Ensure temp directory exists
  //     if (!fs.existsSync(tempDir)) {
  //       fs.mkdirSync(tempDir, { recursive: true });
  //     }
      
  //     // Check if bundled binary exists
  //     if (!fs.existsSync(bundledBinaryPath)) {
  //       console.error(`[Binary Extractor] Bundled binary not found: ${bundledBinaryPath}`);
  //       return bundledBinaryPath; // Fallback
  //     }
      
  //     const bundledStats = fs.statSync(bundledBinaryPath);
  //     let shouldExtract = false;
      
  //     if (!fs.existsSync(extractedBinaryPath)) {
  //       // Binary doesn't exist, extract it
  //       shouldExtract = true;
  //       console.log('[Binary Extractor] Binary not found in temp, extracting...');
  //     } else {
  //       // Check if bundled version is newer
  //       const extractedStats = fs.statSync(extractedBinaryPath);
  //       if (bundledStats.mtime > extractedStats.mtime) {
  //         shouldExtract = true;
  //         console.log('[Binary Extractor] Bundled binary is newer, updating...');
  //       }
        
  //       // Verify integrity with file size comparison
  //       if (bundledStats.size !== extractedStats.size) {
  //         shouldExtract = true;
  //         console.log('[Binary Extractor] Binary size mismatch, re-extracting...');
  //       }
  //     }
      
  //     if (shouldExtract) {
  //       console.log(`[Binary Extractor] Extracting ${binaryName} for optimal performance...`);
        
  //       // Copy binary
  //       fs.copyFileSync(bundledBinaryPath, extractedBinaryPath);
        
  //       // Set executable permissions
  //       fs.chmodSync(extractedBinaryPath, 0o755);
        
  //       // Verify extraction
  //       const newStats = fs.statSync(extractedBinaryPath);
  //       if (newStats.size !== bundledStats.size) {
  //         throw new Error('Binary extraction verification failed');
  //       }
        
  //       console.log(`[Binary Extractor] Successfully extracted to: ${extractedBinaryPath}`);
  //     } else {
  //       console.log('[Binary Extractor] Using existing extracted binary');
  //     }
      
  //     return extractedBinaryPath;
      
  //   } catch (error) {
  //     console.error('[Binary Extractor] Extraction failed, using bundled binary:', error);
  //     return bundledBinaryPath; // Safe fallback
  //   }
  // }
  
  // // For other platforms, use bundled binary
  // return bundledBinaryPath;
}

// Cleanup function for app shutdown (macOS only)
function cleanupExtractedBinary() {
  if (isDev || process.platform !== 'darwin') return;
  
  try {
    const tempDir = path.join(os.tmpdir(), 'neuralagent');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('[Binary Extractor] Cleaned up temporary files');
    }
  } catch (error) {
    console.error('[Binary Extractor] Cleanup failed:', error);
  }
}

export { getOptimalAgentBinary, cleanupExtractedBinary };
