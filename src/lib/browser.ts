export function browserSupport() {
  const ua = navigator.userAgent
  const ios =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return {
    ios,
    secure: window.isSecureContext,
    bluetooth: 'bluetooth' in navigator,
    serial: 'serial' in navigator,
  }
}
