export interface FileInputState {
  file: File | null;
  previewUrl: string | null;
  base64: string | null;
}

export enum AppStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

// Extend the AIStudio interface. 
// The 'aistudio' property is already defined on the Window interface with type 'AIStudio', 
// so we augment the AIStudio interface directly to include the required methods.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}