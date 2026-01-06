type NavigationApp = "default" | "google_maps" | "waze" | "apple_maps";

interface NavigationOptions {
  destinationLat: number;
  destinationLng: number;
  destinationAddress?: string;
  preference?: NavigationApp;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

export function openNavigation(options: NavigationOptions): void {
  const { destinationLat, destinationLng, destinationAddress, preference = "default" } = options;
  const encodedAddress = destinationAddress ? encodeURIComponent(destinationAddress) : "";
  
  let url: string;
  
  switch (preference) {
    case "google_maps":
      url = `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}`;
      break;
      
    case "waze":
      url = `https://waze.com/ul?ll=${destinationLat},${destinationLng}&navigate=yes`;
      break;
      
    case "apple_maps":
      url = `maps://maps.apple.com/?daddr=${destinationLat},${destinationLng}`;
      break;
      
    case "default":
    default:
      if (isIOS()) {
        url = `maps://maps.apple.com/?daddr=${destinationLat},${destinationLng}`;
      } else if (isAndroid()) {
        url = `geo:${destinationLat},${destinationLng}?q=${destinationLat},${destinationLng}`;
      } else {
        url = `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}`;
      }
      break;
  }
  
  window.open(url, "_blank");
}

export function getNavigationAppName(preference: NavigationApp): string {
  switch (preference) {
    case "google_maps": return "Google Maps";
    case "waze": return "Waze";
    case "apple_maps": return "Apple Maps";
    case "default": return "Default Maps App";
    default: return "Maps";
  }
}
