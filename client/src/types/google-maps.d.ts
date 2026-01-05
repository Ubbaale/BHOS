declare namespace google {
  namespace maps {
    function importLibrary(library: string): Promise<any>;
    
    interface LatLng {
      lat(): number;
      lng(): number;
    }
    
    namespace places {
      class Autocomplete {
        constructor(input: HTMLInputElement, options?: AutocompleteOptions);
        addListener(event: string, handler: () => void): void;
        getPlace(): PlaceResult;
      }
      
      interface AutocompleteOptions {
        componentRestrictions?: {
          country: string | string[];
        };
        fields?: string[];
        types?: string[];
      }
      
      interface PlaceResult {
        formatted_address?: string;
        name?: string;
        geometry?: {
          location?: LatLng;
        };
      }
      
      class PlaceAutocompleteElement extends HTMLElement {
        constructor(options?: PlaceAutocompleteElementOptions);
        style: CSSStyleDeclaration;
        addEventListener(type: string, listener: (event: any) => void): void;
      }
      
      interface PlaceAutocompleteElementOptions {
        componentRestrictions?: {
          country: string | string[];
        };
        types?: string[];
      }
    }
  }
}

interface Window {
  google?: typeof google;
}
