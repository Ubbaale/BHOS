declare namespace google {
  namespace maps {
    function importLibrary(library: string): Promise<any>;
    
    namespace places {
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
