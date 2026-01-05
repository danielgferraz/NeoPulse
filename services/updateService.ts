export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  downloadUrl: string;
}

const GITHUB_USER = 'danielgferraz';
const GITHUB_REPO = 'NeoPulse';

// Helper simples para comparar versões semânticas (x.y.z)
const isNewerVersion = (current: string, latest: string): boolean => {
  const v1 = current.replace(/^v/, '').split('.').map(Number);
  const v2 = latest.replace(/^v/, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;
    if (num2 > num1) return true;
    if (num1 > num2) return false;
  }
  return false;
};

export const checkForUpdates = async (currentVersion: string): Promise<UpdateInfo> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases/latest`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
        throw new Error('Falha ao verificar atualizações');
    }

    const data = await response.json();
    const latestVersion = data.tag_name; // Ex: "v1.0.1"
    
    // Encontrar o asset correto (APK) ou usar o html_url
    const downloadUrl = data.assets?.find((a: any) => a.name.endsWith('.apk'))?.browser_download_url || data.html_url;

    const hasUpdate = isNewerVersion(currentVersion, latestVersion);

    return {
      hasUpdate,
      latestVersion,
      downloadUrl
    };
  } catch (error) {
    console.warn("Update check failed (offline?):", error);
    return { hasUpdate: false, latestVersion: currentVersion, downloadUrl: '' };
  }
};
