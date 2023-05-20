declare module 'fred-copy-paste' {
  export function copy(text: string, callback?: (err: Error) => void): void;
  export function paste(callback: (err: Error, content: string) => void): void;
}
